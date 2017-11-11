require('./skulpt.min');  // defines skulpt as Sk
const skulpt = Sk;

const isBoolean = /^(True|False)$/;
const NODE_TYPE = {};
NODE_TYPE.FUNCTION = 'FunctionDef';
NODE_TYPE.CLASS = 'ClassDef';
NODE_TYPE.EXPRESSION = 'Expr';
NODE_TYPE.STRING = 'Str';
NODE_TYPE.NUMBER = 'Num';
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
        .filter(node => isNodeType(node, NODE_TYPE.CLASS));

    let schemas = definitions
        .map(def => parseLayer(def, text))
        .filter(schema => !!schema);

    schemas.forEach(schema => schema.file = filename);

    // Record any aliases
    let assignments = ast.body.filter(node => isNodeType(node, NODE_TYPE.ASSIGN));
    assignments.forEach(node => {
        let schema = schemas.find(schema => schema.name === getValue(node.value));
        if (schema) {
            schema.aliases = node.targets.map(getValue);
        }
    });

    return schemas.filter(schema => schema.name[0] !== '_');
}

function parseLayer(def) {
    // Get the name, base info
    let name = def.name.v;
    let base = def.bases[0] && def.bases[0].id.v;

    // Get the arguments for the layer
    let ctor = def.body.find(node => isNodeType(node, NODE_TYPE.FUNCTION) && node.name.v === '__init__');

    let args = [];
    if (ctor) {
        args = parseFnArguments(ctor);
        //console.log(`Skipping ${name}: Missing constructor`);
        //// TODO: inherit?
        //return;
    }

    // get the docstring
    let docstring = getDocString(def);

    // Check if marked as abstract in the docstring
    let isAbstract = false;
    if (docstring && docstring.indexOf('Abstract') === 0) {
        isAbstract = true;
    }

    return {
        name: name,
        base: base,
        arguments: args,
        abstract: isAbstract,
        aliases: [],
        docstring: docstring
    };
}

function getValue(node) {
    let type = getNodeType(node);

    if (getValue[type]) {
        return getValue[type](node);
    }
}

getValue[NODE_TYPE.NAME] = node => node.id.v;
getValue[NODE_TYPE.STRING] = node => node.s.v;
getValue[NODE_TYPE.NUMBER] = node => node.n.v;

function parseFnArguments(def) {
    let argsLen = def.args.args.length;
    let defsLen = def.args.defaults.length;
    // FIXME: not detecting the defaults consistently...
    let args = def.args.args.map((n, i) => {
        let name = n.id.v;
        let distFromEnd = argsLen - i;
        let defIndex = defsLen - distFromEnd;
        let value = null;
        let type;

        if (defIndex > -1 && def.args.defaults[defIndex]) {
            value = getValue(def.args.defaults[defIndex]);
        } else if (def.args.defaults[defIndex]) {
            console.log('cannot get default for', name);
            console.log(def.args.defaults[defIndex]);
        }
        type = inferArgumentType(name, value, def);

        return {
            name: name,
            type: type,
            default: value
        };
    });
    return args;
}

const TYPE_LOADERS = /^(activation|constraint|regularizer|initializer)s$/;
function inferArgumentType(name, value, fnNode) {
    if (isBoolean.test(value)) return 'boolean';

    // TODO: Check for the import
    // Check if it is an activation
    let statements = fnNode.body;
    // we are looking for the given structure:
    //
    //   <something> = activations.get(<variable)
    //   <something> = initializers.get(<variable)
    //   <something> = regularizers.get(<variable)
    //    etc..
    //
    let assignments = statements
        .filter(stat => isNodeType(stat, NODE_TYPE.ASSIGN));

    let rightMethodCalls = assignments
        .map(assign => assign.value)  // right side of the '='
        .filter(right => isNodeType(right, NODE_TYPE.CALL) && isNodeType(right.func, NODE_TYPE.ATTRIBUTE));

    // Create a list of the type information that can be inferred from each statement
    let typeNames = rightMethodCalls
        .map(call => {  // check that we are calling 'get' on 'activations' with the arg
            if (isNodeType(call.func.value, NODE_TYPE.NAME)) {
                let caller = call.func.value.id.v;
                let method = call.func.attr.v;
                let argument = call.args[0];
                let argumentName = argument && argument.id && argument.id.v;
                let isTypeLoader = TYPE_LOADERS.test(caller) && method === 'get';

                if (isTypeLoader && argumentName === name) {
                    return caller.match(TYPE_LOADERS).pop();
                }
            }
        }).filter(type => !!type);

    // Return the first inferred type (may be undefined if none found)
    return typeNames.pop();
}

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
    let args = parseFnArguments(def);

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

//////////////// activations, regularization, initializers... ////////////////
const TYPE_HELPERS = ['serialize', 'deserialize', 'get'];
function parseTypes(text, filename) {
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
                arguments: parseFnArguments(def),
                docstring: getDocString(def),
                aliases: [],
                file: filename
            };
        });
}

const ACTIVATION_HELPERS = TYPE_HELPERS;
function parseActivationTypes(text, filename) {
    return parseTypes(text, filename)
        .filter(schema => !ACTIVATION_HELPERS.includes(schema.name));
}

const REGULARIZER_HELPERS = ['Regularizer', 'L1L2'].concat(TYPE_HELPERS);
function parseRegularizerTypes(text, filename) {
    return parseTypes(text, filename)
        .filter(schema => !REGULARIZER_HELPERS.includes(schema.name));
}

const INITIALIZER_HELPERS = ['Initializer'].concat(TYPE_HELPERS);
function parseInitializersTypes(text, filename) {
    return parseLayers(text, filename)
        .concat(parseTypes(text, filename))
        .filter(schema => !!schema)
        .filter(schema => !INITIALIZER_HELPERS.includes(schema.name))
        .filter(schema => schema.name[0] !== '_');
}

const CONSTRAINT_HELPERS = ['Constraint'].concat(TYPE_HELPERS);
function parseConstraintTypes(text, filename) {
    return parseLayers(text, filename)
        .filter(schema => !CONSTRAINT_HELPERS.includes(schema.name));
}

module.exports = {
    parseLayers: parseLayers,
    parseFnLayers: parseFnLayers,
    activations: {parse: parseActivationTypes},
    constraints: {parse: parseConstraintTypes},
    initializers: {parse: parseInitializersTypes},
    regularizers: {parse: parseRegularizerTypes}
};
