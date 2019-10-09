/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 */

'use strict';

var config = require('./config.default');

config.server.port = 9001;
config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_tests';
config.server.log = {
    transports: [{
        transportType: 'Console',
        options: {
            level: 'info',
            //silent: true,
            colorize: true,
            timestamp: true,
            prettyPrint: true,
            handleExceptions: true,
            depth: 2
        }
    }]
};



module.exports = config;