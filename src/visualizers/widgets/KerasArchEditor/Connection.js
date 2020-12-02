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

        this.$el
            .on('mouseenter', () => this.onMouseOver())
            .on('mouseleave', () =>  this.onMouseOut());

        this.dimensions = null;
        this.showingDimensions = false;
        this.$dimensions = this.$el.append('g')
            .attr('class', 'dimensionality')
            .attr('opacity', 0);

        this.dimensionBoxWidth = 75;
        this.$dimensionRect = this.$dimensions.append('rect')
            .attr('stroke', '#dddddd')
            .attr('fill', '#dddddd')
            .attr('width', this.dimensionBoxWidth)
            .attr('height', 25)
            .attr('rx', 10)
            .attr('ry', 10);

        this.$dimensionText = this.$dimensions.append('text')
            .attr('x', 37.5)
            .attr('y', 12.5)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .text('unavailable');

        this.update(desc);
        this.desc = desc;
    };

    _.extend(Connection.prototype, BaseConnection.prototype);

    Connection.prototype.onClick = function() {};

    Connection.prototype.onMouseOver = function() {
        this.updateDimensionBoxWidth();
        this.$dimensions
            .transition()
            .attr('opacity', 1);

        this.$path.attr('stroke-width', 3);
        this.showingDimensions = true;
    };

    Connection.prototype.onMouseOut = function() {
        this.$dimensions.transition().attr('opacity', 0);
        this.$path.attr('stroke-width', 2);
        this.showingDimensions = false;
    };

    Connection.prototype.setDimensionality = function(dims) {
        dims = dims.map(dim => dim || 'None');
        this.dimensions = dims;
        this.$dimensionText.text(dims.join(' x '));
        if (this.showingDimensions) {
            this.updateDimensionBoxWidth();
        }
    };

    Connection.prototype.updateDimensionBoxWidth = function() {
        const margin = 5;
        const textWidth = this.$dimensionText.node().getBBox().width;
        const width = textWidth + 2*margin;

        this.$dimensionRect.attr('width', width);
        this.$dimensionText.attr('x', width/2);

        this.dimensionBoxWidth = width;
        this.updateDimensionBoxPosition();
    };

    Connection.prototype.updateDimensionBoxPosition = function() {
        const y = this.y - 12.5;

        // Find the edge that is halfway between the top and bottom
        const minY = Math.min.apply(null, this.points.map(pt => pt.y));
        const vertMiddle = minY + this._height/2;
        const midSection = this.points.find(pt => pt.y - vertMiddle > 0);

        const x = midSection.x-this.dimensionBoxWidth/2;

        this.$dimensions
            .attr('transform', `translate(${x}, ${y})`);

    };

    Connection.prototype.redraw = function() {
        const marker = `arrowhead_${this.color}`;
        const markerLoc = this.desc.inverted ? 'marker-start' : 'marker-end';
        this.$path.attr('d', lineFn(this.points))
            .transition()
            .attr('stroke-width', 2)
            .attr('stroke', this.color)
            .attr('fill', 'none')
            .attr(markerLoc, `url(#${marker})`);

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
        BaseConnection.prototype.update.apply(this, arguments);
        const index = desc.index !== null ? desc.index+1 : '';
        this.$indexText.text(index);
    };

    return Connection;
});
