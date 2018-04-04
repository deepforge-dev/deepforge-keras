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

        this.connections = [];
    };

    _.extend(KerasArchEditorControl.prototype, ThumbnailControl.prototype);

    KerasArchEditorControl.prototype.TERRITORY_RULE = {children: 2};
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
        this.connections = [];
    };

    KerasArchEditorControl.prototype.getCurrentDepth = function () {
        return this.getDepthOf(this._currentNodeId);
    };

    KerasArchEditorControl.prototype.getDepthOf = function (id) {
        return id.split('/').length;
    };

    KerasArchEditorControl.prototype.getParentAtDepth = function (id, depth) {
        depth = depth !== undefined ? depth : (this.getCurrentDepth() + 1);
        return id.split('/').slice(0, depth).join('/');
    };

    KerasArchEditorControl.prototype.isCurrentChild = function (gmeId) {
        return (this.getCurrentDepth() + 1) === this.getDepthOf(gmeId);
    };

    KerasArchEditorControl.prototype.updateConnections = function (desc) {
        // TODO: detect if we need to add/remove a connection
        // Get the inputs of the given node
        const srcIdsForId = {};

        this.connections.forEach(conn => {
            const {src, dst} = conn;
            srcIdsForId[dst] = srcIdsForId[dst] || [];
            srcIdsForId[dst].push(src);
        });

        // Update the ids to ignore ports and stuff
        // TODO
        const srcDstPairs = desc.inputs.map(node => {
            const dstId = node.getId();
            const ids = node.getMemberIds('source');

            return ids.map(srcId => [
                this.getParentAtDepth(srcId),
                this.getParentAtDepth(dstId),
                srcId,
                dstId
            ]);
        }).reduce((l1, l2) => l1.concat(l2), []);

        // For all pairs, remove them if they already exist
        const newPairs = srcDstPairs.filter(pair => {
            const [src, dst] = pair;

            if (srcIdsForId[dst]) {
                const index = srcIdsForId[dst].indexOf(src);

                if (index > -1) {  // exists
                    srcIdsForId[dst].splice(index, 1);
                    return false;
                }
            }

            return true;  // new connection
        });

        // Add the new connections
        newPairs
            .map(pair => {  // create the connection
                const [src, dst, srcArgId, dstArgId] = pair;
                return {
                    src,
                    dst,
                    srcArgId,
                    dstArgId,
                    id: `${src}-${dst}`
                };
            })
            .forEach(conn => {  // add the connection
                this.connections.push(conn);
            });

        // Remove any connections with the same dst but different source
        const ids = srcIdsForId[desc.id] || [];
        ids.forEach(id => this.removeConnectionByEndpoints(id, desc.id));
    };

    KerasArchEditorControl.prototype.removeConnectionByEndpoints = function (src, dst) {
        for (let i = this.connections.length; i--;) {
            const conn = this.connections[i];
            if (conn.src === src && conn.dst === dst) {
                this.connections.splice(i, 1);
                this._widget.removeNode(conn.id);
            }
        }
    };

    KerasArchEditorControl.prototype.removeConnectionsInvolving = function (id) {
        id = this.getParentAtDepth(id);
        for (let i = this.connections.length; i--;) {
            const conn = this.connections[i];
            if (conn.src === id || conn.dst === id) {
                this.connections.splice(i, 1);
                this._widget.removeNode(conn.id);
            }
        }
    };

    KerasArchEditorControl.prototype._onLoad = function (gmeId) {
        // Determine the id that actually needs updating...
        if (this.isCurrentChild(gmeId)) {
            const desc = this._getObjectDescriptor(gmeId);
            this._widget.addNode(desc);
            this.updateConnections(desc);
        }
    };

    KerasArchEditorControl.prototype._onUpdate = function (gmeId) {
        // Update the child containing the id
        const childId = this.getParentAtDepth(gmeId);
        const desc = this._getObjectDescriptor(childId);

        this._widget.updateNode(desc);
        this.updateConnections(desc);
    };

    KerasArchEditorControl.prototype._onUnload = function (gmeId) {
        if (this.isCurrentChild(gmeId)) {
            this.removeConnectionsInvolving(gmeId);
            this._widget.removeNode(gmeId);
        }
    };

    KerasArchEditorControl.prototype._getMetaObjectDescriptor = function(id) {
        // Do not sort inputs/outputs since those nodes are probably not loaded...
        var node = this._client.getNode(id),
            desc = ThumbnailControl.prototype._getObjectDescriptor.call(this, id);

        // Filter attributes
        if (!desc.isConnection && desc.name !== 'Connection') {
            var allAttrs = desc.attributes,
                names = Object.keys(allAttrs),
                ctorInfo = desc.attributes[Constants.ATTR.CTOR_ARGS],
                ctorAttrs = ctorInfo ? ctorInfo.value.split(','): [],
                schema,
                i;

            // Add information about the LayerData inputs and outputs
            desc.inputs = [];
            desc.outputs = [];
            if (node.getSetNames().includes('inputs')) {
                desc.inputs = node.getMemberIds('inputs');
            }
            if (node.getSetNames().includes('outputs')) {
                desc.outputs = node.getMemberIds('outputs');
            }

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
        } else if (desc.isConnection) {  // TODO: Fix this once I can actually connect these ports wrt
            // the auto-layout stuff...
            desc.src = this.getParentAtDepth(desc.src);
            desc.dst = this.getParentAtDepth(desc.dst);
        }

        return desc;
    };

    KerasArchEditorControl.prototype._getObjectDescriptor = function(id) {
        const desc = this._getMetaObjectDescriptor(id);

        if (desc.inputs) {
            desc.inputs = desc.inputs.map(id => this._client.getNode(id));
        }

        if (desc.outputs) {
            desc.outputs = desc.outputs
                .map(id => this._client.getNode(id))
                .sort((a, b) => a.getAttribute('index') < b.getAttribute('index') ? -1 : 1);
        }

        return desc;
    };

    ////////////////////////// Layer Selection Logic //////////////////////////
    KerasArchEditorControl.prototype._getValidInitialNodes = function() {
        // Return all (non-criterion) layer types
        var metanodes = this._client.getAllMetaNodes(),
            layerId,
            name,
            i;

        for (i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === 'Layer') {
                layerId = metanodes[i].getId();
                break;
            }
        }

        if (!layerId) {
            this._logger.warn('Could not find base layer type');
            return [];
        }

        for (i = metanodes.length; i--;) {
            name = metanodes[i].getAttribute('name');
            if (name === 'Input' && metanodes[i].isTypeOf(layerId)) {
                return [{
                    node: this._getObjectDescriptor(metanodes[i].getId()),
                    conn: null
                }];
            }
        }

        return [];
    };

    KerasArchEditorControl.prototype.getPairDesc = function(node) {
        const nodeId = node.getId();
        return {
            node: this._getMetaObjectDescriptor(this.getParentAtDepth(nodeId)),
            arg: this._getMetaObjectDescriptor(nodeId)
        };
    };

    KerasArchEditorControl.prototype.getAllPredecessorsAsDict = function(childId) {
        // For the given node, get all the predecessors
        let current = [childId];
        let visited = {};
        let next;
        while (current.length) {
            next = [];
            for (let i = current.length; i--;) {
                visited[current[i]] = true;

                let node = this._client.getNode(current[i]);
                let inputs = node.getMemberIds('inputs')
                    .map(id => this._client.getNode(id));

                let prevs = inputs
                    .map(node => node.getMemberIds('source').map(id => this.getParentAtDepth(id)))
                    .reduce((l1, l2) => l1.concat(l2), []);

                // Get the predecessors of a given node
                next = next.concat(prevs);
            }
            current = next.filter(id => !visited[id]);
        }

        return visited;
    };

    KerasArchEditorControl.prototype.getValidExistingSuccessors = function(id) {
        const childId = this.getParentAtDepth(id);
        const isPredecessor = this.getAllPredecessorsAsDict(childId);

        // Remove the nodes which are already connected
        // TODO

        return this.getCurrentChildren()
            .filter(node => {
                if (isPredecessor[node.getId()]) {
                    return false;
                }

                // Check if the node is already connected to "childId"
                const isImmediateSuccessor = node.getMemberIds('inputs')
                    .find(id => {
                        const inputNode = this._client.getNode(id);
                        return inputNode.getMemberIds('source')
                            .map(id => this.getParentAtDepth(id))
                            .find(id => id === childId);
                    });

                return !isImmediateSuccessor;
            })
            .map(node => {
                return node.getMemberIds('inputs').map(id => {
                    return {
                        node: this._getObjectDescriptor(this.getParentAtDepth(id)),
                        arg: this._getObjectDescriptor(id)
                    };
                });
            })
            .reduce((l1, l2) => l1.concat(l2), []);
    };

    KerasArchEditorControl.prototype.getValidExistingPredecessors = function(id) {
        const childId = this.getParentAtDepth(id);

        // Get all valid predecessors
        const isPredecessor = this.getAllPredecessorsAsDict(childId);
        delete isPredecessor[childId];  // no self-connections

        // Remove the nodes which are already connected
        const immediatePreds = this._client.getNode(id).getMemberIds('source')
            .map(id => this.getParentAtDepth(id));
        immediatePreds.forEach(id => delete isPredecessor[id]);

        return this.getCurrentChildren()
            .filter(node => isPredecessor[node.getId()])
            .map(node => {
                return node.getMemberIds('outputs').map(id => {
                    return {
                        node: this._getObjectDescriptor(this.getParentAtDepth(id)),
                        arg: this._getObjectDescriptor(id)
                    };
                });
            })
            .reduce((l1, l2) => l1.concat(l2), []);
    };

    KerasArchEditorControl.prototype.getCurrentChildren = function() {
        var node = this._client.getNode(this._currentNodeId),
            childrenIds = node.getChildrenIds();

        return childrenIds.map(id => this._client.getNode(id));
    };

    KerasArchEditorControl.prototype.getValidSuccessors = function() {
        const layers = this.getAllLayers();

        // Get all nodes that have at least one input
        // TODO: show options for each port
        return layers.filter(layer => layer.getMemberIds('inputs').length)
            .map(node => this.getPairDesc(node));
    };

    KerasArchEditorControl.prototype.getValidPredecessors = function() {
        const layers = this.getAllLayers();

        // Get all nodes that have at least one output
        // TODO: show options for each port
        return layers.filter(layer => layer.getMemberIds('outputs').length)
            .map(node => this.getPairDesc(node));
    };

    KerasArchEditorControl.prototype._disconnectNodes = function(srcId, dstId) {
        const [srcLayer, dstLayer] = [srcId, dstId].map(id => {
            const layerId = this.getParentAtDepth(id);
            const layer = this._client.getNode(layerId);
            return layer.getAttribute('name');
        });
        const msg = `Disconnecting ${dstLayer} from ${srcLayer}`;

        this._client.startTransaction(msg);
        this._client.removeMember(dstId, srcId, 'source');
        this._client.completeTransaction();
    };

    KerasArchEditorControl.prototype._connectNodes = function(srcId, dstId) {
        const [srcLayer, dstLayer] = [srcId, dstId].map(id => {
            const layerId = this.getParentAtDepth(id);
            const layer = this._client.getNode(layerId);
            return layer.getAttribute('name');
        });
        const msg = `Connecting ${srcLayer} to ${dstLayer}`;

        this._client.startTransaction(msg);
        this._client.addMember(dstId, srcId, 'source');
        this._client.setMemberRegistry(
            dstId,
            srcId,
            'source',
            'position',
            {x: 100, y: 100}
        );
        this._client.completeTransaction();
    };

    KerasArchEditorControl.prototype._createConnectedNode = function(srcId, dstBaseId, reverse) {
        const parentId = this._currentNodeId;

        const type = this._client.getNode(dstBaseId).getAttribute('name');
        const branchName = this._client.getActiveBranchName();
        const msg = `Creating ${type} layer`;

        let core,
            rootNode,
            project,
            commitHash;

        return Q.ninvoke(this._client, 'getCoreInstance', {logger: this._logger})
            .then(result => {
                core = result.core;
                rootNode = result.rootNode;
                project = result.project;
                commitHash = result.commitHash;

                const nodes = [parentId, dstBaseId]
                    .map(id => core.loadByPath(rootNode, id));

                return Q.all(nodes);
            })
            .then(nodes => {
                const [parent, base] = nodes;
                const newNode = core.createNode({parent, base});

                let inputId;
                let outputId;

                // Add the input id to the 'source' set of outputId
                if (!reverse) {  // srcId is the output and we created the new input
                    outputId = srcId;
                    inputId = core.getMemberPaths(newNode, 'inputs')
                        .find(id => {  // get the first input
                            const index = core.getMemberAttribute(newNode, 'inputs', id, 'index');
                            return index === 0;
                        });
                } else {
                    inputId = srcId;
                    outputId = core.getMemberPaths(newNode, 'outputs')
                        .find(id => {  // get the first output
                            const index = core.getMemberAttribute(newNode, 'outputs', id, 'index');
                            return index === 0;
                        });
                }

                // Set the reference from the input node to the output node
                // TODO
                let inputNode = null;
                let outputNode = null;
                return core.loadByPath(rootNode, inputId)
                    .then(node => {
                        inputNode = node;
                        return core.loadByPath(rootNode, outputId);
                    })
                    .then(node => {
                        outputNode = node;
                        core.addMember(inputNode, 'source', outputNode);
                        core.setMemberRegistry(
                            inputNode,
                            'source',
                            outputId,
                            'position',
                            {x: 100, y: 100}
                        );

                        const persisted = core.persist(rootNode);
                        return project.makeCommit(
                            branchName,
                            [ commitHash ],
                            persisted.rootHash,
                            persisted.objects,
                            msg
                        );
                    });
            })
            .catch(err => this._logger.error(err));
    };

    KerasArchEditorControl.prototype.getAllLayers = function() {
        var metanodes = this._client.getAllMetaNodes(),
            layerId,
            allLayers = [],
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
                    allLayers.push(metanodes[i]);

                }
            }
        }

        return allLayers;
    };

    KerasArchEditorControl.prototype._isValidTerminalNode = function() {
        return true;
    };

    // Widget extensions
    KerasArchEditorControl.prototype._initWidgetEventHandlers = function() {
        ThumbnailControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.insertLayer = this.insertLayer.bind(this);
        this._widget.disconnectNodes = this._disconnectNodes.bind(this);
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
        const existingConnIds = this.connections.map(conn => conn.id);
        ThumbnailControl.prototype._eventCallback.apply(this, arguments);

        this.connections.forEach(conn => {
            if (!existingConnIds.includes(conn.id)) {
                this._widget.addConnection(conn);
            }
        });
    };

    // TODO: Move this to a webhook...
    KerasArchEditorControl.prototype.validateKerasArchitecture = function() {
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

    KerasArchEditorControl.prototype.getSrcDstIdsForConn = function(srcId, nodeId, reverse) {
        var node = this._client.getNode(nodeId),
            ioSetName = reverse ? 'outputs' : 'inputs',
            dstId = node.getMemberIds(ioSetName)[0];

        return ThumbnailControl.prototype.getSrcDstIdsForConn.call(this, srcId, dstId, reverse);
    };

    return KerasArchEditorControl;
});
