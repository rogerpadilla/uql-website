---
title: Indexes
sidebar:
  order: 110
description: Learn how to define simple and composite indexes in UQL.
---

## Indexes

Indexes are defined directly on your entities, either per field or at the class level for composite and specialized indexes.

### Simple Indexes

For basic single-column indexes, use the `index` option within the `@Field` decorator.

```ts
@Entity()
export class User {
  @Id()
  id?: number;

  @Field({ index: true }) // Adds an index named 'idx_user_email'
  email?: string;

  @Field({ index: 'idx_display_name' }) // Adds a named index
  displayName?: string;
}
```

### Composite Indexes

When you need an index that spans multiple columns (e.g., for queries filtering by both `lastName` and `firstName`), use the `@Index` decorator at the class level. This is significantly more efficient than having two separate single-column indexes for multi-column filters.

#### Example: Audit Log
Consider an audit log where you frequently search for entries by `entityType` and `entityId`, ordered by `createdAt`. A composite index on these three columns will make your audit history lookups extremely fast.

```ts
import { Entity, Id, Field, Index } from 'uql-orm';

@Index(['entityType', 'entityId', 'createdAt'], { name: 'idx_audit_lookup' })
@Entity()
export class AuditLog {
  @Id()
  id?: number;

  @Field()
  entityType?: string; // e.g., 'User', 'Post'

  @Field()
  entityId?: string;   // e.g., 'uuid-123'

  @Field({ type: 'timestamptz' })
  createdAt?: Date;

  @Field()
  action?: string;     // e.g., 'create', 'update'
}
```

:::tip
**Which one should I use?**
- Use **`@Field({ index: true })`** for simple, single-column indexes. It's more concise.
- Use **`@Index()`** for composite indexes, or when you need advanced features like `type`, `where` clauses, or custom naming that doesn't fit in the field definition.
:::

### Customizing Indexes

The `@Index` decorator accepts several options to fine-tune the index behavior:

| Option           | Type      | Description                                                                                              |
| :--------------- | :-------- | :------------------------------------------------------------------------------------------------------- |
| `name`           | `string`  | Custom index name.                                                                                       |
| `unique`         | `boolean` | Whether the index should enforce uniqueness. Defaults to `false`.                                        |
| `type`           | `string`  | Dialect-specific index type (e.g., `'btree'`, `'hash'`, `'gin'`, `'gist'`, `'fulltext'`, `'hnsw'`, `'ivfflat'`). |
| `where`          | `string`  | Partial index condition (SQL WHERE clause).                                                              |
| `distance`       | `string`  | Vector indexes: distance metric (e.g., `'cosine'`, `'l2'`), mapped to the operator class.                |
| `m`              | `number`  | HNSW: max connections per node.                                                                          |
| `efConstruction` | `number`  | HNSW: construction search depth.                                                                         |
| `lists`          | `number`  | IVFFlat: number of inverted lists.                                                                       |

#### Unique Composite Index
Ideal for enforcing uniqueness across a combination of fields, such as "one email per tenant" in a multi-tenant application.

```ts
@Index(['email', 'tenantId'], { unique: true })
@Entity()
export class User {
  @Id()
  id?: number;

  @Field()
  email?: string;

  @Field()
  tenantId?: string;
}
```

#### Dialect-Specific Types
```ts
@Index(['metadata'], { type: 'gin' }) // PostgreSQL GIN index for JSONB
@Entity()
export class Log { ... }
```

#### Partial Indexes (Postgres/SQLite)
Partial indexes contain only a subset of the data, which can save space and improve performance for specific query patterns. This is extremely useful for entities with [Soft-Delete](/entities/soft-delete), where you only want to index active records.

```ts
// Index only active (non-deleted) emails to ensure uniqueness
// while allowing multiple 'deleted' records with the same email.
@Index(['email'], { unique: true, where: '"deletedAt" IS NULL' })
@Entity({ softDelete: true })
export class User {
  @Id()
  id?: number;

  @Field()
  email?: string;

  @Field({ onDelete: () => new Date() })
    deletedAt?: Date;
}
```

### Vector Indexes

Vector indexes (for [semantic search](/querying/semantic-search)) are defined with the same `@Index` decorator, using the vector-specific options above:

```ts
@Index(['embedding'], {
  type: 'hnsw',
  distance: 'cosine',
  m: 16,
  efConstruction: 64
})
@Entity()
export class Article {
  @Id()
  id?: number;

  @Field({ type: 'vector', dimensions: 1536 })
  embedding?: number[];
}
```

[Migrations](/migrations) track these parameters: if you tune `m` or `efConstruction` in code, the diff includes the `DROP`/`CREATE` needed to rebuild the index.

### Synchronization

UQL handles indexes automatically during [migrations](/migrations):
1. **Entity to Database**: Whenever you add or remove an index decorator, UQL detects the change during `generate:entities` or `autoSync`.
2. **Database to Entity**: When you use `generate:from-db`, UQL discovers existing indexes and adds the corresponding `@Field({ index: true })` or `@Index()` decorators to your generated code.

---

Read more about [entity definition](/entities/basic) or [Migrations](/migrations).
