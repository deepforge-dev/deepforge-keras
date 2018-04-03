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
            this.selectedItem.showHoverButtons();
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
