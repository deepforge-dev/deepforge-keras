/*globals define */
define([], function() {
    const Constants = {};
    Constants.META_ASPECT_SET_NAME = 'MetaAspectSet';
    Constants.META_ASPECT_SHEET_NAME_PREFIX = 'MetaAspectSet_';
    Constants.CTOR_ARGS_ATTR = 'ctor_arg_order';
    Constants.CONTAINED_LAYER_SET = 'addLayers';
    Constants.CONTAINED_LAYER_INDEX = 'index';

    // Registry
    Constants.REGISTRY = {};
    Constants.REGISTRY.POSITION = 'position';
    Constants.REGISTRY.META_SHEETS = 'MetaSheets';

    return Constants;
});
