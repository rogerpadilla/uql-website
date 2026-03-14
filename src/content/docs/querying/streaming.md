---
title: Streaming
sidebar:
  order: 108
description: Memory-efficient cursor-based streaming for large result sets using findManyStream.
---

## Cursor Streaming

`findManyStream()` returns an `AsyncIterable` that yields records **one at a time** using native database cursors. Unlike `findMany()`, it never loads the entire result set into memory — ideal for exports, ETL pipelines, or any query that could return thousands of rows.

### Basic Example

```ts title="You write"
import { pool } from './uql.config.js';
import { Order } from './shared/models/index.js';

await pool.withQuerier(async (querier) => {
  for await (const order of querier.findManyStream(Order, {
    $select: { id: true, total: true, status: true },
    $where: { status: 'completed' },
    $sort: { createdAt: 'desc' },
  })) {
    // Each `order` is yielded individually — constant memory usage
    await writeToCSV(order);
  }
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "id", "total", "status" FROM "Order"
WHERE "status" = $1
ORDER BY "createdAt" DESC
```

```sql title="Generated SQL (MySQL/MariaDB)"
SELECT `id`, `total`, `status` FROM `Order`
WHERE `status` = ?
ORDER BY `createdAt` DESC
```

### How It Works Per Driver

Every supported driver uses its **native cursor/streaming API** — no polyfills, no buffering:

| Driver       | Mechanism                                   |
| :----------- | :------------------------------------------ |
| PostgreSQL   | [`pg-query-stream`](https://www.npmjs.com/package/pg-query-stream) (server-side cursor) |
| MariaDB      | `connection.queryStream()` (native stream)  |
| MySQL        | `connection.query().stream()` (native stream) |
| SQLite       | `statement.iterate()` (step-based iteration) |
| MongoDB      | Native `FindCursor` async iteration          |


### When to Use Streaming vs `findMany`

| Scenario                                 | Use                 |
| :--------------------------------------- | :------------------ |
| Display a paginated list (10-100 rows)   | `findMany`          |
| Export 100K+ rows to CSV/JSON            | `findManyStream`    |
| ETL pipeline (transform + write)         | `findManyStream`    |
| Aggregate in-app (sum, group)            | `aggregate`         |
| Real-time feed with backpressure         | `findManyStream`    |

:::note
`findManyStream` yields **flat rows only** — it skips relation-filling and lifecycle hooks for maximum streaming performance. If you need joins, use `findMany` with `$select` on relations instead.
:::

### RPC-Friendly Syntax

Like all query methods, `findManyStream` supports the `$entity` call pattern for easy serialization:

```ts
for await (const user of querier.findManyStream({
  $entity: User,
  $select: { id: true, email: true },
  $where: { status: 'active' },
})) {
  process(user);
}
```
