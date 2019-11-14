
'use strict';
describe('keras', function () {
    const testFixture = require('../globals');
    const Core = testFixture.requirejs('common/core/coreQ');
    const assert = require('assert');
    const gmeConfig = testFixture.getGmeConfig();
    const path = testFixture.path;
    const Q = testFixture.Q;
    const logger = testFixture.logger.fork('CreateKerasMeta');
    const projectName = 'testProject';
    const SEED_DIR = path.join(__dirname, '..', '..', 'src', 'seeds');
    let gmeAuth,
        storage,
        rootNode,
        core;

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
        const project = importResult.project;
        core = new Core(project, {
            globConf: gmeConfig,
            logger: logger.fork('core')
        });
        const commitHash = importResult.commitHash;
        const branchName = 'test';
        await project.createBranch(branchName, commitHash);
        const branchHash = await project.getBranchHash(branchName);
        const commit = await Q.ninvoke(project, 'loadObject', branchHash);
        rootNode = await Q.ninvoke(core, 'loadRoot', commit.root);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    const getMetaNode = name => {
        const metanodes = Object.values(core.getAllMetaNodes(rootNode));
        return metanodes.find(node => core.getAttribute(node, 'name') === name);
    };

    it('should not set activations to subtype of Layer', function () {
        const fn = getMetaNode('ActivationFunction');
        const layer = getMetaNode('Layer');
        assert(!core.isTypeOf(fn, layer));
    });

    it('should filter out "x" for activations', function () {
        const fn = getMetaNode('elu');
        const args = core.getAttributeNames(fn);
        assert(!args.includes('x'));
    });

    it('should not have extra nodes in root', async function () {
        const children = await core.loadChildren(rootNode);
        assert.equal(children.length, 2);
    });
});
