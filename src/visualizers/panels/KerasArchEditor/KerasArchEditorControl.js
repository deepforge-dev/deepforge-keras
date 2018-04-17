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
        const connections = desc.inputs
            .map(node => {
                const dstId = node.getId();
                const ids = this.getSortedSetIds(dstId, 'source');

                return ids.map(srcId => [
                    this.getParentAtDepth(srcId),
                    this.getParentAtDepth(dstId),
                    srcId,
                    dstId
                ]);
            })
            .reduce((l1, l2) => l1.concat(l2), [])
            .map(pair => {
                const [src, dst, srcArgId, dstArgId] = pair;
                const connection = {
                    src,
                    dst,
                    srcArgId,
                    dstArgId,
                    index: null,
                    id: `${src}-${dst}`
                };

                const inputIds = this._getLayerArgInputIds(dstArgId);
                if (inputIds.length > 1) {
                    connection.index = inputIds.indexOf(srcArgId);
                }
                return connection;
            });

        // For all pairs, remove them if they already exist
        // They should be updated
        const newPairs = [];
        const existingPairs = [];
        connections.forEach(pair => {
            const {src, dst} = pair;

            if (srcIdsForId[dst]) {
                const index = srcIdsForId[dst].indexOf(src);

                if (index > -1) {  // exists
                    srcIdsForId[dst].splice(index, 1);
                    return existingPairs.push(pair);
                }
            }

            return newPairs.push(pair);  // new connection
        });

        // Update the existing connections if index should no longer be shown
        existingPairs.forEach(conn => this._widget.updateConnection(conn));

        // Add the new connections
        newPairs.forEach(conn => this.connections.push(conn));

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

    KerasArchEditorControl.prototype.isNodeLoaded = function (id) {
        return !!this._client.getNode(id);
    };

    KerasArchEditorControl.prototype.removeConnectionsInvolving = function (id) {
        // I also need to detect if this affects any existing connections
        // That is, I need to update any node which is the target of the
        // connection
        id = this.getParentAtDepth(id);
        for (let i = this.connections.length; i--;) {
            const conn = this.connections[i];
            if (conn.src === id || conn.dst === id) {
                this.connections.splice(i, 1);
                this._widget.removeNode(conn.id);
                if (conn.src === id && this.isNodeLoaded(conn.dst)) {
                    // If this is the source node, this may affect the printing
                    // of indices for other connections to this destination node
                    this._onUpdate(conn.dst);
                }
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

    KerasArchEditorControl.prototype.onActiveNodeUpdate = function (id) {
        // Update the input nodes (their index may have changed)
        const node = this._client.getNode(id);
        const setsToUpdate = ['inputs', 'outputs'];
        setsToUpdate.forEach(set => {
            const memberIds = node.getMemberIds(set);
            memberIds.forEach(id => {
                // Update the node
                const desc = this._getObjectDescriptor(id);
                this._widget.updateNode(desc);
            });
        });
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
            desc.inputs = this.getSortedSetIds(id, 'inputs');
        }
        if (node.getSetNames().includes('outputs')) {
            desc.outputs = this.getSortedSetIds(id, 'outputs');
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

        return desc;
    };

    KerasArchEditorControl.prototype._getObjectDescriptor = function(id) {
        const desc = this._getMetaObjectDescriptor(id);

        // Add the 'index' field if it is an Input layer
        // (only show if multiple inputs)
        const inputs = this.getCurrentNodeInputs();
        desc.index = inputs.length > 1 ? inputs.indexOf(id) : -1;

        if (desc.index === -1) {
            const outputs = this.getSortedSetIds(this._currentNodeId, 'outputs');
            desc.index = outputs.length > 1 ? outputs.indexOf(id) : -1;
        }

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

    KerasArchEditorControl.prototype.getCurrentNodeInputs = function() {
        return this.getSortedSetIds(this._currentNodeId, 'inputs');
    };

    KerasArchEditorControl.prototype.getCurrentNodeOutputs = function() {
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
        // this will need to be updated when we add multi input type support to UI
        // TODO
        return {
            node: this._getMetaObjectDescriptor(nodeId),
            arg: this._getMetaObjectDescriptor(nodeId)
        };
    };

    KerasArchEditorControl.prototype.getAllPredecessorsAsDict = function(childId) {
        return this.getAllNodesInDirection(childId, false);
    };

    KerasArchEditorControl.prototype.getAllSuccessorsAsDict = function(childId) {
        return this.getAllNodesInDirection(childId);
    };

    KerasArchEditorControl.prototype.getAllNodesInDirection = function(childId, forward=true) {
        // If forward, get successors. Else get the predecessors
        const nodeDict = this.getBidirectionalGraph();
        const edgeName = forward ? 'next' : 'prev';
        let current = [childId];
        let visited = {};
        let next;

        while (current.length) {
            next = [];
            for (let i = current.length; i--;) {
                visited[current[i]] = true;

                // Get the predecessors of a given node
                next = next.concat(nodeDict[current[i]][edgeName]);
            }
            current = next.filter(id => !visited[id]);
        }

        return visited;
    };

    KerasArchEditorControl.prototype.getBidirectionalGraph = function() {
        const nodeDict = {};
        const children = this.getCurrentChildren();

        children.forEach(child => nodeDict[child.getId()] = {next: [], prev: [], node: child});

        // Reconstruct the connections in both directions
        children.forEach(node => {
            const inputs = node.getMemberIds('inputs')
                .map(id => this._client.getNode(id));

            const prevs = inputs
                .map(node => node.getMemberIds('source').map(id => this.getParentAtDepth(id)))
                .reduce((l1, l2) => l1.concat(l2), []);

            const nodeId = node.getId();
            nodeDict[nodeId].prev = prevs;
            prevs.forEach(prevId => {
                nodeDict[prevId].next.push(nodeId);
            });
        });

        return nodeDict;
    };

    KerasArchEditorControl.prototype.getValidExistingSuccessors = function(id) {
        return this.getValidExistingNextNodes(id, true);
    };

    KerasArchEditorControl.prototype.getValidExistingPredecessors = function(id) {
        return this.getValidExistingNextNodes(id, false);
    };

    KerasArchEditorControl.prototype.getValidExistingNextNodes = function(id, forward=true) {
        const childId = this.getParentAtDepth(id);
        const isInDirection = this.getAllNodesInDirection(childId, !forward);
        const nodeDict = this.getBidirectionalGraph();
        const edgeName = forward ? 'next' : 'prev';
        const argsType = forward ? 'inputs' : 'outputs';
        const alreadyConnectedNodes = nodeDict[childId][edgeName];

        return this.getCurrentChildren()
            .filter(node => {
                const nodeId = node.getId();
                if (isInDirection[nodeId]) {
                    return false;
                }

                // Check if the node is already connected to "childId"
                const isImmediateNode = alreadyConnectedNodes.includes(nodeId);

                return !isImmediateNode;
            })
            .map(node => {
                return node.getMemberIds(argsType).map(id => {
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

        // Determine the indices for each input
        const inputs = this._getLayerArgInputIds(dstId);
        const srcIndex = inputs.indexOf(srcId);
        inputs.splice(srcIndex, 1);

        this._client.startTransaction(msg);
        this._client.removeMember(dstId, srcId, 'source');
        // Update the 'index' member attribute for any other members
        this.updateSourceIndices(dstId, inputs);
        this._client.completeTransaction();
    };

    KerasArchEditorControl.prototype.getInputNodesWithSource = function(nodeId) {
        return this.getCurrentChildren()  // Get the inputs
            .map(node => node.getMemberIds('inputs').map(id => this._client.getNode(id)))
            .reduce((l1, l2) => l1.concat(l2), [])
            .filter(inputNode => inputNode.getMemberIds('source').includes(nodeId));
    };

    KerasArchEditorControl.prototype.updateSourceIndices = function(inputId, sourceIds) {
        sourceIds = sourceIds || this._getLayerArgInputIds(inputId);
        sourceIds.forEach((id, index) => {
            this._client.setMemberAttribute(
                inputId,
                id,
                'source',
                'index',
                index
            );
        });
    };

    KerasArchEditorControl.prototype.updateArchIndices = function(archId, set) {
        const inputIds = this.getSortedSetIds(archId, set);
        inputIds.forEach((inputId, index) => {
            this._client.setMemberAttribute(
                archId,
                inputId,
                set,
                'index',
                index
            );
        });
    };

    KerasArchEditorControl.prototype.updateArchIOIndices = function(archId) {
        this.updateArchIndices(archId, 'inputs');
        this.updateArchIndices(archId, 'outputs');
    };

    KerasArchEditorControl.prototype.isInArchitecture = function(id) {
        const node = this._client.getNode(id);
        return this.getMetaTypeName(node.getParentId()) === 'Architecture';
    };

    KerasArchEditorControl.prototype._deleteNode = function(nodeId, silent) {
        // Get all nodes which have a reference to this one
        const inputNodes = this.getInputNodesWithSource(nodeId);
        const node = this._client.getNode(nodeId);
        const name = node.getAttribute('name');

        if (!silent) this._client.startTransaction(`Removing ${name} layer`);
        // Update their 'index' member attributes
        inputNodes.forEach(node => this.updateSourceIndices(node.getId()));

        // Remove the node
        ThumbnailControl.prototype._deleteNode.call(this, nodeId, true);

        // If removing an Input layer, update the indices
        if (this.isInArchitecture(nodeId)) {
            if (this.isInputLayer(nodeId)) {
                this.updateArchIndices(node.getParentId(), 'inputs');
            } else if (this.isOutputLayer(nodeId)) {
                this.updateArchIndices(node.getParentId(), 'outputs');
            }
        }

        if (!silent) this._client.completeTransaction();

    };

    KerasArchEditorControl.prototype.isInputLayer = function(id) {
        const metaType = this.getMetaTypeName(id);
        return metaType === 'Input';
    };

    KerasArchEditorControl.prototype.isOutputLayer = function(id) {
        const metaType = this.getMetaTypeName(id);
        return metaType === 'Output';
    };

    KerasArchEditorControl.prototype.isInputOrOutputLayer = function(id) {
        const metaType = this.getMetaTypeName(id);
        return metaType === 'Input' || metaType === 'Output';
    };

    KerasArchEditorControl.prototype._getLayerArgInputIds = function(argId) {
        return this.getSortedSetIds(argId, 'source');
    };

    KerasArchEditorControl.prototype.getSortedSetIds = function(id, name) {
        const dstNode = this._client.getNode(id);
        const existingInputs = dstNode.getSetNames().includes(name) ? 
            dstNode.getMemberIds(name) : [];

        existingInputs.sort((idA, idB) => {  // sort by the index
            // Get the indices and compare
            const [indexA, indexB] = [idA, idB]
                .map(id => dstNode.getMemberAttribute(name, id, 'index') || 0);
            return indexA < indexB ? -1 : 1;
        });

        return existingInputs;
    };

    KerasArchEditorControl.prototype._connectNodes = function(srcId, dstId) {
        const [srcLayer, dstLayer] = [srcId, dstId].map(id => {
            const layerId = this.getParentAtDepth(id);
            const layer = this._client.getNode(layerId);
            return layer.getAttribute('name');
        });
        const msg = `Connecting ${srcLayer} to ${dstLayer}`;

        // Get the index for the new input
        const dstNode = this._client.getNode(dstId);
        const existingInputs = dstNode.getMemberIds('source');
        const index = existingInputs.length;

        this._client.startTransaction(msg);
        this._client.addMember(dstId, srcId, 'source');
        this._client.setMemberRegistry(
            dstId,
            srcId,
            'source',
            'position',
            {x: 100, y: 100}
        );

        // Set the 'index' member attribute
        this._client.setMemberAttribute(
            dstId,
            srcId,
            'source',
            'index',
            index
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
                        .find(id => {  // get the first input (for now)
                            const index = core.getMemberAttribute(newNode, 'inputs', id, 'index');
                            return index === 0;
                        });
                } else {
                    inputId = srcId;
                    outputId = core.getMemberPaths(newNode, 'outputs')
                        .find(id => {  // get the first output (for now)
                            const index = core.getMemberAttribute(newNode, 'outputs', id, 'index');
                            return index === 0;
                        });
                }

                // Set the reference from the input node to the output node
                let inputNode = null;
                let outputNode = null;
                return core.loadByPath(rootNode, inputId)
                    .then(node => {
                        inputNode = node;
                        return core.loadByPath(rootNode, outputId);
                    })
                    .then(node => {
                        outputNode = node;
                        const index = core.getMemberPaths(inputNode, 'source').length;
                        core.addMember(inputNode, 'source', outputNode);
                        core.setMemberRegistry(
                            inputNode,
                            'source',
                            outputId,
                            'position',
                            {x: 100, y: 100}
                        );
                        // Set the 'index' for layer input ordering
                        core.setMemberAttribute(
                            inputNode,
                            'source',
                            outputId,
                            'index',
                            index
                        );

                        // If it is an Input/Output layer, set the index for the arch node
                        const newLayerNode = core.getParent(reverse ? outputNode : inputNode);
                        const parentNode = core.getParent(newLayerNode);
                        const parentMeta = core.getMetaType(parentNode);
                        const isInArchitecture = core.getAttribute(parentMeta, 'name') === 'Architecture';
                        if (isInArchitecture) {
                            const newLayerMeta = core.getMetaType(newLayerNode);
                            const isInputLayer = core.getAttribute(newLayerMeta, 'name') === 'Input';
                            const isOutputLayer = core.getAttribute(newLayerMeta, 'name') === 'Output';
                            // Check for new Input/Output Layer
                            if (isInputLayer && reverse) {
                                this.addArchIOWithCore(core, newLayerNode, 'inputs');
                            } else if (isOutputLayer && !reverse) {
                                this.addArchIOWithCore(core, newLayerNode, 'outputs');
                            }
                        }

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

    KerasArchEditorControl.prototype.addArchIOWithCore = function(core, layerNode, set) {
        const archNode = core.getParent(layerNode);
        const nextIndex = core.getMemberPaths(archNode, set).length;
        core.addMember(archNode, set, layerNode);
        core.setMemberAttribute(
            archNode,
            set,
            core.getPath(layerNode),
            'index',
            nextIndex
        );
    };

    KerasArchEditorControl.prototype.getMetaTypeName = function(id) {
        const node = this._client.getNode(id);
        const metaType = this._client.getNode(node.getMetaTypeId());
        return metaType.getAttribute('name');
    };

    KerasArchEditorControl.prototype._createNode = function(baseId) {
        const type = this._client.getNode(baseId).getAttribute('name');
        this._client.startTransaction(`Creating ${type} layer`);
        ThumbnailControl.prototype._createNode.apply(this, arguments);
        this._client.completeTransaction();
    };

    KerasArchEditorControl.prototype.onAddItem = function(id, baseId, parentId) {
        const isInArchitecture = this.getMetaTypeName(parentId) === 'Architecture';

        if (isInArchitecture) {  // detect adding input/output to the architecture
            const isInputLayer = this.getMetaTypeName(id) === 'Input';
            const isOutputLayer = this.getMetaTypeName(id) === 'Output';
            if (isInputLayer) {
                this.addArchIOWithClient(parentId, id, 'inputs');
            } else if (isOutputLayer) {
                this.addArchIOWithClient(parentId, id, 'outputs');
            }
        }
    };

    KerasArchEditorControl.prototype.addArchIOWithClient = function(archId, layerId, set) {
        const archNode = this._client.getNode(archId);
        const index = archNode.getMemberIds(set).length;
        this._client.addMember(archId, layerId, set);
        // Set the 'index' member attribute
        this._client.setMemberRegistry(
            archId,
            layerId,
            set,
            'index',
            index
        );
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
                node: this._getMetaObjectDescriptor(id)
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
