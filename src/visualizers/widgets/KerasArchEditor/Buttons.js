/*globals define, WebGMEGlobal, $, d3*/
define([
    'widgets/EasyDAG/Buttons',
    'widgets/EasyDAG/Icons'
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
            this.onAddButtonClicked(inputId);
        } else {
            this.startConnectionTo(inputId);

            if (this.selectionManager.selectedItem) {
                const selectedId = this.selectionManager.selectedItem.id;

                if (selectedId.includes(inputId)) {
                    this.selectionManager.deselect();
                }
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

                if (selectedId.includes(inputId)) {
                    this.selectionManager.deselect();
                }
            }
        }
    };
    Buttons.ConnectToOutput = ConnectToOutput;


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
