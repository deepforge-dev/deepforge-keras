/*globals define*/
define([
    './lib/elk.bundled'
], function(
    ELK
) {

    const KerasArchEditorWidgetLayout = function() {
        this.elk = new ELK();
    };

    // Changing the layout to klayjs
    KerasArchEditorWidgetLayout.prototype.refreshScreen = function() {
        console.log('this.active', this.active);
        if (!this.active) {  // can I keep this?
            return;
        }

        // WRITE UPDATES
        // Update the locations of all the nodes

        const graph = {
            id: 'root',
            layoutOptions: {
                'elk.algorithm': 'Draw2D',
                'org.eclipse.elk.direction': 'DOWN'
            },
            /*
            properties: {
                direction: 'DOWN',
                'de.cau.cs.kieler.spacing': 25,
                'de.cau.cs.kieler.edgeRouting': 'ORTHOGONAL'
                //'de.cau.cs.kieler.klay.layered.nodePlace': 'INTERACTIVE'
            },
            */
            edges: [],
            children: []
        };

        graph.children = Object.keys(this.items).map(itemId => {
            var item = this.items[itemId];

            // Update the port location stuff
            const inputs = item.getInputs()
                .map(p => this._getPortInfo(item, p, true));
            const outputs = item.getOutputs()
                .map(p => this._getPortInfo(item, p));
            const ports = inputs.concat(outputs);

            return {
                id: itemId,
                height: item.height,
                width: item.width,
                ports: ports,
                //properties: {
                    //'de.cau.cs.kieler.portConstraints': 'FIXED_POS'
                //}
            };
        });

        graph.edges = Object.keys(this.connections).map(connId => {
            var conn = this.connections[connId];
            return {
                id: connId,
                source: conn.src,
                target: conn.dst,
                sources: [conn.src],
                targets: [conn.dst],
                sourcePort: conn.desc.srcArgId,
                targetPort: conn.desc.dstArgId
            };
        });

        console.log(graph);
        this.elk.layout(graph)
            .then(graph => {
                this.resultGraph = graph;
                this.queueFns([
                    this.applyLayout.bind(this, graph),
                    this.updateTranslation.bind(this),
                    this.refreshItems.bind(this),
                    this.refreshConnections.bind(this),
                    this.selectionManager.redraw.bind(this.selectionManager),
                    this.updateContainerWidth.bind(this),
                    this.refreshExtras.bind(this)
                ]);
            });
    };

    KerasArchEditorWidgetLayout.prototype._getPortInfo = function(item, port, isInput) {
        var position = item.getPortLocation(port.getId(), isInput),
            side = isInput ? 'NORTH' : 'SOUTH';

        position.y += (item.height/2) - 1;
        return {
            id: port.getId(),
            width: 1,  // Ports are rendered outside the node in this library;
            height: 1,  // we want it to look like it goes right up to the node
            properties: {
                'de.cau.cs.kieler.portSide': side
            },
            x: position.x,
            y: position.y
        };
    };

    KerasArchEditorWidgetLayout.prototype.applyLayout = function (graph) {
        var id,
            item,
            lItem,  // layout item
            i;

        for (i = graph.children.length; i--;) {
            // update the x, y
            lItem = graph.children[i];
            id = lItem.id;
            item = this.items[id];
            item.x = lItem.x + item.width/2;
            item.y = lItem.y + item.height/2;
        }

        for (i = graph.edges.length; i--;) {
            // update the connection.points
            lItem = graph.edges[i];
            id = lItem.id;
            item = this.connections[id];
            item.points = lItem.sections.map(section => section.endPoint);
            item.points.unshift(lItem.sections[0].startPoint);
        }
    };


    return KerasArchEditorWidgetLayout;
});
