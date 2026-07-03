---
title: Decorators
sidebar:
  order: 60
description: Define entities with the @Entity, @Id, and @Field decorators, and choose column types.
---
## Entities via decorators

An entity is a plain TypeScript class; its decorators carry the metadata UQL uses for type-safe querying and DDL generation.

:::note[Decorator-free alternative]
Decorators require `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json`. If your toolchain can't enable them, or you prefer plain classes, the [imperative API](/entities/imperative) (`defineEntity`) registers identical metadata with the same options as the decorators on this page.
:::

### Core Decorators

| Decorator     | Purpose                                                                      |
| :------------ | :--------------------------------------------------------------------------- |
| `@Entity()`   | Marks a class as a database table/collection. Accepts options: `name` (custom table name), `softDelete` (enable [soft-delete](/entities/soft-delete)). |
| `@Id()`       | Defines the Primary Key with support for `onInsert` generators (UUIDs, etc). |
| `@Field()`    | Standard column. Use `{ references: ... }` for Foreign Keys.                 |
| `@Index()`    | Defines a composite or customized index on one or more columns.              |
| `@OneToOne`   | Defines a one-to-one relationship.                                           |
| `@OneToMany`  | Defines a one-to-many relationship.                                          |
| `@ManyToOne`  | Defines a many-to-one relationship.                                          |
| `@ManyToMany` | Defines a many-to-many relationship.                                         |

```ts
import { v7 as uuidv7 } from 'uuid';
import { Entity, Id, Field, Index } from 'uql-orm';

@Entity()
export class User {
  @Id({ 
    type: 'uuid', 
    onInsert: () => uuidv7() 
  })
  id?: string;

  @Field({ index: true })
  name?: string;

  @Field({ 
    unique: true, 
    comment: 'User login email' 
  })
  email?: string;

  @Field({ type: 'text' })
  bio?: string;
}
```

### Type Abstraction

UQL provides two levels for specifying column types. **Always prefer `type`** for portability; use `columnType` only for precise SQL control.

| Property         | Level                     | Description                                                                     |
| :--------------- | :------------------------ | :------------------------------------------------------------------------------ |
| **`type`**       | **Logical (Recommended)** | Database-agnostic. UQL maps it to the correct SQL type for each dialect.        |
| **`columnType`** | **Physical**              | Direct SQL type. Use only when you need exact control over the underlying type. |

#### When to Use Each

```ts
// Recommended: use `type` for semantic, cross-database types
@Field({ type: 'uuid' })
externalId?: string;

@Field({ type: 'jsonb' })
metadata?: Json<{ theme?: string; priority?: number }>;

@Field({ type: 'text' })
bio?: string;

// Use sparingly: `columnType` for precise SQL control
@Field({ 
  columnType: 'decimal', 
  precision: 10, 
  scale: 2 
})
price?: number;

@Field({ 
  columnType: 'varchar', 
  length: 500 
})
longBio?: string;
```

:::tip[Prefer `type`]
Using `type: 'uuid'` generates `UUID` on Postgres but `CHAR(36)` on MySQL — automatically. This makes your entities portable across databases without changes.
:::

:::tip[JSONB with `Json<T>`]
Wrapping JSONB field types with `Json<T>` ensures the field is classified as a `FieldKey` (not a `RelationKey`), enabling type-safe usage in `$where`, `$select`, and `$sort`. It also provides **IDE autocompletion** for [dot-notation operator paths](/querying/comparison-operators#jsonb-dot-notation-operators).
:::

### Field Options

The `@Field` and `@Id` decorators accept several options for both query validation and schema generation:

| Option         | Type                | Description                                                                                                                                                         |
| :------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`         | `string`            | Custom database column name.                                                                                                                                        |
| `type`         | `Type \| string`    | Logical type: `String`, `Number`, `Boolean`, `Date`, `BigInt`, or strings like `'uuid'`, `'text'`, `'json'`, `'jsonb'`, `'timestamp'`, `'timestamptz'`, `'vector'`, `'halfvec'`, `'sparsevec'`. |
| `columnType`   | `ColumnType`        | Explicit SQL column type (e.g., `varchar`, `text`, `jsonb`, `vector`, `halfvec`, `sparsevec`). Takes highest priority.                                                                      |
| `length`       | `number`            | Column length. If unspecified, defaults to `TEXT` (Postgres/SQLite) or `VARCHAR(255)` (MySQL/Maria).                                                                |
| `precision`    | `number`            | Numeric precision, e.g. for `decimal` columns.                                                                                                                      |
| `scale`        | `number`            | Numeric scale, e.g. for `decimal` columns.                                                                                                                          |
| `nullable`     | `boolean`           | Whether the column allows NULL values. Defaults to `true`.                                                                                                          |
| `unique`       | `boolean`           | Adds a UNIQUE constraint.                                                                                                                                           |
| `index`        | `boolean \| string` | Adds an index. Pass a string to name it.                                                                                                                            |
| `defaultValue` | `Scalar`            | Default value at the database level.                                                                                                                                |
| `comment`      | `string`            | Adds a comment to the column in the database.                                                                                                                       |
| `dimensions`   | `number`            | Number of dimensions for vector fields. E.g., `@Field({ type: 'vector', dimensions: 1536 })`.                                                                      |
| `distance`     | `VectorDistance`    | Default distance metric for vector similarity queries: `'cosine'`, `'l2'`, `'inner'`, `'l1'`, `'hamming'`.                                                          |
| `onInsert`     | `function`          | Generator function for new records (e.g., `() => uuidv7()`).                                                                                                       |
| `onUpdate`     | `function`          | Callback invoked on every update (e.g., `() => new Date()` for `updatedAt`).                                                                                        |
| `onDelete`     | `function`          | Callback for [soft-delete](/entities/soft-delete) values (e.g., `() => new Date()`).                                                                                |
| `updatable`    | `boolean`           | Set to `false` to prevent updates on this field (e.g., `createdAt`). Defaults to `true`.                                                                            |
| `eager`        | `boolean`           | Whether this field is included in queries by default. Set to `false` for fields (e.g., `password`) that should only be returned when explicitly selected. Defaults to `true`. |
| `virtual`      | `RawExpression`     | Defines a computed/[virtual field](/entities/virtual-fields) via raw SQL.                                                                                            |
| `references`   | `() => Entity`      | Marks this field as a foreign key referencing another entity's primary key.                                                                                          |
| `foreignKey`   | `boolean \| string` | `true` for a plain constraint (the default when `references` is set), a string to name it, or `false` to disable the physical constraint while keeping the logical reference. |

### Primary Key Options

The `@Id` decorator also supports:

| Option          | Type      | Description                                                                                                |
| :-------------- | :-------- | :--------------------------------------------------------------------------------------------------------- |
| `autoIncrement` | `boolean` | Explicitly enable/disable auto-increment. Defaults to `true` for numeric types, `false` for strings/UUIDs. |

#### Choosing Your Primary Key Strategy

```ts
// Auto-increment integer (simple, database-managed)
@Id()
id?: number;

// UUID (portable, client-generated)
@Id({ 
  type: 'uuid', 
  onInsert: () => uuidv7() 
})
id?: string;
```

:::note[Choosing between Integer and UUID keys]
- **Integers** (`@Id()`): the database manages ID generation. Faster joins and smaller indexes make them a good default for internal tables and small-to-medium applications.
- **UUIDs** (`@Id({ type: 'uuid', onInsert: ... })`): better for distributed systems, multi-tenant SaaS, and public-facing APIs. They avoid ID enumeration (users guessing `/users/1`, `/users/2`) and can be generated on the client before the row exists.
:::
