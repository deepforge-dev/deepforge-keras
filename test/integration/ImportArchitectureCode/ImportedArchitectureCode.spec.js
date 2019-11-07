/*eslint-env node, mocha*/
'use strict';

describe('Imported JSON to Code', function () {
    const testFixture = require('../../globals');
    const requrireJs = require('webgme').requirejs;
    const BlobClient = requrireJs('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend'),
        fs = require('fs'),
        {promisify} = require('util'),
        assert = require('assert'),
        gmeConfig = testFixture.getGmeConfig(),
        executePython = testFixture.executePython,
        path = testFixture.path,
        logger = testFixture.logger.fork('ImportedArchitectureToCode'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        SEED_DIR = path.join(__dirname, '..', '..', '..', 'src', 'seeds'),
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        ImportPluginName = 'ImportKeras',
        CodeGenerationPluginName = 'GenerateKeras',
        blobClient = new BlobClient(gmeConfig, logger),
        JSON_DIR = path.join(__dirname, '../../test-cases/modelJsons/');

    let project,
        gmeAuth,
        awaitableLoadObject,
        storage,
        commitHash,
        importPlugin,
        codeGenerationPlugin;

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
        importPlugin = await manager.initializePlugin(ImportPluginName);
        codeGenerationPlugin = await manager.initializePlugin(CodeGenerationPluginName);
        const context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: ''
        };
        await manager.configurePlugin(importPlugin, {}, context);
        await manager.configurePlugin(codeGenerationPlugin, {}, context);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    // let modelsToTest = fs.readdirSync(JSON_DIR).filter((targetFile) => {
    //     return targetFile.endsWith('.json');
    // });

    let modelsToTest = ['sequential_dense.json'];

    modelsToTest.forEach((modelJSON) => {
        describe(`Import JSON and generate Code For ${modelJSON}`, function () {
            let generatedCode;
            before(async function () {
                generatedCode = await importJSONAndGetGeneratedCode(modelJSON);
            });

            it(`should run the python code generated for ${modelJSON}`, () => {
                let execResult = executePython(generatedCode);
                assert(execResult.success);
            }).timeout(5000);
        })
    });


    // This function runs ImportKeras, followed by GenerateKeras
    const importJSONAndGetGeneratedCode = async function(fileName){
        let executePlugin = promisify(manager.executePlugin),
            pluginConfig = {},
            context = {
                project: project,
                activeNode: '',
                branchName: 'test',
                commitHash: commitHash,
                namespace: ''
            };
        let data = fs.readFileSync(path.join(JSON_DIR, fileName), 'utf-8');

        pluginConfig.srcModel = await blobClient.putFile(fileName, data);
        await executePlugin(ImportPluginName, pluginConfig, context);

        let newBranchHash = await project.getBranchHash('test');
        commitHash = newBranchHash;
        let newCommitObj = await awaitableLoadObject(newBranchHash);

        let newRootNode = await importPlugin.core.loadRoot(newCommitObj.root);
        const addedArchitectureNode = (await importPlugin.core.loadChildren(newRootNode)).filter((node) => {
            return importPlugin.core.getAttribute(node, 'name') === fileName.replace('.json', '');
        })[0];

        context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: importPlugin.core.getPath(addedArchitectureNode),
            namespace: ''
        };
        pluginConfig = {};
        let generateCodePluginResult = await executePlugin(CodeGenerationPluginName, pluginConfig, context);
        assert(generateCodePluginResult.success);
        const codeHash = generateCodePluginResult.artifacts[0];
        const codeObj = await blobClient.getObject(codeHash);
        return String.fromCharCode.apply(null, new Uint8Array(codeObj));
    };
});