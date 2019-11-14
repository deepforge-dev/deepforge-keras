/*eslint-env node, mocha*/
describe('ImportKeras', function () {
    const testFixture = require('../../globals'),
        BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend'),
        fs = require('fs'),
        {promisify} = require('util'),
        assert = require('assert'),
        gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        path = testFixture.path,
        logger = testFixture.logger.fork('ImportKeras'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        SEED_DIR = path.join(__dirname, '..', '..', '..', 'src', 'seeds'),
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        pluginName = 'ImportKeras',
        blobClient = new BlobClient(gmeConfig, logger),
        JSON_DIR = path.join(__dirname, '../../test-cases/modelJsons/');

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
            projectSeed: path.join(SEED_DIR, 'keras', 'keras.webgmex'),
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

    describe('without-json-file', function () {
        it('should fail without a JSON file', async () => {
            let manager = new PluginCliManager(null, logger, gmeConfig),
                context = {
                    project: project,
                    commitHash: commitHash,
                    branchName: 'test',
                    activeNode: ''
                },
                runPlugin = promisify(manager.executePlugin);
            try {
                let pluginResult = await runPlugin(pluginName, context, context);
                assert(!pluginResult.success);
            } catch (err) {
                expect(err.message).to.equal('Keras Json Not Provided');
            }

            let branchHash = await project.getBranchHash('test');
            expect(branchHash).to.equal(commitHash);
        });
    });

    const runPluginTest = async (modelName) => {
        let manager = new PluginCliManager(null, logger, gmeConfig),
            runPlugin = promisify(manager.executePlugin),
            pluginConfig = {},
            context = {
                project: project,
                activeNode: '',
                branchName: 'test'
            };

        let data = fs.readFileSync(path.join(JSON_DIR, modelName), 'utf-8');

        assert(data != null);

        let branchHash = await project.getBranchHash('test');
        let commitObject = await awaitableLoadObject(branchHash);
        let rootNode = await plugin.core.loadRoot(commitObject.root);

        assert(rootNode != null);

        let childrenPaths = (await plugin.core.loadChildren(rootNode)).map(plugin.core.getPath);
        pluginConfig.srcModel = await blobClient.putFile(modelName, data);
        let pluginResult = await runPlugin(pluginName, pluginConfig, context);

        assert(pluginResult != null && pluginResult.success === true);
        assert(rootNode != null);

        let newBranchHash = await project.getBranchHash('test');
        commitHash = newBranchHash;
        let newCommitObj = await awaitableLoadObject(newBranchHash);

        let newRootNode = await plugin.core.loadRoot(newCommitObj.root);
        let newChildrenPaths = (await plugin.core.loadChildren(newRootNode)).map(plugin.core.getPath);
        assert(newChildrenPaths.length === childrenPaths.length + 1);
    };

    describe('test-cases', function () {
        const modelsToTest = fs.readdirSync(JSON_DIR).filter((targetFile) => {
            return targetFile.endsWith('.json');
        });

        modelsToTest.forEach((model) => {
            it(`should run plugin for ${model}`, async () => {
                await runPluginTest(model);
            });
        });

    });

    describe('test-connections', function () {
        // For name's sake
        const modelToTest = path.join(JSON_DIR, 'sequential_conv_mnist.json');
        const layerNames = ['input', 'conv2d_1', 'conv2d_2', 'max_pooling2d_1',
            'dropout_6', 'flatten_1', 'dense_9', 'dropout_7', 'dense_10'];

        it('should run plugin and connect layers correctly', async () => {
            const manager = new PluginCliManager(null, logger, gmeConfig),
                runPlugin = promisify(manager.executePlugin),
                pluginConfig = {},
                context = {
                    project: project,
                    activeNode: '',
                    branchName: 'test'
                };
            const data = fs.readFileSync(modelToTest, 'utf-8');

            pluginConfig.srcModel = await blobClient.putFile(modelToTest, data);
            const pluginResult = await runPlugin(pluginName, pluginConfig, context);

            assert(pluginResult != null);
            assert(pluginResult.success === true);

            commitHash = await project.getBranchHash('test');
            const commitObj = await awaitableLoadObject(commitHash);

            const rootNode = await plugin.core.loadRoot(commitObj.root);
            const children = (await plugin.core.loadChildren(rootNode))
                .filter((node) => {
                    return plugin.core.getAttribute(node, 'name')
                        === modelToTest.replace('.json', '');
                });
            assert(children.length === 1);
            const layers = await plugin.core.loadChildren(children[0]);
            let layersMap = {};
            layers.map(node => {
                layersMap[plugin.core.getAttribute(node, 'name')] = node;
            });
            let inputSourcePort, destinationMembers, sourceMembers;

            for(let i = 1; i < layerNames.length; i++){
                inputSourcePort = await plugin.core.loadMembers(layersMap[layerNames[i]], 'inputs');
                destinationMembers = await plugin.core.loadMembers(layersMap[layerNames[i-1]], 'outputs');
                sourceMembers = await plugin.core.loadMembers(inputSourcePort[0], 'source');
                assert(destinationMembers[0]);
                assert(sourceMembers[0]);
                assert(sourceMembers[0] === destinationMembers[0]);
            }
        });
    });
});