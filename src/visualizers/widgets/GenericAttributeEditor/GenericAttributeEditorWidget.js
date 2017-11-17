/* globals define, $ */
/*jshint browser: true*/

define([
    'underscore',
    'css!./styles/GenericAttributeEditorWidget.css'
], function (
    _
) {
    'use strict';

    var GenericAttributeEditorWidget,
        WIDGET_CLASS = 'generic-attribute-editor';

    GenericAttributeEditorWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this.$el = container;
        this.$table = $('<table>');
        this.$content = $('<tbody>');

        this.$table.addClass('table table-hover');
        this.$el.append(this.$table);
        this.$table.append(this.$content);

        this.currentNode = null;
        this._initialize();

        this._logger.debug('ctor finished');
    };

    GenericAttributeEditorWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);
    };

    GenericAttributeEditorWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    GenericAttributeEditorWidget.prototype.addNode =
    GenericAttributeEditorWidget.prototype.updateNode = function (desc) {
        this.$content.empty();
        // Render the attributes in a table
        // TODO:

        this.currentNode = desc;
        // Add "edit in place" stuff for the attribute values
        // TODO:
        var names = Object.keys(desc.attributes);
        names.forEach(name => {
            var value = desc.attributes[name].value;
            var row = $('<tr>');
            var data = $('<td>');
            data.text(name);
            row.append(data);

            data = $('<td>');
            data.text(value);
            row.append(data.text(value));
            this.$content.append(row);
        });

        // TODO: add 'no attributes' msg if needed
    };

    GenericAttributeEditorWidget.prototype.removeNode = function () {
        this.$content.empty();
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    GenericAttributeEditorWidget.prototype.destroy = function () {
    };

    GenericAttributeEditorWidget.prototype.onActivate = function () {
        this._logger.debug('GenericAttributeEditorWidget has been activated');
    };

    GenericAttributeEditorWidget.prototype.onDeactivate = function () {
        this._logger.debug('GenericAttributeEditorWidget has been deactivated');
    };

    return GenericAttributeEditorWidget;
});
