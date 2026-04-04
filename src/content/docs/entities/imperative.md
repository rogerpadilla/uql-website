---
title: Imperative (Decorator-free) Definition
sidebar:
  order: 65
description: Learn how to define entities without decorators using the imperative API.
---

## Imperative Registration

If you prefer a functional approach or are working in an environment where decorators are disabled (such as certain edge runtimes or specific build pipelines), UQL provides an imperative API for entity registration. **Crucially, this approach works without requiring `experimentalDecorators` or `emitDecoratorMetadata` in your `tsconfig.json`.**

This approach allows you to register entities using `defineEntity`, which accepts a configuration object containing all the metadata typically provided by decorators.

### Using `defineEntity`

With `defineEntity`, you can define `fields`, `relations`, `indexes`, and `hooks` directly within the configuration. This is particularly useful for dynamic entity loading or when you want to keep your class definitions clean of metadata.

```ts
import { defineEntity } from 'uql-orm';

class User {}

defineEntity(User, {
  name: 'users',
  fields: {
    id: { type: 'uuid', isId: true },
    name: { type: String },
    email: { type: String, unique: true },
  },
  indexes: [
    { columns: ['email'], unique: true },
  ],
  // You can also define hooks and relations here
});
```

### Helper Functions

To assist with type-safe imperative setup, UQL exports several helper functions:

- `defineField`: Define field properties.
- `defineId`: Configure primary key properties.
- `defineRelation`: Configure relationship properties.

### Advantages

- **Decorator-free**: Works in environments *without* `experimentalDecorators` enabled.
- **Centralized Configuration**: Define your entire schema in a single configuration object or script.
- **Dynamic Schemas**: Easily generate entities from external metadata or JSON configurations at runtime.
- **Clean Classes**: Keeps your domain models focused solely on properties, without metadata clutter.

:::tip[Compatibility]
The imperative API is fully compatible with the decorator-based approach. You can mix and match both styles within the same project.
:::