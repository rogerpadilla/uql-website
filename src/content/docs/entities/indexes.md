---
title: Indexes
sidebar:
  order: 110
description: Learn how to define simple and composite indexes in UQL.
---

## Indexes

UQL provides a simple yet powerful way to define indexes on your database tables. Indexes are essential for optimizing query performance and enforcing uniqueness across multiple columns.

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

| Option   | Type      | Description                                                                               |
| :------- | :-------- | :---------------------------------------------------------------------------------------- |
| `name`   | `string`  | Custom index name.                                                                        |
| `unique` | `boolean` | Whether the index should enforce uniqueness. Defaults to `false`.                         |
| `type`   | `string`  | Dialect-specific index type (e.g., `'btree'`, `'hash'`, `'gin'`, `'gist'`, `'fulltext'`). |
| `where`  | `string`  | Partial index condition (SQL WHERE clause).                                               |

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

### Synchronization

UQL handles indexes automatically during [migrations](/migrations):
1. **Entity to Database**: Whenever you add or remove an index decorator, UQL detects the change during `generate:entities` or `autoSync`.
2. **Database to Entity**: When you use `generate:from-db`, UQL discovers existing indexes and adds the corresponding `@Field({ index: true })` or `@Index()` decorators to your generated code.

:::info
Indexes are synchronized in both directions, ensuring your code and database schema are always perfectly aligned.
:::

---

Read more about [Basic Entities](/entities/basic) or [Migrations](/migrations).
