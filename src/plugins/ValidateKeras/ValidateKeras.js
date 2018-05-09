/*globals define*/
/*eslint-env node, browser*/

define([
    'SimpleNodes/Constants',
    'plugin/GenerateKeras/GenerateKeras/GenerateKeras',
    'text!./metadata.json'
], function (
    SimpleConstants,
    PluginBase,
    pluginMetadata
) {
    'use strict';

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
        let code = files['output.py'];
        const results = this.generateVariableName('results');

        // Add the initialization (register_layer fn)
        const initCode = [
            'layer_registry = {}',
            'def register_layer(name, node_id):',
            '    layer_registry[name] = node_id',
            '',
            `${results} = {}`,
            `${results}['errors'] = []`,
            `${results}['dimensions'] = {}`,
            'def record_error(e):',
            '    info = {}',
            '    info[\'nodeId\'] = layer_registry[current_layer_name]',
            '    if hasattr(e, \'message\'):',
            '        info[\'message\'] = e.message',
            '    if hasattr(e, \'strerror\'):',
            '        info[\'message\'] = e.strerror',
            '    if hasattr(e, \'args\'):',
            '        info[\'message\'] = e.args[0]',
            '    print(info)',
            `    ${results}['errors'].append(info)`,
            '',
            'def record_dimensions(model):',
            '    for layer in model.layers:',
            '        layer_name = layer.name',
            '        node_id = layer_registry[layer.name]',
            `        ${results}['dimensions'][node_id] = layer.output_shape`,
            '',
            'has_bad_layer = False'
        ].join('\n');

        const reportCode = [
            'import json',
            `print(json.dumps(${results}))`
        ].join('\n');

        // Report the errors and dimensions somehow...
        code = [
            initCode,
            'try:',
            indent(code),
            indent('record_dimensions(model)'),
            'except:',
            indent('pass'),
            reportCode
        ].join('\n');

        // Store it as a message?
        // We need to execute this somewhere
        // TODO
        files['output.py'] = code;
        return files;
    };

    ValidateKeras.prototype.generateLayerCode = function(layer) {
        let code = PluginBase.prototype.generateLayerCode.call(this, layer);
        //const outputs = this.generateOutputNames(layer);
        const ctor = this.generateLayerCtor(layer);
        const layerName = this.getLayerName(layer);
        const layerId = layer[SimpleConstants.NODE_PATH];

        // Wrap every layer with a
        const lines = [
            'try:',
            `    current_layer_name = '${layerName}'`,
            `    register_layer(current_layer_name, '${layerId}')`,
            '    if not has_bad_layer:',
            `        ${code}`,
            `        last_layer = ${this.getVariableForNode(layer)}`,
            '    else:',
            `        ${ctor}`,
            'except Exception as e:',
            '    has_bad_layer = True',
            '    record_error(e)'
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
