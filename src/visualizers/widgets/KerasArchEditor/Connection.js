/*globals define*/
define([
    'widgets/EasyDAG/Connection',
    'underscore'
], function(
    BaseConnection,
    _
) {
    var Connection = function($parent, desc) {
        BaseConnection.apply(this, arguments);
        this.$index = this.$el.append('g')
            .attr('class', 'connection-index');

        this.$indexText = this.$index.append('text');
        this.update(desc);
    };

    _.extend(Connection.prototype, BaseConnection.prototype);

    Connection.prototype.onClick = function() {
    };

    Connection.prototype.redraw = function() {
        BaseConnection.prototype.redraw.apply(this, arguments);
        // More intelligent placement of indices
        // TODO
        const center = {
            x: this.x,// + this.getWidth()/2,
            y: this.y// - this.getHeight()/2
        };
        this.$index.attr('transform', `translate(${center.x+10}, ${center.y})`);
    };

    Connection.prototype.update = function(desc) {
        BaseConnection.prototype.update.apply(this, arguments);
        const index = desc.index !== null ? desc.index+1 : '';
        this.$indexText.text(index);
    };

    return Connection;
});
