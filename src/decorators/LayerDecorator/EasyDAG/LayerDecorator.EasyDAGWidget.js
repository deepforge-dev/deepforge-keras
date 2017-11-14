/*globals define, _, WebGMEGlobal, $*/
/*jshint browser: true, camelcase: false*/

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'widgets/KerasArchEditor/FloatingEditor',
    'keras/Constants',
    './LayerField'
], function (
    EllipseDecorator,
    FloatingEditor,
    Constants,
    LayerField
) {

    'use strict';

    var LayerDecorator,
        DECORATOR_ID = 'LayerDecorator';

    // Layer nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    LayerDecorator = function (options) {
        options.skipAttributes = {name: true};
        this.editor = null;

        var skipAttrs = Object.keys(Constants.ATTR).map(key => Constants.ATTR[key]);
        skipAttrs.forEach(attr => options.skipAttributes[attr] = true);
        EllipseDecorator.call(this, options);
    };

    _.extend(LayerDecorator.prototype, EllipseDecorator.prototype);

    LayerDecorator.prototype.DECORATOR_ID = DECORATOR_ID;
    LayerDecorator.prototype.PointerField = LayerField;
    LayerDecorator.prototype.getDisplayName = function() {
        return this._node.name;
    };

    // Create the pointer fields and change the event handlers
    LayerDecorator.prototype.createPointerFields = function() {
        var i = this.fields.length,
            y,
            ptr;

        // Get the fields
        y = EllipseDecorator.prototype.createPointerFields.apply(this, arguments);
        while (i < this.fields.length) {
            // Update the event handlers
            ptr = this.fields[i].name;
            // TODO: This should be changed in EasyDAG
            this.fields[i].selectTarget = this.editPointerField.bind(this, ptr);
            i++;
        }
        return y;
    };

    LayerDecorator.prototype.editPointerField = function(ptr) {
        var tgtId = this._node.pointers[ptr];
        if (tgtId) {  // open a floating window viewing the given node
            let content = this.pointers[ptr].$content[0][0];
            this.createPointerEditor(ptr, content);
        } else {
            this.selectTargetFor(ptr);
        }
    };

    LayerDecorator.prototype.createPointerEditor = function(ptr, content) {
        let field = this.pointers[ptr];
        let tgtId = this._node.pointers[ptr];
        let position = content.getBoundingClientRect();
        if (this.editor) this.editor.destroy();
        // TODO: "activation for Dense: ReLU"
        // TODO: Add the back/close icons
        // TODO: Subclass the floating editor to also select the pointer type
        // TODO: Move this api to the widget so it can automatically close them on resize...
        // OR I could just attach the editor to an html element and then update it on page resize...
        this.editor = FloatingEditor.open(tgtId, position.right, position.top, 300, 300);
        let ptrName = ptr.split('_')
            .map(name => name[0].toUpperCase() + name.slice(1))
            .join(' ');

        // TODO: Make the field value clickable
        // TODO: Show a dropdown of options
        this.editor.setTitle(`${ptrName} for ${this.getDisplayName()}: `);
        this.editor.$value = $('<span>');
        this.editor.$titlebar.append(this.editor.$value);
        this.editor.$value.text(field.value);

        // TODO: Get the options
        let options = [field.value];
        this.editor.$value.on('click',
            () => this.createDropdown(this.editor.$value[0], field.value, options));
    };

    LayerDecorator.prototype.createDropdown = function(element, current, options) {
        let position = element.getBoundingClientRect();
        let container = $('<div>');

        container.css('position', 'absolute');
        container.css('top', position.top);
        container.css('left', position.left);
        container.css('width', position.width);
        container.css('z-index', 15);

        // make the dropdown
        let dropdown = $('<select>');
        options.forEach(name => {
            let item = $('<option>');
            item.attr('value', name);
            item.html(name);
            if (name === current) item.attr('selected', 'selected');
            dropdown.append(item);
        });

        container.append(dropdown);

        dropdown.focus();
        dropdown.on('blur', function() {
            let value = this.value;
            console.log('selected', value);
            // TODO: set the pointer to the given type
            container.remove();
        });
        $('body').append(container);

        return container;
    };

    LayerDecorator.prototype.condense = function() {
        this.closeEditor();
        return EllipseDecorator.prototype.condense.apply(this, arguments);
    };

    LayerDecorator.prototype.closeEditor = function() {
        if (this.editor) this.editor.destroy();
        this.editor = null;
    };

    LayerDecorator.prototype.destroy = function() {
        this.closeEditor();
        return EllipseDecorator.prototype.destroy.apply(this, arguments);
    };

    LayerDecorator.prototype.savePointer = function(ptr, typeId) {
        // Create a child in the given node inheriting from the given ptr type
        let nodeId = this._node.id;
        let node = this.client.getNode(nodeId);
        let name = node.getAttribute('name');

        let msg = `Clearing "${ptr}" of ${name}`;
        if (typeId) {
            let typeNode = this.client.getNode(typeId);
            let typeName = typeNode.getAttribute('name');
            msg = `Setting "${ptr}" of ${name} to ${typeName}`;
        }

        this.client.startTransaction(msg);
        // Clean up the old pointer target
        let oldTargetId = node.getOwnPointer(ptr).to;
        if (oldTargetId && oldTargetId.indexOf(nodeId) === 0) {
            this.client.deleteNode(oldTargetId);
        }

        // Create the new target
        if (typeId) {
            let targetId = this.client.createNode({
                parentId: nodeId,
                baseId: typeId
            });
            this.client.setPointer(nodeId, ptr, targetId);
        }
        this.client.completeTransaction();
    };

    return LayerDecorator;
});
