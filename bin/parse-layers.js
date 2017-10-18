// tensorflow parser for deepforge from cli
// In the future, this should be refactored to run in the browser

if (!process.argv[2]) {
    console.error(`usage: node ${process.argv[1]} <keras-root-dir>`);
    process.exit(1);
}

const path = require('path');
const fs = require('fs');
const layerParser = require('../src/layer-parser');

var layersDir = path.join(process.argv[2], 'keras', 'layers');
var files = fs.readdirSync(layersDir)
    .filter(name => !name.includes('__init__') && !name.includes('_test.py'));

var schemas = files
    .map(filename => {
        let filepath = path.join(layersDir, filename);
        let content = fs.readFileSync(filepath, 'utf8');
        let schemas = layerParser.parseLayers(content, filename);
        return schemas;
    })
    .reduce((l1, l2) => l1.concat(l2), []);

let outputDir = path.join(__dirname, '..', 'src', 'plugins', 'UpdateMeta', 'schema.json');
let content = JSON.stringify(schemas, null, 2);

fs.writeFileSync(outputDir, content);
console.log(`Found ${schemas.length} layers. Saved schema to ${outputDir}`);
