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

    GenerateKeras.prototype.getJsonNode = function(id) {
        return this._jsonNodesById[id];
    };

    GenerateKeras.prototype.registerJsonNodes = function(node) {
        let current = [node];
        let next = [];

        this._jsonNodesById = {};
        while (current.length) {
            for (let i = current.length; i--;) {
                this._jsonNodesById[current[i][SimpleConstants.NODE_PATH]] = current[i];
                next = next.concat(current[i][SimpleConstants.CHILDREN]);
            }
            current = next;
            next = [];
        }
    };

    /* * * * * * * * Main Code Generation Logic * * * * * * * */
    GenerateKeras.prototype.RESULT_VARIABLE_NAME = 'result';

    GenerateKeras.prototype.createOutputFiles = function(activeNode) {
        var outputFiles = {};
        var code;

        this.registerJsonNodes(activeNode);

        const allLayers = activeNode[SimpleConstants.CHILDREN];
        const layers = allLayers.filter(layer => layer.base.name !== 'Output');

        this.variableNames = {};
        this.customObjects = [];

        // Add the inputs with the dimensions
        var resultName = this.generateVariableName(this.RESULT_VARIABLE_NAME);
        var modelName = this.generateVariableName('model');
        var customObjs = this.generateVariableName('custom_objects');
        code = layers.map(layer => this.generateLayerCode(layer));

        // Define the custom_objects dict
        code.push('');
        code.push(`${customObjs} = {}`);
        code.unshift('');
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
        const inputNames = this.getModelInputs(layers);

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

    GenerateKeras.prototype.getModelInputs = function(layers) {
        const inputs = layers
            .filter(layer => layer[SimpleConstants.PREV].length === 0);

        const inputIndexDict = this.getMemberIndicesDict(this.activeNode, 'inputs');
        inputs.sort((layer1, layer2) => {
            const [index1, index2] = [layer1, layer2]
                .map(layer => layer[SimpleConstants.NODE_PATH])
                .map(id => inputIndexDict[id]);
            return index1 < index2 ? -1 : 1;
        });
        return inputs.map(layer => layer.variableName).join(',');
    };

    GenerateKeras.prototype.defineCustomObject = function(name, def) {
        // 'name' must be a valid variable name
        this.customObjects.push([name, def]);
        return name;
    };

    GenerateKeras.prototype.generateLayerCtor = function(layer) {
        this.sortLayerInputsByIndex(layer);

        const ctor = layer[SimpleConstants.BASE].name;
        const args = this.getArgumentsString(layer);

        return `${ctor}(${args})`;
    };

    GenerateKeras.prototype.generateLayerCode = function(layer) {
        const outputs = this.generateOutputNames(layer).join(', ');
        const ctor = this.generateLayerCtor(layer);
        if (layer[SimpleConstants.BASE].name === 'Input') {
            return `${outputs} = ${ctor}`;
        } else {  // add the inputs
            // Add different types of inputs
            // Add multiple outputs support
            const args = this.generateInputValues(layer);
            return `${outputs} = ${ctor}(${args})`;
        }
    };

    GenerateKeras.prototype.generateInputValues = function(layer) {
        return this.getSortedMembers(layer, 'inputs')
            .map(input => {
                const inputVals = this.getSortedMembers(input, 'source')
                    .map(input => this.getVariableForNode(input));

                let inputCode = inputVals.join(', ');
                if (inputVals.length > 1) {
                    inputCode = `[${inputCode}]`;
                }

                if (inputVals.length >= 1) {
                    return `${input.name}=${inputCode}`;
                }

            })
            .filter(input => !!input)
            .join(', ');
    };

    GenerateKeras.prototype.generateOutputNames = function(layer) {
        const outputs = this.getSortedMembers(layer, 'outputs');

        if (outputs.length === 1) {
            // use the same variable for the output and layer since they are
            // basically the same
            const name = this.getVariableForNode(layer);
            outputs[0].variableName = name;
            return [name];
        } else {
            // Generate variable names for each
            // Add these variable names to the children json nodes
            return outputs.map(output => this.getVariableForNode(output));
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

    GenerateKeras.prototype.getSortedMembers = function(json, set) {
        const node = this.getNode(json[SimpleConstants.NODE_PATH]);
        const members = this.core.getMemberPaths(node, set).map(id => this.getNode(id));

        const memberIndices = {};
        members.forEach(member => {
            const id = this.core.getPath(member);
            const index = this.core.getMemberAttribute(node, set, id, 'index');
            memberIndices[id] = index;
        });

        members.sort((layer1, layer2) => {
            const [index1, index2] = [layer1, layer2]
                .map(layer => this.core.getPath(layer))
                .map(id => memberIndices[id]);
            return index1 < index2 ? -1 : 1;
        });

        return members.map(gmeNode => {
            const id = this.core.getPath(gmeNode);
            return this.getJsonNode(id);
        });
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

    GenerateKeras.prototype.getVariableForNode = function(layer, basename) {
        if (!layer.variableName) {
            basename = basename || layer.name.toLowerCase();
            layer.variableName = this.generateVariableName(basename);
        }
        return layer.variableName;
    };

    GenerateKeras.prototype.getArguments = function(layer) {
        // We need to know which arguments are required and which are optional...
        // maybe ctor_arg_order should only contain the required arguments
        const argNames = layer[Constants.ATTR.CTOR_ARGS].split(',');
        return argNames
            .filter(name => layer[name] !== undefined)
            .map(name => {
                let value = this.getArgumentValue(layer[name]);

                // Add special case for recurrent layers -> always return_state
                // when in an architecture node
                if (name === 'return_state') {
                    const pathChunks = layer[SimpleConstants.NODE_PATH].split('/');
                    pathChunks.pop();
                    const parentId = pathChunks.join('/');
                    const parent = this.getJsonNode(parentId);
                    if (parent.base.name === 'Architecture') {
                        value = 'True';
                    }
                }

                return [name, value];
            });
    };


    GenerateKeras.prototype.getArgumentsString = function(layer) {
        const argString = this.getArguments(layer)
            .map(nameAndValue => nameAndValue.join('='))
            .join(', ');

        this.logger.debug(`getting arguments for ${layer.variableName} (${layer.name}): ${argString}`);
        return argString;
    };

    GenerateKeras.prototype.getArgumentValue = function(value) {
        const rawArgType = typeof value;
        if (rawArgType === 'object') {  // pointer
            const node = this.getNode(value[SimpleConstants.NODE_PATH]);
            const isLayer = this.core.isTypeOf(node, this.META.Layer);
            let target = value;

            if (isLayer) {  // wrapped layer
                return this.generateLayerCtor(target);
            } else {  // activation, regularization, etc function
                let type = this.getFunctionType(target);
                let args = this.getArgumentsString(target);

                // activation fns need to be wrapped in a lambda
                if (type === 'keras.activations') {
                    const argValues = this.getArguments(target).map(pair => {
                        const [name, value] = pair;
                        const safeValue = (value + '').replace(/[^a-zA-Z0-9]/g, '_');
                        return `${name}_${safeValue}`;
                    }).join('__');

                    const basename = `custom_${target.name}_${argValues}`;
                    let name = this.generateVariableName(basename);
                    const code = `def ${name}(x):\n    return ${type}.${target.name}(x, ${args})`;
                    this.defineCustomObject(name, code);

                    return name;
                }
                return `${type}.${target.name}(${args})`;
            }
        } else if (rawArgType === 'string'){
            value = value.trim();
            if (value === '') {
                value = 'None';
            }
            const isBool = /^(True|False)$/;
            const isNumber = /^\d*\.?(e|e-)?\d*$/;
            const isTuple = /^\(/;
            const isList = /^\[/;
            const isString = text => !isTuple.test(text) && !isBool.test(text) &&
                !isNumber.test(text) && !isList.test(text) && text !== 'None';

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
