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
        manager = new PluginCliManager(null, logger, gmeConfig),
        project,
        gmeAuth,
        storage,
        plugin = null,
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
            .then(() => {
                return manager.initializePlugin(pluginName)
                    .then(plugin_ => plugin = plugin_);
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
            let pluginConfig = {
                },
                context = {
                    project: project,
                    commitHash: commitHash,
                    branchName: 'test',
                    activeNode: '/V',
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

        it('should resolve activation pointers', function() {
            assert(!code.includes('[object Object]'));
        });
    });

    describe('layer args', function() {
        const testCases = [  // [string, shouldBeQuoted]
            ['valid', true],
            ['same', true],
            ['(10, 128)'],
            ['((10, 1), (12, 128))'],
            ['20e12'],
            ['20e-12'],
            ['None'],
            ['True'],
            ['False']
        ];

        testCases.forEach(pairs => {
            const [testCase, shouldBeQuoted=false] = pairs;
            it(`should ${shouldBeQuoted ? '' : 'not '}quote arg: "${testCase}"`, function() {
                const isQuoted = plugin.getArgumentValue(testCase)[0] === '"';
                assert.equal(isQuoted, shouldBeQuoted);
            });
        });
    });

    describe('variable names', function() {
        it('should not use python keywords', function() {
            const name = plugin.generateVariableName('lambda');
            assert.notEqual(name, 'lambda');
        });
    });

    // TODO: test that we can run the given python code?
});
