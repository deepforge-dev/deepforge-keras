/*jshint node:true, mocha:true*/

'use strict';
var testFixture = require('../../globals');

describe('GenerateKerasMeta', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        path = testFixture.path,
        assert = require('assert'),
        logger = testFixture.logger.fork('GenerateKerasMeta'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        SEED_DIR = path.join(__dirname, '..', '..', '..', 'src', 'seeds'),
        projectName = 'testProject',
        pluginName = 'GenerateKerasMeta',
        project,
        gmeAuth,
        storage,
        commitHash,
        plugin;

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
                    projectSeed: path.join(SEED_DIR, 'base', 'base.webgmex'),
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
            // Create a plugin instance
            .then(() => manager.initializePlugin(pluginName))
            .then(plugin_ => {
                let context = {
                    project: project,
                    commitHash: commitHash,
                    branchName: 'test',
                    activeNode: ''  // rootnode
                };

                plugin = plugin_;
                return manager.configurePlugin(plugin, {}, context);
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

    const getMetaNode = name => {
        let meta = plugin.core.getAllMetaNodes(plugin.rootNode);
        let nodes = Object.keys(meta).map(k => meta[k]);
        return nodes.find(node => plugin.core.getAttribute(node, 'name') === name);
    };

    describe('execution', function() {
        let pluginResult = null;
        before(done => {
            manager.runPluginMain(plugin, (err, res) => {
                pluginResult = res;
                done(err);
            });
        });

        it('should run plugin and update the branch', function (done) {
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);

            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.not.equal(commitHash);
                })
                .nodeify(done);
        });

        it('should add language node to meta', function () {
            let node = getMetaNode('Language');
            assert(node);
        });

        it('should add tabs to the meta', function () {
            let sheets = plugin.core.getRegistry(plugin.rootNode, 'MetaSheets');
            assert(sheets.length > 1);
        });

        it('should add ctor_arg_order attribute', function () {
            let meta = plugin.core.getAllMetaNodes(plugin.rootNode);
            let nodes = Object.keys(meta).map(k => meta[k]);
            let dense = nodes.find(node => plugin.core.getAttribute(node, 'name') === 'Dense');

            let attrs = plugin.core.getAttributeNames(dense);
            assert(attrs.length > 1, 'No attributes loaded for the "dense" layer');
            assert(attrs.includes('ctor_arg_order'));
        });

        describe('functions', () => {

            it('should create nodes for activation fns', function () {
                let node = getMetaNode('softmax');
                assert(node);
            });

            it('should set defaults for relu (even if default is 0)', function () {
                let node = getMetaNode('relu');
                let value = plugin.core.getAttribute(node, 'alpha');
                assert.equal(value, 0);
            });

            it('should set default pointer values for Dense', function () {
                let node = getMetaNode('Dense');
                let target = plugin.core.getPointerPath(node, 'kernel_initializer');
                assert(target);
            });

            it('should create nodes for constraint fns', function () {
                let node = getMetaNode('MaxNorm');
                assert(node);
            });

            it('should create nodes for initializer fns', function () {
                let node = getMetaNode('RandomNormal');
                assert(node);
            });

            it('should create nodes for regularizer fns', function () {
                let node = getMetaNode('l1');
                assert(node);
            });

            it('should create ptrs for layer activation params', function () {
                let node = getMetaNode('Dense');
                assert(plugin.core.getValidPointerNames(node).includes('activation'));
            });

            it('should create `activation` ptr to activation fn for "Dense"', function () {
                let node = getMetaNode('Dense');
                let fn = getMetaNode('ActivationFunction');
                let fnId = plugin.core.getPath(fn);
                let meta = plugin.core.getPointerMeta(node, 'activation');
                assert(meta[fnId]);
            });

            it('should detect types from base layer args (`activation`/Conv2D)', function () {
                let node = getMetaNode('Conv2D');
                let fn = getMetaNode('ActivationFunction');
                let fnId = plugin.core.getPath(fn);
                let meta = plugin.core.getPointerMeta(node, 'activation');
                assert(meta[fnId]);
            });
        });
    });

    describe('plugin fns', function() {
        it('should filter out abstract schemas', function () {
            var abs = plugin.getSchemas().find(schema => schema.abstract);
            expect(abs).to.equal(undefined);
        });

        it('should look up inherited layer props', function () {
            const mockLayer = {
                name: 'TestLayer',
                base: 'Dense'
            };
            const inputs = plugin.getLayerProperty(mockLayer, 'inputs');
            assert(inputs);
        });
    });
});
