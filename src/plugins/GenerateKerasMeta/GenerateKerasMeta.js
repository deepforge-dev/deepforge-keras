/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge-keras/Constants',
    'plugin/PluginBase',
    'common/util/guid',
    'underscore',
    'q',

    'text!./additional-layers.json',
    'text!deepforge-keras/schemas/activations.json',
    'text!deepforge-keras/schemas/initializers.json',
    'text!deepforge-keras/schemas/constraints.json',
    'text!deepforge-keras/schemas/regularizers.json',
    'text!deepforge-keras/schemas/layers.json',
    'text!./metadata.json'
], function (
    Constants,
    PluginBase,
    generateGuid,
    _,
    Q,
    AdditionalLayerTxt,
    ActivationsTxt,
    InitializersTxt,
    ConstraintsTxt,
    RegularizersTxt,
    LayerTxt,
    pluginMetadata
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const AdditionalLayers = JSON.parse(AdditionalLayerTxt);
    const ALL_LAYERS = JSON.parse(LayerTxt).concat(AdditionalLayers)
        .map(layer => {  // apply any special case patching
            if (layer.name === 'Wrapper') {
                layer.arguments[1].type = 'Layer';
            }
            if (layer.name === 'Bidirectional') {
                layer.arguments[1].type = 'Recurrent';
            }
            return layer;
        });
    const LAYERS = ALL_LAYERS.filter(schema => !schema.abstract);
    const TYPES = {
        activation: JSON.parse(ActivationsTxt),
        constraint: JSON.parse(ConstraintsTxt),
        regularizer: JSON.parse(RegularizersTxt),
        initializer: JSON.parse(InitializersTxt)
    };
    const DEFAULT_META_TAB = 'META';

    /**
     * Initializes a new instance of GenerateKerasMeta.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateKerasMeta.
     * @constructor
     */
    var GenerateKerasMeta = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateKerasMeta.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateKerasMeta.prototype = Object.create(PluginBase.prototype);
    GenerateKerasMeta.prototype.constructor = GenerateKerasMeta;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateKerasMeta.prototype.main = function (callback) {
        this.metaSheets = {};
        this.sheetCounts = {};
        this.nodes = {};

        return this.prepareMetaModel()
            .then(() => this.createCategories(LAYERS))
            .then(() => this.createFunctionNodes())
            .then(() => this.updateNodes())
            .then(() => this.save('GenerateKerasMeta updated metamodel.'))
            .then(() => {
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .catch(err => {
                // Result success is false at invocation.
                callback(err, this.result);
            });

    };

    GenerateKerasMeta.prototype.prepareMetaModel = function () {
        // Create the base class, if needed
        this.metaSheets.META = this.createMetaSheetTab('META');
        if (!this.META.Language) {
            let node = this.core.createNode({
                parent: this.rootNode,
                base: this.META.FCO
            });
            this.core.setAttribute(node, 'name', 'Language');
            this.META.Language = node;
            this.addNodeToMeta(node);
        }

        if (!this.META.Architecture) {
            this.META.Architecture = this.createMetaNode('Architecture', this.META.FCO);
        }

        if (!this.META.Layer) {
            this.META.Layer = this.createMetaNode('Layer', this.META.FCO);
        }

        return Q();
    };

    GenerateKerasMeta.prototype.getSpecialTypeNames = function () {
        return Object.keys(TYPES).map(GenerateKerasMeta.capitalize);
    };

    GenerateKerasMeta.prototype.getSpecialTypeBaseName = function (type) {
        type = GenerateKerasMeta.capitalize(type);
        return `${type}Function`;
    };

    GenerateKerasMeta.prototype.getCategories = function (schemas) {
        let content = {};

        schemas = schemas || LAYERS;
        schemas.forEach(layer => {
            var type = this.getBaseName(layer.file);
            content[type] = true;
        });

        // Add activation, constraint, etc, functions
        let specialTypes = this.getSpecialTypeNames();
        specialTypes
            .map(type => this.getSpecialTypeBaseName(type))
            .forEach(baseName => content[baseName] = true);
        return Object.keys(content);
    };

    GenerateKerasMeta.prototype.createFunctionNodes = function () {
        let specialTypes = this.getSpecialTypeNames();
        // Activation functions nodes
        specialTypes.forEach(type => {
            TYPES[type.toLowerCase()].forEach(schema => {
                this.logger.debug(`adding "${schema.name}" layer`);
                let baseName = this.getSpecialTypeBaseName(type);
                let node = this.createMetaLayer(schema, baseName, baseName);

                // Make the node non-abstract
                if (node) {
                    this.core.setRegistry(node, 'isAbstract', false);
                    this.nodes[schema.name] = node;
                    // Record the node under any aliases
                    if (!schema.aliases) throw new Error(`${schema.name} is missing "aliases" field`);
                    schema.aliases.forEach(alias => this.nodes[alias] = node);
                }
            });
        });
    };

    GenerateKerasMeta.prototype.createCategories = function (schemas) {
        // Get the categories
        // Create the category nodes
        var categories = this.getCategories(schemas);
        categories
            .forEach(name => {
                let node = this.META[name];
                this.metaSheets[name] = this.createMetaSheetTab(name);
                if (!node) {
                    this.logger.debug(`Creating category ${name}`);
                    node = this.createMetaNode(name, this.META.Layer, name);
                }

                // Create a tab for each
                this.nodes[name] = node;
            });

        // Make them abstract
        categories
            .forEach(name => this.core.setRegistry(this.META[name], 'isAbstract', true));

    };

    GenerateKerasMeta.prototype.getBaseName = function (filename) {
        var type = filename.split('/').pop().replace(/\.py$/, '');
        return type[0].toUpperCase() + type.substring(1);
    };

    GenerateKerasMeta.prototype.getBaseFor = function (layer) {
        var type = this.getBaseName(layer.file);
        if (!this.META[type]) type = 'Layer';
        return this.META[type];
    };

    GenerateKerasMeta.prototype.updateNodes = function () {
        return Q.all(LAYERS.map(schema => this.updateNode(schema)));
    };

    GenerateKerasMeta.prototype.getLayerSchema = function (name) {
        return ALL_LAYERS.find(layer => layer.name === name);
    };

    GenerateKerasMeta.prototype.updateNode = function (layer) {
        // Create the actual nodes
        this.logger.debug(`adding "${layer.name}" layer`);
        let node = this.createMetaLayer(layer);

        // Make the node non-abstract
        if (node) {
            this.core.setRegistry(node, 'isAbstract', false);
            this.nodes[layer.name] = node;
        }
    };

    GenerateKerasMeta.prototype.removeFromMeta = function (nodeId) {
        var sheets = this.core.getRegistry(this.rootNode, Constants.REGISTRY.META_SHEETS),
            sheet;

        // Remove from meta
        this.core.delMember(this.rootNode, Constants.META_ASPECT_SET_NAME, nodeId);

        // Remove from the given meta sheet
        sheet = sheets.find(sheet => {
            var paths = this.core.getMemberPaths(this.rootNode, sheet.SetID);
            return paths.indexOf(nodeId) > -1;
        });

        if (sheet) {
            this.core.delMember(this.rootNode, sheet.SetID, nodeId);
        }
    };

    GenerateKerasMeta.prototype.createMetaSheetTab = function (name) {
        var sheets = this.core.getRegistry(this.rootNode, Constants.REGISTRY.META_SHEETS),
            id = Constants.META_ASPECT_SHEET_NAME_PREFIX + generateGuid(),
            sheet,
            desc = {
                SetID: id,
                order: sheets.length,
                title: name
            };

        sheet = sheets.find(sheet => sheet.title === name);
        if (!sheet) {
            sheet = desc;
            this.logger.debug(`creating meta sheet "${name}"`);
            this.core.createSet(this.rootNode, sheet.SetID);
            sheets.push(sheet);
            this.core.setRegistry(this.rootNode, Constants.REGISTRY.META_SHEETS, sheets);
        }
        return sheet.SetID;
    };

    // Some helper methods w/ attribute handling
    GenerateKerasMeta.prototype.createMetaLayer = function (layer, baseName, category) {
        // create a meta node for the given layer
        category = category || this.getBaseName(layer.file);
        baseName = baseName || this.getBaseName(layer.file);
        if (!this.META[baseName]) baseName = 'Layer';

        var base = this.META[baseName];
        var node = this.createMetaNode(layer.name, base, category);

        // Clean the arguments
        let layerArgs = this.getLayerProperty(layer, 'arguments') || [];

        if (layerArgs[0] && layerArgs[0].name === 'self') {
            layerArgs.shift();
        }
        layerArgs = layerArgs.filter(arg => arg.name !== 'name');

        var argNames = layerArgs.map(arg => arg.name);

        layerArgs.forEach(arg => {
            let type = this.getArgumentType(layer, arg.name);
            this.addParameter(node, arg.name, {type: type}, arg.default);
        });

        // Add ctor args
        this.core.setAttributeMeta(node, Constants.ATTR.CTOR_ARGS, {type: 'string'});
        this.core.setAttribute(node, Constants.ATTR.CTOR_ARGS, argNames.join(','));

        this.logger.debug(`added attributes to ${layer.name}`);

        // Add the inputs
        this.addLayerInputs(node, layer);

        // Add the outputs
        this.addLayerOutputs(node, layer);

        return node;
    };

    GenerateKerasMeta.prototype.getArgumentType = function (layer, name) {
        let arg, type;

        // For now, we assume that arguments used by both a child and base class
        // are the same type. Ideally, we would inspect the usage of the
        // parameter. For now, this should be sufficient.
        while (layer && !type) {
            arg = layer.arguments && layer.arguments.find(arg => arg.name === name);
            if (!arg) {  // if the argument is not used, stop tracing the inheritance
                return undefined;
            }
            type = arg.type;
            layer = this.getLayerSchema(layer.base);
        }
        return type;
    };

    GenerateKerasMeta.prototype.createIOSet = function (node, name) {
        this.core.setPointerMetaTarget(node, name, this.META.LayerData);
        this.core.setPointerMetaLimits(node, name, -1, -1);
        this.core.createSet(node, name);
    };

    GenerateKerasMeta.prototype.addLayerInputs = function (node, layer) {
        if (!this.getLayerProperty(layer, 'inputs')) {
            this.logger.error(`${layer.name} is missing inputs`);
        }

        this.createIOSet(node, 'inputs');
        const data = this.getLayerProperty(layer, 'inputs');
        if (data) {
            if (data[0].name === 'self') {
                data.shift();
            }

            // Create a node in the current layer
            data.forEach((input, i) => {
                let dataNode = this.core.createNode({
                    parent: node,
                    base: this.META.LayerInput
                });
                this.core.setAttribute(dataNode, 'name', input.name);

                // Add it to the set of inputs for the node
                this.core.addMember(node, 'inputs', dataNode);

                // Set the index
                const inputId = this.core.getPath(dataNode);
                this.core.setMemberAttribute(node, 'inputs', inputId, 'index', i);

            });
        }
        return data;
    };

    GenerateKerasMeta.prototype.isRecurrentLayer = function (layer) {
        const args = layer.arguments || [];
        return !!args.find(arg => arg.name === 'return_state');
    };

    GenerateKerasMeta.prototype.addLayerOutputs = function (node, layer) {
        if (!this.getLayerProperty(layer, 'outputs')) {
            this.logger.error(`${layer.name} is missing outputs`);
        }

        this.createIOSet(node, 'outputs');
        const data = this.getLayerProperty(layer, 'outputs') || [];

        // Also shouldn't add these to any of the activation, reg, init functions
        // TODO
        if (layer.name !== 'Output' && !data.length) {
            data.push({name: 'output'});
        }

        if (this.isRecurrentLayer(layer)) {
            data.push({name: 'hidden_state'});
            data.push({name: 'cell_state'});
        }

        // Create a node in the current layer
        data.forEach((input, i) => {
            let dataNode = this.core.createNode({
                parent: node,
                base: this.META.LayerOutput
            });
            this.core.setAttribute(dataNode, 'name', input.name);

            // Add it to the set of outputs for the node
            this.core.addMember(node, 'outputs', dataNode);

            // Set the index
            const inputId = this.core.getPath(dataNode);
            this.core.setMemberAttribute(node, 'outputs', inputId, 'index', i);
        });
    };

    GenerateKerasMeta.prototype.getLayerProperty = function (layer, prop) {
        if (layer[prop]) {
            return layer[prop];
        }

        for (let i = ALL_LAYERS.length; i--;) {
            if (layer.base === ALL_LAYERS[i].name) {
                return layer[prop] || this.getLayerProperty(ALL_LAYERS[i], prop);
            }
        }
        return null;
    };

    GenerateKerasMeta.prototype.createMetaNode = function (name, base, tabName) {
        var node = this.META[name],
            nodeId = node && this.core.getPath(node);

        tabName = tabName || DEFAULT_META_TAB;

        if (!node) {
            // Create a node
            node = this.core.createNode({
                parent: this.META.Language,
                base: base
            });
            this.core.setAttribute(node, 'name', name);
            this.META[name] = node;
        } else {
            // Remove from meta
            this.removeFromMeta(nodeId);
            this.core.setBase(node, base);
        }

        // Add it to the meta sheet
        this.addNodeToMeta(node, tabName);
        return node;
    };

    GenerateKerasMeta.prototype.addNodeToMeta = function(node, tabName) {
        tabName = tabName || DEFAULT_META_TAB;
        let tabId = this.metaSheets[tabName];
        let position = this.getNextPositionFor(tabName);

        if (!tabId) {
            var err = `No meta sheet for ${tabName}`;
            this.logger.error(err);
            throw err;
        }

        this.core.addMember(this.rootNode, Constants.META_ASPECT_SET_NAME, node);
        this.core.addMember(this.rootNode, tabId, node);

        const nodeId = this.core.getPath(node);
        this.core.setMemberRegistry(
            this.rootNode,
            Constants.META_ASPECT_SET_NAME,
            nodeId,
            Constants.REGISTRY.POSITION,
            position
        );
        this.core.setMemberRegistry(
            this.rootNode,
            tabId,
            nodeId,
            Constants.REGISTRY.POSITION,
            position
        );

        const name = this.core.getAttribute(node, 'name');
        this.logger.debug(`added ${name} to the meta`);
    };

    GenerateKerasMeta.prototype.getNextPositionFor = function(tabName) {
        var index = this.sheetCounts[tabName] || 0,
            position,
            dx = 140,
            dy = 100,
            MAX_WIDTH = 1200,
            x;

        this.sheetCounts[tabName] = index + 1;
        if (index === 0) {
            position = {
                x: MAX_WIDTH/2,
                y: 50
            };
        } else {
            x = dx*index;
            position = {
                x: x%MAX_WIDTH,
                y: Math.floor(x/MAX_WIDTH+1)*dy + 50
            };
        }
        return position;
    };

    GenerateKerasMeta.prototype.addLayerAttribute = function (name, node) {
        // No default value support for now...
        // Create a pointer of the given type on the node
        this.core.setPointerMetaTarget(node, name, this.META.Architecture, 1, 1);
        this.core.setPointerMetaLimits(node, name, 1, 1);
    };

    GenerateKerasMeta.prototype.addParameter = function (node, name, schema, defVal) {
        var type = schema.type;

        // Check if it should be a pointer or an attribute
        if (TYPES[type]) {  // look up node for special types
            type = this.getSpecialTypeBaseName(type);
        }

        const isNodeRefType = !!this.META[type];
        if (isNodeRefType) {  // should be ptr to another node
            this.core.setPointerMetaTarget(node, name, this.META[type], 1, 1);
            this.core.setPointerMetaLimits(node, name, 1, 1);

            if (defVal && defVal !== 'None') {
                // Look up the given meta node. May need to use an alias
                let targetType = this.nodes[defVal];
                if (!targetType) throw new Error(`Invalid ${type}: ${defVal}`);

                let target = this.core.createNode({
                    parent: node,
                    base: targetType
                });
                this.core.setPointer(node, name, target);
            }
        } else {
            return this.addAttribute(node, name, schema, defVal);
        }
    };

    GenerateKerasMeta.prototype.addAttribute = function (node, name, schema, defVal) {
        schema.type = schema.type || 'string';

        if (schema.min !== undefined) {
            schema.min = +schema.min;
        }

        if (schema.max !== undefined) {
            // Set the min, max
            schema.max = +schema.max;
        }
        // Add the enum for booleans so we use python style True/False
        if (schema.type === 'boolean') {
            schema.enum = ['True', 'False'];
            schema.type = 'string';
        }

        // Create the attribute and set the schema
        this.core.setAttributeMeta(node, name, schema);

        if (defVal !== undefined && defVal !== null) {
            this.core.setAttribute(node, name, defVal);
        }
    };

    // Helpers for testing
    GenerateKerasMeta.prototype.getSchemas = function () {
        return LAYERS;
    };

    GenerateKerasMeta.capitalize = function (str) {
        return str[0].toUpperCase() + str.slice(1);
    };

    return GenerateKerasMeta;
});
