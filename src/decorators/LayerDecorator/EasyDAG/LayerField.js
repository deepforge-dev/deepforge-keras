/* globals define, _ */
define([
    'decorators/EllipseDecorator/EasyDAG/PointerField'
], function(
    PointerField
) {
    var LayerField = function() {
        PointerField.apply(this, arguments);
    };

    _.extend(LayerField.prototype, PointerField.prototype);

    return LayerField;
});
