/*jshint node:true, mocha:true*/

'use strict';
const testFixture = require('../../globals');

describe('GenerateKeras', function () {
    const Q = require('q');
    const gmeConfig = testFixture.getGmeConfig();
    const expect = testFixture.expect;
    const assert = require('assert');
    const path = testFixture.path;
    const BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend');
    const logger = testFixture.logger.fork('GenerateKeras');
    const blobClient = new BlobClient(gmeConfig, logger);
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const SEED_DIR = path.join(__dirname, '..', '..', '..', 'src', 'seeds', 'tests');
    const projectName = 'testProject';
    const pluginName = 'GenerateKeras';
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const ARCHITECTURE = {
        Basic: '/c',
        LayerListInput: '/7',
        MultiArchInputs: '/T',
        MultiArchOutputs: '/s'
    };

    let project,
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

    function getGeneratedCode(nodeId) {
        let pluginConfig = {
            },
            context = {
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: nodeId,
                namespace: 'keras'
            };

        return Q.ninvoke(manager, 'executePlugin', pluginName, pluginConfig, context)
            .then(pluginResult => {
                expect(typeof pluginResult).to.equal('object');
                expect(pluginResult.success).to.equal(true);
                let codeHash = pluginResult.artifacts[0];
                return blobClient.getObject(codeHash)
                    .then(obj => String.fromCharCode.apply(null, new Uint8Array(obj)));
            });
    }

    describe('code', function() {
        let code;
        before(function(done) {  // run the plugin and get the generated code
            getGeneratedCode(ARCHITECTURE.Basic)
                .then(result => code = result)
                .nodeify(done);
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

    describe('ordered list input', function() {
        let code;

        before(function(done) {  // run the plugin and get the generated code
            getGeneratedCode(ARCHITECTURE.LayerListInput)
                .then(result => code = result)
                .nodeify(done);
        });

        it('should preserve correct order', function() {
            // Check the argument ordering (Dense, Activation, Dropout)
            const addLayerLine = code.split('\n')
                .find(line => line.includes('Add()'));
            const layers = ['dense', 'activation', 'dropout'];
            const indices = layers.map(layer => addLayerLine.indexOf(layer));
            const inputs = addLayerLine.split('[')[1].split(']')[0];

            indices.reduce((index, nextIndex) => {  // compare pairs
                assert(index < nextIndex, `layer list inputs are out of order: ${inputs}`);
                return nextIndex;
            });
        });
    });

    describe('multi arch input', function() {
        let code;

        before(function(done) {  // run the plugin and get the generated code
            getGeneratedCode(ARCHITECTURE.MultiArchInputs)
                .then(result => code = result)
                .nodeify(done);
        });

        it('should preserve correct order', function() {
            const lines = code.split('\n');
            const input1 = lines.find(line => line.includes('100'))
                .split(' ')[0];
            const input2 = lines.find(line => line.includes('200'))
                .split(' ')[0];
            const input3 = lines.find(line => line.includes('300'))
                .split(' ')[0];
            const createModelLine = lines.find(line => line.includes('Model('));
            const inputs = [input1, input2, input3];
            const indices = inputs.map(name => createModelLine.indexOf(name));
            const order = createModelLine.split('[')[1].split(']')[0];

            indices.reduce((index, nextIndex) => {  // compare pairs
                assert(index < nextIndex, `model inputs are out of order: ${order}`);
                return nextIndex;
            });
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
