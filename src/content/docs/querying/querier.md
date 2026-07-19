---
title: Querier
sidebar:
  order: 105
description: Learn how to use the querier to interact with any database through UQL.
---

## Querier

A `querier` is UQL's abstraction over database drivers to dynamically generate queries for _any_ given entity. It allows interaction with different databases in a consistent way.

### Using a Querier

The query methods live on the [pool](/getting-started#2-fast-track-example). For a **single read**, call one straight on the pool and the connection is acquired and released for you. For a **unit of work** (multiple statements, or any write), use `pool.withQuerier()` and call the methods on the `querier` it hands you. Same methods, two entry points: [which to use, and why](#choosing-poolx-vs-querierx).

```ts title="You write"
import { pool } from './uql.config.js';
import { User } from './shared/models/index.js';

const users = await pool.findMany(User, {
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
});
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

### The same query, every transport

A UQL query is a plain object, so the *same* value works unchanged across every layer. There is no per-transport rewriting, no DTO, no second schema to keep in sync, and the result stays fully typed everywhere, including populated relations:

```ts title="Define it once"
import type { Query } from 'uql-orm/type';
import { User } from './shared/models/index.js';

// filters, sorting, and nested relation loading - all type-checked against User
const query: Query<User> = {
  $select: { id: true, name: true },
  $where: { status: 'active' },
  $populate: { posts: { $select: { title: true }, $where: { published: true }, $limit: 5 } },
  $sort: { createdAt: 'desc' },
  $limit: 10,
};
```

```ts title="Use it everywhere"
// 1. On the server: straight on the pool (or a querier)
const onServer = await pool.findMany(User, query);

// 2. From the browser: against your REST API, same object and same types
const { data: inBrowser } = await httpQuerier.findMany(User, query);

// 3. Across an RPC boundary (tRPC / oRPC): it travels as JSON, untouched
const overRpc = await trpc.user.findMany.query(query);
```

The object you type-check on the server is the object the browser sends and the object RPC carries. See the [HTTP core](/extensions-http), [browser client](/extensions-browser), and the [tRPC](/trpc) / [oRPC](/orpc) recipes.

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

#### Insert IDs

`insertOne`/`insertMany` return the record IDs in payload order. IDs you provide, and IDs generated client-side via `@Id({ onInsert })` (e.g. `randomUUID`), are always returned as-is on every database. Database-generated IDs are exact per row on dialects where the statement itself reports them: PostgreSQL and MariaDB (`INSERT ... RETURNING`) and MongoDB (`insertedIds`). On MySQL and SQLite the driver only reports one generated ID per statement, so UQL infers the rest arithmetically; that inference is applied only when the primary key is auto-increment and no record in the batch supplies an explicit ID (on MySQL it also detects a clustered `auto_increment_increment` stride automatically). In any other case those entries are `undefined` instead of potentially wrong values.

```ts
const ids = await querier.insertMany(User, [
  { name: 'Ada', email: 'ada@uql-orm.dev' },
  { id: 5000, name: 'Alan' }, // explicit id, and omits email
]);
// Alan's missing email falls back to its column default.
// ids: PostgreSQL/MariaDB → [1, 5000] · MySQL/SQLite → [undefined, 5000]
```

Records in one `insertMany` batch may provide different subsets of columns: the statement uses the union of columns, and missing cells fall back to the database default (`DEFAULT` keyword; `NULL` on SQLite, which also triggers its auto-generated keys). Batches larger than the dialect's bind-parameter limit are split into multiple statements automatically; wrap the call in a [transaction](/querying/transactions) if all-or-nothing behavior matters across such splits.

---

### Pool API

The pool manages the connection lifecycle. These are the main `pool` methods:

| Method                          | Description                                                                 |
| :------------------------------ | :-------------------------------------------------------------------------- |
| `pool.withQuerier(callback)`    | Acquire a querier, run `callback`, and auto-release, even on errors.       |
| `pool.transaction(callback)`    | Like `withQuerier`, but wraps the callback in a transaction.                |
| `pool.getQuerier()`             | Manually acquire a querier. **You must call `querier.release()`** yourself. |
| `pool.findMany(...)` and the other reads | Run a single read on its own connection - see [parallel reads](#choosing-poolx-vs-querierx) below. |
| [`pool.all(sql, values?)` / `pool.run(sql, values?)`](/querying/raw-sql#raw-sql-on-the-pool) | Run one [raw SQL](/querying/raw-sql) statement on its own connection (SQL pools only). |
| `pool.end()`                    | Gracefully shut down the pool (close all connections).                      |

:::tip
Always prefer `pool.withQuerier()` or `pool.transaction()` for multi-statement work. They guarantee the connection is released. Use `pool.getQuerier()` only when you need manual lifecycle control (e.g., long-lived operations).
:::

### Choosing: `pool.x` vs. `querier.x`

`pool.findMany(User, q)` is exactly `pool.withQuerier((querier) => querier.findMany(User, q))`: the pool runs a **single statement** as its own unit of work (acquire a connection, run, release). A `querier` is the handle you get **inside** a `withQuerier` / `transaction` callback, where several statements share one connection.

| You're running… | Use | Why |
| :-- | :-- | :-- |
| A single read | `pool.findMany` / `findOne` / `findOneById` / `findManyAndCount` / `count` / `aggregate` (or [`pool.all`](/querying/raw-sql#raw-sql-on-the-pool) for raw SQL) | Connection acquired and released per call, so `Promise.all` runs them on separate connections in parallel |
| Multiple statements, or **any write** | `pool.withQuerier((querier) => …)` | Writes touch relations across several statements, so they need one pinned connection |
| Work that must be all-or-nothing | `pool.transaction((querier) => …)` | Same pinned connection, plus begin / commit / rollback |

Independent reads on the pool run in parallel; the same calls inside one `withQuerier` share a pinned connection and queue:

```ts title="Two connections, in parallel"
const [invoices, total] = await Promise.all([
  pool.findMany(Invoice, { $where: { paid: false } }),
  pool.count(Invoice, {}),
]);
```

```ts title="One pinned connection - queries serialize"
await pool.withQuerier((querier) =>
  Promise.all([querier.findMany(Invoice, {}), querier.count(Invoice, {})]),
);
```

An enclosing [`withContext`](/multi-tenancy) scopes pool reads like any other query, so one wrapper covers a whole parallel fan-out:

```ts
await withContext({ tenantId }, () =>
  Promise.all([pool.findMany(Invoice, {}), pool.count(Invoice, {})]),
);
```

:::note
- Pool reads take the entity-as-argument form only; for the `{ $entity }` form or [streaming](/querying/streaming), use `withQuerier`.
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

```sql title="Generated SQL (PostgreSQL / CockroachDB)"
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

:::note[Insert-vs-update detection]
The result's `created` field (see [Raw SQL](/querying/raw-sql#run)) reports `true`/`false` on Postgres and MySQL only. CockroachDB has no equivalent to Postgres's `xmax` system column, so `created` is always `undefined` there - `upsertOne`/`upsertMany` themselves work the same as everywhere else.
:::
