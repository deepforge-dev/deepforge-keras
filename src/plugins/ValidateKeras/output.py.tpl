import sys
import json

layer_registry = {}
def register_layer(name, node_id):
    layer_registry[name] = node_id

<%= resultsVar %> = {}
<%= resultsVar %>['errors'] = []
<%= resultsVar %>['dimensions'] = {}
def record_error(e):
    info = {}
    info['nodeId'] = layer_registry[current_layer_name]
    if hasattr(e, 'message'):
        info['message'] = e.message
    if hasattr(e, 'strerror'):
        info['message'] = e.strerror
    if hasattr(e, 'args'):
        info['message'] = e.args[0]
    <%= resultsVar %>['errors'].append(info)

def record_dimensions(model):
    for layer in model.layers:
        layer_name = layer.name
        node_id = layer_registry[layer.name]
        # Convert any int64 to python int
        shape = [ int(i) if i is not None else None for i in layer.output_shape ]
        <%= resultsVar %>['dimensions'][node_id] = shape

def print_stats(results):
    json.dumps(results)

has_bad_layer = False

try:
<%= indent(main) %>
    record_dimensions(model)
except Exception as e:
    if isinstance(e, ImportError):
        print(e, file=sys.stderr)
        sys.exit(1)

print_stats(<%= resultsVar %>)
