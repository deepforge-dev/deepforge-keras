/*jshint node:true, mocha:true*/

'use strict';
const testFixture = require('../../globals');
const pluginName = 'GenerateKeras';

describe(pluginName, function () {
    const Q = require('q');
    const gmeConfig = testFixture.getGmeConfig();
    const expect = testFixture.expect;
    const assert = require('assert');
    const BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend');
    const logger = testFixture.logger.fork(pluginName);
    const blobClient = new BlobClient(gmeConfig, logger);
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const projectName = 'testProject';
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const ARCHITECTURE = testFixture.ARCHITECTURE;
    const runPythonCode = testFixture.executePythonCode;

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
                    projectSeed: testFixture.testSeedPath,
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

        it('should name custom fns by parameters', function() {
            const lines = code.split('\n');
            const custom_relu = lines
                .find(line => line.includes('custom_objects') && line.includes('relu'))
                .split('\'')[1];

            // Check that it has a 0 (from it's alpha arg)
            assert(custom_relu.includes('0'));
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
            const inputs = [input2, input1, input3];
            const indices = inputs.map(name => createModelLine.indexOf(name));
            const order = createModelLine.split('[')[1].split(']')[0];

            indices.reduce((index, nextIndex) => {  // compare pairs
                assert(index < nextIndex, `model inputs are out of order: ${order}`);
                return nextIndex;
            });
        });

    });

    describe('multi arch output', function() {
        let code;

        before(function(done) {  // run the plugin and get the generated code
            getGeneratedCode(ARCHITECTURE.MultiArchOutputs)
                .then(result => code = result)
                .nodeify(done);
        });

        it('should preserve correct order', function() {
            const lines = code.split('\n');
            const input1 = lines.find(line => line.includes('Activation'))
                .split(' ')[0];
            const input2 = lines.find(line => line.includes('Dense'))
                .split(' ')[0];
            const input3 = lines.find(line => line.includes('Dropout'))
                .split(' ')[0];
            const createModelLine = lines.find(line => line.includes('Model('));
            const inputs = [input1, input2, input3];
            const indices = inputs.map(name => createModelLine.indexOf(name));
            const order = createModelLine.split('[')[1].split(']')[0];

            indices.reduce((index, nextIndex) => {  // compare pairs
                assert(index < nextIndex, `model outputs are out of order: ${order}`);
                return nextIndex;
            });
        });
    });

    describe('nested (wrapped) layers', function() {
        let code;

        before(function(done) {  // run the plugin and get the generated code
            getGeneratedCode(ARCHITECTURE.NestedLayers)
                .then(result => code = result)
                .nodeify(done);
        });

        it('should recognize layer is not retrievable fn (like activations)', function() {
            const convRegex = /TimeDistributed\((layer=)?Conv2D/;
            assert(convRegex.test(code), 'Generated bad code for wrapped layer');
        });

        it('should not pass inputs to wrapped layer', function() {
            const nestedInputRegex = /Zeros\(\)\)\(\)\)/;
            assert(!nestedInputRegex.test(code), 'Generated inputs for wrapped layer');
        });
    });

    describe('multiple types of layer IO (seq2seq)', function() {
        let code,
            decoder,
            encoder;

        before(function(done) {  // run the plugin and get the generated code
            getGeneratedCode(ARCHITECTURE.Seq2Seq)
                .then(result => {
                    code = result;

                    const lines = code.split('\n');
                    encoder = lines.find(line => line.includes('return_sequences=False'));
                    decoder = lines.find(line => line.includes('return_sequences=True'));
                })
                .nodeify(done);
        });

        it('should return multi values from LSTM', function() {
            const returnVals = encoder.split('=')[0].split(',');
            assert.equal(returnVals.length, 3);
        });

        it('should sort outputs', function() {
            const returnVals = encoder.split('=')[0].split(/,\s*/);
            assert.equal(returnVals[0], 'output');
            assert.equal(returnVals[1], 'hidden_state');
        });

        it('should pass "hidden_state" to decoder', function() {
            const inputVals = decoder.split(/[(]+/).pop();
            assert(
                inputVals.includes('hidden_state'),
                'hidden_state not passed to decoder'
            );
        });

        it('should pass inputs as named args', function() {
            const inputVals = decoder.split(/[(]+/).pop();
            assert(
                inputVals.includes('initial_state='),
                'initial_state keyword arg not found for decoder'
            );
        });

        it('should set initial_state to list in decoder', function() {
            // Check that the decoder sets the initial_state
            const inputVals = decoder.split(/[(]+/).pop();
            const hasListInitState = /initial_state=\[\w+,\s*\w+\]/;
            assert(
                hasListInitState.test(inputVals),
                'initial_state not receiving list input in decoder'
            );
        });

        describe('special cases', function() {
            it('should set return_state to true in recurrent layers', function() {
                assert(encoder.includes('return_state=True'), 'encoder not returning state');
                assert(decoder.includes('return_state=True'), 'decoder not returning state');
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
    describe('run generated code', function () {
        const archTypes = ['MultiArchOutputs', 'NestedLayers', 'Seq2Seq'];

        archTypes.forEach((arch) => {
            it(`Should run the generated code in python for ${arch}`, async () => {
                const generatedCode = await getGeneratedCode(ARCHITECTURE[arch]);
                const executionOutput = runPythonCode(generatedCode);
                assert(executionOutput.success);
            });
        });
    });
});
