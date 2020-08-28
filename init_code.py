# This defines the serialization/deserialization code for keras models when used
# in deepforge

import os
import time
import tarfile
import shutil

import tensorflow.keras as keras

import deepforge


def dump_model(model, outfile):
    # Create the tmp directory
    tmp_dir = outfile.name + '-tmp-' + str(time.time())
    model.save(tmp_dir)

    with tarfile.open(outfile.name, 'w:gz') as tar:
        tar.add(tmp_dir, arcname='SavedModel')

    shutil.rmtree(tmp_dir)


def load_model(infile):
    tmp_dir = infile.name + '-tmp-' + str(time.time())
    os.makedirs(tmp_dir)

    with tarfile.open(infile.name) as tar:
        tar.extractall(path=tmp_dir)

    model = keras.models.load_model(os.path.join(tmp_dir, 'SavedModel'))

    shutil.rmtree(tmp_dir)

    return model


deepforge.serialization.register(keras.models.Model, dump_model, load_model)
