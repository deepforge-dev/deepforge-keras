require('./skulpt.min');  // defines skulpt as Sk
const skulpt = Sk;

const isBoolean = /^(True|False)$/;
const NODE_TYPE = {};
NODE_TYPE.FUNCTION = 'FunctionDef';
NODE_TYPE.CLASS = 'ClassDef';
NODE_TYPE.EXPRESSION = 'Expr';
NODE_TYPE.STRING = 'Str';
NODE_TYPE.ASSIGN = 'Assign';
NODE_TYPE.IF = 'If_';
NODE_TYPE.BOOL = 'BoolOp';
NODE_TYPE.CALL = 'Call';
NODE_TYPE.ATTRIBUTE = 'Attribute';
NODE_TYPE.NAME = 'Name';

function isNodeType(node, type) {
    return node.constructor.name === type;
}

function getNodeType(node) {
    return node.constructor.name;
}

function parseLayers(text, filename) {
    var cst = skulpt.parse(filename, text).cst;
    var ast = skulpt.astFromParse(cst, filename);

    // Check the functional definitions?
    var definitions = ast.body
        .filter(node => {  // get the class nodes
            var nodeType = node.constructor.name;
            return nodeType === NODE_TYPE.CLASS;
        });

    let schemas = definitions
        .map(def => parseLayer(def, text))
        .filter(schema => !!schema);

    schemas.forEach(schema => schema.file = filename);

    return schemas.filter(schema => schema.name[0] !== '_');
}

function parseLayer(def, rawText) {
    // Get the name, base info
    let name = def.name.v;
    let base = def.bases[0] && def.bases[0].id.v;

    // Get the arguments for the layer
    let ctor = def.body.find(node => isNodeType(node, NODE_TYPE.FUNCTION) && node.name.v === '__init__');

    if (!ctor) {
        console.log(`Skipping ${name}: Missing constructor`);
        // TODO: inherit?
        return;
    }
    let args = parseLayerCtor(ctor);

    // get the docstring
    let docstring = getDocString(def);

    // Check if marked as abstract in the docstring
    let isAbstract = false;
    if (docstring.indexOf('Abstract') === 0) {
        isAbstract = true;
    }

    return {
        name: name,
        base: base,
        arguments: args,
        abstract: isAbstract,
        docstring: docstring
    };
}

function parseLayerCtor(def) {
    let argsLen = def.args.args.length;
    let defsLen = def.args.defaults.length;
    // FIXME: not detecting the defaults consistently...
    let args = def.args.args.map((n, i) => {
        let name = n.id.v;
        let distFromEnd = argsLen - i;
        let defIndex = defsLen - distFromEnd;
        let value = null;
        let type;

        if (defIndex > -1 && def.args.defaults[defIndex].id) {
            value = def.args.defaults[defIndex].id.v;
        }
        type = inferArgumentType(name, value, def);
        // TODO: check if it is an activation

        // TODO: add type info
        return {
            name: name,
            type: type,
            default: value
        };
    });
    return args;
}

function inferArgumentType(name, value, fnNode) {
    if (isBoolean.test(value)) return 'boolean';

    // TODO: CHeck for the import
    // Check if it is an activation
    let statements = fnNode.body;
    // we are looking for the given structure:
    //
    //   <something> = activations.get(<variable)
    let assignments = statements
        .filter(stat => isNodeType(stat, NODE_TYPE.ASSIGN));

    let rightMethodCalls = assignments
        .map(assign => assign.value)  // right side of the '='
        .filter(right => isNodeType(right, NODE_TYPE.CALL) && isNodeType(right.func, NODE_TYPE.ATTRIBUTE));

    let isActivationName = rightMethodCalls
        .filter(call => {  // check that we are calling 'get' on 'activations' with the arg
            if (isNodeType(call.func.value, NODE_TYPE.NAME)) {
                let caller = call.func.value.id.v;
                let method = call.func.attr.v;
                let argument = call.args[0];
                let argumentName = argument && argument.id && argument.id.v;

                return caller === 'activations' && method === 'get' &&
                    argumentName === name;
            }
        }).length > 0;

    if (isActivationName) return 'activation';
}

function traverse(node, fn) {
    let next = [];
    let current = [node];
    let stop = false;

    while (current.length) {
        for (var i = current.length; i--;) {
            node = current[i];
            stop = fn(node);
            if (stop) return;
            if (!getChildren[getNodeType(node)]) {
                console.log('---\n', getNodeType(node));
                console.log(node);
            }
            next = next.concat(getChildren[getNodeType(node)](node));
        }
        current = next;
        next = [];
    }
}

let getChildren = {};
getChildren[NODE_TYPE.FUNCTION] = node => node.body;
getChildren[NODE_TYPE.EXPRESSION] = node => [];
getChildren[NODE_TYPE.ASSIGN] = node => [node.value].concat(node.targets);
getChildren[NODE_TYPE.IF] = node => [node.test].concat(node.body);
getChildren[NODE_TYPE.BOOL] = node => node.values;

function getDocString(node) {
    let first = node.body[0];
    if (isNodeType(first, NODE_TYPE.EXPRESSION) && isNodeType(first.value, NODE_TYPE.STRING)) {
        return first.value.s.v;
    }
}

// For `Input` layers (just a function definition)
function parseFnLayers(text, filename) {
    var cst = skulpt.parse(filename, text).cst;
    var ast = skulpt.astFromParse(cst, filename);

    // Check the functional definitions?
    var definitions = ast.body
        .filter(node => {  // get the class nodes
            var nodeType = node.constructor.name;
            return nodeType === NODE_TYPE.FUNCTION;
        });

    let schemas = definitions
        .map(def => parseFnLayer(def, text))
        .filter(schema => !!schema);

    schemas.forEach(schema => schema.file = filename);

    return schemas.filter(schema => schema.name[0] !== '_');
}

function parseFnLayer(def) {
    let name = def.name.v;
    let args = parseLayerCtor(def);

    // get the docstring
    let docstring = getDocString(def);

    // Check if marked as abstract in the docstring
    let isAbstract = false;
    if (docstring && docstring.indexOf('Abstract') === 0) {
        isAbstract = true;
    }

    return {
        name: name,
        arguments: args,
        abstract: isAbstract,
        docstring: docstring
    };
}

// Parsing activation, regularization, etc
const ACTIVATION_HELPERS = ['serialize', 'deserialize', 'get'];
function parseActivationTypes(text, filename) {
    var cst = skulpt.parse(filename, text).cst;
    var ast = skulpt.astFromParse(cst, filename);

    var definitions = ast.body
        .filter(node => {  // get the class nodes
            var nodeType = node.constructor.name;
            return nodeType === NODE_TYPE.FUNCTION;
        });
    
    return definitions
        .map(def => {
            return {
                name: def.name.v,
                args: parseLayerCtor(def),
                docstring: getDocString(def)
            };
        })
        .filter(schema => !ACTIVATION_HELPERS.includes(schema.name));
}

module.exports = {
    parseLayers: parseLayers,
    parseFnLayers: parseFnLayers,
    parseActivationTypes: parseActivationTypes
};
