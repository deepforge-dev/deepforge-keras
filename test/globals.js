// This is used by the test/plugins tests
/*globals requireJS*/
/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';
var testFixture = require('webgme/test/_globals'),
    WEBGME_CONFIG_PATH = '../config';

// This flag will make sure the config.test.js is being used
// process.env.NODE_ENV = 'test'; // This is set by the require above, overwrite it here.

var WebGME = testFixture.WebGME,
    gmeConfig = require(WEBGME_CONFIG_PATH),
    getGmeConfig = function getGmeConfig() {
        'use strict';
        // makes sure that for each request it returns with a unique object and tests will not interfere
        if (!gmeConfig) {
            // if some tests are deleting or unloading the config
            gmeConfig = require(WEBGME_CONFIG_PATH);
        }
        return JSON.parse(JSON.stringify(gmeConfig));
    };

WebGME.addToRequireJsPaths(gmeConfig);

testFixture.getGmeConfig = getGmeConfig;

const path = require('path');
const SEED_DIR = path.join(__dirname, '..', 'src', 'seeds', 'tests');
testFixture.testSeedPath = path.join(SEED_DIR, 'tests.webgmex'),

// Add aliases for submodels
testFixture.ARCHITECTURE = {
    Basic: '/c',
    LayerListInput: '/7',
    MultiArchInputs: '/T',
    MultiArchOutputs: '/s',
    NestedLayers: '/z',
    Seq2Seq: '/4'
};

const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');
const tmpDir = fs.mkdtempSync(path.join(`${os.tmpdir()}`, 'generatedCode-'));


// Execute python code as a spawned child process synchronously
// CodeBlock is python code
// Provide Context for unique name(optional)
testFixture.executePythonCode = function (codeBlock, uniqueName) {
    uniqueName = uniqueName ? uniqueName :Math.random().toString(36).substring(7);
    const uniqueFileName = path.join(tmpDir, `output-${process.pid}-${uniqueName}.py`);
    fs.writeFileSync(uniqueFileName, codeBlock);

    // ExecSync NodeJS.
    const processOutput = spawnSync('python', [`${uniqueFileName}`], {
        shell: '/bin/bash'
    });
    const executionMessage = {};
    if(processOutput.status === 0){
        executionMessage.success = true;
        executionMessage.exitCode = processOutput.status;
    }
    else {
        executionMessage.success = false;
        executionMessage.exitCode = processOutput.status;
    }
    executionMessage.stdout = processOutput.stdout.toString('utf-8');
    executionMessage.stderr = processOutput.stderr.toString('utf-8');
    return executionMessage;
};

module.exports = testFixture;
