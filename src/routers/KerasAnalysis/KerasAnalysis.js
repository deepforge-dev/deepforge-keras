/**
 * This adds a REST endpoint for performing analysis of a given keras architecture.
 * This includes errors and/or dimensionality feedback.
 */

'use strict';

// http://expressjs.com/en/guide/routing.html
const Q = require('q');
const path = require('path');
const fs = require('fs');
const os = require('os');
const childProcess = require('child_process');
const express = require('express');
const router = express.Router();
const PLUGIN_NAME = 'ValidateKeras';
const rimraf = require('rimraf');

const {promisify} = require('util');
const mkdir = promisify(fs.mkdir);
const rm_rf = promisify(rimraf);
let logger = null;

const {port} = require('../../../config').server;
const tmpdir = `${os.tmpdir()}/deepforge-keras-${port}/`;
const PythonWorker = require('./PythonWorker');
let worker;

/**
 * Called when the server is created but before it starts to listening to incoming requests.
 * N.B. gmeAuth, safeStorage and workerManager are not ready to use until the start function is called.
 * (However inside an incoming request they are all ensured to have been initialized.)
 *
 * @param {object} middlewareOpts - Passed by the webgme server.
 * @param {GmeConfig} middlewareOpts.gmeConfig - GME config parameters.
 * @param {GmeLogger} middlewareOpts.logger - logger
 * @param {function} middlewareOpts.ensureAuthenticated - Ensures the user is authenticated.
 * @param {function} middlewareOpts.getUserId - If authenticated retrieves the userId from the request.
 * @param {object} middlewareOpts.gmeAuth - Authorization module.
 * @param {object} middlewareOpts.safeStorage - Accesses the storage and emits events (PROJECT_CREATED, COMMIT..).
 * @param {object} middlewareOpts.workerManager - Spawns and keeps track of "worker" sub-processes.
 */
async function initialize(middlewareOpts) {
    logger = middlewareOpts.logger.fork('KerasAnalysis');
    worker = new PythonWorker(logger);
    const ensureAuthenticated = middlewareOpts.ensureAuthenticated;
    const authorizer = middlewareOpts.gmeAuth.authorizer;
    const getUserId = middlewareOpts.getUserId;

    logger.debug('initializing ...');

    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    router.get('/:projectId/:commitHash/:nodeId', async function (req, res/*, next*/) {
        // Make sure the user has permission to view the project
        const userId = getUserId(req);
        const authOpts = {entityType: authorizer.ENTITY_TYPES.PROJECT};
        const {projectId, commitHash, nodeId} = req.params;
        const {namespace} = req.query;
        const reqName = `${nodeId} in ${projectId} at ${commitHash}`;
        logger.debug(`Requesting analysis for ${reqName}`);

        await authorizer.getAccessRights(userId, projectId, authOpts);
        const accessRights = await authorizer.getAccessRights(userId, projectId, authOpts);
        if (!accessRights.read) {
            logger.debug(`Permission denied: ${userId} cannot read ${projectId}`);
            return res.status(403).send('Permission denied');
        }

        const cachedResults = await getFromCache(
            middlewareOpts.gmeConfig,
            projectId,
            commitHash,
            nodeId
        );
        if (cachedResults) {
            logger.debug(`Retrieved analysis results from cache (${reqName})`);
            return res.json(cachedResults.data);
        } else {
            const results = await analyze(userId, projectId, commitHash, namespace, nodeId);
            res.json(results);
            if (results) {
                return await addToCache(projectId, commitHash, nodeId, results);
            }
        }
    });

    try {
        await mkdir(tmpdir);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }

    logger.debug('ready');
}

function getFromCache(gmeConfig, projectId, commitHash, nodeId) {
    return getDataStore(gmeConfig)
        .then(collection => {
            const search = {projectId, commitHash, nodeId};
            return collection.updateOne(search, {$set: {lastReadTime: new Date()}})
                .then(() => collection.findOne(search));
        });
}

function addToCache(projectId, commitHash, nodeId, data) {
    let search = {projectId, commitHash, nodeId};
    let query = {$set: {data, lastReadTime: new Date()}};
    return getDataStore()
        .then(collection => collection.update(search, query, {upsert: true}))
        .then(() => logger.debug(`Cached analysis results for ${nodeId} in ${projectId} at ${commitHash}`));
}

function spawn(cmd, args) {
    const deferred = Q.defer();
    const execPlugin = childProcess.spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    logger.debug(`Running ${cmd} ${args.join(' ')}`);
    execPlugin.stdout.on('data', data => stdout += data);
    execPlugin.stderr.on('data', data => stderr += data);
    execPlugin.on('close', code => {
        if (code === 0) {
            deferred.resolve(stdout);
        } else {
            logger.debug(`Plugin execution failed. Exit code: ${code}`);
            logger.debug(stderr);
            deferred.reject(stderr);
        }
    });

    return deferred.promise;
}

async function analyze(userId, projectId, commitHash, namespace, nodeId) {
    const workdir = path.join(tmpdir, `deepforge-keras-${commitHash}_${nodeId.split('/').join('-')}`);
    const pythonFile = path.join(workdir, 'output.py');

    const webgmeEnginePath =  path.join(require.resolve('webgme-engine'), '..');
    const [owner, projectName] = projectId.split('+');
    const args = [
        path.join(webgmeEnginePath, 'src', 'bin', 'run_plugin.js'),
        PLUGIN_NAME,
        projectName,
        '--commitHash',
        commitHash,
        '--owner',
        owner,
        '--user',
        userId,
        '--activeNode',
        nodeId,
        '-w',
        path.relative(process.cwd(), workdir)
    ];

    if (namespace) {
        args.push('--namespace', namespace);
    }

    logger.debug(`about to make tmpdir ${workdir}`);
    // only make dir if doesn't exist
    try {
        await mkdir(workdir);
    } catch (err) {
        if (err.code === 'EEXIST') {
            await rm_rf(workdir);
            await mkdir(workdir);
        } else {
            throw err;
        }
    }
    await spawn('node', args);
    try {
        const report = await worker.analyze(pythonFile);
        return report;
    } catch (errmsg) {
        logger.warn(`Analysis failed (likely missing python dependencies): ${errmsg}`);
    } finally {
        await rm_rf(workdir);
    }
    return null;
}

const MongoClient = require('mongodb').MongoClient;
const getMongoClient = (function() {
    let clientP = null;
    return function (gmeConfig, connectIfNeeded=true) {
        if (!clientP) {
            if (connectIfNeeded) {
                clientP = Q(MongoClient.connect(gmeConfig.mongo.uri, gmeConfig.mongo.options));
            } else {
                return Q();
            }
        }
        return clientP;
    };
})();

const getDatabaseName = function (gmeConfig) {
    return gmeConfig.mongo.uri.replace(/^mongodb:\/\/(localhost|[a-zA-Z\d\.]+|\d+\.\d+\.\d+\.\d+):?\d*\//, '') || 'admin';
};

const getDataStore = (function() {
    let datastore = null;
    return function (gmeConfig) {
        if (!datastore) {
            datastore = getMongoClient(gmeConfig)
                .then(client => {
                    const dbName = getDatabaseName(gmeConfig);
                    logger.debug(`Caching analytics in ${dbName}`);
                    return client.db(dbName).collection('keras-analytics');
                });
        }

        return datastore;
    };
})();
/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    callback();
}

/**
 * Called after the server stopped listening.
 * @param {function} callback
 */
function stop(callback) {
    // Close the database connection
    return getMongoClient(null, false)
        .then(client => client && client.close(true))
        .nodeify(callback);
}

module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};
