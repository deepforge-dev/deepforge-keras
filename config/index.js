/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

const fs = require('fs');
const validEnvs = fs.readdirSync(__dirname)
    .filter(name => name.startsWith('config'))
    .map(name => name.split('.')[1]);
const env = validEnvs.find(name => name === process.env.NODE_ENV) || 'default';
const configFilename = __dirname + '/config.' + env + '.js';
const config = require(configFilename);
const validateConfig = require('webgme/config/validator');

validateConfig(configFilename);
module.exports = config;
