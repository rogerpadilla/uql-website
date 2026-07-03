---
title: Imperative (Decorator-free) Definition
sidebar:
  order: 65
description: Define entities without decorators using defineEntity, with the same options as the decorator API.
---

## Imperative Registration

`defineEntity` registers the exact same metadata as the [decorators](/entities/basic), without requiring `experimentalDecorators` or `emitDecoratorMetadata` in `tsconfig.json`. Use it when decorators are unavailable (some edge runtimes and build pipelines), when generating entities from external metadata or JSON at runtime, or when you prefer domain classes free of annotations.

### Using `defineEntity`

The configuration object mirrors the decorator API one to one:

```ts
import { v7 as uuidv7 } from 'uuid';
import { defineEntity } from 'uql-orm';

export class User {
  id?: string;
  name?: string;
  email?: string;
}

export class Post {
  id?: number;
  title?: string;
  authorId?: string;
  author?: User;
}

defineEntity(User, {
  fields: {
    id: { type: 'uuid', isId: true, onInsert: () => uuidv7() },
    name: { type: String, index: true },
    email: { type: String, unique: true, comment: 'User login email' },
  },
});

defineEntity(Post, {
  fields: {
    id: { type: Number, isId: true },
    title: { type: String, nullable: false },
    authorId: { type: 'uuid', references: () => User },
  },
  relations: {
    author: { cardinality: 'm1', entity: () => User },
  },
  indexes: [{ columns: ['title', 'authorId'], unique: true }],
});
```

Every entry maps directly to a decorator:

| Key         | Decorator equivalent          | Notes                                                                                                    |
| :---------- | :---------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `fields`    | `@Field` / `@Id`              | Same [field options](/entities/basic#field-options); mark the primary key with `isId: true` instead of `@Id`. |
| `relations` | `@OneToOne` ... `@ManyToMany` | Same [relation options](/entities/relations), plus `cardinality`: `'11'`, `'1m'`, `'m1'`, or `'mm'`.       |
| `indexes`   | `@Index`                      | `{ columns, name?, unique?, type?, where? }`, see [Indexes](/entities/indexes).                            |
| `hooks`     | `@BeforeInsert()`, ...        | Maps each [lifecycle event](/entities/lifecycle-hooks) to method names, e.g. `{ beforeInsert: ['stamp'] }`. |
| `softDelete`| `@Entity({ softDelete })`     | Requires exactly one field with `onDelete`, see [Soft Delete](/entities/soft-delete).                      |

### Incremental registration

For dynamic schemas, register piece by piece with `defineField`, `defineId`, and `defineRelation`, then call `defineEntity` last; it validates the metadata (fields present, exactly one primary key) and finalizes the entity:

```ts
import { defineEntity, defineField, defineId, defineRelation } from 'uql-orm';

class Article {}

defineId(Article, 'id', { type: 'uuid' });
defineField(Article, 'title', { type: String, nullable: false });
defineRelation(Article, 'author', { cardinality: 'm1', entity: () => User });
defineEntity(Article, { name: 'articles' });
```

:::tip[Compatibility]
The imperative API is fully compatible with the decorator-based approach; both write to the same metadata registry, so you can mix styles within one project, and everything downstream (querying, migrations, the [HTTP transport](/extensions-http)) behaves identically.
:::
