---
title: Raw SQL
sidebar:
  order: 170
description: Execute vanilla SQL queries with type safety using all() and run().
---

Sometimes you need full control over your queries. UQL provides `all()` and `run()` for executing vanilla SQL while maintaining type safety through generics.

:::caution[Raw SQL is not scoped by filters or context]
[Query filters](/querying/filters) - including `security` filters and [soft-delete](/entities/soft-delete) - and the [multi-tenancy](/multi-tenancy) request context apply only to UQL's query methods, never to `all()` / `run()`. Scope raw queries by hand (note the explicit `WHERE "deletedAt" IS NULL` below), or rely on database-native row-level security for defense in depth.
:::

## Available Methods

| Method | Returns | Use Case |
| :--- | :--- | :--- |
| `all<T>(sql, values?)` | `Promise<T[]>` | `SELECT` queries, reports. |
| `run(sql, values?)` | `Promise<QueryUpdateResult>` | Data manipulation (DML). |

---

## `all()`

Use `all()` when you expect a result set. It accepts a generic type to ensure the returned array is fully typed.

```ts title="Select with Generics"
interface UserCount {
  status: string;
  total: number;
}

const stats = await querier.all<UserCount>(`
  SELECT status, COUNT(*) as total 
  FROM "User" 
  WHERE "deletedAt" IS NULL 
  GROUP BY status
`);

// stats: UserCount[]
```

## `run()`

Use `run()` for `INSERT`, `UPDATE`, or `DELETE` statements (DML) where you only care about the operation's metadata (e.g., affected rows).

```ts title="Update with Parameters"
const result = await querier.run(
  'UPDATE "User" SET "status" = $1 WHERE "id" = $2',
  ['active', 123]
);

console.log(result.changes); // Number of affected rows
```

### Response Metadata

`run()` returns a `QueryUpdateResult` object containing:

*   **`changes`**: Number of rows modified, deleted, or inserted.
*   **`ids`**: Array of inserted IDs (for bulk inserts).
*   **`firstId`**: The first inserted ID.
*   **`created`**: Boolean indicating if a row was created (for `upsert`).

---

## Raw SQL on the Pool

SQL pools expose `all()` and `run()` directly. Each call acquires its own connection, runs the single statement, and releases it - so independent statements fan out in parallel with `Promise.all`, without `withQuerier` ceremony:

```ts title="Two aggregates, two connections, in parallel"
const [payments, usages] = await Promise.all([
  pool.all<{ sum: number }>('SELECT COALESCE(SUM(value), 0) sum FROM "Payment" WHERE "workspaceId" = $1', [id]),
  pool.all<{ sum: number }>('SELECT COALESCE(SUM(cost), 0) sum FROM "Usage" WHERE "workspaceId" = $1', [id]),
]);
```

For multiple statements that must share a connection or run atomically, use `pool.withQuerier()` / `pool.transaction()` and the querier's `all()`/`run()` instead.

---

:::tip
UQL automatically handles parameter binding (e.g., `$1`, `$2` or `?`) to prevent SQL injection. Always pass dynamic inputs as an array in the second parameter.
:::

:::note
While `run()` is available on all queriers, `all<T>()` is specific to SQL-based dialects through the `SqlQuerier` interface - as are `pool.all()` / `pool.run()`, which exist only on SQL pools (`SqlQuerierPool`).
:::
