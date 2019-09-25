/*globals define */
define([], function() {
    const ModelMaps = {};

    ModelMaps.CLASS_MAP = {
        InputLayer: 'Input'
    };

    ModelMaps.ARGUMENTS_MAP = {
        batch_shape: 'batch_input_shape'
    };

    ModelMaps.ModelTypes = {
        sequential : 'Sequential',
        functional : 'Model'
    };

    ModelMaps.AbstractLayerTypeMapping = {
        Activation: 'activation',
        ActivityRegularization: 'activity_regularizer'
    };


    // Used for determining nested models
    ModelMaps.ValildLayerNames = [
        'Activation',
        'ActivityRegularization',
        'Add',
        'AlphaDropout',
        'AtrousConvolution1D',
        'AtrousConvolution2D',
        'Average',
        'AveragePooling1D',
        'AveragePooling2D',
        'AveragePooling3D',
        'AvgPool1D',
        'AvgPool2D',
        'AvgPool3D',
        'BatchNormalization',
        'Bidirectional',
        'Concatenate',
        'Conv1D',
        'Conv2D',
        'Conv2DTranspose',
        'Conv3D',
        'Conv3DTranspose',
        'ConvLSTM2D',
        'ConvLSTM2DCell',
        'ConvRecurrent2D',
        'Convolution1D',
        'Convolution2D',
        'Convolution3D',
        'Cropping1D',
        'Cropping2D',
        'Cropping3D',
        'CuDNNGRU',
        'CuDNNLSTM',
        'Deconvolution2D',
        'Deconvolution3D',
        'Dense',
        'DepthwiseConv2D',
        'Dot',
        'Dropout',
        'ELU',
        'Embedding',
        'Flatten',
        'GRU',
        'GRUCell',
        'GaussianDropout',
        'GaussianNoise',
        'GlobalAveragePooling1D',
        'GlobalAveragePooling2D',
        'GlobalAveragePooling3D',
        'GlobalAvgPool1D',
        'GlobalAvgPool2D',
        'GlobalAvgPool3D',
        'GlobalMaxPool1D',
        'GlobalMaxPool2D',
        'GlobalMaxPool3D',
        'GlobalMaxPooling1D',
        'GlobalMaxPooling2D',
        'GlobalMaxPooling3D',
        'Highway',
        'Input',
        'InputLayer',
        'InputSpec',
        'LSTM',
        'LSTMCell',
        'Lambda',
        'Layer',
        'LeakyReLU',
        'LocallyConnected1D',
        'LocallyConnected2D',
        'Masking',
        'MaxPool1D',
        'MaxPool2D',
        'MaxPool3D',
        'MaxPooling1D',
        'MaxPooling2D',
        'MaxPooling3D',
        'Maximum',
        'MaxoutDense',
        'Minimum',
        'Multiply',
        'PReLU',
        'Permute',
        'RNN',
        'ReLU',
        'Recurrent',
        'RepeatVector',
        'Reshape',
        'SeparableConv1D',
        'SeparableConv2D',
        'SimpleRNN',
        'SimpleRNNCell',
        'Softmax',
        'SpatialDropout1D',
        'SpatialDropout2D',
        'SpatialDropout3D',
        'StackedRNNCells',
        'Subtract',
        'ThresholdedReLU',
        'TimeDistributed',
        'UpSampling1D',
        'UpSampling2D',
        'UpSampling3D',
        'ZeroPadding1D',
        'ZeroPadding2D',
        'ZeroPadding3D'
    ];


    return ModelMaps;

});