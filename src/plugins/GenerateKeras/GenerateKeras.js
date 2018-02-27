/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge-keras/Constants',
    'SimpleNodes/SimpleNodes',
    'SimpleNodes/Constants',
    'text!./metadata.json'
], function (
    Constants,
    PluginBase,
    SimpleConstants,
    pluginMetadata
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of GenerateKeras.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateKeras.
     * @constructor
     */
    var GenerateKeras = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.variableNames = null;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateKeras.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateKeras.prototype = Object.create(PluginBase.prototype);
    GenerateKeras.prototype.constructor = GenerateKeras;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateKeras.prototype.createOutputFiles = function(activeNode) {
        var outputFiles = {};
        var layers = activeNode[SimpleConstants.CHILDREN];
        var code;

        this.variableNames = {};

        // Add the inputs with the dimensions
        var resultName = this.generateVariableName('result');
        var modelName = this.generateVariableName('model');
        code = layers.map(layer => this.generateLayerCode(layer));

        // Import the layers
        code.unshift('');
        code.unshift('from keras.layers import *');
        code.unshift('from keras.models import Model');
        code.unshift('import keras');

        // Return the model
        var inputs = layers
            .filter(layer => layer[SimpleConstants.PREV].length === 0)
            .map(layer => layer.variableName)
            .join(',');

        var outputs = layers
            .filter(layer => layer[SimpleConstants.NEXT].length === 0)
            .map(layer => layer.variableName)
            .join(',');

        code.push('');
        code.push(`${modelName} = Model(inputs=[${inputs}], outputs=[${outputs}])`);
        code.push(`${resultName} = ${modelName}`);

        outputFiles['output.py'] = code.join('\n');

        return outputFiles;
    };

    GenerateKeras.prototype.generateLayerCode = function(layer) {
        var name = this.generateLayerName(layer);
        var ctor = layer[SimpleConstants.BASE].name;
        var args = this.getArguments(layer);
        var prevs;

        prevs = layer[SimpleConstants.PREV].map(node => node.variableName).join(',');
        if (layer[SimpleConstants.BASE].name === 'Input') {
            return `${name} = ${ctor}(${args})`;
        } else {
            return `${name} = ${ctor}(${args})(${prevs})`;
        }
    };

    GenerateKeras.prototype.generateVariableName = function(basename) {
        var count = 2;
        var name = basename;

        while (this.variableNames[name]) {
            name = `${basename}${count}`;
            count++;
        }
        this.variableNames[name] = true;
        return name;
    };

    GenerateKeras.prototype.generateLayerName = function(layer) {
        var basename = layer.name.toLowerCase();
        layer.variableName = this.generateVariableName(basename);
        return layer.variableName;
    };

    GenerateKeras.prototype.getArguments = function(layer) {
        // We need to know which arguments are required and which are optional...
        // maybe ctor_arg_order should only contain the required arguments
        var argNames = layer[Constants.ATTR.CTOR_ARGS].split(',');
        var argString = argNames
            .filter(arg => layer[arg] !== undefined)
            .map(arg => `${arg}=${this.getArgumentValue(layer[arg])}`).join(', ');

        this.logger.debug(`getting arguments for ${layer.variableName} (${layer.name}): ${argString}`);
        return argString;
    };

    GenerateKeras.prototype.getArgumentValue = function(value) {
        if (typeof value === 'object') {  // pointer
            let target = value;
            let args = this.getArguments(target);
            let type = this.getFunctionType(target);

            // activation fns need to be wrapped in a lambda
            if (type === 'keras.activations') {
                return `lambda x: ${type}.${target.name}(x, ${args})`;
            }
            return `${type}.${target.name}(${args})`;
        } else {
            // Trim whitespace

            value = value.replace(/^\s*/, '').replace(/\s*$/, '');
            const isBool = /^(True|False)$/;
            const isNumber = /^\d*\.?(e|e-)?\d*$/;
            const isTuple = /^\(/;
            const isString = text => !isTuple.test(text) && !isBool.test(text) &&
                !isNumber.test(text) && text !== 'None';

            if (isString(value)) {
                value = `"${value.replace(/"/g, '\\"')}"`;
            }
        }
        return value;
    };

    GenerateKeras.prototype.getFunctionType = function(fn) {
        let base = fn.base.base.name;
        let fnType = base.replace(/Function$/, '').toLowerCase();

        return `keras.${fnType}s`;
    };

    return GenerateKeras;
});
