/*globals define */
define([], function() {
    const ModelMaps = {};

    ModelMaps.CLASS_MAP = {
        InputLayer: 'Input'
    };

    ModelMaps.ARGUMENTS_MAP = {
        batch_shape: 'batch_input_shape'
    };

    ModelMaps.ModelTypes = {
        sequential : 'Sequential',
        functional : 'Model'
    };

    ModelMaps.AbstractLayerTypeMapping = {
        Activation: 'activation',
        ActivityRegularization: 'activity_regularizer'
    };


    return ModelMaps;

});