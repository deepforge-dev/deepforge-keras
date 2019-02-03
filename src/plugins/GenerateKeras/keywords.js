/*globals define*/
// List of python keywords
define([], function() {
    return [
        'and','del','from','not','while','as','elif','global','or','with',
        'assert','else','if','pass','yield','break','except','import','print',
        'class','exec','in','raise','continue','finally','is','return','def',
        'for','lambda','try',
        // Additional words to avoid (builtins)
        '__name__', '__doc__', '__package__', '__loader__', '__spec__',
        '__build_class__', '__import__', 'abs', 'all', 'any', 'ascii', 'bin',
        'callable', 'chr', 'compile', 'delattr', 'dir', 'divmod', 'eval',
        'exec', 'format', 'getattr', 'globals', 'hasattr', 'hash', 'hex', 'id',
        'input', 'isinstance', 'issubclass', 'iter', 'len', 'locals', 'max',
        'min', 'next', 'oct', 'ord', 'pow', 'print', 'repr', 'round', 'setattr',
        'sorted', 'sum', 'vars', 'None', 'Ellipsis', 'NotImplemented', 'False',
        'True', 'bool', 'memoryview', 'bytearray', 'bytes', 'classmethod',
        'complex', 'dict', 'enumerate', 'filter', 'float', 'frozenset',
        'property', 'int', 'list', 'map', 'object', 'range', 'reversed', 'set',
        'slice', 'staticmethod', 'str', 'super', 'tuple', 'type', 'zip',
        '__debug__', 'BaseException', 'Exception', 'TypeError',
        'StopAsyncIteration', 'StopIteration', 'GeneratorExit', 'SystemExit',
        'KeyboardInterrupt', 'ImportError', 'ModuleNotFoundError', 'OSError',
        'EnvironmentError', 'IOError', 'EOFError', 'RuntimeError',
        'RecursionError', 'NotImplementedError', 'NameError',
        'UnboundLocalError', 'AttributeError', 'SyntaxError', 'IndentationError',
        'TabError', 'LookupError', 'IndexError', 'KeyError', 'ValueError',
        'UnicodeError', 'UnicodeEncodeError', 'UnicodeDecodeError',
        'UnicodeTranslateError', 'AssertionError', 'ArithmeticError',
        'FloatingPointError', 'OverflowError', 'ZeroDivisionError',
        'SystemError', 'ReferenceError', 'BufferError', 'MemoryError',
        'Warning', 'UserWarning', 'DeprecationWarning',
        'PendingDeprecationWarning', 'SyntaxWarning', 'RuntimeWarning',
        'FutureWarning', 'ImportWarning', 'UnicodeWarning', 'BytesWarning',
        'ResourceWarning', 'ConnectionError', 'BlockingIOError',
        'BrokenPipeError', 'ChildProcessError', 'ConnectionAbortedError',
        'ConnectionRefusedError', 'ConnectionResetError', 'FileExistsError',
        'FileNotFoundError', 'IsADirectoryError', 'NotADirectoryError',
        'InterruptedError', 'PermissionError', 'ProcessLookupError',
        'TimeoutError', 'open', 'quit', 'file'
    ];
});
