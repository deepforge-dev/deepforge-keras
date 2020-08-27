/*jshint node:true, mocha:true*/

'use strict';

describe('JSONImporter', function () {
    const testFixture = require('../../globals');
    const Core = testFixture.requirejs('common/core/coreQ');
    const Importer = testFixture.requirejs('deepforge-keras/plugins/JSONImporter');
    const assert = require('assert');
    const gmeConfig = testFixture.getGmeConfig();
    const path = testFixture.path;
    const Q = testFixture.Q;
    const logger = testFixture.logger.fork('CreateKerasMeta');
    const projectName = 'testProject';
    let project,
        gmeAuth,
        storage,
        commitHash,
        core;

    before(async function () {
        this.timeout(7500);
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: path.join(testFixture.SEED_DIR, 'EmptyProject.webgmex'),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        project = importResult.project;
        core = new Core(project, {
            globConf: gmeConfig,
            logger: logger.fork('core')
        });
        commitHash = importResult.commitHash;
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    let counter = 1;
    async function getNewRootNode(core) {
        const branchName = 'test' + counter++;
        await project.createBranch(branchName, commitHash);
        const branchHash = await project.getBranchHash(branchName);
        const commit = await Q.ninvoke(project, 'loadObject', branchHash);
        return await Q.ninvoke(core, 'loadRoot', commit.root);
    }

    let importer,
        node,
        original,
        root;

    beforeEach(async () => {
        root = await getNewRootNode(core);
        importer = new Importer(core, root);
        node = (await core.loadChildren(root))[0];
        original = await importer.toJSON(node);
    });

    describe('attributes', function() {
        it('should set attributes', async function() {
            original.attributes.name = 'hello world!';
            await importer.apply(node, original);
            assert.equal(core.getAttribute(node, 'name'), 'hello world!');
        });

        it('should set attributes using @name', async function() {
            const rootSchema = await importer.toJSON(root);
            rootSchema.children = [
                {
                    id: '@name:FCO',
                    attributes: {name: 'NewName'},
                }
            ];
            await importer.apply(root, rootSchema);
            assert.equal(core.getAttribute(node, 'name'), 'NewName');
        });

        it('should set attributes using @attribute:name:FCO', async function() {
            const rootSchema = await importer.toJSON(root);
            rootSchema.children = [
                {
                    id: '@attribute:name:FCO',
                    attributes: {name: 'NewName'},
                }
            ];
            await importer.apply(root, rootSchema);
            assert.equal(core.getAttribute(node, 'name'), 'NewName');
        });

        it('should delete attributes', async function() {
            delete original.attributes.name;
            await importer.apply(node, original);
            assert.equal(core.getAttribute(node, 'name'), undefined);
        });

        it('should ignore attributes if missing "attributes"', async function() {
            delete original.attributes;
            await importer.apply(node, original);
            assert.equal(core.getAttribute(node, 'name'), 'FCO');
        });
    });

    describe('attribute meta', function() {
        it('should add to attribute meta', async function() {
            original.attribute_meta.test = {type: 'string'};
            await importer.apply(node, original);
            assert.notEqual(core.getAttributeMeta(node, 'test'), undefined);
            assert.equal(core.getAttributeMeta(node, 'test').type, 'string');
        });

        it('should delete attribute meta', async function() {
            delete original.attribute_meta.name;
            await importer.apply(node, original);
            assert.equal(core.getAttributeMeta(node, 'name'), undefined);
        });

        it('should update attribute meta fields', async function() {
            original.attribute_meta.name.type = 'boolean';
            await importer.apply(node, original);
            assert.equal(core.getAttributeMeta(node, 'name').type, 'boolean');
        });

        it('should change attribute to enum', async function() {
            original.attribute_meta.name.enum = ['a', 'b'];
            await importer.apply(node, original);
            assert.deepEqual(core.getAttributeMeta(node, 'name').enum, ['a', 'b']);
        });

        it('should change attribute from enum', async function() {
            core.setAttributeMeta(node, 'name', {type: 'string', enum: ['a', 'b']});
            await importer.apply(node, original);
            assert.equal(core.getAttributeMeta(node, 'name').enum, undefined);
        });

        it('should change attribute enum values', async function() {
            core.setAttributeMeta(node, 'name', {type: 'string', enum: ['a', 'b']});
            original.attribute_meta.name.enum = ['b', 'c', 'a'];
            await importer.apply(node, original);
            assert.deepEqual(core.getAttributeMeta(node, 'name').enum, ['b', 'c', 'a']);
        });
    });

    describe('registry', function() {
        it('should add registry values', async function() {
            original.registry.name = 'hello world!';
            await importer.apply(node, original);
            assert.equal(core.getRegistry(node, 'name'), 'hello world!');
        });

        it('should delete registry values', async function() {
            delete original.registry.position;
            await importer.apply(node, original);
            assert.equal(core.getRegistry(node, 'position'), undefined);
        });

        it('should update registry fields', async function() {
            original.registry.position.x = 500;
            const {y} = original.registry.position;
            await importer.apply(node, original);
            assert.equal(core.getRegistry(node, 'position').x, 500);
            const newY = core.getRegistry(node, 'position').y;
            assert.equal(
                newY,
                y,
                `Changed y value from ${y} to ${newY}`,
            );
        });
    });

    describe('multiple nodes', function() {
        let node2, node3;
        let original2;

        beforeEach(async () => {
            const base = node;
            const parent = root;
            node2 = core.createNode({base, parent});
            core.setAttribute(node2, 'name', 'Node2');
            node3 = core.createNode({base, parent});
            core.setAttribute(node3, 'name', 'Node3');
            original2 = await importer.toJSON(node2);
        });

        describe('pointers', function() {
            it('should add pointer', async function() {
                const nodePath = core.getPath(node2);
                original.pointers.newPtr = nodePath;
                await importer.apply(node, original);
                assert.equal(core.getPointerPath(node, 'newPtr'), nodePath);
            });

            it('should add pointer using @meta tag', async function() {
                const nodePath = core.getPath(node);
                original.pointers.newPtr = `@meta:FCO`;
                await importer.apply(node, original);
                assert.equal(core.getPointerPath(node, 'newPtr'), nodePath);
            });

            it('should delete pointer', async function() {
                delete original2.pointers.base;
                await importer.apply(node2, original2);
                assert.equal(core.getPointerPath(node2, 'base'), null);
            });

            it('should change pointer', async function() {
                const nodePath = core.getPath(node3);
                original2.pointers.base = nodePath;
                await importer.apply(node2, original2);
                assert.equal(core.getPointerPath(node2, 'base'), nodePath);
            });

            it('should resolve @meta tag even if renamed during changes', async function() {
                const fco = await core.loadByPath(root, '/1');
                const node = core.createNode({base: fco, parent: root});
                core.setAttribute(node, 'name', 'MetaNode');
                core.addMember(root, 'MetaAspectSet', node);

                const newJSON = {
                    attributes: {name: 'root'},
                    children: [
                        {
                            id: '@meta:MetaNode',
                            attributes: {
                                name: 'NewMetaNodeName',
                            }
                        },
                        {
                            id: '@meta:FCO',
                            pointers: {
                                testPtr: '@meta:MetaNode',
                            }
                        },
                    ]
                };

                await importer.apply(root, newJSON);
                assert.equal(core.getAttribute(node, 'name'), 'NewMetaNodeName');
                assert.equal(core.getPointerPath(fco, 'testPtr'), core.getPath(node));
            });
        });

        describe('pointer meta', function() {
            beforeEach(async () => {
                core.setPointerMetaLimits(node2, 'myPtr', 1, 1);
                core.setPointerMetaTarget(node2, 'myPtr', node3, -1, 1);
                core.setPointerMetaTarget(node2, 'myPtr', node2, -1, 1);
                original2 = await importer.toJSON(node2);
            });

            it('should add pointer meta', async function() {
                const nodePath = core.getPath(node3);
                const ptrMeta = {min: 1, max: 1};
                ptrMeta[nodePath] = {min: -1, max: 1};

                original2.pointer_meta.newPtr = ptrMeta;
                await importer.apply(node2, original2);
                assert.deepEqual(core.getPointerMeta(node2, 'newPtr'), ptrMeta);
            });

            it('should delete pointer meta', async function() {
                delete original2.pointer_meta.myPtr;
                await importer.apply(node2, original2);
                assert.equal(core.getPointerMeta(node2, 'myPtr'), undefined);
            });

            it('should delete pointer meta target', async function() {
                const nodeId = core.getPath(node2);
                delete original2.pointer_meta.myPtr[nodeId];
                await importer.apply(node2, original2);
                const meta = core.getPointerMeta(node2, 'myPtr');
                assert.equal(meta[nodeId], undefined);
                assert.notEqual(meta[core.getPath(node3)], undefined);
            });

            it('should update pointer target limits', async function() {
                const nodeId = core.getPath(node2);
                original2.pointer_meta.myPtr[nodeId].min = 1;
                await importer.apply(node2, original2);
                const meta = core.getPointerMeta(node2, 'myPtr');
                assert.equal(meta[nodeId].min, 1);
            });

            it('should update pointer limits', async function() {
                original2.pointer_meta.myPtr.min = -1;
                await importer.apply(node2, original2);
                const meta = core.getPointerMeta(node2, 'myPtr');
                assert.equal(meta.min, -1);
            });

            it('should add target to existing pointer', async function() {
                const nodeId = core.getPath(node);
                original2.pointer_meta.myPtr[nodeId] = {min: -1, max: 1};
                await importer.apply(node2, original2);
                const meta = core.getPointerMeta(node2, 'myPtr');
                assert.deepEqual(meta[nodeId], {min: -1, max: 1});
                assert.notEqual(meta[core.getPath(node2)], undefined);
            });
        });

        describe('sets', function() {
            const setName = 'someSet';
            let node4;

            beforeEach(async () => {
                node4 = core.createNode({base: node, parent: root});
                core.setAttribute(node4, 'name', 'Node4');

                core.setPointerMetaLimits(node2, setName, -1, -1);
                core.setPointerMetaTarget(node2, setName, node3, -1, -1);
                core.setPointerMetaTarget(node2, setName, node4, -1, -1);

                core.addMember(node2, setName, node3);
                original2 = await importer.toJSON(node2);
            });

            it('should add member', async function() {
                const nodeId = core.getPath(node4);
                original2.sets[setName].push(nodeId);
                await importer.apply(node2, original2);
                const members = core.getMemberPaths(node2, setName);
                assert(members.includes(nodeId));
                assert.equal(members.length, 2);
            });

            it('should add member to new set', async function() {
                const nodeId = core.getPath(node4);
                const setName = 'newSet';
                original2.sets[setName] = [nodeId];
                await importer.apply(node2, original2);
                const members = core.getMemberPaths(node2, setName);
                assert(members.includes(nodeId));
                assert.equal(members.length, 1);
                assert(core.getSetNames(node2).includes(setName));
            });

            it('should remove member', async function() {
                core.addMember(node2, setName, node4);
                original2 = await importer.toJSON(node2);

                original2.sets[setName].pop();
                const newMembers = original2.sets[setName].slice();
                await importer.apply(node2, original2);
                const members = core.getMemberPaths(node2, setName);
                assert.deepEqual(members, newMembers);
            });

            it('should create empty set', async function() {
                const setName = 'newSet';
                original2.sets[setName] = [];
                await importer.apply(node2, original2);
                const members = core.getMemberPaths(node2, setName);
                assert.equal(members.length, 0);
                assert(core.getSetNames(node2).includes(setName));
            });

            it('should delete set', async function() {
                delete original2.sets[setName];
                await importer.apply(node2, original2);
                assert(!core.getSetNames(node2).includes(setName));
            });

            describe('attributes', function() {
                const attrName = 'myAttr';
                let nodeId;
                beforeEach(async () => {
                    nodeId = core.getPath(node3);
                    core.setMemberAttribute(node2, setName, nodeId, attrName, 'hello');
                    original2 = await importer.toJSON(node2);
                });

                it('should set member attributes', async function() {
                    original2.member_attributes[setName][nodeId][attrName] = 'world';
                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberAttribute(node2, setName, nodeId, attrName),
                        'world'
                    );
                });

                it('should set new member attributes', async function() {
                    const nodeId = core.getPath(node4);
                    original2.sets[setName] = [nodeId];
                    original2.member_attributes[setName][nodeId] = {};
                    original2.member_attributes[setName][nodeId][attrName] = 'world';

                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberAttribute(node2, setName, nodeId, attrName),
                        'world'
                    );
                });

                it('should set member attribute on new set', async function() {
                    const nodeId = core.getPath(node4);
                    original2.sets[setName] = [nodeId];
                    original2.member_attributes[setName][nodeId] = {};
                    original2.member_attributes[setName][nodeId][attrName] = 'world';

                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberAttribute(node2, setName, nodeId, attrName),
                        'world'
                    );
                });

                it('should delete member attributes', async function() {
                    delete original2.member_attributes[setName][nodeId][attrName];
                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberAttribute(node2, setName, nodeId, attrName),
                        undefined
                    );
                });

                it('should delete all member attributes for set', async function() {
                    core.setMemberAttribute(node2, setName, nodeId, 'attr2', 'world');
                    original2 = await importer.toJSON(node2);

                    delete original2.member_attributes[setName][nodeId];
                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberAttribute(node2, setName, nodeId, attrName),
                        undefined
                    );
                    assert.equal(
                        core.getMemberAttribute(node2, setName, nodeId, 'attr2'),
                        undefined
                    );
                });
            });

            describe('registry', function() {
                const regName = 'myReg';
                let nodeId;
                beforeEach(async () => {
                    nodeId = core.getPath(node3);
                    const position = {x: 1, y: 2};
                    core.setMemberRegistry(node2, setName, nodeId, regName, position);
                    original2 = await importer.toJSON(node2);
                });

                it('should set member registry values', async function() {
                    original2.member_registry[setName][nodeId][regName] = 'world';
                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberRegistry(node2, setName, nodeId, regName),
                        'world'
                    );
                });

                it('should set new member registry values', async function() {
                    const nodeId = core.getPath(node4);
                    original2.sets[setName] = [nodeId];
                    original2.member_registry[setName][nodeId] = {};
                    original2.member_registry[setName][nodeId][regName] = 'world';

                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberRegistry(node2, setName, nodeId, regName),
                        'world'
                    );
                });

                it('should set member registry on new set', async function() {
                    const nodeId = core.getPath(node4);
                    original2.sets[setName] = [nodeId];
                    original2.member_registry[setName][nodeId] = {};
                    original2.member_registry[setName][nodeId][regName] = 'world';

                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberRegistry(node2, setName, nodeId, regName),
                        'world'
                    );
                });

                it('should delete member registry values', async function() {
                    delete original2.member_registry[setName][nodeId][regName];
                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberRegistry(node2, setName, nodeId, regName),
                        undefined
                    );
                });

                it('should delete all member registry values for set', async function() {
                    core.setMemberRegistry(node2, setName, nodeId, 'attr2', 'world');
                    original2 = await importer.toJSON(node2);

                    delete original2.member_registry[setName][nodeId];
                    await importer.apply(node2, original2);
                    assert.equal(
                        core.getMemberRegistry(node2, setName, nodeId, regName),
                        undefined
                    );
                    assert.equal(
                        core.getMemberRegistry(node2, setName, nodeId, 'attr2'),
                        undefined
                    );
                });

                it('should set nested member registry', async function() {
                    original2.member_registry[setName][nodeId][regName].x = 3;
                    await importer.apply(node2, original2);
                    const newPosition = core.getMemberRegistry(node2, setName, nodeId, regName);
                    assert.equal(
                        newPosition.x,
                        3
                    );

                    assert.equal(
                        newPosition.y,
                        2
                    );
                });
            });
        });

        describe('child nodes', function() {
            it('should create nodes', async function() {
                const nodeId = core.getPath(node3);
                original2.children.push({
                    attributes: {name: 'NewChild'},
                    pointers: {base: nodeId}
                });
                await importer.apply(node2, original2);
                const children = await core.loadChildren(node2);
                assert.equal(children.length, 1);
                assert.equal(
                    core.getAttribute(children[0], 'name'),
                    'NewChild'
                );
            });

            it('should set @name if tag not found', async function() {
                const nodeId = core.getPath(node3);
                original2.children.push({
                    id: '@name:NewChild',
                    pointers: {base: nodeId}
                });
                await importer.apply(node2, original2);
                const children = await core.loadChildren(node2);
                assert.equal(children.length, 1);
                assert.equal(
                    core.getAttribute(children[0], 'name'),
                    'NewChild'
                );
            });

            it('should set @attribute if tag not found', async function() {
                const nodeId = core.getPath(node3);
                original2.children.push({
                    id: '@attribute:testAttr:NewChild',
                    pointers: {base: nodeId}
                });
                await importer.apply(node2, original2);
                const children = await core.loadChildren(node2);
                assert.equal(children.length, 1);
                assert.equal(
                    core.getAttribute(children[0], 'testAttr'),
                    'NewChild'
                );
            });

            it('should match nodes existing nodes', async function() {
                const newNode = core.createNode({base: node3, parent: node2});
                core.setAttribute(newNode, 'name', 'NewChild');
                original2.children.push({
                    id: '@name:NewChild',
                    attributes: {name: 'SomeNewName'},
                });
                await importer.apply(node2, original2);
                const children = await core.loadChildren(node2);
                assert.equal(children.length, 1);
                assert.equal(
                    core.getAttribute(children[0], 'name'),
                    'SomeNewName'
                );
            });

            it('should delete nodes not in json', async function() {
                const newNode = core.createNode({base: node3, parent: node2});
                core.setAttribute(newNode, 'name', 'NewChild');

                const newNode2 = core.createNode({base: node3, parent: node2});
                core.setAttribute(newNode2, 'name', 'NewChild2');

                original2.children.push({
                    id: '@name:NewChild',
                    attributes: {name: 'SomeNewName'},
                });

                await importer.apply(node2, original2);
                const children = await core.loadChildren(node2);
                assert.equal(children.length, 1);
                assert.equal(
                    core.getAttribute(children[0], 'name'),
                    'SomeNewName'
                );
            });

            it('should ignore children if no "children" field', async function() {
                const newNode = core.createNode({base: node3, parent: node2});
                core.setAttribute(newNode, 'name', 'NewChild');
                delete original2.children;
                await importer.apply(node2, original2);
                const [child] = await core.loadChildren(node2);
                assert(!!child);
                assert.equal(core.getGuid(child), core.getGuid(newNode));
            });

        });
    });

    describe('findNode', function() {
        it('should find nodes using @meta', async function() {
            const fco = await importer.findNode(node, '@meta:FCO');
            assert.equal(fco, node);
        });

        it('should find nodes using @name', async function() {
            const fco = await importer.findNode(root, '@name:FCO');
            assert.equal(fco, node);
        });

        it('should not find nodes outside parent', async function() {
            const fco = await importer.findNode(node, '@name:FCO');
            assert.equal(fco, undefined);
        });
    });

    describe('import', function() {
        let children;

        before(async () => {
            root = await getNewRootNode(core);
            importer = new Importer(core, root);

            const state = {attributes: {name: 'hello'}};
            await importer.import(root, state);
            children = await core.loadChildren(root);
        });

        it('should not apply changes to parent', function() {
            assert.notEqual(core.getAttribute(root, 'name'), 'hello');
        });

        it('should create new node', async function() {
            assert.equal(children.length, 2);
        });

        it('should apply changes to new node', async function() {
            const newNode = children
                .find(node => core.getAttribute(node, 'name') === 'hello');
            assert(newNode);
        });
    });
});
