---
title: Basic entities
sidebar:
  order: 60
description: This tutorial explains how to define basic entities with the UQL orm.
---
## Basic entities

The following are the steps to define a basic `entity`:

### Core Decorators

| Decorator     | Purpose                                                                      |
| :------------ | :--------------------------------------------------------------------------- |
| `@Entity()`   | Marks a class as a database table/collection.                                |
| `@Id()`       | Defines the Primary Key with support for `onInsert` generators (UUIDs, etc). |
| `@Field()`    | Standard column. Use `{ references: ... }` for Foreign Keys.                 |
| `@Index()`    | Defines a composite or customized index on one or more columns.              |
| `@OneToOne`   | Defines a one-to-one relationship.                                           |
| `@OneToMany`  | Defines a one-to-many relationship.                                          |
| `@ManyToOne`  | Defines a many-to-one relationship.                                          |
| `@ManyToMany` | Defines a many-to-many relationship.                                         |

```ts
import { v7 as uuidv7 } from 'uuid';
import { Entity, Id, Field, Index } from '@uql/core';

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
// ✅ RECOMMENDED: Use `type` for semantic, cross-database types
@Field({ type: 'uuid' })
externalId?: string;

@Field({ type: 'jsonb' })
metadata?: object;

@Field({ type: 'text' })
bio?: string;

// ⚠️ USE SPARINGLY: `columnType` for precise SQL control
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

### Field Options

The `@Field` and `@Id` decorators accept several options for both query validation and schema generation:

| Option         | Type                | Description                                                                                                                                                         |
| :------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`         | `string`            | Custom database column name.                                                                                                                                        |
| `type`         | `Type \| string`    | Logical type: `String`, `Number`, `Boolean`, `Date`, `BigInt`, or strings like `'uuid'`, `'text'`, `'json'`, `'jsonb'`, `'timestamp'`, `'timestamptz'`, `'vector'`. |
| `columnType`   | `ColumnType`        | Explicit SQL column type (e.g., `varchar`, `text`, `jsonb`, `vector`). Takes highest priority.                                                                      |
| `length`       | `number`            | Column length. If unspecified, defaults to `TEXT` (Postgres/SQLite) or `VARCHAR(255)` (MySQL/Maria).                                                                |
| `nullable`     | `boolean`           | Whether the column allows NULL values. Defaults to `true`.                                                                                                          |
| `unique`       | `boolean`           | Adds a UNIQUE constraint.                                                                                                                                           |
| `index`        | `boolean \| string` | Adds an index. Pass a string to name it.                                                                                                                            |
| `defaultValue` | `Scalar`            | Default value at the database level.                                                                                                                                |
| `comment`      | `string`            | Adds a comment to the column in the database.                                                                                                                       |
| `onInsert`     | `function`          | Generator function for new records (e.g., for UUIDs).                                                                                                               |
| `reference`    | `() => Entity`      | Marks this field as a foreign key referencing another entity's primary key.                                                                                         |
| `foreignKey`   | `string \| false`   | Custom foreign key constraint name, or `false` to disable physical constraints while maintaining logical references.                                                |

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

:::tip[When to Use Each]
- **`@Id()`**: Use for simple numeric auto-increment keys. The database manages ID generation.
- **`@Id({ type: 'uuid', onInsert: ... })`**: Use for distributed systems, APIs, or when you need IDs before database insertion. UUIDs are portable across databases.
:::

---

Continue reading about [Relationships](/entities/relations) or [Indexes](/entities/indexes).
