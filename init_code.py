# This defines the serialization/deserialization code for keras models when used
# in deepforge

import deepforge
import keras

def dump_model(model, outfile):
    model.save(outfile.name)

def load_model(infile):
    return keras.models.load_model(infile.name)

deepforge.serialization.register(keras.models.Model, dump_model, load_model)
