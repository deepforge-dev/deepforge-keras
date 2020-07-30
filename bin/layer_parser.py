import inspect
import tensorflow as tf
import tensorflow.keras as keras

SERIALIZATION_HELPERS = [
    'serialize',
    'deserialize',
]

INIT_HELPERS = ['get']

ABSTRACT_CLASSES = [
    'Initializer',
    'Constraint',
    'Regularizer'
]


class LayerParser:
    """A generic parser for keras.

    This class uses inspect module, together with some
    conventions in the keras sources to gather information
    on keras layers, constraints, activations etc...
    """
    def __init__(self):
        self.tf_version = tf.__version__
        self.keras_version = keras.__version__
        print(f'Tensorflow Version: {self.tf_version}, '
              f'Keras Version: {self.keras_version}')

    def parse_activations(self):
        """Parse activations of keras

        Notes:
        ------
        This method uses ``LayerParser._parse_class_module`` to parse activation functions
        """
        return self._parse_fn_module(module_name=keras.activations)

    def parse_constrains(self):
        """Parse constraints of keras

        Notes:
        ------
        This method uses ``LayerParser._parse_class_module`` to parse constraints
        """
        return self._parse_class_module(module_name=keras.constraints)

    def parse_initializers(self):
        """Parse initializers of keras

        Notes:
        ------
        This method uses ``LayerParser._parse_class_module`` to parse initializers functions
        """
        return self._parse_class_module(module_name=keras.initializers)

    def parse_regularizers(self):
        """Parse regularizers of keras

        Notes:
        ------
        This method uses ``LayerParser._parse_class_module`` to parse initializers functions
        """
        regularizers = self._parse_class_module(module_name=keras.regularizers)
        for regularizer in regularizers:
            if regularizer.get('name') == 'L1L2':
                regularizer['aliases'] = ['l1l2']
        return regularizers

    def _parse_fn_module(self, module_name):
        """Parse module definitions with function exports

        Parameters
        ----------
        module_name : types.ModuleType or types.MethodWrapperType
            The module to parse function exports for

        Returns
        -------
        list of dict
            A list of dictionaries where each member has is the following
                {
                    'name' : name of the function,
                    'arguments': list of arguments to the function along with default values
                    'docstring': docstring of the function
                    'file': module file (tensorflow/keras/module.py or similar)
                }
        """
        members = inspect.getmembers(module_name)
        functions = []
        for name, member in members:
            if inspect.isfunction(member) and not self.is_helper_type(name):
                arguments = self._get_fn_arguments(member)
                docstring = member.__doc__
                file = '/'.join(member.__module__.split('.')) + '.py'
                functions.append({
                    'name': name,
                    'arguments': arguments,
                    'docstring': docstring,
                    'file': file
                })
        return functions

    def _parse_class_module(self,
                            module_name,
                            get_call_annotations=False):
        """Parse module definitions with classes export

        Parameters
        ----------
        module_name : types.ModuleType or types.MethodWrapperType
            The module to parse function exports for

        get_call_annotations: bool, default=False
            If true, parse return annotations for __call__ dunder name for the class

        Returns
        -------
        list of dict
            A list of dictionaries where each member has is the following
                {
                        'name': name of the class,
                        'base': the immediate base class (using mro),
                        'docstring': docstring for the classes,
                        'arguments': list of arguments for __init__ method with default values,
                        'abstract': true if the class is abstract in keras,
                        'outputs': list of outputs of the call method,
                        'inputs': list of inputs to the __call__ dunder with default values,
                        'file': module file (tensorflow/keras/module.py or similar)
                        'aliases': list of alternative export names for the class
                }
        """
        members = inspect.getmembers(module_name)
        classes = []
        class_aliases = {}
        for name, member in members:
            if inspect.isclass(member) and \
                    not self.is_helper_type(name):
                if self.is_standard_class_name(name):
                    docstring = member.__doc__
                    base = inspect.getmro(member)[1].__name__
                    abstract = self.is_abstract(name) or inspect.isabstract(member)
                    arguments = None if abstract else self._get_fn_arguments(member)
                    inputs = None if abstract else self._get_call_arguments(member)

                    # TODO: could use inspect.getsourcefile()??
                    file = '/'.join(member.__module__.split('.')) + '.py'

                    classes.append({
                        'name': name,
                        'base': base,
                        'docstring': docstring,
                        'arguments': arguments,
                        'abstract': abstract,
                        'outputs': [] if get_call_annotations else None,
                        'inputs': inputs,
                        'file': file,

                    })
                else:
                    class_alias = class_aliases.get(member.__name__, [])
                    class_alias.append(name)
                    class_aliases[member.__name__] = class_alias

        for class_ in classes:
            if class_['name'] in class_aliases:
                class_['aliases'] = class_aliases.get(class_['name'])
            else:
                class_['aliases'] = None

        return classes

    def _get_call_arguments(self, member):
        if inspect.isclass(member):
            call = list(filter(lambda member: member[0] == '__call__', inspect.getmembers(member)))
            if len(call):
                return self._get_fn_arguments(call[0][-1])

    def _get_fn_arguments(self, member):
        if inspect.isfunction(member) or inspect.isclass(member):
            params_list = []
            params = inspect.signature(member).parameters
            for param_name, param in params.items():
                if param.default is None:
                    default = 'None'
                else:
                    default = None if param.default is param.empty else param.default

                if isinstance(default, tf.python.framework.dtypes.DType):
                    default = str(default)

                params_list.append({
                    'name': param_name,
                    'default': default
                })

            if len(params_list) and inspect.isclass(member):
                params_list.insert(0, {'name': 'self', 'default': None})
            elif inspect.isclass(member):
                params_list = None

            return params_list

    @staticmethod
    def is_helper_type(member):
        return member in SERIALIZATION_HELPERS or member in INIT_HELPERS

    @staticmethod
    def is_abstract(member):
        return member in ABSTRACT_CLASSES

    @staticmethod
    def is_standard_class_name(name):
        return name[0].isupper() and not name.startswith('_')

