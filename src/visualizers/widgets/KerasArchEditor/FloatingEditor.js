/*globals define, $, WebGMEGlobal*/
define([
    'panels/AutoViz/AutoVizPanel',
    'css!./FloatingEditor.css'
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

        // Add a thin border or shadow...
        // TODO: use vuejs?
        this.width = w;
        this.height = h;
        this.position = {left: x, top: y};

        // add titlebar
        // TODO
        this.initialize();

        // Load the autoviz and set the active node
        let params = {
            client: WebGMEGlobal.Client,
            embedded: true
        };
        this.panel = new AutoVizPanel(this, params);

        this.setNode(nodeId);

        $('body').append(this.$el);
    }

    FloatingEditor.TITLEBAR_HEIGHT = 20;
    FloatingEditor.prototype.initialize = function() {
        let titlebarHeight = FloatingEditor.TITLEBAR_HEIGHT;

        this.$el = $('<div>');
        this.$el.addClass('floating-editor');
        this.$el.css('left', this.position.left);
        this.$el.css('top', this.position.top-titlebarHeight);
        this.$el.css('width', this.width);
        this.$el.css('height', this.height+titlebarHeight);


        this.$titlebar = $('<div>');
        this.$titlebar.addClass('titlebar');
        this.$titlebar.css('height', titlebarHeight);
        this.$titlebar.css('width', this.width-2);
        this.$el.append(this.$titlebar);

        this.$titlePrefix = $('<span>');
        this.$titlebar.append(this.$titlePrefix);

        this.$title = $('<span>');
        this.$title.addClass('target');
        this.$titlebar.append(this.$title);

        // TODO: Add close button
        this.$body = $('<div>');
        this.$body.addClass('body');
        this.$body.css('height', this.height);
        this.$body.css('top', titlebarHeight);
        this.$el.append(this.$body);

    };

    FloatingEditor.prototype.setNode = function(nodeId) {
        this.currentNodeId = null;
        this.panel.currentNode = nodeId;
        this.panel.selectedObjectChanged(nodeId);
    };

    FloatingEditor.prototype.setTitlePrefix = function(title) {
        this.$titlePrefix.text(title);
    };

    FloatingEditor.prototype.setTitle = function(title) {
        this.$title.text(title);
    };

    FloatingEditor.prototype.addPanel = function(name, panel) {
        this.$body.append(panel.$pEl);
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
