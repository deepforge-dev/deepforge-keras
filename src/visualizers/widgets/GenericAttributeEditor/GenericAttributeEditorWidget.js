/* globals define, $ */
/*jshint browser: true*/

define([
    'css!./styles/GenericAttributeEditorWidget.css'
], function (
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

    GenericAttributeEditorWidget.prototype.addRow = function (name, content) {
        var row = $('<tr>');
        var data = $('<td>');
        data.text(name);
        row.append(data);

        data = $('<td>');
        data.text(content);
        row.append(data.text(content));
        this.$content.append(row);

        // Add click listener
        data.on('click', () => this.editValue(name, content, data));
        return row;
    };

    GenericAttributeEditorWidget.prototype.editValue = function (attr, value, html) {
        var position = html[0].getBoundingClientRect();
        var width = Math.max(position.right-position.left, 20);

        html.editInPlace({
            enableEmpty: true,
            value: value,
            css: {
                'z-index': 10000,
                'width': width,
                'xmlns': 'http://www.w3.org/1999/xhtml'
            },
            onChange: (oldValue, newValue) => {
                this.setAttribute(attr, newValue);
            }
        });

    };

    // Adding/Removing/Updating items
    GenericAttributeEditorWidget.prototype.addNode =
    GenericAttributeEditorWidget.prototype.updateNode = function (desc) {
        this.$content.empty();

        // Render the attributes in a table
        var names = Object.keys(desc.attributes);
        names.forEach(name => {
            var value = desc.attributes[name].value;
            this.addRow(name, value);
        });

        // add 'no attributes' msg if needed
        if (names.length === 0) {
            var row = this.addRow('no configurable attributes');
            row.addClass('empty-msg');
        }
    };

    GenericAttributeEditorWidget.prototype.removeNode = function () {
        this.$content.empty();
        var row = this.addRow('The current node has been deleted');
        row.addClass('empty-msg');
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
