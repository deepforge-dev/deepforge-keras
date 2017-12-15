/*globals define */
/*jshint browser: true*/

define([
    'deepforge-keras/Constants',
    'panels/EasyDAG/EasyDAGControl',
    'js/NodePropertyNames',
    'js/Utils/ComponentSettings',
    'underscore',
    'q'
], function (
    Constants,
    ThumbnailControl,
    nodePropertyNames,
    ComponentSettings,
    _,
    Q
) {

    'use strict';

    var KerasArchEditorControl,
        DEFAULT_CONFIG = {
            DefaultColor: '#80cbc4',
            LayerColors: {
                Recurrent: '#ffb74d',
                Pooling: '#ffe0b2',
                Convolutional: '#90caf9',
                Core: '#ff9100',
                Wrappers: '#80deea',
                Normalization: '#ce93d8'
            }
        };

    KerasArchEditorControl = function (options) {
        ThumbnailControl.call(this, options);
        this._config = DEFAULT_CONFIG;
        ComponentSettings.resolveWithWebGMEGlobal(this._config, this.getComponentId());
        this.validateLayers = _.debounce(() => this.validateKerasArchitecture(), 500);
    };

    _.extend(KerasArchEditorControl.prototype, ThumbnailControl.prototype);

    KerasArchEditorControl.prototype.TERRITORY_RULE = {children: 1};
    KerasArchEditorControl.prototype.DEFAULT_DECORATOR = 'LayerDecorator';
    KerasArchEditorControl.prototype.getComponentId = function() {
        return 'KerasArchEditor';
    };

    KerasArchEditorControl.prototype.selectedObjectChanged = function(id) {
        this.nestedLevel = typeof id === 'string' ?
            Math.floor(id.split('/').length/2) % 2 : 0;
        ThumbnailControl.prototype.selectedObjectChanged.call(this, id);

        if (typeof id === 'string') {
            var name = this._client.getNode(id).getAttribute('name');
            this._widget.setTitle(name);
        }
    };

    KerasArchEditorControl.prototype._getObjectDescriptor = function(id) {
        var node = this._client.getNode(id),
            desc = ThumbnailControl.prototype._getObjectDescriptor.call(this, id);

        // Filter attributes
        if (!desc.isConnection) {
            var allAttrs = desc.attributes,
                names = Object.keys(allAttrs),
                ctorInfo = desc.attributes[Constants.ATTR.CTOR_ARGS],
                ctorAttrs = ctorInfo ? ctorInfo.value.split(','): [],
                schema,
                i;

            desc.attributes = {};

            // add ctor attributes
            for (i = 0; i < ctorAttrs.length; i++) {
                if (allAttrs[ctorAttrs[i]]) {  // (not a ref to a layer)
                    desc.attributes[ctorAttrs[i]] = allAttrs[ctorAttrs[i]];
                }
            }

            for (i = names.length; i--;) {
                // check if it is a setter
                schema = node.getAttributeMeta(names[i]);
                if (names[i] === 'name' || schema.setterType) {
                    desc.attributes[names[i]] = allAttrs[names[i]];
                }
            }

            // Add layer type (base class's base class)
            desc.layerType = null;
            if (desc.baseName) {
                var base = this._client.getNode(node.getMetaTypeId()),
                    layerType = this._client.getNode(base.getBaseId()),
                    color;

                desc.baseName = base.getAttribute(nodePropertyNames.Attributes.name);
                if (layerType) {
                    desc.layerType = layerType.getAttribute(nodePropertyNames.Attributes.name);

                    color = this._config.LayerColors[desc.layerType];
                    if (desc.layerType === 'Container' && this.nestedLevel) {
                        color = this._config.LayerColors.NestedContainer;
                    }
                    if (!color) {
                        this._logger.warn(`No color found for ${desc.layerType}`);
                        color = this._config.DefaultColor;
                    }
                    desc.color = color;

                    if (desc.layerType === 'Container') {
                        desc.containedLayers = node.getMemberIds(Constants.CONTAINED_LAYER_SET)
                            .map(layerId => {
                                var index = node.getMemberRegistry(
                                    Constants.CONTAINED_LAYER_SET,
                                    layerId,
                                    Constants.CONTAINED_LAYER_INDEX
                                );
                                return [layerId, index];
                            })
                            .sort((a, b) => a[1] < b[1] ? -1 : 1)
                            .map(tuple => tuple[0]);

                        // Set the decorator to ContainerLayerDecorator
                        desc.Decorator = this._client.decoratorManager
                            .getDecoratorForWidget('ContainerLayerDecorator', 'EasyDAG');
                    }
                }
            }
        }
        return desc;
    };

    ////////////////////////// Layer Selection Logic //////////////////////////
    KerasArchEditorControl.prototype._getValidInitialNodes = function() {
        // Return all (non-criterion) layer types
        var metanodes = this._client.getAllMetaNodes(),
            layerId,
            name,
            connId,
            layers = [],
            tgts,
            j,
            i;

        for (i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === 'Layer') {
                layerId = metanodes[i].getId();
                break;
            }
        }

        if (!layerId) {
            this._logger.warn('Could not find layer connector');
            return [];
        }

        for (i = metanodes.length; i--;) {
            name = metanodes[i].getAttribute('name');
            if (name === 'Input' && metanodes[i].isTypeOf(layerId)) {
                layers.push(metanodes[i]);
            } else if (!connId && name === 'Connection') {  // Detect the layer connection type...
                tgts = this._client.getPointerMeta(metanodes[i].getId(), 'src').items;
                for (j = tgts.length; j--;) {
                    if (tgts[j].id === layerId) {
                        connId = metanodes[i].getId();
                    }
                }

            }
        }

        return this._getLayerConnDescs(layers, connId);
    };

    KerasArchEditorControl.prototype.getValidSuccessors =
    KerasArchEditorControl.prototype.getNonCriterionLayers = function() {
        // Return all (non-criterion) layer types
        var metanodes = this._client.getAllMetaNodes(),
            layerId,
            connId,
            allLayers = [],
            tgts,
            j,
            i;

        for (i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === 'Layer') {
                layerId = metanodes[i].getId();
                break;
            }
        }

        // Remove all criterion layers and abstract layers
        for (i = metanodes.length; i--;) {
            if (layerId) {
                if (!metanodes[i].isAbstract() && metanodes[i].isTypeOf(layerId)) {

                    if (metanodes[i].getAttribute('name') !== 'Criterion') {
                        allLayers.push(metanodes[i]);
                    }
                } else if (!connId && metanodes[i].getAttribute('name') === 'Connection') {  // Detect the layer connection type...
                    tgts = this._client.getPointerMeta(metanodes[i].getId(), 'src').items;
                    for (j = tgts.length; j--;) {
                        if (tgts[j].id === layerId) {
                            connId = metanodes[i].getId();
                        }
                    }
                }
            }
        }

        return this._getLayerConnDescs(allLayers, connId);
    };

    KerasArchEditorControl.prototype._getLayerConnDescs = function(layers, connId) {
        var descs = [];

        if (!connId) {
            this._logger.warn('Could not find a layer connector');
            return [];
        }

        var conn = this._getObjectDescriptor(connId);
        // Remove all criterion layers and abstract layers
        for (var i = layers.length; i--;) {
            descs.push({
                node: this._getObjectDescriptor(layers[i].getId()),
                conn: conn
            });
        }

        return descs;
    };

    KerasArchEditorControl.prototype._isValidTerminalNode = function() {
        return true;
    };

    // Widget extensions
    KerasArchEditorControl.prototype._initWidgetEventHandlers = function() {
        ThumbnailControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.insertLayer = this.insertLayer.bind(this);
    };

    KerasArchEditorControl.prototype.insertLayer = function(layerBaseId, connId) {
        var conn = this._client.getNode(connId),
            parentId = conn.getParentId(),
            layerId,
            nextLayerId = conn.getPointer('dst').to,
            connBaseId = conn.getBaseId(),
            newConnId,

            baseName = this._client.getNode(layerBaseId).getAttribute('name'),
            prevLayerId = conn.getPointer('src').to,
            srcName = this._client.getNode(prevLayerId).getAttribute('name'),
            dstName = this._client.getNode(nextLayerId).getAttribute('name'),
            msg = `Inserting ${baseName} layer between ${srcName} and ${dstName}`;

        this._client.startTransaction(msg);
        // Create the new layer
        layerId = this._client.createNode({
            parentId: parentId,
            baseId: layerBaseId
        });

        // Connect the new layer to the previous dst of 'connId'
        newConnId = this._client.createNode({
            parentId: parentId,
            baseId: connBaseId
        });
        this._client.setPointer(newConnId, 'src', layerId);
        this._client.setPointer(newConnId, 'dst', nextLayerId);

        // Change the dst of 'connId' to the new layer
        this._client.setPointer(connId, 'dst', layerId);

        this._client.completeTransaction();
    };

    KerasArchEditorControl.prototype._eventCallback = function() {
        ThumbnailControl.prototype._eventCallback.apply(this, arguments);
        this.validateLayers();
    };

    KerasArchEditorControl.prototype.validateKerasArchitecture = function() {
        var pluginId = 'ValidateKerasArchitecture',
            context = this._client.getCurrentPluginContext(pluginId);

        this._logger.info('about to validate arch');
        // Run the plugin in the browser (set namespace)
        //context.managerConfig.namespace = 'keras';
        //context.pluginConfig = {};
        //Q.ninvoke(this._client, 'runServerPlugin', pluginId, context)
            //.then(res => {
                //var results = res.messages[0].message;
                //if (results.errors !== null) {
                    //this._widget.displayErrors(results.errors);
                //}
            //})
            //.fail(err => this._logger.warn(`Validation failed: ${err}`));
    };

    ////////////////////////////// Event Handlers ////////////////////////////// 
    KerasArchEditorControl.prototype._getValidTargetsFor = function(id, ptr) {
        // Get all the meta nodes matching the given type...
        let typeIds = this._client.getPointerMeta(id, ptr).items.map(item => item.id);
        let metanodes = this._client.getAllMetaNodes();
        let targets = [];

        for (let i = metanodes.length; i--;) {
            for (let t = typeIds.length; t--;) {
                if (metanodes[i].isTypeOf(typeIds[t]) && !metanodes[i].isAbstract()) {
                    targets.push(metanodes[i].getId());
                    break;
                }
            }
        }

        return targets.map(id => {
            return {
                node: this._getObjectDescriptor(id)
            };
        });
    };

    return KerasArchEditorControl;
});
