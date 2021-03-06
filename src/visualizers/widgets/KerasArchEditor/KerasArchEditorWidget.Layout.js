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
        if (!this.active) {
            return;
        }

        // WRITE UPDATES
        // Update the locations of all the nodes

        const graph = {
            id: 'root',
            layoutOptions: {
                'elk.algorithm': 'layered',
                'org.eclipse.elk.direction': 'DOWN',
                'org.eclipse.elk.spacing.nodeNode': 40,
                'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': 40
            },
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
            ports.push(this._getSharedWeightPort(item));

            return {
                id: itemId,
                height: item.height,
                width: item.width,
                ports: ports,
                properties: {
                    'org.eclipse.elk.portConstraints': 'FIXED_POS'
                }
            };
        });

        graph.edges = Object.keys(this.connections).map(connId => {
            var conn = this.connections[connId];
            return {
                id: connId,
                source: conn.src,
                target: conn.dst,
                sourcePort: conn.desc.srcArgId,
                targetPort: conn.desc.dstArgId
            };
        });

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
                'org.eclipse.elk.port.side': side
            },
            x: position.x,
            y: position.y
        };
    };

    KerasArchEditorWidgetLayout.prototype._getSharedWeightPort = function(item) {
        return {
            id: item.id,
            width: 1,  // Ports are rendered outside the node in this library;
            height: 1,  // we want it to look like it goes right up to the node
            properties: {
                'org.eclipse.elk.port.side': 'EAST'
            },
            x: item.width,
            y: 0.5 * item.height,
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

            item.points = lItem.sections
                .map(section => {
                    const pts = section.bendPoints || [];
                    pts.push(section.endPoint);
                    pts.unshift(section.startPoint);
                    return pts;
                })
                .reduce((l1, l2) => l1.concat(l2), []);
        }
    };


    return KerasArchEditorWidgetLayout;
});
