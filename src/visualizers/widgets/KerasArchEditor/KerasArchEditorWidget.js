/*globals define, d3*/
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
    'css!./styles/KerasArchEditorWidget.css'
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

    var KerasArchEditorWidget,
        WIDGET_CLASS = 'keras-arch-editor',
        LAYER_TAB_ORDER = [  // TODO: FIXME
            'Simple',
            'Transfer',
            'Convolution',
            'RNN',
            'Container',
            'Misc'
        ];

    KerasArchEditorWidget = function () {
        var container = arguments[1];
        if (container) {
            container.addClass(WIDGET_CLASS);
        }
        ThumbnailWidget.apply(this, arguments);
        this._emptyMsg = 'Click to add a new layer';
        this.hasError = {};
    };

    _.extend(KerasArchEditorWidget.prototype, ThumbnailWidget.prototype);

    KerasArchEditorWidget.prototype.ItemClass = Layer;
    KerasArchEditorWidget.prototype.Connection = Connection;
    KerasArchEditorWidget.prototype.SelectionManager = SelectionManager;

    KerasArchEditorWidget.prototype.getComponentId = function() {
        return 'KerasArchEditor';
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
    };

    KerasArchEditorWidget.prototype.showHoverButtons = function(layer) {
        var btn,
            height = layer.height,
            cx = layer.width/2;

        if (this.$hoverBtns) {
            this.hideHoverButtons();
        }

        this.$hoverBtns = layer.$el
            .append('g')
            .attr('class', 'hover-container');

        layer.getOutputs().forEach(output => {
            const id = output.getId();
            btn = new Buttons.ConnectToOutput({
                context: this,
                $pEl: this.$hoverBtns,
                item: id,
                x: cx,
                y: height
            });
        });

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

    KerasArchEditorWidget.prototype.hideHoverButtons = function() {
        if (this.$hoverBtns) {
            this.$hoverBtns.remove();
            this.$hoverBtns = null;
        }
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
                console.log('connecting', startId, dstId);
                this.connectNodes(startId, dstId);
            },
            dstItems = dsts.map(pair => this.items[pair.node.id]);

        console.log('reverse', reverse);
        this.resetConnectingState();
        this._connectionOptions = dstItems;
        this._connectionSrc = src;
        dstItems
            .map((item, i) => {
                let arg = dsts[i].arg;
                return [
                    arg,
                    item.showIcon({
                        x: 0.5,
                        y: !reverse ? 0 : 1,
                        icon: 'chevron-bottom'
                    })
                ];
            })
            .forEach(pair => pair[1].on('click', () => onClick(pair[0])));

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
        var nodes = this.getValidSuccessors(srcId);

        return this.promptLayer(nodes)
            .then(selected => this.onAddItemSelected(srcId, selected, reverse));
    };

    KerasArchEditorWidget.prototype.onAddItemSelected = function(srcId, selected, reverse) {
        // For now, just connect to the first input/output
        // FIXME
        console.log('onAddItemSelected');
        this.createConnectedNode(srcId, selected.node.id, reverse);
    };

    KerasArchEditorWidget.prototype.getLayerCategoryTabs = function(types) {
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

    KerasArchEditorWidget.prototype.updateNode = function(desc) {
        var item = this.items[desc.id];
        item.update(desc);
        this.refreshUI();
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
