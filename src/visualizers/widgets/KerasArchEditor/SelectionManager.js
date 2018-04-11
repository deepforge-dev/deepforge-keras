/* globals _, define*/
define([
    'widgets/EasyDAG/SelectionManager',
    'widgets/EasyDAG/Buttons'
], function(
    ManagerBase,
    Buttons
) {

    var SelectionManager = function() {
        ManagerBase.apply(this, arguments);
    };

    _.extend(SelectionManager.prototype, ManagerBase.prototype);

    SelectionManager.prototype.createActionButtons = function(width, height, transition) {
        var btn;
        // Check if the selected item can have successors
        if (!this.selectedItem.isConnection) {
            var layer = this.selectedItem,
                cx = width/2;

            layer.getOutputs().forEach(output => {
                const id = output.getId();
                btn = new Buttons.ConnectToOutput({
                    context: this._widget,
                    $pEl: this.$selection,
                    item: id,
                    x: cx,
                    y: height
                });
            });

            layer.getInputs().forEach(input => {
                const inputId = input.getId();
                btn = new Buttons.ConnectToInput({
                    context: this._widget,
                    $pEl: this.$selection,
                    item: inputId,
                    x: cx,
                    y: 0
                });
            });

            btn = new Buttons.DeleteOne({
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                transition: transition,
                x: 0,
                y: 0
            });

            // Add a help button?
            // TODO
        } else {
            // Remove button
            btn = new Buttons.DisconnectLayers({
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                transition: transition,
                x: 0,
                y: 0
            });
        }
    };

    SelectionManager.prototype.select = function(item) {
        let selected = item === this.selectedItem;
        item.onClick(selected);
        return ManagerBase.prototype.select.call(this, item);
    };

    return SelectionManager;
});
