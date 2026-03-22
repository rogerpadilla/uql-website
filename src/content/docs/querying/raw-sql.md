---
title: Raw SQL
sidebar:
  order: 109
  badge:
    text: New
    variant: success
description: Execute vanilla SQL queries with type safety using all() and run().
---

Sometimes you need full control over your queries. UQL provides `all()` and `run()` for executing vanilla SQL while maintaining type safety through generics.

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

:::tip
UQL automatically handles parameter binding (e.g., `$1`, `$2` or `?`) to prevent SQL injection. Always pass dynamic inputs as an array in the second parameter.
:::

:::note
While `run()` is available on all queriers, `all<T>()` is specific to SQL-based dialects through the `SqlQuerier` interface.
:::
