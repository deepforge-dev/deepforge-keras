/*globals define, WebGMEGlobal, d3*/
define([
    'widgets/EasyDAG/Buttons',
    'webgme-easydag/Icons'
], function(
    Buttons,
    Icons
) {

    var client = WebGMEGlobal.Client;
    var ConnectToInput = function(params) {
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
            .attr('r', ConnectToInput.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('chevron-bottom', this.$el, {
            radius: lineRadius
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
        Buttons.ButtonBase.call(this, params);
    };
    ConnectToOutput.SIZE = 10;
    ConnectToOutput.BORDER = 1;
    ConnectToOutput.prototype.BTN_CLASS = 'connect-to-input';
    ConnectToOutput.prototype = new Buttons.ButtonBase();

    ConnectToOutput.prototype._render = function() {
        var lineRadius = ConnectToOutput.SIZE - ConnectToOutput.BORDER,
            btnColor = '#90caf9';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', ConnectToOutput.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('chevron-bottom', this.$el, {
            radius: lineRadius
        });
    };

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

    return Buttons;
});
