/*globals define*/
define([
    'text!./additional-layers.json',
    'text!./activations.json',
    'text!./initializers.json',
    'text!./constraints.json',
    'text!./regularizers.json',
    'text!./layers.json',
], function(
    AdditionalLayerTxt,
    ActivationsTxt,
    InitializersTxt,
    ConstraintsTxt,
    RegularizersTxt,
    LayerTxt,
) {

    const SpecialTypes = {
        activation: JSON.parse(ActivationsTxt),
        constraint: JSON.parse(ConstraintsTxt),
        regularizer: JSON.parse(RegularizersTxt),
        initializer: JSON.parse(InitializersTxt)
    };
    const SpecialTypeNames = Object.keys(SpecialTypes);
    const AdditionalLayers = JSON.parse(AdditionalLayerTxt);
    const Layers = JSON.parse(LayerTxt).concat(AdditionalLayers)
        .map(layer => {  // apply any special case patching
            if (layer.name === 'Wrapper' || layer.name === 'TimeDistributed') {
                layer.arguments[1].type = 'Layer';
            }
            if (layer.name === 'Bidirectional') {
                layer.arguments[1].type = 'Recurrent';
            }
            if (layer.name === 'Input') {
                layer.category = 'topology'
            }

            if (layer.arguments) {
                layer.arguments.forEach(argument => {
                    if (!argument.type) {
                        argument.type = SpecialTypeNames
                            .find(name => argument.name.includes(name));
                    }
                });
            }
            return layer;
        });

    return {SpecialTypes, Layers};
});
