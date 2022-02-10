/*globals define*/
/*eslint-env node, browser*/

define(["text!./metadata.json", "plugin/PluginBase"], function (
    pluginMetadata,
    PluginBase
) {
    "use strict";

    pluginMetadata = JSON.parse(pluginMetadata);

    class ExportKerasToJSON extends PluginBase {
        constructor() {
            super();
            this.pluginMetadata = pluginMetadata;
        }

        async main() {
            const state = await this.getJSON(this.activeNode);
            console.log({state});
            this.result.setSuccess(true);
            const filename = this.core.getAttribute(this.activeNode, 'name') + '.json';
            await this.addFile(filename, JSON.stringify(state, null, 2));
        }

        async getJSON(node) {
            const attributes = Object.fromEntries(
                this.core
                    .getOwnAttributeNames(node)
                    .map((name) => [name, this.core.getAttribute(node, name)])
            );
            const children = await this.core.loadChildren(node);
            const pointers = await Promise.all(this.core.getOwnPointerNames(node).concat(['base'])
                .map(name =>
                    this.core.loadByPath(
                        this.rootNode,
                        this.core.getPointerPath(node, name)
                    ).then(node => [name, node])
                ));

            const setNames = this.core.getSetNames(node);
            const sets = {};
            const member_attributes = {};
            const member_registry = {};
            await Promise.all(setNames.map(async name => {
                const memberPaths = this.core.getMemberPaths(node, name);
                const members = await Promise.all(memberPaths
                    .map(p => this.core.loadByPath(this.rootNode, p))
                );
                const memberIds = members.map(m => this.getNodeRefID(m));
                sets[name] = memberIds;

                member_attributes[name] = Object.fromEntries(memberPaths.map((memberPath, i) => {
                    const id = memberIds[i];
                    const attrs = this.core.getMemberOwnAttributeNames(node, name, memberPath)
                        .map(attrName => [
                            attrName,
                            this.core.getMemberAttribute(
                                node,
                                name,
                                memberPath,
                                attrName
                            )
                        ]);
                    return [id, Object.fromEntries(attrs)];
                }));

                member_registry[name] = Object.fromEntries(memberPaths.map((memberPath, i) => {
                    const id = memberIds[i];
                    const attrs = this.core.getMemberOwnRegistryNames(node, name, memberPath)
                        .map(attrName => [
                            attrName,
                            this.core.getMemberRegistry(
                                node,
                                name,
                                memberPath,
                                attrName
                            )
                        ]);
                    return [id, Object.fromEntries(attrs)];
                }));
            }));

            return {
                id: this.getNodeID(node),
                alias: this.core.getGuid(node),
                attributes,
                pointers: Object.fromEntries(pointers.map(
                    ([name, node]) => [name, this.getNodeRefID(node)]
                )),
                sets,
                member_attributes,
                member_registry,

                children: await Promise.all(
                    children.map((child) => this.getJSON(child))
                ),
            };
        }

        getNodeRefID(node) {
            let id;
            if (this.core.isMetaNode(node)) {
                id = `@meta:${this.getFullyQualifiedName(node)}`;
            } else if (this.isInExport(node)) {
                id = `@id:${this.core.getGuid(node)}`;
            } else {
                id = `@path:${this.core.getPath(node)}`;
            }
            return this.applyKerasNameUpdates(id);
        }

        getNodeID(node) {
            let id;
            if (this.core.isMetaNode(node)) {
                id = `@meta:${this.getFullyQualifiedName(node)}`;
            } else if (this.isStructurallyInherited(node)) {
                id = `@name:${this.core.getAttribute(node, 'name')}`;
            } else if (this.isInExport(node)) {
                id = `@id:${this.core.getGuid(node)}`;
            } else {
                id = `@path:${this.core.getPath(node)}`;
            }

            return this.applyKerasNameUpdates(id);
        }

        applyKerasNameUpdates(name) {
            return name
                .replace('glorot_uniform', 'GlorotUniform');
        }

        getFullyQualifiedName(node) {
            const name = this.core.getAttribute(node, 'name');
            const nodePath = this.core.getPath(node);
            const library = this.core.getLibraryNames(this.rootNode)
                .find(name => {
                    const root = this.core.getLibraryRoot(this.rootNode, name);
                    const rootPath = this.core.getPath(root);
                    const isInLibrary = nodePath.startsWith(rootPath);

                    return isInLibrary;
                });

            if (library) {
                return `${library}.${name}`;
            }

            return name;
        }

        isStructurallyInherited(node) {
            const base = this.core.getBase(node);
            const parent = this.core.getParent(node);
            const parentBase = this.core.getBase(parent);

            return this.core.getParent(base) === parentBase;
        }

        isInExport(node) {
            const nodePath = this.core.getPath(node);
            const activeNodePath = this.core.getPath(this.activeNode);
            return nodePath.startsWith(activeNodePath);
        }
    }

    ExportKerasToJSON.metadata = pluginMetadata;

    return ExportKerasToJSON;
});
