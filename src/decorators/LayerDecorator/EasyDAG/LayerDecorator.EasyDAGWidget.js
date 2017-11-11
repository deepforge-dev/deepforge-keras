/*globals define, _, WebGMEGlobal*/
/*jshint browser: true, camelcase: false*/

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'keras/Constants',
    './LayerField'
], function (
    EllipseDecorator,
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
        if (tgtId) {
            // TODO: Change this to open the peek editor
            //WebGMEGlobal.State.registerActiveObject(tgtId);
            console.log('opening editor for', ptr);
        } else {
            this.selectTargetFor(ptr);
        }
    };

    LayerDecorator.prototype.createLayerArg = function(ptr) {
        // Find the Architecture node type
        var metanodes = this.client.getAllMetaNodes(),
            base = metanodes.find(node => node.getAttribute('name') === 'Architecture'),
            baseId,
            msg = `Creating layers for "${ptr}" of ${this._node.name}`,
            tgtId;

        // 
        if (!base) {
            return this.logger.error('Could not find "Architecture" type!');
        }

        // Create a nested "architecture" node and set the ptr target to it
        //baseId = base.getId();
        //this.client.startTransaction(msg);
        //tgtId = this.client.createNode({
            //parentId: this._node.id,
            //baseId: baseId
        //});
        //this.client.setAttribute(tgtId, 'name', `${ptr} (${this._node.name})`);
        //this.savePointer(ptr, tgtId);
        //this.client.completeTransaction();
        //WebGMEGlobal.State.registerActiveObject(tgtId);
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
