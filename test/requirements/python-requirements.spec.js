/*jshint node:true, mocha:true*/

'use strict';
var testFixture = require('../globals');
const { spawnSync } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('python-test', function () {
    it('Should find python 3', (done) => {
        const processOutput = spawnSync(`python3`, ['-c', `"print('hello world')";`]);
        assert(processOutput.status === 0);
        done();
    });

    describe('requirements-test', function() {
        let requirements = fs.readFileSync(path.join(__dirname, '..', '..', 'requirements.txt'),
            {encoding: 'utf-8'}).split('\n').filter((val) => val);
        requirements.forEach((req) => {
            it(`Should be able to import package ${req}`, (done) =>{
                const processOutput = spawnSync(`python3`, ['-c', `"import ${req}";`]);
                assert(processOutput.status === 0);
                done();
            });
        });
    });
});

