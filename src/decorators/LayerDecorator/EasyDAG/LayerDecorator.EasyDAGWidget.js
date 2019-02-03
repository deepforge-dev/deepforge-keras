/*globals define, _, $, d3*/
/*jshint browser: true, camelcase: false*/

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'widgets/KerasArchEditor/FloatingEditor',
    'deepforge-keras/Constants',
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
        this._zoom = 1;
        options.skipAttributes = {name: true};
        this.editor = null;

        var skipAttrs = Object.keys(Constants.ATTR).map(key => Constants.ATTR[key]);
        skipAttrs.forEach(attr => options.skipAttributes[attr] = true);
        EllipseDecorator.call(this, options);

        // Enable click to change name
        this.$name.on('click', () => {
            if (this.expanded) {
                this.editLayerName();
            }
        });
    };

    _.extend(LayerDecorator.prototype, EllipseDecorator.prototype);

    LayerDecorator.prototype.DECORATOR_ID = DECORATOR_ID;
    LayerDecorator.prototype.PointerField = LayerField;
    LayerDecorator.prototype.getDisplayName = function(detailed) {
        let {name} = this._node;
        const {baseName} = this._node;
        detailed = detailed === undefined ? this.expanded : detailed;

        // if the basename is different from the name, show both
        if (this._node.baseName !== name && detailed) {
            name += ` (${baseName})`;
        }

        // If it has an index field, add that to the name
        if (this._node.index > -1) {
            name += ` (${this._node.index + 1})`;
        }
        return name;
    };

    LayerDecorator.prototype.editLayerName = function() {
        var html = this.$name.node(),
            position = html.getBoundingClientRect(),

            width = Math.max(position.right-position.left, 15),
            container = $('<div>'),
            parentHtml = $('body');

        // Using a temp container for the editing
        container.css('top', position.top/this._zoom);
        container.css('left', position.left/this._zoom);
        container.css('position', 'absolute');
        container.css('width', width/this._zoom);
        container.css('zoom', this._zoom);
        container.attr('id', 'CONTAINER-TMP');

        $(parentHtml).append(container);

        container.editInPlace({
            enableEmpty: true,
            value: this._node.name,
            css: {
                'z-index': 10000,
                'id': 'asdf',
                'width': width,
                'xmlns': 'http://www.w3.org/1999/xhtml'
            },
            onChange: (oldValue, newValue) => {
                const shouldClearName = !newValue || newValue === this._node.baseName;
                const value = shouldClearName ? null : newValue;
                const changed = oldValue !== value;

                if (changed) {
                    this.saveAttribute('name', value);
                }
            },
            onFinish: function () {
                $(this).remove();
            }
        });
    };

    LayerDecorator.prototype.render = function(zoom) {
        this._zoom = zoom || 1;
        return EllipseDecorator.prototype.render.apply(this, arguments);
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

    LayerDecorator.prototype.update = function() {
        this.updateDisplayName();
        let result =  EllipseDecorator.prototype.update.apply(this, arguments);
        if (this.editor) {
            let ptr = this.editor.ptrName;
            let tgtId = this._node.pointers[ptr];

            this.editor.setNode(tgtId);

            let field = this.pointers[ptr];
            this.editor.setTitle(field.value);
        }
        return result;
    };

    LayerDecorator.prototype.updateTargetName = function(id) {
        let result = EllipseDecorator.prototype.updateTargetName.apply(this, arguments);

        if (this.editor) {
            let ptr = this.editor.ptrName;
            let tgtId = this._node.pointers[ptr];
            if (tgtId === id) {
                let field = this.pointers[ptr];
                this.editor.setTitle(field.value);
            }
        }

        return result;
    };

    LayerDecorator.prototype.createPointerEditor = function(ptr, content) {
        let field = this.pointers[ptr];
        let tgtId = this._node.pointers[ptr];
        let position = content.getBoundingClientRect();
        if (this.editor) this.editor.destroy();
        // I should attach the editor to the html element and then update it on page resize...
        // TODO
        // How would I get the resize event?

        let ptrName = ptr.split('_')
            .map(name => name[0].toUpperCase() + name.slice(1))
            .join(' ');

        this.editor = FloatingEditor.open(tgtId, position.right, position.top, 300, 130);
        this.editor.setTitlePrefix(`${ptrName} for ${this.getDisplayName(false)}: `);
        this.editor.setTitle(field.value);
        this.editor.ptrName = ptr;

        // Get the options
        let options = this.getValidTargetsFor(ptr).map(target => target.node);
        this.editor.$title.on('click',
            () => this.createDropdown(this.editor.$title[0], field, options));
    };

    LayerDecorator.prototype.createDropdown = function(element, field, options) {
        let position = element.getBoundingClientRect();
        let container = $('<div>');
        let self = this;

        container.css('position', 'absolute');
        container.css('top', position.top);
        container.css('left', position.left);
        container.css('width', position.width);
        container.css('z-index', 15);

        // make the dropdown
        let dropdown = $('<select>');
        options.forEach(option => {
            let name = option.name;
            let item = $('<option>');
            item.attr('value', name);
            item.html(name);
            if (name === field.value) item.attr('selected', 'selected');
            dropdown.append(item);
        });

        container.append(dropdown);

        dropdown.focus();
        dropdown.on('blur', () => container.remove());
        dropdown.on('change', function() {
            let value = this.value;
            let tgtId = null;
            if (value) {
                tgtId = options.find(option => option.name === value).id;
                field.value = value;
            }
            self.savePointer(field.name, tgtId);
            container.remove();
        });
        $('body').append(container);
        this.$dropdown = container;

        return container;
    };

    LayerDecorator.prototype.updateDisplayName = function(detailed=false) {
        const displayName = this.getDisplayName(detailed);
        if (this.name !== displayName) {
            this.name = displayName;
            this.nameWidth = null;
            this.updateWidth();
            console.log('-- width', this.width);
        }
    };

    LayerDecorator.prototype.expand = function() {
        this.updateDisplayName(true);
        return EllipseDecorator.prototype.expand.apply(this, arguments);
    };

    LayerDecorator.prototype.condense = function() {
        this.closeEditor();
        this.updateDisplayName();
        return EllipseDecorator.prototype.condense.apply(this, arguments);
    };

    LayerDecorator.prototype.closeEditor = function() {
        if (this.editor) this.editor.destroy();
        if (this.$dropdown) this.$dropdown.remove();
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

    LayerDecorator.prototype.onClick = function(selected) {
        if (selected && this.editor) {
            // Ignore if clicking on the pointer field
            let ptrField = this.pointers[this.editor.ptrName].$content[0][0];
            let clickedPtrField = d3.event.target === ptrField;
            if (!clickedPtrField) {
                this.closeEditor();
            }
        }
    };

    return LayerDecorator;
});
