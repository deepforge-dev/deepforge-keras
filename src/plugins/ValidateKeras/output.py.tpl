import sys
import json
import typing
<%= imports %>

def register_layer(registry, name, node_id):
    if name not in registry:
        registry[name] = []
    registry[name].append(node_id)

def record_error(node_id, e, results):
    info = {}
    info['nodeId'] = node_id
    if hasattr(e, 'message'):
        info['message'] = e.message
    if hasattr(e, 'strerror'):
        info['message'] = e.strerror
    if hasattr(e, 'args'):
        info['message'] = e.args[0]
    results['errors'].append(info)

def _convert_to_int(shape_or_int):
    if isinstance(shape_or_int, typing.Iterable):
        return list(map(_convert_to_int, shape_or_int))
    elif shape_or_int:
        return int(shape_or_int)

def record_dimensions(registry, model, results):
    for layer in model.layers:
        layer_name = layer.name
        for node_id in registry[layer.name]:
            # Convert any int64 to python int
            shape = _convert_to_int(layer.output_shape)
            if isinstance(shape[0], list):
                shape = shape[0]
            results['dimensions'][node_id] = shape

def analyze():
    <%= resultsVar %> = {}
    <%= resultsVar %>['errors'] = []
    <%= resultsVar %>['dimensions'] = {}
    layer_registry = {}
    has_bad_layer = False

    try:
<%= indent(indent(main)) %>
        record_dimensions(layer_registry, model, <%= resultsVar %>)
    except Exception as e:
        if isinstance(e, ImportError):
            print(e, file=sys.stderr)
            sys.exit(1)

    return <%= resultsVar %>

if __name__ == '__main__':
    results = analyze()
    print(json.dumps(results))
