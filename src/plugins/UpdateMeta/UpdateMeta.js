/*globals define*/
/*jshint node:true, browser:true*/

// TODO: Add support for additional types
define([
    'plugin/PluginConfig',
    'keras/Constants',
    'text!keras/activations.json',
    'text!./metadata.json',
    'text!./schema.json',
    'plugin/PluginBase',
    'common/util/guid',
    'underscore',
    'q'
], function (
    PluginConfig,
    Constants,
    ActivationsTxt,
    pluginMetadata,
    schemaText,
    PluginBase,
    generateGuid,
    _,
    Q
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const SCHEMAS = JSON.parse(schemaText).filter(schema => !schema.abstract);
    const ACTIVATIONS = JSON.parse(ActivationsTxt).map(info => info.name);
    const DEFAULT_META_TAB = 'META';

    /**
     * Initializes a new instance of UpdateMeta.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin UpdateMeta.
     * @constructor
     */
    var UpdateMeta = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    UpdateMeta.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    UpdateMeta.prototype = Object.create(PluginBase.prototype);
    UpdateMeta.prototype.constructor = UpdateMeta;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    UpdateMeta.prototype.main = function (callback) {
        this.metaSheets = {};
        this.sheetCounts = {};
        this.nodes = {};

        return this.prepareMetaModel()
            .then(() => this.createCategories(SCHEMAS))
            .then(() => this.updateNodes())
            .then(() => this.save('UpdateMeta updated metamodel.'))
            .then(() => {
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .catch(err => {
                // Result success is false at invocation.
                callback(err, this.result);
            });

    };

    UpdateMeta.prototype.prepareMetaModel = function () {
        // Create the base class, if needed
        this.metaSheets.META = this.createMetaSheetTab('META');
        if (!this.META.Language) {
            let node = this.core.createNode({
                parent: this.rootNode,
                base: this.META.FCO
            });
            this.core.setAttribute(node, 'name', 'Language');
            this.META.Language = node;
        }

        if (!this.META.Architecture) {
            this.META.Architecture = this.createMetaNode('Architecture', this.META.FCO);
        }

        if (!this.META.Layer) {
            this.META.Layer = this.createMetaNode('Layer', this.META.FCO);
        }

        //var isNewLayer = {},
            //newLayers = schemas.map(layer => layer.name),
            //oldLayers,
            //oldNames;

        //newLayers = newLayers.concat(this.getCategories());  // add the category nodes
        //newLayers.forEach(name => isNewLayer[name] = true);

        //// Set the newLayer nodes 'base' to 'Layer' so we don't accidentally
        //// delete them
        //newLayers
            //.map(name => this.META[name])
            //.filter(layer => !!layer)
            //.forEach(layer => this.core.setBase(layer, this.META.Layer));

        //oldLayers = Object.keys(this.META)
                //.filter(name => name !== 'Layer')
                //.map(name => this.META[name])
                //.filter(node => this.isMetaTypeOf(node, this.META.Layer))
                //.filter(node => !isNewLayer[this.core.getAttribute(node, 'name')]);

        //oldNames = oldLayers.map(l => this.core.getAttribute(l, 'name'));
        //// Get the old layer names
        //this.logger.debug(`Removing layers: ${oldNames.join(', ')}`);
        //oldLayers.forEach(layer => this.core.deleteNode(layer));
        return Q();
    };

    UpdateMeta.prototype.getCategories = function (schemas) {
        let content = {};

        schemas = schemas || SCHEMAS;
        schemas.forEach(layer => {
            var type = this.getBaseName(layer.file);
            if (!content[type]) {
                content[type] = [];
            }
            content[type].push(layer);
        });

        return Object.keys(content);
    };

    UpdateMeta.prototype.createCategories = function (schemas) {
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

    UpdateMeta.prototype.getBaseName = function (filename) {
        var type = filename.split('/').pop().replace(/\.py$/, '');
        return type[0].toUpperCase() + type.substring(1);
    };

    UpdateMeta.prototype.getBaseFor = function (layer) {
        var type = this.getBaseName(layer.file);
        if (!this.META[type]) type = 'Layer';
        return this.META[type];
    };

    UpdateMeta.prototype.updateNodes = function () {
        return Q.all(SCHEMAS.map(schema => this.updateNode(schema)));
    };

    UpdateMeta.prototype.updateNode = function (layer) {
        // Create the actual nodes
        this.logger.debug(`adding "${layer.name}" layer`);
        let node = this.createMetaLayer(layer);

        // Make the node non-abstract
        if (node) {
            this.core.setRegistry(node, 'isAbstract', false);
            this.nodes[layer.name] = node;
        }
    };

    UpdateMeta.prototype.removeFromMeta = function (nodeId) {
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

    UpdateMeta.prototype.createMetaSheetTab = function (name) {
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
    UpdateMeta.prototype.createMetaLayer = function (layer) {
        // create a meta node for the given layer
        var category = this.getBaseName(layer.file);
        var node = this.createMetaNode(layer.name, this.getBaseFor(layer), category);

        // Clean the arguments
        if (layer.arguments[0] && layer.arguments[0].name === 'self') {
            layer.arguments.shift();
        }
        layer.arguments = layer.arguments.filter(arg => arg.name !== 'name');

        var argNames = layer.arguments.map(arg => arg.name);

        layer.arguments.forEach(arg => {
            this.addAttribute(arg.name, node, {type: arg.type}, arg.default);
        });

        // Add ctor args
        this.core.setAttributeMeta(node, Constants.ATTR.CTOR_ARGS, {type: 'string'});
        this.core.setAttribute(node, Constants.ATTR.CTOR_ARGS, argNames.join(','));

        this.logger.debug(`added attributes to ${layer.name}`);

        // Remove attributes not in the given list
        //var currentAttrs = this.core.getValidAttributeNames(node),
            //defVal,
            //rmAttrs,
            //simpleAttrs,
            //rmPtrs;

        //simpleAttrs = argNames;
        //rmAttrs = _.difference(currentAttrs, simpleAttrs)  // old attribute names
            //.filter(attr => attr !== 'name');

        //rmAttrs.forEach(attr => {
            //this.core.delAttributeMeta(node, attr);
            //if (this.core.getOwnAttribute(node, attr) !== undefined) {
                //this.core.delAttribute(node, attr);
            //}
        //});
        this.logger.debug(`removed old attributes for ${layer.name}`);

        return node;
    };

    UpdateMeta.prototype.createMetaNode = function (name, base, tabName) {
        var node = this.META[name],
            nodeId = node && this.core.getPath(node),
            //setters = {},
            //defaults = {},
            //types = {},
            position,
            tabId;

        tabName = tabName || DEFAULT_META_TAB;
        tabId = this.metaSheets[tabName];
        position = this.getPositionFor(name, tabName);

        if (!tabId) {
            var err = `No meta sheet for ${tabName}`;
            this.logger.error(err);
            throw err;
        }

        if (!node) {
            // Create a node
            node = this.core.createNode({
                parent: this.META.Language,
                base: base
            });
            this.core.setAttribute(node, 'name', name);
            this.META[name] = node;

            nodeId = this.core.getPath(node);
        } else {
            // Remove from meta
            this.removeFromMeta(nodeId);
            this.core.setBase(node, base);
        }

        // Add it to the meta sheet
        this.core.addMember(this.rootNode, Constants.META_ASPECT_SET_NAME, node);
        this.core.addMember(this.rootNode, tabId, node);

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

        this.logger.debug(`added ${name} to the meta`);

        return node;
    };

    UpdateMeta.prototype.getPositionFor = function(name, tabName) {
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

    UpdateMeta.prototype.addLayerAttribute = function (name, node) {
        // No default value support for now...
        // Create a pointer of the given type on the node
        this.core.setPointerMetaTarget(node, name, this.META.Architecture, 1, 1);
        this.core.setPointerMetaLimits(node, name, 1, 1);
    };

    UpdateMeta.prototype.addAttribute = function (name, node, schema, defVal) {
        schema.type = schema.type || 'string';
        if (schema.type === 'list') {  // FIXME: add support for lists
            schema.type = 'string';
        }

        // TODO: Add support for activations
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

        if (defVal) {
            this.core.setAttribute(node, name, defVal);
        }
    };

    // Helpers for testing
    UpdateMeta.prototype.getSchemas = function () {
        return SCHEMAS;
    };

    return UpdateMeta;
});
