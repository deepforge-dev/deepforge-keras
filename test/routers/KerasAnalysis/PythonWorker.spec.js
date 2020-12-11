const testFixture = require('../../globals');
describe('PythonWorker', function() {
    const logger = testFixture.logger.fork('KerasAnalysis:PythonWorker');
    const path = require('path');
    const os = require('os');
    const fs = require('fs').promises;
    const assert = require('assert');
    const rimraf = require('rimraf');
    const {promisify} = require('util');
    const rm_rf = promisify(rimraf);
    const PythonWorker = require('../../../src/routers/KerasAnalysis/PythonWorker');
    const testScripts = [];
    let worker;

    before(async function() {
        worker = new PythonWorker(logger);
        const nums = [1,2,3,4,5,6,7,8,9,10];
        testScripts.push(...await Promise.all(nums.map(testScript)));
    });

    after(async () => {
        await worker.kill();
        await Promise.all(testScripts.map(file => rm_rf(file)));
    });

    it('should invoke "analyze" from the module', async function() {
        const result = await worker.analyze(testScripts[0]);
        assert.equal(result, 1);
    });

    it('should queue multiple requests', async function() {
        const results = await Promise.all(
            testScripts.map(file => worker.analyze(file))
        );
        results.forEach((res, i) => assert.equal(res, i + 1));
    });

    async function testScript(num) {
        const contents = `def analyze():\n\treturn ${num}`;
        const tmpdir = os.tmpdir();
        const filename = path.join(tmpdir, `deepforge_keras_PythonWorker_test_${num}.py`);
        await fs.writeFile(filename, contents);
        return filename;
    }
});
