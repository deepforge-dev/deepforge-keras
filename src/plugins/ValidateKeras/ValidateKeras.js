/*globals define*/
/*eslint-env node, browser*/

define([
    'SimpleNodes/Constants',
    'plugin/GenerateKeras/GenerateKeras/GenerateKeras',
    'underscore',
    'text!./output.py.tpl',
    'text!./metadata.json',
], function (
    SimpleConstants,
    PluginBase,
    _,
    CodeTplText,
    pluginMetadata,
) {
    'use strict';

    const CodeTpl = _.template(CodeTplText);
    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ValidateKeras.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ValidateKeras.
     * @constructor
     */
    var ValidateKeras = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ValidateKeras.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ValidateKeras.prototype = Object.create(PluginBase.prototype);
    ValidateKeras.prototype.constructor = ValidateKeras;

    const indent = function(code) {
        return '    ' + code.replace(/\n/mg, '\n    ');
    };

    ValidateKeras.prototype.createOutputFiles = function(activeNode) {
        const files = PluginBase.prototype.createOutputFiles.call(this, activeNode);
        let main = files['output.py'];
        const resultsVar = this.generateVariableName('results');
        const code = CodeTpl({indent, main, resultsVar});

        files['output.py'] = code;
        return files;
    };

    ValidateKeras.prototype.generateLayerCode = function(layer) {
        let code = PluginBase.prototype.generateLayerCode.call(this, layer);
        const outputs = this.generateOutputNames(layer);
        const ctor = this.generateLayerCtor(layer, true);
        const layerName = this.getLayerName(layer.source || layer);
        const layerId = layer[SimpleConstants.NODE_PATH];

        // Wrap every layer with a
        const lines = [
            'try:',
            `    current_layer_name = '${layerName}'`,
            `    register_layer(current_layer_name, '${layerId}')`,
            '    if not has_bad_layer:',
            `        ${code.replace(/\n/g, '\n        ')}`,
            `        last_layer = ${outputs[0]}`,
            '    else:',
            `        ${ctor}`,
            'except Exception as e:',
            '    has_bad_layer = True',
            `    record_error('${layerId}', e)`
        ];
        return lines.join('\n');
    };

    ValidateKeras.prototype.getArguments = function(layer) {
        const args = PluginBase.prototype.getArguments.call(this, layer);
        // Add the 'name' argument to all layers
        const node = this.getNode(layer[SimpleConstants.NODE_PATH]);
        if (this.core.isTypeOf(node, this.META.Layer)) {
            args.push(['name', `'${this.getLayerName(layer)}'`]);
        }
        return args;
    };

    ValidateKeras.prototype.getLayerName = function(layer) {
        if (!layer.layerName) {
            layer.layerName = this.generateVariableName('layer');
        }
        return layer.layerName;
    };

    ValidateKeras.prototype.getModelIODefinition = function(layers) {
        const normal = PluginBase.prototype.getModelIODefinition.call(this, layers);
        const inputNames = this.getModelInputs(layers);
        const fallbackModel = `Model(inputs=[${inputNames}], outputs=[last_layer])`;

        return `${fallbackModel} if has_bad_layer else ${normal}`;
    };

    return ValidateKeras;
});
