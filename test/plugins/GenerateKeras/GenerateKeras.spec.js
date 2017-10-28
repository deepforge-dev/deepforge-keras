/*jshint node:true, mocha:true*/

'use strict';
var testFixture = require('../../globals');

describe('GenerateKeras', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        assert = require('assert'),
        path = testFixture.path,
        BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend'),
        logger = testFixture.logger.fork('GenerateKeras'),
        blobClient = new BlobClient(gmeConfig, logger),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        SEED_DIR = path.join(__dirname, '..', '..', '..', 'src', 'seeds', 'tests'),
        projectName = 'testProject',
        pluginName = 'GenerateKeras',
        project,
        gmeAuth,
        storage,
        commitHash;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: path.join(SEED_DIR, 'tests.webgmex'),
                    projectName: projectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                project = importResult.project;
                commitHash = importResult.commitHash;
                return project.createBranch('test', commitHash);
            })
            .nodeify(done);
    });

    after(function (done) {
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    describe('code', function() {
        let code;
        before(function(done) {  // run the plugin and get the generated code
            var manager = new PluginCliManager(null, logger, gmeConfig),
                pluginConfig = {
                },
                context = {
                    project: project,
                    commitHash: commitHash,
                    branchName: 'test',
                    activeNode: '/v',
                };

            manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
                try {
                    expect(err).to.equal(null);
                    expect(typeof pluginResult).to.equal('object');
                    expect(pluginResult.success).to.equal(true);
                    let codeHash = pluginResult.artifacts[0];
                    blobClient.getObject(codeHash, function(err, obj) {
                        code = String.fromCharCode.apply(null, new Uint8Array(obj));
                        done();
                    });
                } catch (e) {
                    done(e);
                    return;
                }
            });
        });

        it('should import all keras layers', function() {
            assert(code.includes('from keras.layers import *'));
        });

        it('should create a model', function() {
            assert(code.includes('model = Model('));
        });

        it('should import Model', function() {
            assert(code.includes('import Model'));
        });

    });
});
