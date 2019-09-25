describe('json-model-parser', function () {
    let requireJs = require('requirejs');
    requireJs.config({
        baseUrl: __dirname
    });
    const ModelParser = requireJs('../../src/common/json-model-parser');
    const fs = require('fs');
    const path = require('path');
    const assert = require('assert');

    describe('basic-sequential', function () {
        let sequentialModelConfig = null;
        beforeEach(() => {
            let sequentialModelTxt = fs.readFileSync(path.resolve(__dirname,
                '../test-cases/modelJsons/sequential_dense.json'));
            sequentialModelConfig = JSON.parse(sequentialModelTxt);
        });

        it('Should find the number of models to be 1', () => {
            let numModels = ModelParser.countNumberOfModels(sequentialModelConfig);
            assert.equal(numModels, 1);
        });

        it('Should flatten the nested model, although none of them exist', () => {
            let flattenedConfig = ModelParser.flatten(sequentialModelConfig);
            assert.equal(flattenedConfig.config.layers.length, sequentialModelConfig.config.layers.length+1)
        });


    });

    describe('nested-sequential', function () {
        let nestedSequentialModelConfig = null;
        beforeEach(() => {
            let nestedSequentialModelTxt = fs.readFileSync(path.resolve(__dirname,
                '../test-cases/modelJsons/sequential_nested.json'));
            nestedSequentialModelConfig = JSON.parse(nestedSequentialModelTxt);
        });

        it('Should find the number of models to be 3', () => {
           let numModels = ModelParser.countNumberOfModels(nestedSequentialModelConfig);
           assert.equal(numModels, 3);
        });

        it('Should flatten the nested sequential model', function () {
            let flattenedConfig = ModelParser.flatten(nestedSequentialModelConfig);
            assert.equal(flattenedConfig.config.layers.length , 4)
        });
    });

    describe('sequential-inside-functional', function () {
        let nestedFunctionalModelConfig = null;
        beforeEach(() => {
            let nestedFunctionalModelTxt = fs.readFileSync(path.resolve(__dirname,
                '../test-cases/modelJsons/functional_memnn_babi.json'));
            nestedFunctionalModelConfig = JSON.parse(nestedFunctionalModelTxt);
        });

        it('should find the number of models to be 4', function () {
            let numModels = ModelParser.countNumberOfModels(nestedFunctionalModelConfig);
            assert.equal(numModels, 4);
        });


    })

});