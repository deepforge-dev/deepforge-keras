/*globals define, d3*/
define([
    'widgets/EasyDAG/Connection',
    'underscore'
], function(
    BaseConnection,
    _
) {
    const lineFn = d3.svg.line()
        .x(d => d.x)
        .y(d => d.y)
        .interpolate('linear');

    var Connection = function($parent, desc) {
        BaseConnection.apply(this, arguments);
        this.$index = this.$el.append('g')
            .attr('class', 'connection-index');

        this.$indexText = this.$index.append('text');
        this.$padding = this.$el.append('path')
            .attr('stroke-width', 12)
            .attr('class', 'conn-padding')
            .attr('stroke-opacity', 0.01)
            .attr('fill', 'none');

        this.$padding
            .on('mouseover', () => this.onMouseOver())
            .on('mouseout', () =>  this.onMouseOut());

        this.update(desc);
    };

    _.extend(Connection.prototype, BaseConnection.prototype);

    Connection.prototype.onClick = function() {};

    Connection.prototype.onMouseOver = function() {
        this.$path.attr('stroke-width', 3);
    };

    Connection.prototype.onMouseOut = function() {
        this.$path.attr('stroke-width', 2);
    };

    Connection.prototype.redraw = function() {
        BaseConnection.prototype.redraw.apply(this, arguments);

        this.$padding.attr('d', lineFn(this.points))
            .transition()
            .attr('stroke', '#000000ee')
            .attr('fill', 'none');

        this.$index.attr('transform', `translate(${this.x+10}, ${this.y})`);
    };

    Connection.prototype.update = function(desc) {
        BaseConnection.prototype.update.apply(this, arguments);
        const index = desc.index !== null ? desc.index+1 : '';
        this.$indexText.text(index);
    };

    return Connection;
});
