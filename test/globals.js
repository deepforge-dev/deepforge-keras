// This is used by the test/plugins tests
/*globals requireJS*/
/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';
var testFixture = require('webgme/test/_globals'),
    WEBGME_CONFIG_PATH = '../config';
const { spawnSync } = require('child_process');

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

testFixture.executePython = function (codeBlock) {
    const processOutput = spawnSync('python3', ['-', `<<EOF\n${codeBlock}\nEOF`], {
        shell: '/bin/bash'
    });
    return {
        success: processOutput.status === 0,
        exitCode: processOutput.exitCode,
        stdout: processOutput.stdout.toString('utf-8'),
        stderr: processOutput.stderr.toString('utf-8')
    };
};

module.exports = testFixture;
