require('./skulpt.min');  // defines skulpt as Sk
const skulpt = Sk;

const isBoolean = /^(True|False)$/;
const NODE_TYPE = {};
NODE_TYPE.FUNCTION = 'FunctionDef';
NODE_TYPE.CLASS = 'ClassDef';
NODE_TYPE.EXPRESSION = 'Expr';
NODE_TYPE.STRING = 'Str';

function isNodeType(node, type) {
    return node.constructor.name === type;
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

    schemas = definitions
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
        console.log('Skipping', def.name.v);
        // TODO: inherit?
        return;
    }
    let args = parseLayerCtor(ctor);

    // get the docstring
    let docstring = getDocString(def, rawText);

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
    let args = def.args.args.map((n, i) => {
        let distFromEnd = argsLen - i;
        let defIndex = defsLen - distFromEnd;
        let value = null;
        let type;

        if (defIndex > -1 && def.args.defaults[defIndex].id) {
            value = def.args.defaults[defIndex].id.v;
            if (isBoolean.test(value)) type = 'boolean';
        }

        // TODO: add type info
        return {
            name: n.id.v,
            type: type,
            default: value
        };
    });
    return args;
}

function getDocString(node, text) {
    let first = node.body[0];
    if (isNodeType(first, NODE_TYPE.EXPRESSION) && isNodeType(first.value, NODE_TYPE.STRING)) {
        return first.value.s.v;
    }
}

module.exports = {
    parseLayers: parseLayers
};
