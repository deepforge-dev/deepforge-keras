/*globals define*/
/*jshint browser: true*/

define([
    //'deepforge/globals',
    './Buttons',
    //'deepforge/viz/widgets/Thumbnail',
    'widgets/EasyDAG/EasyDAGWidget',
    'widgets/EasyDAG/AddNodeDialog',
    './SelectionManager',
    './Layer',
    './Connection',
    'q',
    'underscore',
    'css!./styles/ArchEditorWidget.css'
], function (
    //DeepForge,
    Buttons,
    ThumbnailWidget,
    AddNodeDialog,
    SelectionManager,
    Layer,
    Connection,
    Q,
    _
) {
    'use strict';

    var ArchEditorWidget,
        WIDGET_CLASS = 'keras-arch-editor',
        LAYER_TAB_ORDER = [  // TODO: FIXME
            'Simple',
            'Transfer',
            'Convolution',
            'RNN',
            'Container',
            'Misc'
        ];

    ArchEditorWidget = function () {
        var container = arguments[1];
        if (container) {
            container.addClass(WIDGET_CLASS);
        }
        ThumbnailWidget.apply(this, arguments);
        this._emptyMsg = 'Click to add a new layer';
        this.hasError = {};
    };

    _.extend(ArchEditorWidget.prototype, ThumbnailWidget.prototype);

    ArchEditorWidget.prototype.ItemClass = Layer;
    ArchEditorWidget.prototype.Connection = Connection;
    ArchEditorWidget.prototype.SelectionManager = SelectionManager;

    ArchEditorWidget.prototype.getComponentId = function() {
        return 'ArchEditor';
    };

    ArchEditorWidget.prototype.setupItemCallbacks = function() {
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
    };

    ArchEditorWidget.prototype.showHoverButtons = function(layer) {
        var btn,
            height = layer.height,
            cx = layer.width/2;

        if (this.$hoverBtns) {
            this.hideHoverButtons();
        }

        this.$hoverBtns = layer.$el
            .append('g')
            .attr('class', 'hover-container');

        if (layer.getOutputs().length) {
            btn = new Buttons.Connect.From({
                context: this,
                $pEl: this.$hoverBtns,
                item: layer,
                x: cx,
                y: height
            });
        }

        // TODO: Make a button for each input
        layer.getInputs().forEach(input => {
            const inputId = input.getId();
            btn = new Buttons.ConnectToInput({
                context: this,
                $pEl: this.$hoverBtns,
                item: inputId,
                x: cx,
                y: 0
            });
        });

        return btn;
    };

    ArchEditorWidget.prototype.hideHoverButtons = function() {
        if (this.$hoverBtns) {
            this.$hoverBtns.remove();
            this.$hoverBtns = null;
        }
    };

    ArchEditorWidget.prototype.startConnection = function () {
        this.hideHoverButtons();

        // The first input will be an inputId instead of item
        // TODO

        ThumbnailWidget.prototype.startConnection.apply(this, arguments);
    };

    ArchEditorWidget.prototype.getItemContaining = function (id) {
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

    ArchEditorWidget.prototype.startConnectionFrom = function (dataId) {
        const targets = this.getValidExistingSuccessors(dataId);
        const item = this.getItemContaining(dataId);

        this.startConnection(item, dataId, targets);
    };

    ArchEditorWidget.prototype.startConnectionTo = function (dataId) {
        const targets = this.getValidExistingPredecessors(dataId);
        const item = this.getItemContaining(dataId);

        this.startConnection(item, dataId, targets, true);
    };

    ArchEditorWidget.prototype.startConnection = function (src, srcId, dsts, reverse) {
        var onClick = (clicked, connId) => {
                const startId = !reverse ? srcId : clicked.id;
                const dstId = !reverse ? clicked.id : srcId;

                d3.event.stopPropagation();
                this.resetConnectingState();
                this.connectNodes(startId, dstId, connId);
            },
            pairs = dsts.map(pair => [this.items[pair.node.id], pair.conn.id]);

        this.resetConnectingState();
        this._connectionOptions = pairs.map(pair => pair[0]);
        this._connectionSrc = src;
        pairs.map(pair => {
            var item = pair[0],
                connId = pair[1];

            return [
                item,
                connId,
                item.showIcon({
                    x: 0.5,
                    y: !reverse ? 0 : 1,
                    icon: 'chevron-bottom'
                })
            ];
        })
        .forEach(pair => pair[2].on('click', () => onClick(pair[0], pair[1])));

        // Create the 'create-new' icon for the src
        src.showIcon({
            x: 0.5,
            y: !reverse ? 1 : 0,
            icon: 'plus'
        }).on('click', () => {
            d3.event.stopPropagation();
            this.resetConnectingState();
            this.onAddButtonClicked(srcId, reverse);
        });

        this._connecting = true;
    };

    ArchEditorWidget.prototype.onCreateInitialNode = function() {
        var nodes = this.getValidInitialNodes();
        if (nodes.length === 1) {
            this.createNode(nodes[0].node.id);
        } else {
            return this.promptLayer(nodes)
                .then(selected => this.createNode(selected.node.id));
        }
    };

    ArchEditorWidget.prototype.onAddButtonClicked = function(item, reverse) {
        // TODO: Should this accept the id of the input/output node, too?
        var nodes = this.getValidSuccessors(item.id);

        return this.promptLayer(nodes)
            .then(selected => this.onAddItemSelected(item, selected, reverse));
    };

    ArchEditorWidget.prototype.onAddItemSelected = function(item, selected, reverse) {
        // For now, just connect to the first input/output
        // FIXME
        var inputsOrOutputs = reverse ? item.getInputs() : item.getOutputs(),
            id = inputsOrOutputs[0].getId();

        this.createConnectedNode(id, selected.conn.id, selected.node.id, reverse);
    };

    ArchEditorWidget.prototype.getLayerCategoryTabs = function(types) {
        var tabs = [],
            allTabs = {},
            tab,
            i;

        Object.keys(types).forEach(type => allTabs[type] = true);
        delete allTabs.Criterion;

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

    ArchEditorWidget.prototype.promptLayer = function(nodes) {
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

    ArchEditorWidget.prototype.updateNode = function(desc) {
        var item = this.items[desc.id];
        item.update(desc);
        this.refreshUI();
    };

    ArchEditorWidget.prototype.expandAllNodes = function(reverse) {
        var itemIds = Object.keys(this.items),
            method = reverse ? 'condenseAll' : 'expandAll';

        for (var i = itemIds.length; i--;) {
            this.items[itemIds[i]][method]();
        }
    };

    ArchEditorWidget.prototype.onInsertButtonClicked = function(item) {
        var nodes = this.getValidInitialNodes();
        return this.promptLayer(nodes)
            .then(selected => this.insertLayer(selected.node.id, item.id));
    };

    ArchEditorWidget.prototype.displayErrors = function(errors) {
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

    return ArchEditorWidget;
});
