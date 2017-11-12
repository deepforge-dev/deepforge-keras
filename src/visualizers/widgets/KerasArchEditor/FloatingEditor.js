/*globals define, $, WebGMEGlobal*/
define([
    'panels/AutoViz/AutoVizPanel'
], function(
    AutoVizPanel
) {
    // HTML window to show a given node at some position on the screen
    // Example Usage:
    //
    //   let editor = FloatingEditor.open(nodeId, x, y, width, height);
    //   editor.destroy();
    //
    function FloatingEditor(nodeId, x, y, w, h) {
        this.$el = $('<div>');
        $('body').append(this.$el);

        // Add a thin border or shadow...
        // TODO: use vuejs?
        this.width = w;
        this.height = h;
        this.$el.addClass('floating-editor');
        this.$el.css('position', 'absolute');
        this.$el.css('z-index', 10);
        this.$el.css('left', x);
        this.$el.css('top', y);
        this.$el.css('width', this.width);
        this.$el.css('height', this.height);

        this.$el.css('border', '1px solid lightgrey');

        // Load the autoviz and set the active node
        let params = {
            client: WebGMEGlobal.Client,
            embedded: true
        };
        this.panel = new AutoVizPanel(this, params);

        this.panel.currentNode = nodeId;
        this.panel.selectedObjectChanged(nodeId);
    }

    FloatingEditor.prototype.addPanel = function(name, panel) {
        this.$el.append(panel.$pEl);
        panel.setSize(this.width-2, this.height-1);
        panel.afterAppend();
    };

    FloatingEditor.prototype.destroy = function() {
        this.panel.destroy();
        this.$el.remove();
    };

    FloatingEditor.open = function(nodeId, x, y, width, height) {
        // Create a floating editor and return it
        return new FloatingEditor(nodeId, x, y, width, height);
    };

    return FloatingEditor;
});
