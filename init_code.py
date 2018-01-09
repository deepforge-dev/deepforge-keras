# This defines the serialization/deserialization code for keras models when used
# in deepforge

import deepforge
import keras

def serialize_model(model, filename):
    model.save(filename)

deepforge.serialize.register_serialization(keras.models.Model, serialize_model, keras.models.load_model)
