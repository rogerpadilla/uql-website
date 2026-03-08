---
title: Lifecycle Hooks
sidebar:
  order: 85
description: Learn how to use lifecycle hook decorators to run logic before/after insert, update, delete, and load operations in UQL.
---

## Overview

Lifecycle hooks let you run custom logic at key moments in an entity's lifecycle — before/after inserts, updates, deletes, and after loading from the database. Use them for validation, automatic timestamps, slug generation, computed fields, data masking, and more.

UQL provides **7 decorator hooks** and a **global listener** system:

| Decorator         | Fires when                                 |
| :---------------- | :----------------------------------------- |
| `@BeforeInsert()` | Before a new record is inserted            |
| `@AfterInsert()`  | After a new record is inserted             |
| `@BeforeUpdate()` | Before a record is updated                 |
| `@AfterUpdate()`  | After a record is updated                  |
| `@BeforeDelete()` | Before a record is deleted                 |
| `@AfterDelete()`  | After a record is deleted                  |
| `@AfterLoad()`    | After a record is loaded from the database |

All hooks receive a `HookContext` with the active `querier`, so you can perform additional DB operations within the same transaction.

## Entity-Level Hooks

Define hooks as methods on your entity class using decorator annotations.

### Basic Example

```ts
import { Entity, Id, Field, BeforeInsert, AfterLoad } from 'uql-orm';

@Entity()
export class Article {
  @Id()
  id?: number;

  @Field()
  title?: string;

  @Field()
  slug?: string;

  @Field()
  internalCode?: string;

  @BeforeInsert()
  generateSlug() {
    if (this.title) {
      this.slug = this.title.toLowerCase().replace(/\s+/g, '-');
    }
  }

  @AfterLoad()
  maskInternalCode() {
    this.internalCode = '***';
  }
}
```

When you insert an `Article`, the `generateSlug` hook runs **before** the SQL is executed, setting the `slug` field automatically. When you load articles, `maskInternalCode` fires **after** the query, replacing the raw value.

### Mutation Semantics

- **`before*` hooks** (`@BeforeInsert`, `@BeforeUpdate`, `@BeforeDelete`): Mutations via `this` are **propagated** to the payload — this is how you transform data before persistence.
- **`@AfterLoad`**: Mutations via `this` are **propagated** — this is how you compute virtual fields and mask data after loading.
- **`after*` hooks** (`@AfterInsert`, `@AfterUpdate`, `@AfterDelete`): Side-effect only — for logging, cache invalidation, or notifications. Data is already persisted.

### Async Hooks

Hooks can be `async`. UQL will `await` them before proceeding:

```ts
@Entity()
export class User {
  @Id()
  id?: number;

  @Field()
  email?: string;

  @BeforeInsert()
  async validateEmail(ctx: HookContext) {
    const existing = await ctx.querier.count(User, {
      $where: { email: this.email },
    });
    if (existing > 0) {
      throw new Error('Email already exists');
    }
  }
}
```

> **Note:** The `HookContext` provides access to `ctx.querier`, which operates within the same transaction. This makes hooks transactionally safe.

### Multiple Hooks Per Event

You can register multiple hooks for the same event. They execute in **declaration order**:

```ts
@Entity()
export class Post {
  @Id()
  id?: number;

  @Field()
  title?: string;

  @Field()
  slug?: string;

  @BeforeInsert()
  normalizeTitle() {
    this.title = this.title?.trim();
  }

  @BeforeInsert()
  generateSlug() {
    this.slug = this.title?.toLowerCase().replace(/\s+/g, '-');
  }
}
```

### Stacking Decorators

A single method can be registered for multiple events:

```ts
@BeforeInsert()
@BeforeUpdate()
normalizeEmail() {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
}
```

### Hook Inheritance

Hooks are inherited from parent entities. Parent hooks execute **first**:

```ts
class BaseEntity {
  @Id()
  id?: number;

  @Field()
  updatedAt?: Date;

  @BeforeInsert()
  @BeforeUpdate()
  setTimestamp() {
    this.updatedAt = new Date();
  }
}

@Entity()
class Post extends BaseEntity {
  @Field()
  title?: string;

  @BeforeInsert()
  validate() {
    if (!this.title) throw new Error('Title is required');
  }
}
// On insert: setTimestamp() runs first, then validate()
```

## Global Listeners

For cross-cutting concerns (audit logging, automatic timestamps across all entities, cache invalidation), register **global listeners** on the querier pool:

```ts
import { PgQuerierPool, type QuerierListener } from 'uql-orm';

const auditListener: QuerierListener = {
  afterInsert({ entity, payloads, querier }) {
    console.log(`Inserted ${payloads.length} ${entity.name} records`);
  },
  afterUpdate({ entity, querier }) {
    console.log(`Updated ${entity.name} records`);
  },
  afterDelete({ entity }) {
    console.log(`Deleted ${entity.name} records`);
  },
};

const pool = new PgQuerierPool(connectionConfig, {
  listeners: [auditListener],
});
```

Global listeners receive a `ListenerContext` with:

| Property   | Type        | Description                           |
| :--------- | :---------- | :------------------------------------ |
| `entity`   | `Type<E>`   | The entity class                      |
| `querier`  | `Querier`   | The active querier (same transaction) |
| `payloads` | `E[]`       | The entity payloads                   |
| `event`    | `HookEvent` | The event name                        |

### Execution Order

1. **Global listeners** fire first (in registration order)
2. **Entity-level hooks** fire second (in declaration order, parent hooks first)

This ordering lets global listeners perform setup (e.g., inject audit metadata) before entity hooks process it.

## Cross-Dialect Compatibility

Lifecycle hooks work identically across all supported databases — PostgreSQL, MySQL, MariaDB, SQLite, LibSQL, Cloudflare D1, and MongoDB. Hooks operate at the querier abstraction layer, not at the dialect level.

---

Continue reading about [Virtual Fields](/entities/virtual-fields).
