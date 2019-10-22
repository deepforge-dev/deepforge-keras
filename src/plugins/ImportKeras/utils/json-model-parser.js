/*globals define*/
define(['./JSONModelMaps'], function (JSONModelMaps) {
    const ModelParser = {
        countNumberOfModels: countNumberOfModels,
        flatten: flatten
    };

    function countNumberOfModels(modelConfig) {
        return countModels(modelConfig);
    }

    /*
    This function will flatten nested models (i.e. a Model inside a model)
    and create a simple array of all the layers that can be directly used by
    the plugin
     */
    function flatten(modelConfig) {
        let alteredModelConfig = JSON.parse(JSON.stringify(modelConfig));
        let layersInfo = [];
        let replacementInboundNodeKeys = {};
        flattenNestedModel(alteredModelConfig, layersInfo, replacementInboundNodeKeys);
        alteredModelConfig.config.layers = layersInfo;
        addInputLayer(alteredModelConfig);
        inboundNodesToStringArray(alteredModelConfig);
        replaceModelInboundKeyWithFirstLayer(alteredModelConfig, replacementInboundNodeKeys);
        return alteredModelConfig;
    }

    function countModels(modelConfig) {
        if(isModel(modelConfig)){
            return modelConfig.config.layers
                .filter(layer => isModel(layer))
                .map(nestedModel => countModels(nestedModel))
                .reduce((a, b) => a+b, 1);
        }
        return 0;
    }

    function flattenNestedModel(modelConfig, layersInfo = [], inboundNodeKeys = {}) {
        let layers = modelConfig.config.layers;
        if (layers) {
            layers.forEach((layer, index, records) => {
                if (isModel(layer)) {
                    addInboundNodesForSequential(layer);
                    let lastIndex = layer.config.layers.length - 1;
                    inboundNodeKeys[layer.name] = layer.config.layers[lastIndex].config.name; // Change model inbound to first layer in the model.
                    if (layer.inbound_nodes) {
                        layer.config.layers[0].inbound_nodes = layer.inbound_nodes;
                    } else {
                        if (records[index - 1]) {
                            layer.config.layers[0].inbound_nodes = records[index - 1].config.name;
                        }
                        else {
                            layer.config.layers[0].inbound_nodes = [];
                        }
                    }
                    flattenNestedModel(layer, layersInfo);
                } else {
                    layersInfo.push(layer);
                }
            });
        }
    }


    function addInboundNodesForSequential(layersInfo) {
        if (determineModelType(layersInfo) !== JSONModelMaps.ModelTypes.sequential) {
            return;
        }
        layersInfo = layersInfo.config.layers;
        for (let i = 0; i < layersInfo.length - 1; i++) {
            layersInfo[i + 1].inbound_nodes = [layersInfo[i].config.name];
            if (i === 0) {
                layersInfo[i].inbound_nodes = [];
                layersInfo[i].name = layersInfo[i].config.name;
            }
            // This adds Consistency with the functional models, because
            // the functional JSON file has duplicate name keys,
            // one inside config and one at the top level
            if (!layersInfo[i + 1].name) {
                layersInfo[i + 1].name = layersInfo[i + 1].config.name;
            }
        }
    }


    function isModel(modelConfig) {
        return Array.isArray(modelConfig.config.layers);
    }


    function addInputLayer(modelConfig) {
        if (determineModelType(modelConfig) === JSONModelMaps.ModelTypes.sequential) {
            let inputLayerToAdd = {
                'class_name': 'InputLayer',
                'config': {
                    'batch_input_shape': modelConfig.config.layers[0].config.batch_input_shape,
                    'dtype': 'float32',
                    'name': 'input',
                    'sparse': false
                },
                'name': 'input',
                'inbound_nodes': []
            };

            delete modelConfig.config.layers[0].config.batch_input_shape;
            modelConfig.config.layers.splice(0, 0, inputLayerToAdd);
            addInboundNodesForSequential(modelConfig);
        }
    }

    // Determine whether the model is 'Sequential' Or 'Functional'
    // Its necessary because 'Sequential' Models do not have the property inbound_nodes
    // In their layer so, it should be added externally
    // Cases for a sequential model:
    // 1. The model has an attribute called class_name and is equal to 'Sequential'
    // 2. The model has an no attribute inbound_nodes
    function determineModelType(model) {
        if (model.class_name && model.class_name === JSONModelMaps.ModelTypes.sequential) {
            return JSONModelMaps.ModelTypes.sequential;
        }
        let layers = model.config.layers;
        if (layers) {
            for (let i = 0; i < layers.length; i++) {
                if (!layers[i].inbound_nodes) {
                    return JSONModelMaps.ModelTypes.sequential;
                }
            }
        }
        return JSONModelMaps.ModelTypes.functional;
    }


    // After getting flattened layers, change from
    function inboundNodesToStringArray(modelConfig) {
        if (determineModelType(modelConfig) === JSONModelMaps.ModelTypes.sequential) {
            return;
        }
        let layers = modelConfig.config.layers;
        layers.forEach((layer) => {

            if (layer.inbound_nodes[0] && layer.inbound_nodes[0][0] && layer.inbound_nodes[0][0] instanceof Array) {
                let inBoundNodesArr = layer.inbound_nodes[0];
                let inBoundNodesNames = [];
                for (let i = 0; i < inBoundNodesArr.length; i++) {
                    inBoundNodesNames.push(inBoundNodesArr[i][0]);
                    //ToDo: Implement Logic for Custom Layers
                }
                layer.inbound_nodes = inBoundNodesNames;
            }

        });


    }

    function replaceModelInboundKeyWithFirstLayer(modelInfo, replacementLayerPairs) {
        let replacementKeys = Object.keys(replacementLayerPairs);
        let layers = modelInfo.config.layers;
        if (replacementKeys.length > 0) {
            replacementKeys.forEach(key => {
                for (let i = 0; i < layers.length; i++) {
                    let inboundNodesArray = layers[i].inbound_nodes;
                    inboundNodesArray.forEach((node, index, records) => {
                        if (node === key) {
                            records[index] = replacementLayerPairs[key];
                        }
                    });
                }
            });
        }
    }

    return ModelParser;

});