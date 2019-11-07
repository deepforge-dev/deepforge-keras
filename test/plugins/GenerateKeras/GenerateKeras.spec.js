/*jshint node:true, mocha:true*/

'use strict';
describe('GenerateKeras', function () {
    const testFixture = require('../../globals');
    const pluginName = 'GenerateKeras';
    const Q = require('q');
    const gmeConfig = testFixture.getGmeConfig();
    const expect = testFixture.expect;
    const assert = require('assert');
    const logger = testFixture.logger.fork(pluginName);
    const BlobClient = testFixture.getBlobTestClient();
    const blobClient = new BlobClient(gmeConfig, logger);
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const projectName = 'testProject';
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const ARCHITECTURE = testFixture.ARCHITECTURE;
    const executePython = testFixture.executePython;

    let project,
        gmeAuth,
        storage,
        plugin = null,
        commitHash;

    before(async function () {
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: testFixture.testSeedPath,
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        project = importResult.project;
        commitHash = importResult.commitHash;
        await project.createBranch('test', commitHash);
        plugin = await manager.initializePlugin(pluginName);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    async function getGeneratedCode(nodeId) {
        const pluginConfig = {};
        const context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: nodeId,
            namespace: 'keras'
        };

        const result = await Q.ninvoke(
            manager,
            'executePlugin',
            pluginName,
            pluginConfig,
            context
        );
        expect(typeof result).to.equal('object');
        expect(result.success).to.equal(true);
        const codeHash = result.artifacts[0];
        return await blobClient.getObjectAsString(codeHash);
        //return String.fromCharCode.apply(null, new Uint8Array(obj));
    }

    describe('code', function() {
        let code;
        before(async function() {  // run the plugin and get the generated code
            code = await getGeneratedCode(ARCHITECTURE.Basic);
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

        before(async function() {  // run the plugin and get the generated code
            code = await getGeneratedCode(ARCHITECTURE.LayerListInput);
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

        before(async function() {  // run the plugin and get the generated code
            code = await getGeneratedCode(ARCHITECTURE.MultiArchInputs);
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

        before(async function() {  // run the plugin and get the generated code
            code = await getGeneratedCode(ARCHITECTURE.MultiArchOutputs);
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

        it('should run generated code without errors', () => {
            const executionResult = executePython(code);
            assert(executionResult.success);
        }).timeout(5000);
    });

    describe('nested (wrapped) layers', function() {
        let code;

        before(async function() {  // run the plugin and get the generated code
            code = await getGeneratedCode(ARCHITECTURE.NestedLayers);
        });

        it('should recognize layer is not retrievable fn (like activations)', function() {
            const convRegex = /TimeDistributed\((layer=)?Conv2D/;
            assert(convRegex.test(code), 'Generated bad code for wrapped layer');
        });

        it('should not pass inputs to wrapped layer', function() {
            const nestedInputRegex = /Zeros\(\)\)\(\)\)/;
            assert(!nestedInputRegex.test(code), 'Generated inputs for wrapped layer');
        });

        it('should run generated code without errors', () => {
            const executionResult = executePython(code);
            assert(executionResult.success);
        }).timeout(5000);
    });

    describe('multiple types of layer IO (seq2seq)', function() {
        let code,
            decoder,
            encoder;

        before(async function() {  // run the plugin and get the generated code
            code = await getGeneratedCode(ARCHITECTURE.Seq2Seq);
            const lines = code.split('\n');
            encoder = lines.find(line => line.includes('return_sequences=False'));
            decoder = lines.find(line => line.includes('return_sequences=True'));
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

        it('should run generated code without errors', () => {
            const exectionResult = executePython(code);
            assert(exectionResult.success);
        }).timeout(5000);

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
            ['([10, 1], [12, 128])'],
            ['[[10, 1], [12, 128]]'],
            ['[(10, 1), (12, 128)]'],
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
});
