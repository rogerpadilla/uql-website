---
title: Querier
sidebar:
  order: 105
description: Learn how to use the querier to interact with any database through UQL.
---

## Querier

A `querier` is UQL's abstraction over database drivers to dynamically generate queries for _any_ given entity. It allows interaction with different databases in a consistent way.

### Using a Querier

The recommended way to use a querier is `pool.withQuerier()`. It acquires a querier from the [pool](/getting-started#2-fast-track-example), runs your callback, and guarantees release, even if an error is thrown.

```ts title="You write"
import { pool } from './uql.config.js';
import { User } from './shared/models/index.js';

const users = await pool.withQuerier(async (querier) => 
  querier.findMany(User, {
    $select: { id: true, name: true },  // Whitelist scalar fields
    $exclude: { password: true },       // Blacklist scalar fields
    $populate: { profile: true },       // Load relations
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
-- Scalar projection combining $select and $exclude
SELECT "User"."id", "User"."name",
       -- $populate fields from joined relations
       "profile"."id" "profile.id", "profile"."picture" "profile.picture"
FROM "User"
LEFT JOIN "Profile" "profile" ON "profile"."userId" = "User"."id"
WHERE "User"."name" = $1 OR "User"."creatorId" = $2
ORDER BY "User"."createdAt" DESC
LIMIT 10
```

This is especially useful when you want to **release the connection before doing slow non-DB work** (e.g. calling an external API or LLM), preventing connection pool starvation:

```ts
// Phase 1: read from DB (single read - the pool one-liner acquires and releases for you)
const data = await pool.findOne(Resource, { $where: { id: resourceId } });

// Phase 2: slow external call (no connection held)
const result = await callExternalApi(data);

// Phase 3: write result back (writes belong in a unit of work)
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
| `findMany(Entity, query, opts?)`            | Find multiple records matching the query.      |
| `findManyStream(Entity, query, opts?)`      | [Stream records](/querying/streaming) as an `AsyncIterable` for memory-efficient row-by-row iteration. Relation loading rules differ from `findMany`; see [streaming & relations](/querying/streaming#relations--streaming). |
| `findManyAndCount(Entity, query, opts?)`    | Find records and return `[rows, totalCount]`.  |
| `findOne(Entity, query, opts?)`             | Find a single record matching the query.       |
| `findOneById(Entity, id, query?, opts?)`    | Find a record by its primary key.              |
| `count(Entity, query, opts?)`               | Count records matching the query.              |
| `aggregate(Entity, query, opts?)`           | Run an [aggregate query](/querying/aggregate) (`GROUP BY`, `HAVING`, etc.). |
| `insertOne(Entity, data)`                   | Insert a single record and return its ID.      |
| `insertMany(Entity, data[])`                | Insert multiple records and return their IDs.  |
| `updateOneById(Entity, id, data, opts?)`    | Update a record by its primary key.            |
| `updateMany(Entity, query, data, opts?)`    | Update multiple records matching the query.    |
| `saveOne(Entity, data)`                     | Insert or update based on ID presence.         |
| `saveMany(Entity, data[])`                  | Bulk insert or update based on ID presence.    |
| `upsertOne(Entity, conflictPaths, data)`    | Insert or update based on conflict paths.      |
| `upsertMany(Entity, conflictPaths, data[])` | Bulk insert or update based on conflict paths. |
| `deleteOneById(Entity, id, opts?)`          | Delete by primary key. [Soft-deletes](/entities/soft-delete) when the entity has a soft-delete field; pass `{ hardDelete: true }` to remove permanently. |
| `deleteMany(Entity, query, opts?)`          | Delete multiple records matching the query (soft by default; `{ hardDelete: true }` removes permanently). |
| `restoreOneById(Entity, id)`                | Restore a [soft-deleted](/entities/soft-delete) record by its primary key. |
| `restoreMany(Entity, query)`                | Restore soft-deleted records matching the query. |
| [`run(sql, values?)`](/querying/raw-sql)    | Execute [raw SQL](/querying/raw-sql) (INSERT, UPDATE, DELETE). |
| [`all<T>(sql, values?)`](/querying/raw-sql) | Execute [raw SQL SELECT](/querying/raw-sql) with generics. |
| `transaction(callback, opts?)`              | Run a [transaction](/querying/transactions) within a callback. |
| `beginTransaction(opts?)`                   | Start a [transaction](/querying/transactions) manually. |
| `commitTransaction()`                       | Commit the active transaction.                 |
| `rollbackTransaction()`                     | Roll back the active transaction.              |
| `release()`                                 | Return the connection to the pool.             |

The trailing `opts?` on reads, updates, and deletes is a [`QueryOptions`](/querying/filters): bypass [query filters](/querying/filters) for the call (e.g. `withDeleted()` to include soft-deleted rows, or `{ filters: false }`), or force `{ hardDelete: true }` on a delete.

:::note
The query-based methods also support an RPC-friendly call pattern:

```ts
const users = await querier.findMany({ $entity: User, $where: { status: 'active' } });
```

This lets you serialize queries as plain JSON and pass them across RPC/REST boundaries. The `$entity` field is stripped before query execution.
:::

---

### Pool API

The pool manages the connection lifecycle. These are the main `pool` methods:

| Method                          | Description                                                                 |
| :------------------------------ | :-------------------------------------------------------------------------- |
| `pool.withQuerier(callback)`    | Acquire a querier, run `callback`, and auto-release, even on errors.       |
| `pool.transaction(callback)`    | Like `withQuerier`, but wraps the callback in a transaction.                |
| `pool.getQuerier()`             | Manually acquire a querier. **You must call `querier.release()`** yourself. |
| `pool.findMany(...)` and the other reads | Run a single read on its own connection - see [parallel reads](#parallel-reads-on-the-pool) below. |
| [`pool.all(sql, values?)` / `pool.run(sql, values?)`](/querying/raw-sql#raw-sql-on-the-pool) | Run one [raw SQL](/querying/raw-sql) statement on its own connection (SQL pools only). |
| `pool.end()`                    | Gracefully shut down the pool (close all connections).                      |

:::tip
Always prefer `pool.withQuerier()` or `pool.transaction()` for multi-statement work. They guarantee the connection is released. Use `pool.getQuerier()` only when you need manual lifecycle control (e.g., long-lived operations).
:::

### Parallel Reads on the Pool

The read methods - `findMany`, `findOne`, `findOneById`, `findManyAndCount`, `count`, and `aggregate` - are available directly on the pool. Each call acquires its own connection, runs the single read, and releases it, so independent reads fan out in parallel with `Promise.all`:

```ts title="Two connections, in parallel"
const [invoices, total] = await Promise.all([
  pool.findMany(Invoice, { $where: { paid: false } }),
  pool.count(Invoice, {}),
]);
```

The same calls inside one `withQuerier` callback share a single pinned connection, so they queue instead:

```ts title="One pinned connection - queries serialize"
await pool.withQuerier((querier) =>
  Promise.all([querier.findMany(Invoice, {}), querier.count(Invoice, {})]),
);
```

Both are correct - pick by intent: **pool reads** for independent one-shot queries, **`withQuerier`/`transaction`** for a unit of work that should share one connection (or be atomic).

An enclosing [`withContext`](/multi-tenancy) scopes pool reads like any other query - one wrapper covers a whole parallel fan-out:

```ts
await withContext({ tenantId }, () =>
  Promise.all([pool.findMany(Invoice, {}), pool.count(Invoice, {})]),
);
```

:::note
- Pool reads take the entity-as-argument form only; for the `{ $entity }` form, [streaming](/querying/streaming), or **writes** (they need a unit of work), use `withQuerier` / `transaction`.
- On single-connection backends (better-sqlite3, Bun sqlite, D1) pool reads stay correct but share the one connection, so they serialize rather than parallelize.
:::

### Upsert Operations

Upsert (insert-or-update) resolves conflicts using **conflict paths**: the fields that define uniqueness. If a row with matching conflict path values already exists, it is updated; otherwise, a new row is inserted.

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
