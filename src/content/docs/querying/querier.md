---
title: Querier
sidebar:
  order: 105
description: Learn how to use the querier to interact with any database through UQL.
---

## Querier

A `querier` is UQL's abstraction over database drivers to dynamically generate queries for _any_ given entity. It allows interaction with different databases in a consistent way.

### Using a Querier

The recommended way to use a querier is `pool.withQuerier()`. It acquires a querier from the [pool](/getting-started#2-fast-track-example), runs your callback, and guarantees release — even if an error is thrown.

```ts title="You write"
import { pool } from './uql.config.js';
import { User } from './shared/models/index.js';

const users = await pool.withQuerier(async (querier) => 
  querier.findMany(User, {
    $select: { id: true, name: true },
    $where: { 
      $or: [
        { name: 'roger' }, 
        { creatorId: 1 }
      ] 
    },
    $sort: { createdAt: 'desc' },
    $limit: 10
  })
);
// querier is automatically released here
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "id", "name" FROM "User"
WHERE "name" = $1 OR "creatorId" = $2
ORDER BY "createdAt" DESC
LIMIT 10
```

This is especially useful when you want to **release the connection before doing slow non-DB work** (e.g. calling an external API or LLM), preventing connection pool starvation:

```ts
// Phase 1 — read from DB (connection held briefly)
const data = await pool.withQuerier((querier) => 
  querier.findOne(Resource, { $where: { id: resourceId } })
);

// Phase 2 — slow external call (no connection held)
const result = await callExternalApi(data);

// Phase 3 — write result back (connection held briefly)
await pool.withQuerier((querier) => 
  querier.updateOneById(Resource, resourceId, { result })
);
```

### Manual Querier Management

For advanced scenarios where you need full control over the querier lifecycle, use `pool.getQuerier()`. Always release it in a `finally` block:

```ts
import { User } from './entities/index.js';
import { pool } from './uql.config.js';

const querier = await pool.getQuerier();

try {
  const users = await querier.findMany(User, {
    $select: { id: true, name: true },
    $limit: 10
  });
} finally {
  await querier.release(); // Essential for pool health
}
```

---

### Available Methods

| Method                                      | Description                                    |
| :------------------------------------------ | :--------------------------------------------- |
| `findMany(Entity, query)`                   | Find multiple records matching the query.      |
| `findManyAndCount(Entity, query)`           | Find records and return `[rows, totalCount]`.  |
| `findOne(Entity, query)`                    | Find a single record matching the query.       |
| `findOneById(Entity, id, query?)`           | Find a record by its primary key.              |
| `count(Entity, query)`                      | Count records matching the query.              |
| `aggregate(Entity, query)`                  | Run an [aggregate query](/querying/aggregate) (`GROUP BY`, `HAVING`, etc.). |
| `insertOne(Entity, data)`                   | Insert a single record and return its ID.      |
| `insertMany(Entity, data[])`                | Insert multiple records and return their IDs.  |
| `updateOneById(Entity, id, data)`           | Update a record by its primary key.            |
| `updateMany(Entity, query, data)`           | Update multiple records matching the query.    |
| `saveOne(Entity, data)`                     | Insert or update based on ID presence.         |
| `saveMany(Entity, data[])`                  | Bulk insert or update based on ID presence.    |
| `upsertOne(Entity, conflictPaths, data)`    | Insert or update based on conflict paths.      |
| `upsertMany(Entity, conflictPaths, data[])` | Bulk insert or update based on conflict paths. |
| `deleteOneById(Entity, id)`                 | Delete a record by its primary key.            |
| `deleteMany(Entity, query)`                 | Delete multiple records matching the query.    |
| `run(sql, values?)`                         | Execute raw SQL.                               |
| `transaction(callback, opts?)`              | Run a [transaction](/querying/transactions) within a callback. |
| `beginTransaction(opts?)`                   | Start a [transaction](/querying/transactions) manually. |
| `commitTransaction()`                       | Commit the active transaction.                 |
| `rollbackTransaction()`                     | Roll back the active transaction.              |
| `release()`                                 | Return the connection to the pool.             |

:::note
Read methods (`findOne`, `findMany`, `findManyAndCount`, `count`, `deleteMany`) also support an RPC-friendly call pattern: `querier.findMany({ $entity: User, ...query })`. This makes serialization for RPC/REST endpoints trivial.
:::

---

### Upsert Operations

Upsert (insert-or-update) resolves conflicts using **conflict paths** — the fields that define uniqueness. If a row with matching conflict path values already exists, it is updated; otherwise, a new row is inserted.

#### `upsertOne`

```ts title="You write"
await querier.upsertOne(User, { email: true }, {
  email: 'roger@uql-orm.dev',
  name: 'Roger',
});
```

```sql title="Generated SQL (PostgreSQL)"
INSERT INTO "User" ("email", "name") VALUES ($1, $2)
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"
```

#### `upsertMany`

Efficiently upsert multiple records in a single statement:

```ts title="You write"
await querier.upsertMany(User, { email: true }, [
  { email: 'roger@uql-orm.dev', name: 'Roger' },
  { email: 'ana@uql-orm.dev', name: 'Ana' },
  { email: 'freddy@uql-orm.dev', name: 'Freddy' },
]);
```

```sql title="Generated SQL (PostgreSQL)"
INSERT INTO "User" ("email", "name") VALUES ($1, $2), ($3, $4), ($5, $6)
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"
```

```sql title="Generated SQL (MySQL/MariaDB)"
INSERT INTO `User` (`email`, `name`) VALUES (?, ?), (?, ?), (?, ?)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)
```

:::tip
`upsertMany` is ideal for data synchronization, bulk imports, or seeding. It reduces round-trips to a single statement regardless of the number of records.
:::
