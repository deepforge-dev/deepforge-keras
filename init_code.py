# This defines the serialization/deserialization code for keras models when used
# in deepforge

import dill as pickle
import os
import time
import tarfile
import shutil

import tensorflow.keras as keras

import deepforge

def dump_model(model, outfile):
    # Create the tmp directory
    tmp_dir = outfile.name + '-tmp-' + str(time.time())
    model_path = os.path.join(tmp_dir, 'model')
    model.save(model_path)
    co_path = os.path.join(tmp_dir, 'custom_objects')
    with open(co_path, 'wb') as f:
        pickle.dump(model.custom_objects, f)

    with tarfile.open(outfile.name, 'w:gz') as tar:
        tar.add(model_path, arcname='SavedModel')
        tar.add(co_path, arcname='custom_objects')

    shutil.rmtree(tmp_dir)


def load_model(infile):
    tmp_dir = infile.name + '-tmp-' + str(time.time())
    os.makedirs(tmp_dir)

    with tarfile.open(infile.name) as tar:
        tar.extractall(path=tmp_dir)

    model_path = os.path.join(tmp_dir, 'SavedModel')
    co_path = os.path.join(tmp_dir, 'custom_objects')
    if os.path.isfile(co_path):
        with open(co_path, 'rb') as f:
            custom_objects = pickle.load(f)
    else:
        custom_objects = {}

    model = keras.models.load_model(model_path, custom_objects=custom_objects)

    shutil.rmtree(tmp_dir)

    return model


for subclass in keras.Model.__subclasses__():
    deepforge.serialization.register(subclass, dump_model, load_model)
