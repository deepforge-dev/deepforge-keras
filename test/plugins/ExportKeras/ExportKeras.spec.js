/*eslint-env node, mocha*/
describe('ExportKeras', function () {
    const testFixture = require('../../globals'),
        BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend'),
        {promisify} = require('util'),
        assert = require('assert'),
        ARCHITECTURE = testFixture.ARCHITECTURE,
        gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('ExportKeras'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        pluginName = 'ExportKeras',
        blobClient = new BlobClient(gmeConfig, logger);

    let project,
        gmeAuth,
        awaitableLoadObject,
        storage,
        commitHash,
        plugin;

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
        awaitableLoadObject = promisify(project.loadObject);

        await project.createBranch('test', commitHash);
        plugin = await manager.initializePlugin(pluginName);
        const context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: ''
        };
        await manager.configurePlugin(plugin, {}, context);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    async function getGeneratedJSON(nodeId) {
        const pluginConfig = {};
        const context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: nodeId,
            namespace: 'keras'
        };

        let awaitableExecutePlugin = promisify(manager.executePlugin);

        const result = await awaitableExecutePlugin(pluginName, pluginConfig, context);

        assert.equal(result.success, true, "Error, Plugin execution failed");
        const jsonHash = result.artifacts[0];
        return await blobClient.getObjectAsJSON(jsonHash);
    }

    describe('multi arch output', function () {
        let modelJSON;
        const layerNames = ['input_1', 'activation_1', 'dense_1', 'dropout_1'];
        const layerClassNames = ['InputLayer', 'Activation', 'Dense', 'Dropout'];

        before(async function () {
            modelJSON = await getGeneratedJSON(ARCHITECTURE.MultiArchOutputs);

        });

        it('should match layer names and number of layers', function () {
            assert.equal(modelJSON.class_name, 'Model');
            assert.equal(modelJSON.config.output_layers.length, 3,
                `Number of Output layers should be 3 found ${modelJSON.config.output_layers.length}`);
            assert.equal(modelJSON.config.layers.length, 4,
                `Number of layers should be 3 found ${modelJSON.config.layers.length}`);
            const layers = modelJSON.config.layers;
            layers.forEach((layer, index) => {
                assert.equal(layer.class_name, layerClassNames[index],
                    `Mismatch in class name for the layer expected
                    ${layerClassNames[index]}, found ${layer.class_name}`);
                assert.equal(layer.name, layerNames[index],
                    `Mismatch in names for the layers expected
                    ${layerNames[index]}, found ${layer.name}`);
            });
        });
    });

    describe('nested (wrapped) layers', function () {
        let modelJSON;
        const layerNames = ['input_1', 'time_distributed_1'];
        const layerClassNames = ['InputLayer', 'TimeDistributed'];

        before(async function () {
            modelJSON = await getGeneratedJSON(ARCHITECTURE.NestedLayers);

        });

        it('should match layer names and number of layers', function () {
            assert.equal(modelJSON.class_name, 'Model');
            assert.equal(modelJSON.config.output_layers.length, 1,
                `Number of Output layers should be 1 found ${modelJSON.config.output_layers.length}`);
            assert.equal(modelJSON.config.layers.length, 2,
                `Number of layers should be 2 found ${modelJSON.config.layers.length}`);
            const layers = modelJSON.config.layers;
            layers.forEach((layer, index) => {
                assert.equal(layer.class_name, layerClassNames[index],
                    `Mismatch in class name for the layer expected
                    ${layerClassNames[index]}, found ${layer.class_name}`);
                assert.equal(layer.name, layerNames[index],
                    `Mismatch in names for the layers expected
                    ${layerNames[index]}, found ${layer.name}`);
            });
        });
    });

    describe('seq to seq', function () {
        let modelJSON;
        const layerNames = ['input_2', 'input_1', 'lstm_1', 'lstm_2', 'dense_1'];
        const layerClassNames = ['InputLayer', 'InputLayer', 'LSTM', 'LSTM', 'Dense'];

        before(async function () {
            modelJSON = await getGeneratedJSON(ARCHITECTURE.Seq2Seq);

        });

        it('should match layer names and number of layers', function () {
            assert.equal(modelJSON.class_name, 'Model');
            assert.equal(modelJSON.config.output_layers.length, 1,
                `Number of Output layers should be 1 found ${modelJSON.config.output_layers.length}`);
            assert.equal(modelJSON.config.layers.length, 5,
                `Number of layers should be 5 found ${modelJSON.config.layers.length}`);
            const layers = modelJSON.config.layers;
            layers.forEach((layer, index) => {
                assert.equal(layer.class_name, layerClassNames[index],
                    `Mismatch in class name for the layer expected
                    ${layerClassNames[index]}, found ${layer.class_name}`);
                assert.equal(layer.name, layerNames[index],
                    `Mismatch in names for the layers expected
                    ${layerNames[index]}, found ${layer.name}`);
            });
        });
    });
});
