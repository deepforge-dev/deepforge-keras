/*jshint node:true, mocha:true*/

'use strict';
const { spawnSync } = require('child_process');
const assert = require('assert');

describe('python', function () {
    it('should find python 3.7', () => {
        const processOutput = spawnSync('python3', ['-c', `import sys; print(sys.version[0:3])`]);
        const pythonVersion = processOutput.stdout.toString().trim();
        assert.equal(pythonVersion, '3.7', `Expected python version 3.7 but found ${pythonVersion}`);
    });

    describe('requirements', function() {
        const requirements = ['tensorflow', 'keras'];
        requirements.forEach((req) => {
            it(`should be able to import package ${req}`, () =>{
                const processOutput = spawnSync(`python3`, ['-c', `"import ${req}";`]);
                assert.equal(processOutput.status, 0);
            });
        });
    });
});

