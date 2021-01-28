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
        .filter(layer => {
            const {file} = layer;
            const isSpektralLayer = file.startsWith('spektral');
            const isSpektralMisc = isSpektralLayer && file.includes('base.py');
            return !isSpektralMisc;
        })
        .map(layer => {  // apply any special case patching
            if (layer.name === 'Wrapper' || layer.name === 'TimeDistributed') {
                layer.arguments[1].type = 'Layer';
            }
            if (layer.name === 'Bidirectional') {
                layer.arguments[1].type = 'Recurrent';
            }
            if (layer.name === 'Input') {
                layer.category = 'topology';
            }
            if (layer.file.startsWith('spektral')) {
                if (layer.file.includes('pooling')) {
                    layer.category = 'Graph_Pooling';
                } else {
                    layer.category = 'Graph';
                }
                if (layer.name === 'MessagePassing') {
                    layer.abstract = true;
                }
            }

            if (layer.arguments) {
                layer.arguments.forEach(argument => {
                    if (!argument.type) {
                        argument.type = SpecialTypeNames
                            .find(name => argument.name.includes(name));
                    }

                    if (argument.name === 'return_attn_coef') {
                        if (layer.outputs.length === 0) {
                            layer.outputs.push({name: 'output'});
                        }
                        layer.outputs.push({name: 'attn_coef'});
                        argument.type = 'constant_attribute';
                        argument.default = 'True';
                    }

                    // Fix case sensitivity issue
                    if (argument.default === 'prelu') {
                        argument.default = 'PReLU';
                    }
                });
            }

            const isMaskPoolingLayer = [
                'DiffPool',
                'MinCutPool',
                'SAGPool',
                'TopKPool',
            ].includes(layer.name);
            if (isMaskPoolingLayer) {
                layer.outputs = [
                    {name: 'reduced_features'},
                    {name: 'reduced_adj'},
                    {name: 'clustering_matrix'},
                ];
                // TODO: if disjoint, add another input...
                // https://github.com/danielegrattarola/spektral/blob/d720de476d04a8d9ed23570336eddfedb97dd7de/spektral/layers/pooling/topk_pool.py#L137
                const returnMask = layer.arguments.find(arg => arg.name === 'return_mask');
                returnMask.type = 'constant_attribute';
                returnMask.default = 'True';
            }

            addKnownAliases(layer);

            return layer;
        });

    function addKnownAliases(layer) {
        const KNOWN_LAYER_ALIASES = {
            GCNConv: 'GraphConv',
            ECCConv: 'EdgeConditionedConv',
            GATConv: 'GraphAttention',
            GCSConv: 'GraphConvSkip',
            APPNPConv: 'APPNP'
        };

        const alias = KNOWN_LAYER_ALIASES[layer.name];
        if (alias) {
            layer.aliases.push(alias);
        }
        return layer;
    }

    return {SpecialTypes, Layers};
});
