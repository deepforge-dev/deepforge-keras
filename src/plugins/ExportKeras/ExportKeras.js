/*globals define*/
/*eslint-env node*/
define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'SimpleNodes/Constants',
    'plugin/GenerateKeras/GenerateKeras/GenerateKeras'
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
        const files = PluginBase.prototype.createOutputFiles.call(this, activeNode);
        if(!this.outputFileName){
            let fileName = this.getCurrentConfig().jsonFileName || "exported_architecture.json";
            if(!fileName.endsWith('.json')){
                fileName = `${fileName}.json`;
            }
            this.outputFileName = fileName;
        }

        let outputFiles = {};
        let codeString = files['output.py'];
        const modelJSONName = this.generateVariableName('model_json');
        let code = codeString.split('\n');

        code.push('');
        code.push(`${modelJSONName} = ${this.RESULT_VARIABLE_NAME}.to_json()`);
        code.push(`print(${modelJSONName})`);
        outputFiles[this.outputFileName] = await this.executePython(code.join('\n'));
        this.logger.info(`Exported JSON Model filename is ${this.outputFileName}`);
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
        let jsonModelString = stdout.split('\n').filter(val => !!val);
        jsonModelString = jsonModelString[jsonModelString.length-1];
        const jsonExport = JSON.stringify(JSON.parse(jsonModelString), null, 2);
        this.logger.info(`The JSON export is ${jsonExport}`);
        return jsonExport;
    };

    return ExportKeras;
});
