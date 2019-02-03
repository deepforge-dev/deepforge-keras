/*globals define, WebGMEGlobal, $, d3*/
define([
    'widgets/EasyDAG/Buttons',
    'webgme-easydag/Icons',
    'underscore',
    './lib/showdown.min'
], function(
    Buttons,
    Icons,
    _,
    showdown
) {

    var client = WebGMEGlobal.Client;
    var ConnectToInput = function(params) {
        this.scale = params.scale || 1.0;
        Buttons.ButtonBase.call(this, params);
    };
    ConnectToInput.SIZE = 10;
    ConnectToInput.BORDER = 1;
    ConnectToInput.prototype.BTN_CLASS = 'connect-to-input';
    ConnectToInput.prototype = new Buttons.ButtonBase();

    ConnectToInput.prototype._render = function() {
        var lineRadius = ConnectToInput.SIZE - ConnectToInput.BORDER,
            btnColor = '#90caf9';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', ConnectToInput.SIZE * this.scale)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('chevron-bottom', this.$el, {
            radius: lineRadius * this.scale
        });
    };

    ConnectToInput.prototype._onClick = function(inputId) {
        if (d3.event.shiftKey) {
            this.onAddButtonClicked(inputId, true);
        } else {
            this.startConnectionTo(inputId);

            if (this.selectionManager.selectedItem) {
                const selectedId = this.selectionManager.selectedItem.id;

                if (inputId.includes(selectedId)) {
                    this.selectionManager.deselect();
                }
            } else {  // hovered
                this.hideHoverButtons();
            }
        }
    };
    Buttons.ConnectToInput = ConnectToInput;

    var ConnectToOutput = function(params) {
        this.scale = params.scale || 1.0;
        Buttons.ButtonBase.call(this, params);
    };
    ConnectToOutput.SIZE = 10;
    ConnectToOutput.BORDER = 1;
    ConnectToOutput.prototype.BTN_CLASS = 'connect-to-output';
    ConnectToOutput.prototype = new Buttons.ButtonBase();

    ConnectToOutput.prototype._render = ConnectToInput.prototype._render;

    ConnectToOutput.prototype._onClick = function(inputId) {
        if (d3.event.shiftKey) {
            this.onAddButtonClicked(inputId);
        } else {
            this.startConnectionFrom(inputId);

            if (this.selectionManager.selectedItem) {
                const selectedId = this.selectionManager.selectedItem.id;

                if (inputId.includes(selectedId)) {
                    this.selectionManager.deselect();
                }
            } else {  // hovered
                this.hideHoverButtons();
            }
        }
    };
    Buttons.ConnectToOutput = ConnectToOutput;

    var DisconnectLayers = function(params) {
        Buttons.ButtonBase.call(this, params);
    };
    DisconnectLayers.SIZE = 10;
    DisconnectLayers.BORDER = 1;
    DisconnectLayers.prototype.BTN_CLASS = 'disconnect-layers';
    DisconnectLayers.prototype = Object.create(Buttons.Delete.prototype);

    DisconnectLayers.prototype._onClick = function(conn) {
        const {srcArgId, dstArgId} = conn.desc;
        this.disconnectNodes(srcArgId, dstArgId);
        this.selectionManager.deselect();
    };
    Buttons.DisconnectLayers = DisconnectLayers;

    var GoToBase = function(params) {
        // Check if it should be disabled
        var baseId = this._getBaseId(params.item),
            base = baseId && client.getNode(baseId);

        if (!params.disabled) {
            params.disabled = base ? base.isLibraryElement() : true;
        }
        Buttons.ButtonBase.call(this, params);
    };

    GoToBase.SIZE = 10;
    GoToBase.BORDER = 1;
    GoToBase.prototype.BTN_CLASS = 'go-to-base';
    GoToBase.prototype = new Buttons.ButtonBase();

    GoToBase.prototype._render = function() {
        var lineRadius = GoToBase.SIZE - GoToBase.BORDER,
            btnColor = '#90caf9';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', GoToBase.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('code', this.$el, {
            radius: lineRadius
        });
    };

    GoToBase.prototype._onClick = function(item) {
        var node = client.getNode(item.id),
            baseId = node.getBaseId();

        WebGMEGlobal.State.registerActiveObject(baseId);
    };

    GoToBase.prototype._getBaseId = function(item) {
        var n = client.getNode(item.id);
        return n && n.getBaseId();
    };

    Buttons.GoToBase = GoToBase;

    const mdConverter = new showdown.Converter();
    const ShowHelpDocs = function(params) {
        Buttons.ButtonBase.call(this, params);
    };

    ShowHelpDocs.SIZE = 10;
    ShowHelpDocs.BORDER = 1;
    ShowHelpDocs.prototype.BTN_CLASS = 'show-help-docs';
    ShowHelpDocs.prototype = new Buttons.ButtonBase();

    ShowHelpDocs.prototype._render = function() {
        var lineRadius = ShowHelpDocs.SIZE - ShowHelpDocs.BORDER,
            btnColor = '#e3f2fd';

        this.$el
            .append('circle')
            .attr('r', ShowHelpDocs.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('question-mark', this.$el, {
            radius: lineRadius
        });
    };

    ShowHelpDocs.convertDocsToHtml = function(docs) {
        // First preprocess the docstring to (nice) markdown
        docs = docs
            .replace(/^\s*/mg, '')  // default indentation creates code blocks
            .replace(/^([a-zA-Z_]+):/mg, (match, argName) => `- ${argName}:`);

        // Convert the arguments to a list
        return mdConverter.makeHtml(docs);
    };

    ShowHelpDocs.prototype._onClick = function(item) {
        const docs = ShowHelpDocs.convertDocsToHtml(item.desc.docs);

        // Remove old docs dialogs
        $('#show-docs').remove();

        const docsDialog = $(modalTpl({desc: item.desc, docs: docs}));

        // Remove the Example section
        let isExampleSection = false;
        const elements = docsDialog.find('.modal-body').children();
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].nodeName === 'H1') {
                isExampleSection = elements[i].innerText.toLowerCase() === 'example';
            }

            if (isExampleSection) {
                elements[i].remove();
            }
        }

        // Update the urls to point to the keras site
        const anchors = docsDialog.find('a');
        for (let i = anchors.length-1; i--;) {
            const url = anchors[i].getAttribute('href');
            anchors[i].setAttribute('href', `https://keras.io/${url.replace('.md', '')}/`);
        }
        docsDialog.modal('show');
    };

    const modalTpl = _.template(`
    <div class="show-docs modal fade" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title"><%= desc.name %> Documentation</h3>
                </div>
                <div class="modal-body">
                <%= docs %>
                </div>
            </div>
        </div>
    </div>
    `);

    Buttons.ShowDocs = ShowHelpDocs;

    return Buttons;
});
