---
title: Aggregate Queries
sidebar:
  order: 150
description: Use GROUP BY, HAVING, COUNT, SUM, AVG, MIN, MAX, and DISTINCT with UQL's aggregate API.
---

## Aggregate Queries

Use `querier.aggregate()` for analytics that involve `GROUP BY`, aggregate functions, and post-aggregation filtering via `HAVING`. Works identically across **all SQL dialects** and **MongoDB**.

### Basic Usage

```ts title="You write"
const results = await querier.aggregate(Order, {
  $where: { amount: { $gt: 0 } },    // WHERE: filter rows before grouping
  $group: { status: true },          // GROUP BY column(s)
  $agg: {
    total: { $sum: 'amount' },       // SUM("amount") AS "total"
    count: { $count: '*' },          // COUNT(*) AS "count"
  },
  $having: { count: { $gt: 5 } },    // Post-aggregation filter
  $sort: { total: -1 },              // ORDER BY total DESC
  $limit: 10,
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "status", SUM("amount") "total", COUNT(*) "count"
FROM "Order"
WHERE "amount" > $1
GROUP BY "status"
HAVING COUNT(*) > $2
ORDER BY SUM("amount") DESC
LIMIT 10
```

```sql title="Generated SQL (MySQL/MariaDB/SQLite)"
SELECT `status`, SUM(`amount`) `total`, COUNT(*) `count`
FROM `Order`
WHERE `amount` > ?
GROUP BY `status`
HAVING COUNT(*) > ?
ORDER BY SUM(`amount`) DESC
LIMIT 10
```

```json title="Generated MongoDB Pipeline"
[
  { "$match": { "amount": { "$gt": 0 } } },
  { "$group": { "_id": { "status": "$status" }, "total": { "$sum": "$amount" }, "count": { "$sum": 1 } } },
  { "$project": { "_id": 0, "status": "$_id.status", "total": 1, "count": 1 } },
  { "$match": { "count": { "$gt": 5 } } },
  { "$sort": { "total": -1 } },
  { "$limit": 10 }
]
```

> There is no `$select` in `aggregate()` - the output columns are exactly the `$group` columns plus the `$agg` aliases.

### `$group` and `$agg`

`$group` lists the columns to group by; `$agg` defines the computed columns, each under an alias you choose. Keeping them separate makes both fully type-safe: `$group` keys are checked against your entity's fields (like `$select`), and the field references inside `$agg` are typed too, so a typo is a compile error.

**`$group`** - grouping columns (`GROUP BY`):

- **`{ status: true }`**: `GROUP BY "status"`

**`$agg`** - computed columns (`alias → aggregate function`):

- **`{ $count: '*' }`**: `COUNT(*)` (every row)
- **`{ $count: 'field' }`**: `COUNT("field")` (non-null values only)
- **`{ $sum: 'field' }`**: `SUM("field")`
- **`{ $avg: 'field' }`**: `AVG("field")`
- **`{ $min: 'field' }`**: `MIN("field")`
- **`{ $max: 'field' }`**: `MAX("field")`
- **`{ $countDistinct: 'field' }`**: `COUNT(DISTINCT "field")`
- **`{ $sumDistinct: 'field' }`**: `SUM(DISTINCT "field")`
- **`{ $avgDistinct: 'field' }`**: `AVG(DISTINCT "field")`

`{ $count: '*' }` counts every row; `{ $count: 'field' }` counts only rows where the field is non-null - identical on SQL (`COUNT("field")`) and MongoDB.

Both keys are optional: use `$group` alone for a `DISTINCT`-style query, or `$agg` alone for a grand total across all rows.

#### Distinct aggregates

Use the flat `$countDistinct` / `$sumDistinct` / `$avgDistinct` ops to aggregate over a field's distinct values - e.g. how many distinct customers ordered per status:

```ts title="You write"
const results = await querier.aggregate(Order, {
  $group: { status: true },
  $agg: { customers: { $countDistinct: 'customerId' } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "status", COUNT(DISTINCT "customerId") "customers"
FROM "Order"
GROUP BY "status"
```

On MongoDB this compiles to `$addToSet` + a `$project` reducer (`$size` for `$countDistinct`, `$sum`/`$avg` for `$sumDistinct`/`$avgDistinct`), so the result is identical across dialects. DISTINCT applies only to these numeric aggregates; `$min`/`$max` have no distinct variant.

```ts title="You write"
// Total revenue with no grouping
const [{ revenue }] = await querier.aggregate(Order, {
  $agg: { revenue: { $sum: 'amount' } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT SUM("amount") "revenue" FROM "Order"
```

```sql title="Generated SQL (MySQL/MariaDB/SQLite)"
SELECT SUM(`amount`) `revenue` FROM `Order`
```

### `$where` vs `$having`

- **[`$where`](/querying/filters)**: Filters rows **before** grouping (`WHERE` clause).
- **[`$having`](#having-operators)**: Filters groups **after** aggregation (`HAVING` clause).

```ts title="You write"
const results = await querier.aggregate(Order, {
  $where: { createdAt: { $gte: new Date('2025-01-01') } },
  $group: { status: true },
  $agg: { count: { $count: '*' } },
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

The `$having` map supports the same [comparison operators](/querying/comparison-operators) as `$where`:

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
  $group: { status: true },
  $agg: { count: { $count: '*' } },
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
`$distinct` is a modifier on [`findMany`](/querying/querier), not part of the `aggregate()` API. Use `aggregate()` when you need `GROUP BY`, aggregate functions, or `HAVING` filters.
:::

---

## Next Steps

- [Querier API](/querying/querier): Full find/select/sort/pagination reference.
- [Filters (`$where`)](/querying/filters): Filter rows before grouping.
- [Comparison Operators](/querying/comparison-operators): Every operator usable in `$having`.
- [Sub-Queries](/querying/sub-queries): Correlated sub-queries and raw SQL fragments.
