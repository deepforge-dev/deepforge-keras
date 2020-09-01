/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge-keras/plugins/JSONImporter',
    'deepforge-keras/Constants',
    'plugin/PluginBase',
    'common/util/guid',
    'underscore',
    'q',
    './schemas/index',
    'text!./metadata.json',
], function (
    JSONImporter,
    Constants,
    PluginBase,
    generateGuid,
    _,
    Q,
    Schemas,
    pluginMetadata,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const {SpecialTypes, Layers} = Schemas;
    const ConcreteLayers = Layers.filter(schema => !schema.abstract);
    const DEFAULT_META_TAB = 'META';

    var CreateKerasMeta = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    CreateKerasMeta.metadata = pluginMetadata;

    CreateKerasMeta.prototype = Object.create(PluginBase.prototype);
    CreateKerasMeta.prototype.constructor = CreateKerasMeta;

    CreateKerasMeta.prototype.main = async function (callback) {
        this.metaSheets = {};
        this.sheetCounts = {};
        this.aliases = {};

        const importer = new JSONImporter(this.core, this.rootNode);
        const state = await this.getBaseModel(importer);
        await this.createCategories(state, ConcreteLayers);
        await this.createFunctionNodes(state);
        await this.createLayers(state);

        await importer.apply(this.rootNode, state);
        await this.save('CreateKerasMeta updated metamodel.');
        this.result.setSuccess(true);
        callback(null, this.result);
    };

    CreateKerasMeta.prototype.resolveName = function (name) {
        return this.aliases[name] || name;
    };

    CreateKerasMeta.prototype.getBaseModel = async function (importer) {
        const placeholder = name => ({id: `@name:${name}`});
        const language = {
            id: '@name:Language',
            children: [],
        };

        const root = await importer.toJSON(this.rootNode, true);
        this.language = language;

        this.metaSheets.META = this.createMetaSheetTab(root, 'META');
        root.children = [
            placeholder('FCO'),
            language,
        ];

        // Create the base class, if needed
        this.addNodeToMeta(root, language);

        const existingNodes = [
            'Architecture',
            'Layer',
            'LayerData',
            'LayerInput',
            'LayerOutput',
            'Function',
        ];
        existingNodes.forEach(name => language.children.push(placeholder(name)));

        return root;
    };

    CreateKerasMeta.prototype.getSpecialTypeNames = function () {
        return Object.keys(SpecialTypes).map(CreateKerasMeta.capitalize);
    };

    CreateKerasMeta.prototype.getSpecialTypeBaseName = function (type) {
        type = CreateKerasMeta.capitalize(type);
        return `${type}Function`;
    };

    CreateKerasMeta.prototype.createFunctionNodes = function (root) {
        const specialTypes = this.getSpecialTypeNames();

        specialTypes.forEach(type => {
            const isActivation = type.toLowerCase() === 'activation';
            SpecialTypes[type.toLowerCase()].forEach(schema => {
                this.logger.debug(`adding "${schema.name}" layer`);
                const baseName = this.getSpecialTypeBaseName(type);

                if (isActivation) {
                    schema.arguments.shift();
                }

                const node = this.createMetaLayer(root, schema, baseName, baseName);

                // Make the node non-abstract
                if (node) {
                    node.registry.isAbstract = false;
                    // Record the node under any aliases
                    if (!schema.aliases) throw new Error(`${schema.name} is missing "aliases" field`);

                    schema.aliases
                        .forEach(alias => this.aliases[alias] = schema.name);
                }
            });
        });
    };

    CreateKerasMeta.prototype.getLayerCategories = function (schemas) {
        let content = {};

        schemas = schemas || ConcreteLayers;
        schemas.forEach(layer => {
            const layerBase = layer.category || layer.file;
            var type = this.getBaseName(layerBase);

            content[type] = true;
        });
        return Object.keys(content);
    };

    CreateKerasMeta.prototype.createCategories = function (root, schemas) {
        // Get the categories
        // Create the category nodes
        const categories = this.getLayerCategories(schemas);

        // Add activation, constraint, etc, functions
        categories.forEach(name => {
            this.metaSheets[name] = this.createMetaSheetTab(root, name);
            this.logger.debug(`Creating layer category ${name}`);
            const node = this.createMetaNode(root, name, '@meta:Layer', name);
            node.registry.isAbstract = true;
        });

        this.getSpecialTypeNames().forEach(type => {
            const base = this.getSpecialTypeBaseName(type);
            this.metaSheets[base] = this.createMetaSheetTab(root, base);
            this.logger.debug(`Creating special type category ${base}`);
            const node = this.createMetaNode(root, base, `@meta:Function`, base);
            node.registry.isAbstract = true;
        });
    };

    CreateKerasMeta.prototype.getBaseName = function (filename) {
        var type = filename.split('/').pop().replace(/(_v2)?\.py$/, '');
        return type[0].toUpperCase() + type.substring(1);
    };

    CreateKerasMeta.prototype.getBaseFor = function (layer) {
        var type = this.getBaseName(layer.file);
        if (!this.META[type]) type = 'Layer';
        return this.META[type];
    };

    CreateKerasMeta.prototype.createLayers = function (root) {
        ConcreteLayers.forEach(layer => {
            this.logger.debug(`adding "${layer.name}" layer`);
            const node = this.createMetaLayer(root, layer);
            node.registry.isAbstract = false;
        });
    };

    CreateKerasMeta.prototype.getLayerSchema = function (name) {
        return Layers.find(layer => layer.name === name);
    };

    CreateKerasMeta.prototype.createMetaSheetTab = function (root, name) {
        const sheets = root.registry[Constants.REGISTRY.META_SHEETS];
        let sheet = sheets.find(sheet => sheet.title === name);

        if (!sheet) {
            const id = Constants.META_ASPECT_SHEET_NAME_PREFIX + generateGuid();
            sheet = {
                SetID: id,
                order: sheets.length,
                title: name
            };
            this.logger.debug(`creating meta sheet "${name}"`);
            sheets.push(sheet);

            root.sets[id] = [];
            root.member_registry[id] = {};
        }
        return sheet.SetID;
    };

    CreateKerasMeta.prototype.getCleanLayerArgs = function (layer) {
        let layerArgs = this.getLayerProperty(layer, 'arguments') || [];

        if (layerArgs[0] && layerArgs[0].name === 'self') {
            layerArgs.shift();
        }

        return layerArgs
            .filter(arg => arg.name !== 'name')
            .map(arg => {
                if (!arg.type && Array.isArray(arg.default)) {
                    arg.default = `(${arg.default.join(', ')})`;
                }
                return arg;
            });
    };

    CreateKerasMeta.prototype.createMetaLayer = function (root, layer, baseName, category) {
        // create a meta node for the given layer
        const layerCategory = layer.category || layer.file;
        category = category || this.getBaseName(layerCategory);
        baseName = baseName || this.getBaseName(layerCategory);

        const base = `@meta:${baseName}`;
        const node = this.createMetaNode(root, layer.name, base, category, layer.aliases);

        // Clean the arguments
        const layerArgs = this.getCleanLayerArgs(layer);
        const argNames = layerArgs.map(arg => arg.name);

        layerArgs.forEach(arg => {
            let type = this.getArgumentType(layer, arg.name);
            this.addParameter(node, arg.name, {type: type}, arg.default);
        });

        // Add ctor args
        node.attribute_meta[Constants.ATTR.CTOR_ARGS] = {type: 'string'};
        node.attributes[Constants.ATTR.CTOR_ARGS] = argNames.join(',');

        this.logger.debug(`added attributes to ${layer.name}`);

        // Add docstring
        node.attribute_meta[Constants.ATTR.DOC] = {type: 'string'};
        if (layer.docstring) {
            node.attributes[Constants.ATTR.DOC] = layer.docstring;
        }
        // Add the inputs
        this.addLayerInputs(node, layer);

        // Add the outputs
        this.addLayerOutputs(node, layer);

        return node;
    };

    CreateKerasMeta.prototype.getArgumentType = function (layer, name) {
        const arg = layer.arguments && layer.arguments.find(arg => arg.name === name);
        if (!arg) {
            return undefined;
        }
        const type = arg.type || typeof arg.default;
        return type;
    };

    CreateKerasMeta.prototype.createIOSet = function (node, name) {
        const meta = {min: -1, max: -1};
        meta['@meta:LayerData'] = {min: -1, max: -1};
        node.pointer_meta[name] = meta;
    };

    CreateKerasMeta.prototype.addLayerInputs = function (node, layer) {
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
                const dataNode = {
                    id: `@name:${input.name}`,
                    pointers: {base: `@meta:LayerInput`},
                };
                node.children.push(dataNode);

                // Add it to the set of outputs for the node
                if (!node.sets.inputs) node.sets.inputs = [];

                node.sets.inputs.push(dataNode.id);

                // set the index
                ensureCanNest(node, ['member_attributes', 'inputs', dataNode.id]);
                node.member_attributes.inputs[dataNode.id].index = i;
            });
        }
        return data;
    };

    CreateKerasMeta.prototype.isRecurrentLayer = function (layer) {
        const args = layer.arguments || [];
        return !!args.find(arg => arg.name === 'return_state');
    };

    CreateKerasMeta.prototype.addLayerOutputs = function (node, layer) {
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
            const dataNode = {
                id: `@name:${input.name}`,
                pointers: {base: `@meta:LayerOutput`},
            };
            node.children.push(dataNode);

            // Add it to the set of outputs for the node
            if (!node.sets.outputs) node.sets.outputs = [];

            node.sets.outputs.push(dataNode.id);

            // set the index
            ensureCanNest(node, ['member_attributes', 'outputs', dataNode.id]);
            node.member_attributes.outputs[dataNode.id].index = i;
        });
    };

    CreateKerasMeta.prototype.getLayerProperty = function (layer, prop) {
        if (layer[prop]) {
            return layer[prop];
        }

        for (let i = Layers.length; i--;) {
            if (layer.base === Layers[i].name) {
                return layer[prop] || this.getLayerProperty(Layers[i], prop);
            }
        }
        return null;
    };

    CreateKerasMeta.prototype.createMetaNode = function (root, name, baseId, tabName, aliases) {
        tabName = tabName || DEFAULT_META_TAB;
        aliases = aliases || [];

        const id = aliases.find(alias => this.META.hasOwnProperty(alias)) || name;
        const node = {
            id: `@meta:${id}`,
            pointers: {base: baseId},
            attributes: {name},
            registry: {},
            attribute_meta: {},
            pointer_meta: {},
            sets: {},
            children: [],
        };

        this.language.children.push(node);
        this.addNodeToMeta(root, node, tabName);
        return node;
    };

    CreateKerasMeta.prototype.addNodeToMeta = function(root, node, tabName=DEFAULT_META_TAB) {
        let tabId = this.metaSheets[tabName];
        let position = this.getNextPositionFor(tabName);

        if (!tabId) {
            var err = `No meta sheet for ${tabName}`;
            this.logger.error(err);
            throw new Error(err);
        }

        const nodeId = node.id;
        root.sets[Constants.META_ASPECT_SET_NAME].push(nodeId);
        root.sets[tabId].push(nodeId);

        const registry = {};
        registry[Constants.REGISTRY.POSITION] = position;
        root.member_registry[Constants.META_ASPECT_SET_NAME][nodeId] = registry;
        root.member_registry[tabId][nodeId] = registry;

        this.logger.debug(`added ${node.id} to the meta`);
    };

    CreateKerasMeta.prototype.getNextPositionFor = function(tabName) {
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

    CreateKerasMeta.prototype.addParameter = function (node, name, schema, defVal) {
        var type = this.resolveName(schema.type);
        defVal = this.resolveName(defVal);

        // Check if it should be a pointer or an attribute
        if (SpecialTypes[type]) {  // look up node for special types
            type = this.getSpecialTypeBaseName(type);
        }

        const isNodeRefType = !!this.META[type];
        if (isNodeRefType) {  // should be ptr to another node
            const ptrMeta = {min: -1, max: 1};
            ptrMeta[`@meta:${type}`] = {min: -1, max: 1};
            node.pointer_meta[name] = ptrMeta;

            if (defVal && defVal !== 'None') {
                const target = {
                    id: `@name:${defVal}`,
                    pointers: {base: `@meta:${defVal}`},
                };
                node.children.push(target);
                node.pointers[name] = target.id;
            }
        } else {
            return this.addAttribute(node, name, schema, defVal);
        }
    };

    CreateKerasMeta.prototype.addAttribute = function (node, name, schema, defVal) {
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
        node.attribute_meta[name] = schema;

        if (defVal !== undefined && defVal !== null) {
            node.attributes[name] = defVal;
        }
    };

    function ensureCanNest(dict, keys) {
        keys.forEach(key => {
            if (!dict[key]) {
                dict[key] = {};
            }
            dict = dict[key];
        });
    }

    // Helpers for testing
    CreateKerasMeta.prototype.getSchemas = function () {
        return ConcreteLayers;
    };

    CreateKerasMeta.capitalize = function (str) {
        return str[0].toUpperCase() + str.slice(1);
    };

    return CreateKerasMeta;
});
