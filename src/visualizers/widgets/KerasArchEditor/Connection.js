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
        this.setDefaults(desc);

        this.$index = this.$el.append('g')
            .attr('class', 'connection-index');

        this.$indexText = this.$index.append('text');
        this.$padding = this.$el.append('path')
            .attr('stroke-width', 12)
            .attr('class', 'conn-padding')
            .attr('stroke-opacity', 0.01)
            .attr('fill', 'none');

        this.$el
            .on('mouseenter', () => this.onMouseOver())
            .on('mouseleave', () =>  this.onMouseOut());

        this.showingTooltip = false;
        this.$tooltip = this.$el.append('g')
            .attr('class', 'dimensionality')
            .attr('opacity', 0);

        this.tooltipBoxWidth = 75;
        this.$tooltipRect = this.$tooltip.append('rect')
            .attr('stroke', desc.tooltip.color)
            .attr('fill', desc.tooltip.color)
            .attr('width', this.tooltipBoxWidth)
            .attr('height', 25)
            .attr('rx', 10)
            .attr('ry', 10);

        this.$tooltipText = this.$tooltip.append('text')
            .attr('x', 37.5)
            .attr('y', 12.5)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-style', desc.tooltip.fontStyle)
            .text(desc.tooltip.text);

        this.update(desc);
        this.desc = desc;
    };

    _.extend(Connection.prototype, BaseConnection.prototype);

    Connection.prototype.onClick = function() {};

    Connection.prototype.onMouseOver = function() {
        this.updateTooltipBoxWidth();
        this.$tooltip
            .transition()
            .attr('opacity', 1);

        this.$path.attr('stroke-width', 3);
        this.showingTooltip = true;
    };

    Connection.prototype.onMouseOut = function() {
        this.$tooltip.transition().attr('opacity', 0);
        this.$path.attr('stroke-width', 2);
        this.showingTooltip = false;
    };

    Connection.prototype.setTooltip = function(text) {
        this.$tooltipText.text(text);
        if (this.showingTooltip) {
            this.updateTooltipBoxWidth();
        }
    };

    Connection.prototype.updateTooltipBoxWidth = function() {
        const margin = 5;
        const textWidth = this.$tooltipText.node().getBBox().width;
        const width = textWidth + 2*margin;

        this.$tooltipRect.attr('width', width);
        this.$tooltipText.attr('x', width/2);

        this.tooltipBoxWidth = width;
        this.updateDimensionBoxPosition();
    };

    Connection.prototype.updateDimensionBoxPosition = function() {
        const y = this.y - 12.5;

        // Find the edge that is halfway between the top and bottom
        const minY = Math.min.apply(null, this.points.map(pt => pt.y));
        const vertMiddle = minY + this._height/2;
        const midSection = this.points.find(pt => pt.y - vertMiddle > 0);

        const x = midSection.x-this.tooltipBoxWidth/2;

        this.$tooltip
            .attr('transform', `translate(${x}, ${y})`);

    };

    Connection.prototype.redraw = function() {
        const transition = this.$path.attr('d', lineFn(this.points))
            .transition()
            .attr('stroke-width', 2)
            .attr('stroke', this.desc.color)
            .attr('fill', 'none');

        if (!this.desc.undirected) {
            transition.attr('marker-end', `url(#arrowhead)`);
        }

        if (this.desc.dash) {
            transition.attr('stroke-dasharray', this.desc.dash);
        }

        // Update the x,y,width, height from the points
        this.updateBounds();

        this.$padding.attr('d', lineFn(this.points))
            .transition()
            .attr('stroke', '#000000ee')
            .attr('fill', 'none');

        if (this.isPlaced()) {
            this.$index.attr('transform', `translate(${this.x+10}, ${this.y})`);
            this.updateDimensionBoxPosition();
        }
    };

    Connection.prototype.isPlaced = function() {
        return !isNaN(this.x) && !isNaN(this.y);
    };

    Connection.prototype.update = function(desc) {
        this.setDefaults(desc);
        BaseConnection.prototype.update.apply(this, arguments);
        const index = desc.index !== null ? desc.index+1 : '';
        this.$indexText.text(index);
    };

    Connection.prototype.setDefaults = function(desc) {
        desc.color = desc.color || 'black';
        desc.tooltip = desc.tooltip || {};
        desc.tooltip.color = desc.tooltip.color || '#dddddd';
        desc.tooltip.text = desc.tooltip.text || 'unavailable';
        desc.tooltip.fontStyle = desc.tooltip.fontStyle || 'normal';
    };

    return Connection;
});
