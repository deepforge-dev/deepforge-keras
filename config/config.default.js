'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

// Add/overwrite any additional settings here
// config.server.port = 8080;
config.server.port = process.env.PORT ? +process.env.PORT : 8080;
// config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_my_app';
config.storage.keyType = 'rand160Bits';  // tmp hack

config.requirejsPaths.keras = './src/common';
config.plugin.allowServerExecution = true;
validateConfig(config);
module.exports = config;
