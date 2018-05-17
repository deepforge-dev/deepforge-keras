/*globals define*/

/**
 * Generated by RestRouterGenerator 2.2.0 from webgme on Fri May 04 2018 10:11:39 GMT-0500 (CDT).
 * To use in webgme add to gmeConfig.rest.components[KerasAnalysis] = {
 *    mount: 'path/subPath',
 *    src: path.join(process.cwd(), './KerasAnalysis'),
 *    options: {}
 * }
 * If you put this file in the root of your directory the above will expose the routes at
 * <host>/path/subPath, for example GET <host>/path/subPath/getExample will be routed to the getExample below.
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
const rm_rf = require('rimraf');
let logger = null;

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
function initialize(middlewareOpts) {
    logger = middlewareOpts.logger.fork('KerasAnalysis');
    const ensureAuthenticated = middlewareOpts.ensureAuthenticated;
    const getUserId = middlewareOpts.getUserId;

    logger.debug('initializing ...');

    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        // TODO: set all headers, check rate limit, etc.

        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    // In the future, it may be better to simply retrieve the results from the database
    // and perform the computation in a webhook
    // TODO
    router.get('/:projectId/:commitHash/:nodeId', function (req, res/*, next*/) {
        // For the first pass, we should just run the plugin and get the results
        // TODO
        // Make sure the user has permission to view the project
        // TODO
        const userId = getUserId(req);
        const {projectId, commitHash, nodeId} = req.params;

        logger.debug(`Requesting analysis for ${nodeId} in ${projectId} at ${commitHash}`);
        return analyzeSubmodel(projectId, commitHash, nodeId)
            .then(results => res.json(results))
            .catch(err => {
                logger.error(err);
                res.status(500).send(err);
            });
    });

    logger.debug('ready');
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

function analyzeSubmodel(projectId, commitHash, nodeId) {
    const tmpdir = path.join(os.tmpdir(), `${commitHash}_${nodeId.replace('/', '-')}`);
    const pythonFile = path.join(tmpdir, 'output.py');

    const webgmeEnginePath =  path.join(require.resolve('webgme-engine'), '..');
    const args = [
        path.join(webgmeEnginePath, 'src', 'bin', 'run_plugin.js'),
        PLUGIN_NAME,
        projectId,
        '--commitHash',
        commitHash,
        '--activeNode',
        nodeId,
        '--namespace',
        'keras',
        '-w',
        path.relative(process.cwd(), tmpdir)
    ];

    logger.debug(`about to make tmpdir ${tmpdir}`);
    // only make dir if doesn't exist
    return Q.invoke(fs, 'exists', tmpdir)
        .then(exists => {
            let prepare = Q();
            if (exists) {
                prepare = Q.nfcall(rm_rf, tmpdir);
            }

            return prepare.then(() => Q.ninvoke(fs, 'mkdtemp', tmpdir));
        })
        .then(() => spawn('node', args))
        .then(() => spawn('python', [pythonFile]))
        .then(stdout => {  // Call the python file and capture the last line from stdout
            const data = stdout.split('\n').filter(line => !!line).pop();
            const report = JSON.parse(data);
            return Q.nfcall(rm_rf, tmpdir)
                .then(() => report);
        });
}

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
    callback();
}

module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};
