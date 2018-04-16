/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge-keras/Constants',
    'SimpleNodes/SimpleNodes',
    'SimpleNodes/Constants',
    './keywords',
    'underscore',
    'text!./metadata.json'
], function (
    Constants,
    PluginBase,
    SimpleConstants,
    PythonKeywords,
    _,
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
        this.variableNames = {};
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

    /* * * * Overrides for Updating Connection Detection * * * */
    GenerateKeras.prototype.isConnection =
    GenerateKeras.prototype._isConnection = function(node) {
        if (this.core.isTypeOf(node, this.META.Layer)) {
            const dstLayerId = this.core.getPath(node);
            const inputs = this.core.getMemberPaths(node, 'inputs')
                .map(id => this.getNode(id));
            const srcDstPairs = inputs
                .map(node => [
                    this.core.getPath(node),
                    this.core.getMemberPaths(node, 'source')
                ]);

            srcDstPairs.forEach(pair => {
                const [inputId, outputIds] = pair;

                outputIds.forEach(outputId => {
                    const srcLayerId = this.getChildId(outputId);
                    this._connections.push({
                        src: srcLayerId,
                        dst: dstLayerId,
                        inputId: inputId,
                        outputId: outputId
                    });
                });
            });
        }

        // Always return false since layers are implied by set containment
        return false;
    };

    GenerateKeras.prototype.mergeConnectionNode = function(conn) {
        const src = this.nodes[conn.src];
        const dst = this.nodes[conn.dst];

        src[SimpleConstants.NEXT].push(dst);
        dst[SimpleConstants.PREV].push(src);
    };

    GenerateKeras.prototype.getChildId = function(id) {
        // Get the id of the child containing the given id
        const activeId = this.core.getPath(this.activeNode);
        const depth = activeId.split('/').length;
        return id.split('/').slice(0, depth+1).join('/');
    };

    /* * * * * * * * Main Code Generation Logic * * * * * * * */
    GenerateKeras.prototype.createOutputFiles = function(activeNode) {
        var outputFiles = {};
        var code;

        const allLayers = activeNode[SimpleConstants.CHILDREN];
        const layers = allLayers.filter(layer => layer.base.name !== 'Output');

        this.variableNames = {};
        this.customObjects = [];

        // Add the inputs with the dimensions
        var resultName = this.generateVariableName('result');
        var modelName = this.generateVariableName('model');
        var customObjs = this.generateVariableName('custom_objects');
        code = layers.map(layer => this.generateLayerCode(layer));

        // Define the custom_objects dict
        code.push('');
        code.push(`${customObjs} = {}`);
        this.customObjects.forEach(pair => {
            let [name, def] = pair;
            code.unshift(def);  // prepend definition
            code.push(`${customObjs}['${name}'] = ${name}`);
        });
        code.push('');

        // Import the layers
        code.unshift('');
        code.unshift('from keras.layers import *');
        code.unshift('from keras.models import Model');
        code.unshift('import keras');

        // Return the model
        const modelCtor = this.getModelIODefinition(allLayers);
        code.push('');
        code.push(`${modelName} = ${modelCtor}`);
        code.push(`${resultName} = ${modelName}`);
        code.push(`${modelName}.custom_objects = ${customObjs}`);

        outputFiles['output.py'] = code.join('\n');

        return outputFiles;
    };

    GenerateKeras.prototype.getModelIODefinition = function(layers) {
        const inputs = layers
            .filter(layer => layer[SimpleConstants.PREV].length === 0);

        const inputIndexDict = this.getMemberIndicesDict(this.activeNode, 'inputs');
        inputs.sort((layer1, layer2) => {
            const [index1, index2] = [layer1, layer2]
                .map(layer => layer[SimpleConstants.NODE_PATH])
                .map(id => inputIndexDict[id]);
            return index1 < index2 ? -1 : 1;
        });
        const inputNames = inputs.map(layer => layer.variableName)
            .join(',');

        // Order the outputs by their 'index' as well
        const outputIndexDict = this.getMemberIndicesDict(this.activeNode, 'outputs');
        const outputs = layers
            .filter(layer => layer[SimpleConstants.NEXT].length === 0)
            .map(layer => {  // if "Output" layer, get the predecessor
                if (layer.base.name === 'Output') {
                    return layer[SimpleConstants.PREV][0];
                }
                return layer;
            });

        outputs.sort((layer1, layer2) => {
            // Sort them by the output
            const [index1, index2] = [layer1, layer2]
                .map(layer => layer[SimpleConstants.NEXT][0] || layer)
                .map(layer => layer[SimpleConstants.NODE_PATH])
                .map(id => outputIndexDict[id]);

            return index1 < index2 ? -1 : 1;
        });

        const outputNames = outputs.map(layer => layer.variableName)
            .join(',');

        return `Model(inputs=[${inputNames}], outputs=[${outputNames}])`;
    };

    GenerateKeras.prototype.defineCustomObject = function(name, def) {
        // 'name' must be a valid variable name
        this.customObjects.push([name, def]);
        return name;
    };

    GenerateKeras.prototype.generateLayerCode = function(layer) {
        var name = this.generateLayerName(layer);
        var ctor = layer[SimpleConstants.BASE].name;
        var args = this.getArguments(layer);

        this.sortLayerInputsByIndex(layer);

        if (layer[SimpleConstants.BASE].name === 'Input') {
            return `${name} = ${ctor}(${args})`;
        } else {
            let inputs = layer[SimpleConstants.PREV].map(node => node.variableName);
            let inputCode = inputs.join(', ');
            if (inputs.length > 1) {
                inputCode = `[${inputCode}]`;
            }

            return `${name} = ${ctor}(${args})(${inputCode})`;
        }
    };

    GenerateKeras.prototype.getMemberIndicesDict = function(node, set) {
        const sourceIndicesDict = {};

        const sourceIds = this.core.getMemberPaths(node, set);
        sourceIds.forEach(id => {
            const index = this.core.getMemberAttribute(node, set, id, 'index');
            const srcLayerId = this.getChildId(id);
            sourceIndicesDict[srcLayerId] = index;
        });

        return sourceIndicesDict;
    };

    GenerateKeras.prototype.sortLayerInputsByIndex = function(layer) {

        // Get the input id
        const node = this.getNode(layer[SimpleConstants.NODE_PATH]);
        const inputs = this.core.getMemberPaths(node, 'inputs').map(id => this.getNode(id));

        let indexByNodeId = {};
        inputs.forEach(input => {
            const dict = this.getMemberIndicesDict(input, 'source');
            _.extend(indexByNodeId, dict);
        });

        layer[SimpleConstants.PREV].sort((layer1, layer2) => {
            const [index1, index2] = [layer1, layer2]
                .map(l => l[SimpleConstants.NODE_PATH])
                .map(id => indexByNodeId[id]);

            return index1 < index2 ? -1 : 1;
        });
    };

    GenerateKeras.prototype.generateVariableName = function(basename) {
        var count = 2;
        var name = basename;

        while (this.variableNames[name] || PythonKeywords.includes(name)) {
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
        const rawArgType = typeof value;
        if (rawArgType === 'object') {  // pointer
            let target = value;
            let args = this.getArguments(target);
            let type = this.getFunctionType(target);

            // activation fns need to be wrapped in a lambda
            if (type === 'keras.activations') {
                let name = this.generateVariableName(`custom_${target.name}`);
                const code = `def ${name}(x):\n    return ${type}.${target.name}(x, ${args})`;
                this.defineCustomObject(name, code);

                return name;
            }
            return `${type}.${target.name}(${args})`;
        } else if (rawArgType === 'string'){
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
