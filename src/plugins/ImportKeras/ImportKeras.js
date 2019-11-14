/*globals define*/
define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    './utils/JSONModelMaps',
    './utils/json-model-parser',
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    ModelMaps,
    JSONLayerParser,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);


    /**
     * Initializes a new instance of ImportKeras.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ImportKeras.
     * @constructor
     */
    var ImportKeras = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructure etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ImportKeras.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ImportKeras.prototype = Object.create(PluginBase.prototype);
    ImportKeras.prototype.constructor = ImportKeras;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(Error|null, plugin.PluginResult)} callback - the result callback
     */
    ImportKeras.prototype.main = async function(callback){
        let srcJsonHash = this.getCurrentConfig().srcModel;
        if (!srcJsonHash) {
            callback(new Error('Keras Json Not Provided'), this.result);
            return;
        }
        try {
            let archName = this.getCurrentConfig().archName;
            let metadata = await this.blobClient.getMetadata(srcJsonHash);
            archName = archName ? archName : metadata.name.replace('.json', '');
            let modelJson = await this.blobClient.getObjectAsJSON(srcJsonHash);
            this.modelInfo = JSONLayerParser.flatten(modelJson).config;
            let importedArchNode = this.addNewArchitecture(archName);
            this.addLayers(importedArchNode);
            await this.addConnections();
            await this.save('Completed Import Model');
            this.result.setSuccess(true);
            callback(null, this.result);
        } catch (err) {
            this.logger.debug(`Something Went Wrong, Error Message: ${err}`);
            callback(err, this.result);
        }
    };

    ImportKeras.prototype.addNewArchitecture = function (archName) {
        // Add Architecture
        let importedArch = this.core.createNode({
            parent: this.activeNode,
            base: this.META.Architecture
        });
        const uniqueName = archName;
        this.core.setAttribute(importedArch, 'name', uniqueName);
        this.logger.debug(`Added ${uniqueName} as a new architecture.`);
        return importedArch;
    };

    // This should add layers. constraints, initializers, regularizers as well as activations to the layer.
    ImportKeras.prototype.addLayers = function (importedArch) {
        let layers = this.modelInfo.layers;
        let layerToCreate = null;
        this.layerInfo = {};
        layers.forEach((layer) => {
            layerToCreate = this._getMetaTypeForClass(layer.class_name);
            let layerNode = this.core.createNode({
                parent: importedArch,
                base: this.META[layerToCreate]
            });
            this.logger.debug(`Added ${layerToCreate}\
            to ${this.core.getAttribute(importedArch, 'name')}`);

            // Add all attributes, from the model JSON, as well as from the layers schema
            this._addLayerAttributes(layerNode, layer);
            this._addConfigurableNodes(layerNode, layer);
        });
    };

    // All the attributes, which do not require a separate node to be created
    // 1. First find the validAttributeNames for the layer
    // 2. If the name is in layer, set it.
    // 3. If the name is in layer.config, set it.
    // 4. Finally, check the layers schema for remaining attributes.
    ImportKeras.prototype._addLayerAttributes = function (layerNode, attrObj) {
        let config = attrObj.config;
        let validAttributeNamesForThisLayer = this.core.getValidAttributeNames(layerNode);
        let configKeys = Object.keys(config);
        let remainingKeys = Object.keys(attrObj)
            .filter(value => value !== 'config');

        validAttributeNamesForThisLayer.forEach((attribute) => {
            if (remainingKeys.indexOf(this._jsonConfigToNodeAttr(attribute)) > -1) {
                this.core.setAttribute(layerNode, attribute, this._toPythonType(attrObj[this._jsonConfigToNodeAttr(attribute)]));
                this.logger.debug(`Set ${attribute} for ${this.core.getGuid(layerNode)}` +
                    ` to ${this.core.getAttribute(layerNode, attribute)}`);
            } else if (configKeys.indexOf(this._jsonConfigToNodeAttr(attribute)) > -1) {
                this.core.setAttribute(layerNode, attribute, this._toPythonType(config[this._jsonConfigToNodeAttr(attribute)]));
                this.logger.debug(`Set ${attribute} for ${this.core.getGuid(layerNode)}` +
                    ` to ${this.core.getAttribute(layerNode, attribute)}`);
            }
        });
        let layerName = this.core.getAttribute(layerNode, 'name');
        this.layerInfo[layerName] = layerNode;

    };

    ImportKeras.prototype._addConfigurableNodes = function (layerNode, layerConfig) {
        let allPointerNames = this.core.getValidPointerNames(layerNode);
        let config = layerConfig.config;
        this.logger.debug(`Layer ${this.core.getAttribute(layerNode, 'name')}` +
            ` has following configurable attributes ${allPointerNames.join(', ')}`);
        allPointerNames.filter(pointer => !!config[pointer])
            .forEach((pointer) => {
                let node = this._addFunctionNode(layerNode, config, pointer);
                this.core.setPointer(layerNode, pointer, node);
                this.logger.debug(`Added ${this.core.getAttribute(node, 'name')}`
                    + ` as ${pointer} to the layer `
                    + `${this.core.getAttribute(layerNode, 'name')}`);
            });
    };


    ImportKeras.prototype._addFunctionNode = function (layerNode, config, pointer){
        const baseNodeName = (typeof config[pointer] === 'string' ? config[pointer] : config[pointer].class_name);
        let configurableNode = this.core.createNode({
            parent: layerNode,
            base: this.META[this._getMetaTypeForClass(baseNodeName)]
        });
        this.logger.debug(`Added ${this.core.getAttribute(configurableNode, 'name')} as` +
            ` ${pointer} to the layer ${this.core.getAttribute(layerNode, 'name')}`);
        let validArgumentsForThisNode = this.core.getValidAttributeNames(configurableNode);
        let configForAddedNode = config[pointer].config;
        if (validArgumentsForThisNode && configForAddedNode) {
            validArgumentsForThisNode.forEach((arg) => {
                if (configForAddedNode[arg])
                    this.core.setAttribute(configurableNode, arg,
                        this._toPythonType(configForAddedNode[arg]));
            });
        }
        return configurableNode;
    };

    // This method is used to convert javascript arrays/booleans to a
    // list(python)/boolean in string Representation. Needed for
    // Code generation.
    ImportKeras.prototype._toPythonType = function (obj) {
        if (obj == null) {
            return 'None';
        }
        if (obj instanceof Array) {
            return '(' + obj.map((val) => {
                return this._toPythonType(val);
            }).join(', ') + ')';
        } else if (typeof obj === 'boolean') {
            return obj ? 'True' : 'False';
        } else {
            return obj;
        }
    };

    // This method is used to convert various classes from the
    // keras JSON to deepforge meta Nodes
    ImportKeras.prototype._getMetaTypeForClass = function (kerasClass) {
        let classMap = ModelMaps.CLASS_MAP;
        if (Object.keys(classMap).indexOf(kerasClass) > -1) {
            return classMap[kerasClass];
        } else {
            return kerasClass;
        }
    };

    // Change the model converts some JSON
    // layer attributes names (from keras) to the correct
    // attribute name for deepforge-keras nodes
    ImportKeras.prototype._jsonConfigToNodeAttr = function (orgName) {
        let argMap = ModelMaps.ARGUMENTS_MAP;
        if (Object.keys(argMap).indexOf(orgName) > -1) {
            return argMap[orgName];
        } else {
            return orgName;
        }
    };

    /**********************The functions below Add Connections between the Layers**************/
    ImportKeras.prototype.addConnections = async function () {
        // this._findNodeByName();
        let layers = this.modelInfo.layers;
        let layerInputConnections = {};
        let layerOutputConnections = {};
        let connections = null;
        layers.forEach((layer) => {
            layerInputConnections[layer.name] = [];
            layerOutputConnections[layer.name] = [];
        });

        layers.forEach((layer) => {
            if (layer.inbound_nodes.length > 0) {
                connections = layer.inbound_nodes;
                connections.forEach((connection) => {

                    if (this._layerNameExists(connection)) {
                        layerInputConnections[layer.name].push(connection);
                        layerOutputConnections[connection].push(layer.name);
                    }
                });

            }
        });

        await this._updateConnections(layerInputConnections);
    };


    ImportKeras.prototype._layerNameExists = function (layerName) {
        let allLayerNames = this.modelInfo.layers.map((layer) => {
            return layer.name;
        });

        return allLayerNames.indexOf(layerName) > -1;
    };

    ImportKeras.prototype._updateConnections = function (inputs) {
        let allLayerNames = Object.keys(inputs);
        return Promise.all(allLayerNames.map((layerName) => {
            let dstLayer = this.layerInfo[layerName];
            let srcs = inputs[layerName];
            return Promise.all(srcs.map((src, index) => {
                return this._connectLayers(this.layerInfo[src], dstLayer, index);
            }));
        }));
    };

    ImportKeras.prototype._connectLayers = async function (srcLayer, dstLayer, index) {

        // FIXME: Do we really want to always be connecting to the *first* input/output?
        let srcPort = (await this.getOrderedMembers(srcLayer, 'outputs'))[0];
        let dstPort = (await this.getOrderedMembers(dstLayer, 'inputs'))[0];

        if (dstPort && srcPort) {
            this.core.addMember(dstPort, 'source', srcPort);
            this.core.setMemberRegistry(dstPort,
                'source',
                this.core.getPath(srcPort),
                'position', {x: 100, y: 100});
            this.core.setMemberAttribute(dstPort, 'source',
                this.core.getPath(srcPort),
                'index', index);
            this.logger.debug(`Connected ${this.core.getAttribute(srcLayer, 'name')} ` +
                `with ${this.core.getAttribute(dstLayer, 'name')} as input ${index}`);
        }
    };

    ImportKeras.prototype.getOrderedMembers = async function (node, setName) {
        const members = await this.core.loadMembers(node, setName);

        members.sort((m1, m2) => {
            const index1 = this.getMemberIndex(node, setName, m1);
            const index2 = this.getMemberIndex(node, setName, m2);
            return index1 < index2 ? -1 : 1;
        });

        return members;
    };

    ImportKeras.prototype.getMemberIndex = function (node, setName, member) {
        const path = this.core.getPath(member);
        return this.core.getMemberAttribute(node, setName, path, 'index');
    };

    return ImportKeras;
});
