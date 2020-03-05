'use strict';

describe('schemas', function () {
    const testFixture = require('../../globals');
    const Schemas = testFixture.requirejs('plugin/CreateKerasMeta/CreateKerasMeta/schemas/index');
    const assert = require('assert');

    describe('SimpleRNN', function() {
        let layer = null;
        before(() => {
            layer = Schemas.Layers.find(layer => layer.name === 'SimpleRNN');
        });

        it('should infer type for kernel_initializer', function() {
            const arg = layer.arguments.find(arg => arg.name === 'kernel_initializer');
            assert.equal(arg.type, 'initializer');
        });

        it('should infer type for kernel_constraint', function() {
            const arg = layer.arguments.find(arg => arg.name === 'kernel_constraint');
            assert.equal(arg.type, 'constraint');
        });

        it('should infer type for kernel_regularizer', function() {
            const arg = layer.arguments.find(arg => arg.name === 'kernel_regularizer');
            assert.equal(arg.type, 'regularizer');
        });
    });

    describe('initializers', function() {
        it('should not have any undefined types', function() {
            Schemas.Layers.forEach(layer => {
                const initializers = (layer.arguments || [])
                    .filter(arg => arg.name.includes('initializer'));

                initializers.forEach(arg => {
                    assert(!!arg.type, `Found initializer without type: ${arg.name} for ${layer.name}`);
                });
            });
        });
    });

    describe('constraints', function() {
        it('should not have any undefined types', function() {
            Schemas.Layers.forEach(layer => {
                const constraints = (layer.arguments || [])
                    .filter(arg => arg.name.includes('constraint'));

                constraints.forEach(arg => {
                    assert(!!arg.type, `Found constraint without type: ${arg.name} for ${layer.name}`);
                });
            });
        });
    });

    describe('regularizers', function() {
        it('should not have any undefined types', function() {
            Schemas.Layers.forEach(layer => {
                const regularizers = (layer.arguments || [])
                    .filter(arg => arg.name.includes('regularizer'));

                regularizers.forEach(arg => {
                    assert(!!arg.type, `Found regularizer without type: ${arg.name} for ${layer.name}`);
                });
            });
        });
    });
});
