/*globals define*/
/*eslint-env node*/
define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'SimpleNodes/Constants',
    '../GenerateKeras/GenerateKeras'
], function (
    PluginConfig,
    pluginMetadata,
    SimpleConstants,
    PluginBase) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const { exec } = require('child_process');
    function ExportKeras() {
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.outputFileName = "";
    }

    ExportKeras.metadata = pluginMetadata;

    // Prototypical inheritance from GenerateKeras.
    ExportKeras.prototype = Object.create(PluginBase.prototype);
    ExportKeras.prototype.constructor = ExportKeras;

    ExportKeras.prototype.createOutputFiles = async function(activeNode){
        var outputFiles = {};
        var code;
        if(!this.outputFileName){
            let fileName = this.getCurrentConfig().jsonFileName || "exported_architecture.json";
            if(!fileName.endsWith('.json')){
                fileName = `${fileName}.json`;
            }
            this.outputFileName = fileName;
        }

        this.registerJsonNodes(activeNode);

        const allLayers = activeNode[SimpleConstants.CHILDREN];
        const layers = allLayers.filter(layer => layer.base.name !== 'Output');

        this.variableNames = {};
        this.customObjects = [];

        // Add the inputs with the dimensions
        var resultName = this.generateVariableName('result');
        var modelName = this.generateVariableName('model');
        let modelJSONName = this.generateVariableName('model_json');
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
        code.push(`${modelJSONName} = ${modelName}.to_json()`);
        code.push('');
        code.push(`print('MODEL JSON STRING START')`);
        code.push(`print(${modelJSONName})`);
        code.push(`print('MODEL JSON STRING END')`);

        outputFiles[this.outputFileName] = await this.executePython(code.join('\n'));
        return outputFiles;
    };

    ExportKeras.prototype.executePython = function (code, pythonVersion="3.5") {
        const command = `python${pythonVersion} - <<EOF\n${code}\nEOF`;
        return new Promise((resolve, reject) => {
            exec(command, {
                shell: '/bin/bash'
            },(error, stdout) => {
                if(error) reject(error.toString());
                if(stdout) resolve(this._stdoutToJSON(stdout));
            });
        });
    };

    ExportKeras.prototype._stdoutToJSON = function (stdout) {
        let jsonPattern = new RegExp("(MODEL JSON STRING START\n)(.*\n)(MODEL JSON STRING END\n)");
        const jsonModelString = jsonPattern.exec(stdout);

        const jsonExport = JSON.stringify(JSON.parse(jsonModelString[2]), null, 4);
        this.logger.info(`The JSON export is ${jsonExport}`);

        return jsonExport;
    };

    return ExportKeras;
});
