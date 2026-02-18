---
title: Querier
sidebar:
  order: 180
description: Learn how to use the querier to interact with any database through UQL.
---

## Querier

A `querier` is UQL's abstraction over database drivers to dynamically generate queries for _any_ given entity. It allows interaction with different databases in a consistent way.

With a `querier` you can:

- Manipulate the data related to _any_ `entity`.
- Use [transactions](/transactions).

### Obtaining a Querier

A querier is obtained from a [pool](/getting-started#2-fast-track-example). Always remember to release it when done:

```ts
import { User } from './entities/index.js';
import { pool } from './uql.config.js';

const querier = await pool.getQuerier();

try {
  const users = await querier.findMany(User, {
    $select: ['id', 'name'],
    $where: { 
      $or: [
        { name: 'roger' }, 
        { creatorId: 1 }
      ] 
    },
    $sort: { createdAt: 'desc' },
    $limit: 10
  });
} finally {
  await querier.release(); // Essential for pool health
}
```

### Available Methods

| Method                                            | Description                                              |
| :------------------------------------------------ | :------------------------------------------------------- |
| `findMany(Entity, query)`                         | Find multiple records matching the query.                |
| `findManyAndCount(Entity, query)`                 | Find records and return `[rows, totalCount]`.            |
| `findOne(Entity, query)`                          | Find a single record matching the query.                 |
| `findOneById(Entity, id, query?)`                 | Find a record by its primary key.                        |
| `count(Entity, query)`                            | Count records matching the query.                        |
| `insertOne(Entity, data)`                         | Insert a single record and return its ID.                |
| `insertMany(Entity, data[])`                      | Insert multiple records and return their IDs.            |
| `updateOneById(Entity, id, data)`                 | Update a record by its primary key.                      |
| `updateMany(Entity, query, data)`                 | Update multiple records matching the query.              |
| `saveOne(Entity, data)`                           | Insert or update based on ID presence.                   |
| `saveMany(Entity, data[])`                        | Bulk insert or update based on ID presence.              |
| `upsertOne(Entity, conflictPaths, data)`          | Insert or update based on conflict paths.                |
| `upsertMany(Entity, conflictPaths, data[])`       | Bulk insert or update based on conflict paths.           |
| `deleteOneById(Entity, id)`                       | Delete a record by its primary key.                      |
| `deleteMany(Entity, query)`                       | Delete multiple records matching the query.              |
| `run(sql, values?)`                               | Execute raw SQL.                                         |
| `transaction(callback)`                           | Run a transaction within a callback.                     |
| `release()`                                       | Return the connection to the pool.                       |

:::note
Read methods (`findOne`, `findMany`, `findManyAndCount`, `count`, `deleteMany`) also support an RPC-friendly call pattern: `querier.findMany({ $entity: User, ...query })`. This makes serialization for RPC/REST endpoints trivial.
:::

### Upsert Operations

Upsert (insert-or-update) resolves conflicts using **conflict paths** — the fields that define uniqueness. If a row with matching conflict path values already exists, it is updated; otherwise, a new row is inserted.

#### `upsertOne`

```ts
await querier.upsertOne(User, { email: true }, {
  email: 'roger@uql.io',
  name: 'Roger',
});
```

**SQL (PostgreSQL):**
```sql
INSERT INTO "User" ("email", "name") VALUES ($1, $2)
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"
```

#### `upsertMany`

Efficiently upsert multiple records in a single statement:

```ts
await querier.upsertMany(User, { email: true }, [
  { email: 'roger@uql.io', name: 'Roger' },
  { email: 'ana@uql.io', name: 'Ana' },
  { email: 'carlos@uql.io', name: 'Carlos' },
]);
```

**SQL (PostgreSQL):**
```sql
INSERT INTO "User" ("email", "name") VALUES ($1, $2), ($3, $4), ($5, $6)
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"
```

**SQL (MySQL/MariaDB):**
```sql
INSERT INTO `User` (`email`, `name`) VALUES (?, ?), (?, ?), (?, ?)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)
```

:::tip
`upsertMany` is ideal for data synchronization, bulk imports, or seeding. It reduces round-trips to a single statement regardless of the number of records.
:::

### Transactions

For multi-step operations, you can use the pool's `transaction` method which automatically handles the entire querier lifecycle:

```ts
const result = await pool.transaction(async (querier) => {
  const user = await querier.findOne(User, { $where: { email: '...' } });
  await querier.insertOne(Profile, { userId: user.id, bio: '...' });
  return user;
});
// Querier is automatically released
```

If you already have a `querier` instance, you can use its `transaction` method to achieve the same automatic commit/rollback behavior:

```ts
const result = await querier.transaction(async () => {
  await querier.insertOne(Profile, { userId: user.id, bio: '...' });
});
```

See [transactions](/transactions) for more patterns.
