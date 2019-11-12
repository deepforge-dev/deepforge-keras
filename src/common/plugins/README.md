This file contains documentation about the contained shared modules.

## JSONImporter (uses changeset.js)
Given a GME node and JSON, this utility will update the GME node to be equivalent to the JSON. This will also recursively update all child nodes (removing those not present in the JSON). As missing fields are ignored, a simple placeholder

The expected JSON is as follows:

```javascript
{
    id: "@meta:SomeMetaNode",
    attributes: {
        name: "Some node"
    },
    attribute_meta: {
        name: {type: "string"}
    },
    pointers: {
        name: idOrPath,
        base: idOrPath,
    },
    pointer_meta: {
        name: {
            idOrPath: {min=-1, max=1},  // max=-1 if it defines a set
            min: 1,  // -1 if it defines a set
            max: 1,  // -1 if it defines a set
        }
    },
    registry: {
        position: {x: 10, y: 50}
    },
    sets: {
        name: [idOrPath, idOrPath2, ...]
    },
    member_attributes: {
        set_name: {
            idOrPath: {
                name: value
            }
        }
    },
    member_registry: {
        set_name: {
            nodeId: {
                name: value
            }
        }
    },
    children: [{...}]
}
```

The `id` field is used to establish identity between nodes in the JSON and existing nodes. (Although GUIDs are effective, they are seldom available when importing from another source.) This excludes the top level node as it is assumed that the given GME node is the same as the top level node in the JSON. Specifically, this value is used to match the node in the JSON to the GME node to update.
In the above JSON, `id` can be one of the following:
- `@meta:<name of metanode>`: a node in the metamodel with the given name
- `@name:<name of node>`: a node contained in the given node with the given name
- `<node path>`: a node with the given path

The rest of the fields correspond to the similarly named concepts in WebGME. For more information, check out https://webgme.readthedocs.io/en/latest/meta_modeling/meta_modeling_concepts.html (or the [source docs](https://editor.webgme.org/docs/source/Core.html) for usage with the Core).

Example usage for this utility can be found in the [tests](/test/common/plugins/JSONImporter.spec.js) and in the [CreateKerasMeta](/src/plugins/CreateKerasMeta/CreateKerasMeta.js) plugin.
