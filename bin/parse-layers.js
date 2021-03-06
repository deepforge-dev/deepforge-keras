// keras parser for deepforge from cli
// In the future, this should be refactored to run in the browser

if (!process.argv[2]) {
    console.error(`usage: node ${process.argv[1]} <keras-root-dir>`);
    process.exit(1);
}

const path = require('path');
const fs = require('fs');
const layerParser = require('../src/common/layer-parser');
const outputDir = path.join('src', 'plugins', 'CreateKerasMeta', 'schemas');

saveTypes('activations');
saveTypes('regularizers');
saveTypes('initializers');
saveTypes('constraints');

// Parse the main layer definitions
let layersDir = path.join(process.argv[2], 'keras', 'layers');
let files = fs.readdirSync(layersDir)
    .filter(name => !name.includes('__init__') && !name.includes('_test.py'));

let schemas = files
    .map(filename => {
        let filepath = path.join(layersDir, filename);
        let content = fs.readFileSync(filepath, 'utf8');
        let schemas = layerParser.parseLayers(content, `keras/layers/${filename}`);
        return schemas;
    })
    .reduce((l1, l2) => l1.concat(l2), []);

// Add the Input layer
let topologyFile = path.join(process.argv[2], 'keras', 'engine', 'topology.py');
let inputLayer = layerParser.parseFnLayers(fs.readFileSync(topologyFile, 'utf8'), 'keras/engine/topology.py')
    .find(schema => schema.name === 'Input');

schemas.push(inputLayer);

let outputPath = path.join(outputDir, 'layers.json');
saveJson(schemas, outputPath);
console.log(`Found ${schemas.length} layers. Saved schema to ${outputPath}`);

function saveTypes(typeName) {
    let outputPath = path.join(outputDir, typeName + '.json');
    let sourceFile = path.join(process.argv[2], 'keras', `${typeName}.py`);
    let initTypes = layerParser[typeName].parse(fs.readFileSync(sourceFile, 'utf8'), `keras/${typeName}.py`);

    saveJson(initTypes, outputPath);
    console.log(`Detected ${initTypes.length} ${typeName}. Saved to ${outputPath}`);
}

function saveJson(json, unixPath) {
    let content = JSON.stringify(json, null, 2);
    let dirs = [__dirname, '..'].concat(unixPath.split('/'));
    let outputDir = path.join.apply(path, dirs);

    fs.writeFileSync(outputDir, content);
}
