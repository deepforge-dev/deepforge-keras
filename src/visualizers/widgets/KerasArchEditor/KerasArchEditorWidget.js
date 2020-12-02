/*globals define, d3*/
/*jshint browser: true*/

define([
    //'deepforge/globals',
    './Buttons',
    //'deepforge/viz/widgets/Thumbnail',
    'widgets/EasyDAG/EasyDAGWidget',
    'widgets/EasyDAG/AddNodeDialog',
    './KerasArchEditorWidget.Layout',
    './SelectionManager',
    './Layer',
    './Connection',
    'q',
    'underscore',
    'css!./styles/KerasArchEditorWidget.css'
], function (
    //DeepForge,
    Buttons,
    ThumbnailWidget,
    AddNodeDialog,
    KerasArchEditorWidgetLayout,
    SelectionManager,
    Layer,
    Connection,
    Q,
    _
) {
    'use strict';

    var KerasArchEditorWidget,
        WIDGET_CLASS = 'keras-arch-editor',
        LAYER_TAB_ORDER = [
            'Core',
            'Convolutional',
            'Pooling',
            'Normalization',
            'Embeddings',
            'Advanced_activations',
            'Recurrent',
            'Local',
            'Merge',
            'Noise',
            'Cudnn_recurrent',
            'Topology',
            'Wrappers'
        ];

    KerasArchEditorWidget = function () {
        var container = arguments[1];
        if (container) {
            container.addClass(WIDGET_CLASS);
        }
        ThumbnailWidget.apply(this, arguments);
        this._emptyMsg = 'Click to add a new layer';
        this.hasError = {};
        KerasArchEditorWidgetLayout.call(this);
    };

    _.extend(
        KerasArchEditorWidget.prototype,
        ThumbnailWidget.prototype,
        KerasArchEditorWidgetLayout.prototype
    );

    KerasArchEditorWidget.prototype.ItemClass = Layer;
    KerasArchEditorWidget.prototype.Connection = Connection;
    KerasArchEditorWidget.prototype.SelectionManager = SelectionManager;

    KerasArchEditorWidget.prototype.getComponentId = function() {
        return 'KerasArchEditor';
    };

    KerasArchEditorWidget.prototype.initSvgDefs = function() {
        ThumbnailWidget.prototype.initSvgDefs.apply(this, arguments);
        const children = this._$svg.node().children;
        const defs = d3.select(children[children.length-1]);
        defs.append('marker')
            .attr('id', 'arrowhead_black')
            .attr('refX', 5.25)
            .attr('refY', 2)
            .attr('markerWidth', 6)
            .attr('markerHeight', 4)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M 0,0 V 4 L6,2 Z');

        defs.append('marker')
            .attr('id', 'arrowhead_#b2ebf2')  // FIXME: parameterize this
            .attr('refX', 5.25)
            .attr('refY', 2)
            .attr('markerWidth', 6)
            .attr('markerHeight', 4)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M 0,0 V 4 L6,2 Z')
            .attr('stroke', '#b2ebf2')
            .attr('fill', '#b2ebf2');
    };

    KerasArchEditorWidget.prototype.setupItemCallbacks = function() {
        ThumbnailWidget.prototype.setupItemCallbacks.apply(this, arguments);
        // Add the hover button functions
        this.ItemClass.prototype.showHoverButtons = function() {
            var layer = this;
            this._widget.showHoverButtons(layer);
        };

        this.ItemClass.prototype.hideHoverButtons = function() {
            this._widget.hideHoverButtons();
        };

        this.ItemClass.prototype.isHoverAllowed = function() {
            return !this._widget.isConnecting();
        };

        this.ItemClass.prototype.promptInitialLayer = function() {
            var nodes = this._widget.getValidInitialNodes();
            if (nodes.length === 1) {
                return Q(nodes[0].node.id);
            } else {
                return this._widget.promptLayer(nodes)
                    .then(selected => selected.node.id);
            }
        };

        this.ItemClass.prototype.getValidTargetsFor = function(ptr) {
            return this._widget.getValidTargetsFor(this.id, ptr);
        };

        this.ItemClass.prototype.delAttribute = function(attr) {
            return this._widget.delAttribute(this.id, attr);
        };
    };

    KerasArchEditorWidget.prototype.showHoverButtons = function(layer) {
        if (this.$hoverBtns) {
            this.hideHoverButtons();
        }

        this.$hoverBtns = layer.$el
            .append('g')
            .attr('class', 'hover-container');

        this.addConnectBtns(layer, this.$hoverBtns);
    };

    KerasArchEditorWidget.prototype.addConnectBtns = function(layer, $el, opts) {
        let btns = [];

        opts = opts || {};
        const offsetX = opts.offsetX || 0;
        const top = opts.top || 0;
        const bottom = opts.bottom || layer.height;

        // Adjust the position of the inputs/outputs so they are visible
        const outputs = layer.getOutputs();
        let dx = layer.width/(outputs.length + 1);
        let startX = dx + offsetX;
        outputs.forEach((output, index) => {
            const id = output.getId();
            const name = output.getAttribute('name');
            const btn = new Buttons.ConnectToOutput({
                context: this,
                title: name,
                $pEl: $el,
                item: id,
                x: startX + dx * index,
                y: bottom,
                scale: index === 0 ? 1 : 0.9
            });
            btns.push(btn);
        });

        const inputs = layer.getInputs();
        dx = layer.width/(inputs.length + 1);
        startX = dx + offsetX;
        inputs.forEach((input, index) => {
            const id = input.getId();
            const name = input.getAttribute('name');
            const btn = new Buttons.ConnectToInput({
                context: this,
                $pEl: $el,
                item: id,
                title: name,
                scale: index === 0 ? 1 : 0.9,
                x: startX + dx * index,
                y: top
            });
            btns.push(btn);
        });

        return btns;
    };

    KerasArchEditorWidget.prototype.hideHoverButtons = function() {
        if (this.$hoverBtns) {
            this.$hoverBtns.remove();
            this.$hoverBtns = null;
        }
    };

    KerasArchEditorWidget.prototype.onDeselect = function() {
        this.hideHoverButtons();
    };

    KerasArchEditorWidget.prototype.startConnection = function () {
        this.hideHoverButtons();

        // The first input will be an inputId instead of item
        // TODO

        ThumbnailWidget.prototype.startConnection.apply(this, arguments);
    };

    KerasArchEditorWidget.prototype.getItemContaining = function (id) {
        let itemId = id;
        const chunks = id.split('/');

        while (chunks.length) {
            itemId = chunks.join('/');
            if (this.items[itemId]) {
                return this.items[itemId];
            }
            chunks.pop();
        }
        return null;
    };

    KerasArchEditorWidget.prototype.startConnectionFrom = function (dataId) {
        const targets = this.getValidExistingSuccessors(dataId);
        const item = this.getItemContaining(dataId);

        this.startConnection(item, dataId, targets);
    };

    KerasArchEditorWidget.prototype.startConnectionTo = function (dataId) {
        const targets = this.getValidExistingPredecessors(dataId);
        const item = this.getItemContaining(dataId);

        this.startConnection(item, dataId, targets, true);
    };

    KerasArchEditorWidget.prototype.startConnection = function (src, srcId, dsts, reverse) {
        var onClick = arg => {
                const startId = !reverse ? srcId : arg.id;
                const dstId = !reverse ? arg.id : srcId;

                d3.event.stopPropagation();
                this.resetConnectingState();
                this.connectNodes(startId, dstId);
            },
            dstItems = dsts.map(pair => this.items[pair.node.id]);

        this.resetConnectingState();
        const tuples = dstItems.map((item, i) => {
            let arg = dsts[i].arg;
            const position = item.getRelativePortLocation(arg.id);
            const icon = item.showIcon({
                x: position.x,
                y: position.y,
                icon: 'chevron-bottom'
            });
            icon.append('title').text(arg.name);
            return [
                arg,
                item,
                icon
            ];
        });
        tuples.forEach(pair => pair[2].on('click', () => onClick(pair[0])));

        // Create the 'create-new' icon for the src
        const position = src.getRelativePortLocation(srcId);
        const srcIcon = src.showIcon({
            x: position.x,
            y: position.y,
            icon: 'plus'
        }).on('click', () => {
            d3.event.stopPropagation();
            this.resetConnectingState();
            this.onAddButtonClicked(srcId, reverse);
        });

        this._connectionOptions = tuples.map(tuple => tuple.slice(1));
        this._connectionSrc = [src, srcIcon];

        this._connecting = true;
    };

    KerasArchEditorWidget.prototype.onCreateInitialNode = function() {
        var nodes = this.getValidInitialNodes();
        if (nodes.length === 1) {
            this.createNode(nodes[0].node.id);
        } else {
            return this.promptLayer(nodes)
                .then(selected => this.createNode(selected.node.id));
        }
    };

    KerasArchEditorWidget.prototype.onAddButtonClicked = function(srcId, reverse) {
        // TODO: Should this accept the id of the input/output node, too?
        var nodes = reverse ? this.getValidPredecessors(srcId) :
            this.getValidSuccessors(srcId);

        return this.promptLayer(nodes)
            .then(selected => this.onAddItemSelected(srcId, selected, reverse));
    };

    KerasArchEditorWidget.prototype.onAddItemSelected = function(srcId, selected, reverse) {
        // For now, just connect to the first input/output
        // FIXME
        this.createConnectedNode(srcId, selected.node.id, reverse);
    };

    KerasArchEditorWidget.prototype.getLayerCategoryTabs = function(types) {
        var tabs = [],
            allTabs = {},
            tab,
            i;

        Object.keys(types).forEach(type => allTabs[type] = true);

        // Add the ordered tabs
        for (i = LAYER_TAB_ORDER.length; i--;) {
            tab = LAYER_TAB_ORDER[i];
            if (allTabs[tab]) {
                tabs.unshift(tab);
                delete allTabs[tab];
            }
        }

        // Add any remaining categories
        Object.keys(allTabs).forEach(tab => tabs.unshift(tab));

        return tabs;
    };

    KerasArchEditorWidget.prototype.promptLayer = function(nodes) {
        var deferred = Q.defer(),
            types = {},
            opts = {};  // 'create new' nodes

        nodes.map(pair => pair.node)
            .forEach(node => types[node.layerType] = node.color);

        nodes.sort((a, b) => a.node.name < b.node.name ? -1 : 1);

        // Sort by layer type
        opts.tabs = this.getLayerCategoryTabs(types);
        opts.tabFilter = (tab, pair) => {
            return pair.node.layerType === tab;
        };

        AddNodeDialog.prompt(nodes, opts)
            .then(selected => deferred.resolve(selected));
        return deferred.promise;
    };

    KerasArchEditorWidget.prototype.selectTargetFor = function(id, ptr, filter) {
        const validTargets = this.getValidTargetsFor(id, ptr, filter);
        const areLayers = validTargets.length && validTargets.every(target => target.node.layerType);

        // If they are layers, use promptLayer (for categories)
        if (areLayers) {
            return this.promptLayer(validTargets)
                .then(selected => {
                    const item = this.items[id];
                    const layerId = selected.node.id;
                    if (item.decorator.savePointer) {
                        item.decorator.savePointer(ptr, layerId);
                    } else {
                        this.setPointerForNode(id, ptr, layerId);
                    }
                });
        } else {
            return ThumbnailWidget.prototype.selectTargetFor.apply(this, arguments);
        }
    };

    KerasArchEditorWidget.prototype.updateNode = function(desc) {
        var item = this.items[desc.id];
        item.update(desc);
        this.refreshUI();
    };

    KerasArchEditorWidget.prototype.updateConnection = function(desc) {
        ThumbnailWidget.prototype.updateConnection.apply(this, arguments);
        this.connections[desc.id].update(desc);
    };

    KerasArchEditorWidget.prototype.expandAllNodes = function(reverse) {
        var itemIds = Object.keys(this.items),
            method = reverse ? 'condenseAll' : 'expandAll';

        for (var i = itemIds.length; i--;) {
            this.items[itemIds[i]][method]();
        }
    };

    KerasArchEditorWidget.prototype.onInsertButtonClicked = function(item) {
        var nodes = this.getValidInitialNodes();
        return this.promptLayer(nodes)
            .then(selected => this.insertLayer(selected.node.id, item.id));
    };

    KerasArchEditorWidget.prototype.showAnalysisResults = function(results) {
        const {errors, dimensions} = results;

        Object.values(this.items)
            .forEach(item => item.clear());

        errors.forEach(error => {
            const {nodeId, message} = error;
            this.items[nodeId].error(message);
        });

        const connections = Object.values(this.connections);

        connections
            .filter(conn => dimensions[conn.src])
            .forEach(conn => {
                const srcLayer = this.items[conn.src];
                const outputIds = srcLayer.getOutputs().map(n => n.getId());
                const dims = outputIds.length === 1 ?
                    [dimensions[conn.src]] : dimensions[conn.src];

                const index = outputIds.indexOf(conn.desc.srcArgId);
                const dimsText = dims.map(dim => dim || 'None')
                    .join(' x ');
                conn.setDimensionality(dims[index]);
            });
    };

    KerasArchEditorWidget.prototype.displayErrors = function(errors) {
        // For each of the errors, highlight the given nodes
        var oldErrored = Object.keys(this.hasError),
            currentErrored = errors.map(err => err.id),
            newErrored = _.difference(currentErrored, oldErrored),
            fixedLayers = _.difference(oldErrored, currentErrored);

        this.logger.info('updating displayed errors to', currentErrored);
        this.hasError = {};
        newErrored.forEach(id => {
            if (this.items[id]) {
                this.items[id].decorator.highlight('red');
                this.hasError[id] = true;
            }
        });

        fixedLayers.forEach(id => {
            if (this.items[id]) {
                this.items[id].clear();
            }
        });
    };

    return KerasArchEditorWidget;
});
