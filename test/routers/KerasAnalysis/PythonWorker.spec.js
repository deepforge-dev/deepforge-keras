const testFixture = require('../../globals');
describe('PythonWorker', function() {
    const logger = testFixture.logger.fork('KerasAnalysis:PythonWorker');
    const path = require('path');
    const assert = require('assert');
    const PythonWorker = require('../../../src/routers/KerasAnalysis/PythonWorker');
    let worker;

    before(function() {
        worker = new PythonWorker(logger);
    });

    it('should invoke "analyze" from the module', async function() {
        const result = await worker.analyze(path.join(__dirname, 'AnalysisScript.py'));
        assert.equal(result.test, 'passing!');
    });

    it('should queue multiple requests', async function() {
        const results = await Promise.all([
            worker.analyze(path.join(__dirname, 'AnalysisScript.py')),
            worker.analyze(path.join(__dirname, 'AnalysisScript.py')),
            worker.analyze(path.join(__dirname, 'AnalysisScript.py')),
            worker.analyze(path.join(__dirname, 'AnalysisScript.py')),
            worker.analyze(path.join(__dirname, 'AnalysisScript.py')),
        ]);
        results.forEach(res => assert.equal(res.test, 'passing!'));
    });
});
