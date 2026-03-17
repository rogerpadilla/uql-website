---
title: Aggregate Queries
sidebar:
  order: 107
  badge:
    text: New
    variant: success
description: Use GROUP BY, HAVING, COUNT, SUM, AVG, MIN, MAX, and DISTINCT with UQL's aggregate API.
---

## Aggregate Queries

Use `querier.aggregate()` for analytics that involve `GROUP BY`, aggregate functions, and post-aggregation filtering via `HAVING`. Works identically across **all SQL dialects** and **MongoDB**.

### Basic Usage

```ts title="You write"
const results = await querier.aggregate(Order, {
  $group: {
    status: true,                    // GROUP BY column
    total: { $sum: 'amount' },       // SUM("amount") AS "total"
    count: { $count: '*' },          // COUNT(*) AS "count"
  },
  $having: { count: { $gt: 5 } },   // Post-aggregation filter
  $sort: { total: -1 },             // ORDER BY total DESC
  $limit: 10,
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "status", SUM("amount") "total", COUNT(*) "count"
FROM "Order"
GROUP BY "status"
HAVING COUNT(*) > $1
ORDER BY SUM("amount") DESC
LIMIT 10
```

```sql title="Generated SQL (MySQL/MariaDB)"
SELECT `status`, SUM(`amount`) `total`, COUNT(*) `count`
FROM `Order`
GROUP BY `status`
HAVING COUNT(*) > ?
ORDER BY SUM(`amount`) DESC
LIMIT 10
```

```sql title="Generated SQL (SQLite)"
SELECT `status`, SUM(`amount`) `total`, COUNT(*) `count`
FROM `Order`
GROUP BY `status`
HAVING COUNT(*) > ?
ORDER BY SUM(`amount`) DESC
LIMIT 10
```

```json title="Generated MongoDB Pipeline"
[
  { "$group": { "_id": { "status": "$status" }, "total": { "$sum": "$amount" }, "count": { "$sum": 1 } } },
  { "$project": { "_id": 0, "status": "$_id.status", "total": 1, "count": 1 } },
  { "$match": { "count": { "$gt": 5 } } },
  { "$sort": { "total": -1 } },
  { "$limit": 10 }
]
```

### `$group`

The `$group` map defines both the grouping columns and the aggregate functions. Each key becomes an alias in the result.

- **`true`** — Group by this column (`GROUP BY "column"`)
- **`{ $count: '*' }`** — `COUNT(*)`
- **`{ $sum: 'field' }`** — `SUM("field")`
- **`{ $avg: 'field' }`** — `AVG("field")`
- **`{ $min: 'field' }`** — `MIN("field")`
- **`{ $max: 'field' }`** — `MAX("field")`

```ts title="You write"
// Total revenue with no grouping
const [{ revenue }] = await querier.aggregate(Order, {
  $group: { revenue: { $sum: 'amount' } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT SUM("amount") "revenue" FROM "Order"
```

```sql title="Generated SQL (MySQL/MariaDB/SQLite)"
SELECT SUM(`amount`) `revenue` FROM `Order`
```

### `$where` vs `$having`

- **`$where`** — Filters rows **before** grouping (`WHERE` clause).
- **`$having`** — Filters groups **after** aggregation (`HAVING` clause).

```ts title="You write"
const results = await querier.aggregate(Order, {
  $group: {
    status: true,
    count: { $count: '*' },
  },
  $where: { createdAt: { $gte: new Date('2025-01-01') } },
  $having: { count: { $gt: 10 } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "status", COUNT(*) "count"
FROM "Order"
WHERE "createdAt" >= $1
GROUP BY "status"
HAVING COUNT(*) > $2
```

```sql title="Generated SQL (MySQL/MariaDB/SQLite)"
SELECT `status`, COUNT(*) `count`
FROM `Order`
WHERE `createdAt` >= ?
GROUP BY `status`
HAVING COUNT(*) > ?
```

### `$having` Operators

The `$having` map supports the same comparison operators as `$where`:

| Operator | SQL | Example |
| :--- | :--- | :--- |
| `$eq` | `=` | `{ count: 5 }` or `{ count: { $eq: 5 } }` |
| `$ne` | `<>` | `{ count: { $ne: 0 } }` |
| `$gt` / `$gte` | `>` / `>=` | `{ total: { $gte: 100 } }` |
| `$lt` / `$lte` | `<` / `<=` | `{ avg: { $lt: 50 } }` |
| `$between` | `BETWEEN` | `{ count: { $between: [5, 20] } }` |
| `$in` / `$nin` | `IN` / `NOT IN` | `{ count: { $in: [1, 5, 10] } }` |
| `$isNull` | `IS NULL` | `{ maxVal: { $isNull: true } }` |
| `$isNotNull` | `IS NOT NULL` | `{ maxVal: { $isNotNull: true } }` |

### Sorting, Pagination

Aggregate results can be sorted by any alias and paginated using `$skip` and `$limit`:

```ts title="You write"
const results = await querier.aggregate(User, {
  $group: {
    status: true,
    count: { $count: '*' },
  },
  $sort: { count: -1 },
  $skip: 20,
  $limit: 10,
});
```

### `$distinct`

For simple `SELECT DISTINCT` queries (without aggregation), add `$distinct: true` to any find query:

```ts title="You write"
const names = await querier.findMany(User, {
  $select: { name: true },
  $distinct: true,
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT DISTINCT "name" FROM "User"
```

```sql title="Generated SQL (MySQL/MariaDB/SQLite)"
SELECT DISTINCT `name` FROM `User`
```

:::tip
`$distinct` is a modifier on `findMany`, not part of the `aggregate()` API. Use `aggregate()` when you need `GROUP BY`, aggregate functions, or `HAVING` filters.
:::
