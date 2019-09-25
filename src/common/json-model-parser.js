/*
This function is used to determine the config type,
 */
define(['./JSONModelMaps'], function (JSONModelMaps) {
    const ModelParser = {
        countNumberOfModels: countNumberOfModels,
        flatten: flatten
    };

    function countNumberOfModels(modelConfig) {
        return _countModels(modelConfig);
    }

    /*
    This function will flatten a nested models, if they exist.
     */
    function flatten(modelConfig) {
        let alteredModelConfig = JSON.parse(JSON.stringify(modelConfig));
        let layersInfo = [];
        _flatten(alteredModelConfig, layersInfo);
        alteredModelConfig.config.layers = layersInfo;
        _addInputLayer(alteredModelConfig);
        _inboundNodesToStringArray(alteredModelConfig);
        return alteredModelConfig;
    }

    function _countModels(modelConfig) {
        num = 0;
        if(_isModel(modelConfig)){
            num++;
        }
        let layers = modelConfig.config.layers;
        if(layers) {
            layers.forEach((layer) => {
                if (_isModel(layer)) {
                    num += _countModels(layer);
                }
            });
        }
        return num;
    }

    // This is a recursive implementation
    // To flatten out nested models
    function _flatten(modelConfig, layersInfo) {
        if(!layersInfo){
            layersInfo = [];
        }
        let layers = modelConfig.config.layers;
        if(layers) {
            layers.forEach((layer, index, records) => {
               if(_isModel(layer)){
                   _addInboundNodesForSequential(layer);
                   if(layer.inbound_nodes){
                       layer.config.layers[0].inbound_nodes = layer.inbound_nodes;
                   }
                   else {
                       // ToDo: Implement logic for cascaded nested layers
                       layer.config.layers[0].inbound_nodes = records[index-1].config.name;
                   }
                   _flatten(layer, layersInfo);
               }
               else {
                   layersInfo.push(layer);
               }
            });
        }
    }


    function _addInboundNodesForSequential(layersInfo) {
        if(_determineModelType(layersInfo) !== JSONModelMaps.ModelTypes.sequential){
            return;
        }
        layersInfo = layersInfo.config.layers;
        for (let i = 0; i < layersInfo.length - 1; i++) {
            layersInfo[i + 1].inbound_nodes = [layersInfo[i].config.name];
            if (i === 0) {
                layersInfo[i].inbound_nodes = [];
                layersInfo[i].name = layersInfo[i].config.name
            }
            // This adds Consistency with the functional models, becuase
            // the functional JSON file has duplicate name keys, one inside config and one at the top level
            if (!layersInfo[i + 1].name) {
                layersInfo[i + 1].name = layersInfo[i + 1].config.name;
            }
        }
    }


    function _isModel(modelConfig) {
        return !(modelConfig.config.layers === undefined || modelConfig.config.layers === null);
    }


    function _addInputLayer(modelConfig) {
        if(_determineModelType(modelConfig) ===JSONModelMaps.ModelTypes.sequential){
            let inputLayerToAdd = {
                "class_name": "InputLayer",
                "config": {
                    "batch_input_shape": modelConfig.config.layers[0].config.batch_input_shape,
                    "dtype": "float32",
                    "name": "input",
                    "sparse": false
                },
                "name": "input",
                "inbound_nodes": []
            };
            // console.log('>', modelConfig.config.layers[0]);

            delete modelConfig.config.layers[0].config.batch_input_shape;
            modelConfig.config.layers.splice(0, 0, inputLayerToAdd);
            _addInboundNodesForSequential(modelConfig);
        }
    }

    // Determine whether the model is 'Sequential' Or 'Functional'
    // Its necessary because 'Sequential' Models do not have the property inbound_nodes
    // In their layer so, it should be added externally
    // Cases for a sequential model:
    // 1. The model has an attribute called class_name and is equal to 'Sequential'
    // 2. The model has an no attribute inbound_nodes
    function _determineModelType(model) {
        if(model.class_name && model.class_name === JSONModelMaps.ModelTypes.sequential){
            return JSONModelMaps.ModelTypes.sequential;
        }
        let layers = model.config.layers;
        if(layers){
            for(let i = 0; i < layers.length; i++){
                if(!layers[i].inbound_nodes){
                    return JSONModelMaps.ModelTypes.sequential;
                }
            }
        }
        return JSONModelMaps.ModelTypes.functional;
    }


    // After getting flattened layers, change from
    function _inboundNodesToStringArray(modelConfig) {
        let layers = modelConfig.config.layers;

    }


    return ModelParser;

});