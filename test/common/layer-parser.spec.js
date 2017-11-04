describe('layer-parser', function() {
    const LayerParser = require('../../src/common/layer-parser');
    const fs = require('fs');
    const path = require('path');
    const assert = require('assert');

    describe('activations', function () {
        let content = null;
        let acts = null;

        before(() => {
            content = fs.readFileSync(path.join(__dirname, '..', 'test-cases', 'activations.py'), 'utf8');
            acts = LayerParser.regularizers.parse(content);
        });

        it('should parse the activations', () => {
            assert.equal(acts.length, 10);
        });

        it('should parse activation w/ name "softmax"', () => {
            assert(acts.find(info => info.name === 'softmax'));
        });

        it('should parse the arguments (softmax)', () => {
            let softmax = acts.find(info => info.name === 'softmax');
            assert(softmax.arguments.find(arg => arg.name === 'axis'));
        });

        it('should parse the argument defaults (softmax, axis)', () => {
            let softmax = acts.find(info => info.name === 'softmax');
            let axis = softmax.arguments.find(arg => arg.name === 'axis');
            assert.equal(axis.default, -1);
        });
    });

    describe('regularizers', function () {
        let content = null;
        let regs = null;

        before(() => {
            content = fs.readFileSync(path.join(__dirname, '..', 'test-cases', 'regularizers.py'), 'utf8');
            regs = LayerParser.regularizers.parse(content);
        });

        it('should parse the regularizers', () => {
            assert.equal(regs.length, 3);
        });

        it('should parse regularizer w/ name "l1"', () => {
            assert(regs.find(info => info.name === 'l1'));
        });

        it('should parse the arguments (l1)', () => {
            let l1 = regs.find(info => info.name === 'l1');
            assert(l1.arguments.find(arg => arg.name === 'l'));
        });

        it('should parse the argument defaults (l1, l)', () => {
            let l1 = regs.find(info => info.name === 'l1');
            let l = l1.arguments.find(arg => arg.name === 'l');
            assert.equal(l.default, 0.01);
        });
    });

    describe('initializers', function () {
        let content = null;
        let inits = null;

        before(() => {
            content = fs.readFileSync(path.join(__dirname, '..', 'test-cases', 'initializers.py'), 'utf8');
            inits = LayerParser.initializers.parse(content);
        });

        it('should parse the initializers', () => {
            assert.equal(inits.length, 13);
        });

        it('should parse initializer w/ name "he_normal"', () => {
            assert(inits.find(info => info.name === 'he_normal'));
        });

        it('should filter out the private fns', () => {
            assert(!inits.find(info => info.name === '_compute_fans'));
        });

        it('should use compatibility aliases', () => {
            assert(inits.find(info => info.name === 'normal'));
        });

        it('should parse the arguments (normal)', () => {
            let normal = inits.find(info => info.name === 'normal');
            assert(normal.arguments.find(arg => arg.name === 'stddev'));
        });

        it('should parse the argument defaults (normal, l)', () => {
            let normal = inits.find(info => info.name === 'normal');
            let l = normal.arguments.find(arg => arg.name === 'stddev');
            assert.equal(l.default, 0.05);
        });
    });
});
