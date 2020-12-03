import sys
import json
import typing

layer_registry = {}
def register_layer(name, node_id):
    if name not in layer_registry:
        layer_registry[name] = []
    layer_registry[name].append(node_id)

<%= resultsVar %> = {}
<%= resultsVar %>['errors'] = []
<%= resultsVar %>['dimensions'] = {}
def record_error(node_id, e):
    info = {}
    info['nodeId'] = node_id
    if hasattr(e, 'message'):
        info['message'] = e.message
    if hasattr(e, 'strerror'):
        info['message'] = e.strerror
    if hasattr(e, 'args'):
        info['message'] = e.args[0]
    <%= resultsVar %>['errors'].append(info)

def _convert_to_int(shape_or_int):
    if isinstance(shape_or_int, typing.Iterable):
        return list(map(_convert_to_int, shape_or_int))
    elif shape_or_int:
        return int(shape_or_int)

def record_dimensions(model):
    for layer in model.layers:
        layer_name = layer.name
        for node_id in layer_registry[layer.name]:
            # Convert any int64 to python int
            shape = _convert_to_int(layer.output_shape)
            if isinstance(shape[0], list):
                shape = shape[0]
            <%= resultsVar %>['dimensions'][node_id] = shape

def print_stats(results):
    print(json.dumps(results))

has_bad_layer = False

try:
<%= indent(main) %>
    record_dimensions(model)
except Exception as e:
    if isinstance(e, ImportError):
        print(e, file=sys.stderr)
        sys.exit(1)

print_stats(<%= resultsVar %>)
