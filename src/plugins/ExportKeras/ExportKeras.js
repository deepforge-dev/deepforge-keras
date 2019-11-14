/*globals define*/
/*eslint-env node*/
define([
    'text!./metadata.json',
    'plugin/GenerateKeras/GenerateKeras/GenerateKeras'
], function (
    pluginMetadata,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const { exec } = require('child_process');
    function ExportKeras() {
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    }

    ExportKeras.metadata = pluginMetadata;

    // Prototypical inheritance from GenerateKeras.
    ExportKeras.prototype = Object.create(PluginBase.prototype);
    ExportKeras.prototype.constructor = ExportKeras;

    ExportKeras.prototype.createOutputFiles = async function(activeNode){
        const files = PluginBase.prototype.createOutputFiles.call(this, activeNode);
        let outputFiles = {};
        let codeString = files['output.py'];
        const modelJSONName = this.generateVariableName('model_json');
        let code = codeString.split('\n');

        code.push('');
        code.push(`${modelJSONName} = ${this.RESULT_VARIABLE_NAME}.to_json()`);
        code.push(`print(${modelJSONName})`);
        outputFiles[`${activeNode.name}.json`] = await this.executePython(code.join('\n'));
        this.logger.info(`Exported JSON Model filename is ${activeNode.name}.json`);
        return outputFiles;
    };

    ExportKeras.prototype.executePython = function (code, pythonVersion='3') {
        if(!pythonVersion.startsWith('3')){
            throw new Error(`Python${pythonVersion} is not supported`);
        }
        const command = `python${pythonVersion} - <<EOF\n${code}\nEOF`;
        return new Promise((resolve, reject) => {
            exec(command, {
                shell: '/bin/bash'
            },(error, stdout) => {
                if(error) reject(error.toString());
                if(stdout) resolve(this.getModelJSON(stdout));
            });
        });
    };

    ExportKeras.prototype.getModelJSON = function (stdout) {
        let jsonModelString = stdout.split('\n').filter(val => !!val);
        jsonModelString = jsonModelString[jsonModelString.length-1];
        const jsonExport = JSON.stringify(JSON.parse(jsonModelString), null, 2);
        this.logger.info(`The JSON export is ${jsonExport}`);
        return jsonExport;
    };

    return ExportKeras;
});
