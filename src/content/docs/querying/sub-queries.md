---
title: Sub-Queries
sidebar:
  order: 165
description: This tutorial explains how to use sub-queries with the UQL orm.
---

## Sub-Queries

UQL provides a powerful way to write sub-queries using `raw` expressions that interact directly with the `QueryContext`. These expressions allow you to inject raw SQL fragments while still benefiting from UQL's parameterization and dialect-aware engine.

### Using `raw` in `$where`

The simplest use of a sub-query is adding a raw SQL condition to your `$where` clause.

```ts title="You write"
import { raw } from 'uql-orm';
import { Item } from './shared/models/index.js';

const items = await querier.findMany(Item, {
  $select: { id: true },
  $where: { 
    $and: [
      { companyId: 1 }, 
      raw('SUM(salePrice) > 500') 
    ] 
  }
});
```

```sql title="Generated SQL"
SELECT "id" FROM "Item" WHERE "companyId" = 1 AND SUM(salePrice) > 500
```

### Advanced: Context-Aware Sub-Queries (`$exists`)

For complex sub-queries like `EXISTS` or `IN`, you can pass a callback to `raw`. This callback provides access to the `QueryContext` and the `dialect`, allowing you to generate sub-queries that are correctly prefixed and compatible with your database.

```ts title="You write"
import { raw } from 'uql-orm';
import { User, Item } from './shared/models/index.js';

const items = await querier.findMany(Item, {
  $select: { id: true },
  $where: {
    $nexists: raw(({ ctx, dialect, escapedPrefix }) => {
      // Use the dialect to generate a nested SELECT statement
      dialect.find(
        ctx,
        User,
        {
          $select: { id: true },
          // Reference the parent table's prefix safely
          $where: { companyId: raw(({ ctx }) => ctx.append(`${escapedPrefix}.companyId`)) },
        },
        { autoPrefix: true }
      );
    }),
  },
});
```


```sql title="Generated SQL"
SELECT "id"
FROM "Item"
WHERE NOT EXISTS
    (SELECT "User"."id" FROM "User" WHERE "User"."companyId" = "Item"."companyId")
```

:::tip
When using `raw` callbacks, `escapedPrefix` automatically refers to the alias of the current table in the main query, ensuring your sub-query correctly joins back to the parent record.
:::

---

### Understanding `raw()`

The `raw()` function from `uql-orm` injects SQL fragments into queries. It has two forms:

| Form | Syntax | Use Case |
| :--- | :--- | :--- |
| **String** | `raw('SQL fragment')` | Simple expressions (e.g., `raw('SUM(price) > 100')`). |
| **Callback** | `raw(({ ctx, dialect, escapedPrefix }) => { ... })` | Complex sub-queries that need dialect-aware SQL generation. |

The callback receives:

- **`ctx`** — the `QueryContext` for building parameterized SQL via `ctx.append(sql)` and `ctx.value(val)`.
- **`dialect`** — the current SQL dialect instance for generating nested queries (e.g., `dialect.find(...)`).
- **`escapedPrefix`** — the escaped alias of the parent table, used to reference parent columns in correlated sub-queries.
