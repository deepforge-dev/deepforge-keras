import sys
import zmq
import json
import importlib.util

address = sys.argv[1]
context = zmq.Context()
socket = context.socket(zmq.REP)
socket.bind(address)

def load_module_from_path(filename, name='module'):
    spec = importlib.util.spec_from_file_location(name, filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

while True:
    filename = socket.recv()
    print(f'Analyzing {filename.decode()}')

    result = {}
    result['success'] = False
    try:
        model = load_module_from_path(filename.decode(), 'model')
        result['data'] = model.analyze()
        result['success'] = True
    except Exception as e:
        result['data'] = str(e)

    socket.send(json.dumps(result).encode('utf8'))
