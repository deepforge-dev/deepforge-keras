/*jshint node:true, mocha:true*/

'use strict';
var testFixture = require('../../globals');

describe('GenerateKerasMeta', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        assert = require('assert'),
        logger = testFixture.logger.fork('GenerateKerasMeta'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
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
                    projectSeed: testFixture.path.join(testFixture.SEED_DIR, 'EmptyProject.webgmex'),
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

        it('should add tabs to the meta', function () {
            let sheets = plugin.core.getRegistry(plugin.rootNode, 'MetaSheets');
            assert(sheets.length > 1);
        });

        it.skip('should add ctor_arg_order attribute', function () {
            let sheets = plugin.core.getRegistry(plugin.rootNode, 'MetaSheets');
            let meta = plugin.core.getAllMetaNodes(plugin.rootNode);
            let nodes = Object.keys(meta).map(k => meta[k]);
            let dense = nodes.find(node => plugin.core.getAttribute(node, 'name'));

            let names = nodes.map(n => plugin.core.getAttribute(n, 'name'));
            let attrs = plugin.core.getAttributeNames(dense);
            assert(attrs.length > 1, 'No attributes loaded for the "dense" layer');
            assert(attrs.includes('ctor_arg_order'));
        });
    });

    describe('plugin fns', function() {
        it('should filter out abstract schemas', function () {
            var abs = plugin.getSchemas().find(schema => schema.abstract);
            expect(abs).to.equal(undefined);
        });
    });
});
