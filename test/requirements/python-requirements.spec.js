/*jshint node:true, mocha:true*/

'use strict';
const { spawnSync } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('python', function () {
    it('should find python 3.5', () => {
        const processOutput = spawnSync('python3', ['-c', `import sys; print(sys.version[0:3])`]);
        const pythonVersion = processOutput.stdout.toString().trim();
        assert.equal(pythonVersion, '3.5', `Expected python version 3.5 but found ${pythonVersion}`);
    });

    describe('requirements', function() {
        const requirements = fs.readFileSync(path.join(__dirname, '..', '..', 'requirements.txt'),'utf-8').split('\n')
            .map(line => line.trim()).filter(line => !!line);
        requirements.forEach((req) => {
            it(`should be able to import package ${req}`, () =>{
                const processOutput = spawnSync(`python3`, ['-c', `"import ${req}";`]);
                assert.equal(processOutput.status, 0);
            });
        });
    });
});

