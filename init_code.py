# This defines the serialization/deserialization code for keras models when used
# in deepforge

import deepforge
import keras

def dump_model(model, outfile):  # Create tar ball of custom_objects and model
    # Create the tmp directory
    import os
    import time
    tmp_dir = outfile.name + '-tmp-' + str(time.time())
    os.makedirs(tmp_dir)

    # store any custom objects in a file
    if hasattr(model, 'custom_objects'):
        co_path = os.path.join(tmp_dir, 'custom_objects')
        with open(co_path, 'wb') as f:
            import dill as pickle
            pickle.dump(model.custom_objects, f)

    # write the model to a file
    model_path = os.path.join(tmp_dir, 'model')
    model.save(model_path)

    # tar both files together into the outfile
    import tarfile
    with tarfile.open(outfile.name, 'w:gz') as tar:
        tar.add(model_path, arcname='model')
        if hasattr(model, 'custom_objects'):
            tar.add(co_path, arcname='custom_objects')

    import shutil
    shutil.rmtree(tmp_dir)

def load_model(infile):
    # Make a tmp dir
    import os
    from os import path
    import time
    tmp_dir = infile.name + '-tmp-' + str(time.time())
    os.makedirs(tmp_dir)

    # I need to untar the given file
    import tarfile
    with tarfile.open(infile.name) as tar:
        tar.extractall(path=tmp_dir)

    # If custom_objects exists, then I need to unpickle it
    has_custom_objects = False
    custom_objects = None
    co_path = path.join(tmp_dir, 'custom_objects')
    if path.exists(co_path):
        with open(co_path, 'rb') as f:
            import dill as pickle
            custom_objects = pickle.load(f)

    model_path = path.join(tmp_dir, 'model')
    model = keras.models.load_model(model_path, custom_objects=custom_objects)

    import shutil
    shutil.rmtree(tmp_dir)

    return model

deepforge.serialization.register(keras.models.Model, dump_model, load_model)
