describe('json-model-parser', function () {
    'use strict';
    const requireJs = require('webgme').requirejs;
    const fs = require('fs');
    const path = require('path');
    const assert = require('assert');
    const ModelParser = requireJs('../../../src/plugins/json-model-parser');

    describe('basic-sequential', function () {
        let sequentialModelConfig = null;
        let layerConfigProperties = null;
        before(() => {
            layerConfigProperties = [
                'bias_regularizer', 'dtype', 'bias_constraint',
                'kernel_regularizer', 'name', 'trainable', 'bias_initializer',
                'activity_regularizer', 'kernel_constraint',
            ];
            let sequentialModelTxt = fs.readFileSync(path.resolve(__dirname,
                '../test-cases/modelJsons/sequential_dense.json'));
            sequentialModelConfig = JSON.parse(sequentialModelTxt);
        });

        it('Should find the number of models to be 1', () => {
            let numModels = ModelParser.countNumberOfModels(sequentialModelConfig);
            assert.equal(numModels, 1);
        });

        it('It should parse the sequential model, with no nested models', () => {
            let flattenedConfig = ModelParser.flatten(sequentialModelConfig);
            assert.equal(flattenedConfig.config.layers.length,
                sequentialModelConfig.config.layers.length + 1);
            // Test all layers are imported correctly
            for (let i = 1; i < flattenedConfig.config.layers.length; i++) {
                assert.equal(flattenedConfig.config.layers[i].name,
                    sequentialModelConfig.config.layers[i - 1].config.name);
                assert(Object.prototype.hasOwnProperty.call(flattenedConfig.config.layers[i],'inbound_nodes'));
                assert.deepEqual(flattenedConfig.config.layers[i].config.bias_regularizer);
            }
            // Check the layer config properties for equality
            layerConfigProperties.forEach((prop) => {
                for (let i = 1; i < flattenedConfig.config.layers.length; i++) {
                    if (flattenedConfig.config.layers[i].config[prop]) {
                        assert.deepEqual(flattenedConfig.config.layers[i].config[prop],
                            sequentialModelConfig.config.layers[i - 1].config[prop]);
                    }
                }
            });

            // Check the properties of the added InputLayer
            assert.equal(flattenedConfig.config.layers[0].class_name, 'InputLayer');
            assert.deepEqual(flattenedConfig.config.layers[0].config.batch_input_shape,
                sequentialModelConfig.config.layers[0].config.batch_input_shape);

        });
    });

    describe('nested-sequential', function () {
        let nestedSequentialModelConfig = null;
        before(() => {
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
            assert.equal(flattenedConfig.config.layers.length, 4);
            assert.equal(flattenedConfig.config.layers[0].class_name, 'InputLayer');
            assert.deepEqual(flattenedConfig.config.layers[0].config.batch_input_shape,
                nestedSequentialModelConfig.config.layers[0].config.batch_input_shape);
            assert.deepEqual(flattenedConfig.config.layers[2].class_name,
                nestedSequentialModelConfig.config.layers[1]
                    .config.layers[0].config.layers[0].class_name);
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

        it('should flatten the sequential inside functional model', function () {
            let flattenedConfig = ModelParser.flatten(nestedFunctionalModelConfig);

            // Tests for layers
            assert.deepEqual(flattenedConfig.config.layers[0], nestedFunctionalModelConfig.config.layers[0]);
            assert.deepEqual(flattenedConfig.config.layers[1], nestedFunctionalModelConfig.config.layers[1]);
            assert.deepEqual(flattenedConfig.config.layers[2].config,
                nestedFunctionalModelConfig.config.layers[2].config.layers[0].config);
            assert.deepEqual(flattenedConfig.config.layers[3].config,
                nestedFunctionalModelConfig.config.layers[2].config.layers[1].config);
            assert.deepEqual(flattenedConfig.config.layers[4].config,
                nestedFunctionalModelConfig.config.layers[3].config.layers[0].config);
            assert.deepEqual(flattenedConfig.config.layers[5].config,
                nestedFunctionalModelConfig.config.layers[3].config.layers[1].config);
            assert.deepEqual(flattenedConfig.config.layers[6].config,
                nestedFunctionalModelConfig.config.layers[4].config);
            assert.deepEqual(flattenedConfig.config.layers[7].config,
                nestedFunctionalModelConfig.config.layers[5].config);
            assert.deepEqual(flattenedConfig.config.layers[8].config,
                nestedFunctionalModelConfig.config.layers[6].config.layers[0].config);
            assert.deepEqual(flattenedConfig.config.layers[9].config,
                nestedFunctionalModelConfig.config.layers[6].config.layers[1].config);
            assert.deepEqual(flattenedConfig.config.layers[10].config,
                nestedFunctionalModelConfig.config.layers[7].config);
            assert.deepEqual(flattenedConfig.config.layers[11].config,
                nestedFunctionalModelConfig.config.layers[8].config);
            let i = 12, j = 9;
            while (i < flattenedConfig.config.layers.length) {
                assert.deepEqual(flattenedConfig.config.layers[i].config,
                    nestedFunctionalModelConfig.config.layers[j].config);
                i++;
                j++;
            }

            // Tests for inbound nodes, tested using model_graph.
            assert.deepEqual(flattenedConfig.config.layers[2].inbound_nodes, ['input_3']);
            assert.deepEqual(flattenedConfig.config.layers[3].inbound_nodes, ['embedding_3']);
            assert.deepEqual(flattenedConfig.config.layers[4].inbound_nodes, ['input_4']);
            assert.deepEqual(flattenedConfig.config.layers[5].inbound_nodes, ['embedding_5']);
            assert.deepEqual(flattenedConfig.config.layers[6].inbound_nodes, ['dropout_1', 'dropout_3']);
            assert.deepEqual(flattenedConfig.config.layers[7].inbound_nodes, ['dot_1']);
            assert.deepEqual(flattenedConfig.config.layers[8].inbound_nodes, ['input_3']);
            assert.deepEqual(flattenedConfig.config.layers[9].inbound_nodes, ['embedding_4']);
            assert.deepEqual(flattenedConfig.config.layers[10].inbound_nodes, ['activation_1', 'dropout_2']);
            assert.deepEqual(flattenedConfig.config.layers[11].inbound_nodes, ['add_1']);
            assert.deepEqual(flattenedConfig.config.layers[12].inbound_nodes, ['permute_1', 'dropout_3']);
            assert.deepEqual(flattenedConfig.config.layers[13].inbound_nodes, ['concatenate_2']);
            assert.deepEqual(flattenedConfig.config.layers[14].inbound_nodes, ['lstm_3']);
            assert.deepEqual(flattenedConfig.config.layers[15].inbound_nodes, ['dropout_4']);
            assert.deepEqual(flattenedConfig.config.layers[16].inbound_nodes, ['dense_2']);
        });
    });

    describe('redshift-convolutional-model', function () {
        let redshiftModelConfig = null;
        beforeEach(() => {
            let redshiftModelTxt = fs.readFileSync(path.resolve(path.resolve(__dirname,
                '../test-cases/modelJsons/redshiftModel.json')));
            redshiftModelConfig = JSON.parse(redshiftModelTxt);
        });

        it('find the number of models to be 1', function () {
            let numModels = ModelParser.countNumberOfModels(redshiftModelConfig);
            assert.equal(numModels, 1);
        });

        it('should flatten the model and change its inbound_nodes config', function () {
            let flattenedRedshiftConfig = ModelParser.flatten(redshiftModelConfig);
            // Test the layer config
            for(let i = 0; i < flattenedRedshiftConfig.config.layers.length; i++){
                let flatLayer =  flattenedRedshiftConfig.config.layers[i];
                let normalLayer = redshiftModelConfig.config.layers[i];
                // Test the layer config
                assert.deepEqual(flatLayer.config, normalLayer.config);
                // Tests for inbound nodes, it should be iterable, since the model is functional and not nested.
                if(normalLayer.inbound_nodes.length > 0){
                    normalLayer.inbound_nodes[0].forEach((node, index) =>{
                        assert.deepEqual(flatLayer.inbound_nodes[index], node[0]);
                    });
                }
            }

        });
    });
});