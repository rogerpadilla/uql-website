---
title: Logical Operators
sidebar:
  order: 110
description: This tutorial explains how to use logical operators with the UQL orm.
---

## Logical Operators

Logical operators allow you to combine multiple conditions in a single query. UQL uses a MongoDB-inspired syntax that is 100% valid JSON.

| Name   | Description                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------- |
| `$and` | joins query clauses with a logical `AND` (default).                                            |
| `$or`  | joins query clauses with a logical `OR`, returns records that match any clause.                |
| `$not` | negates the given clause.                                                                      |
| `$nor` | joins query clauses with a logical `OR` and then negates the result.                           |

&nbsp;

### Implicit vs Explicit `$and`

The `$and` operator is implicit when you specify multiple fields in the `$where` object.

```ts title="You write"
import { User } from './shared/models/index.js';

// Implicit AND
const users = await querier.findMany(User, {
  $where: { name: 'roger', status: 'active' },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "User" WHERE "name" = $1 AND "status" = $2
```

The same query with an explicit `$and`:

```ts title="You write"
const users = await querier.findMany(User, {
  $where: { 
    $and: [{ name: 'roger' }, { status: 'active' }] 
  },
});
```

```sql title="Generated SQL (PostgreSQL)"
-- Same result as implicit AND
SELECT * FROM "User" WHERE "name" = $1 AND "status" = $2
```

### Complex Logical Nesting

Logical operators can be nested to create complex filters.

```ts title="You write"
const users = await querier.findMany(User, {
  $where: { 
    $or: [
      { name: { $istartsWith: 'A' } },
      { 
        $and: [
          { status: 'pending' },
          { createdAt: { $lt: new Date('2025-01-01') } }
        ]
      }
    ]
  },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "User"
WHERE "name" ILIKE $1
   OR ("status" = $2 AND "createdAt" < $3)
```

### `$not` — Negate a Condition

`$not` wraps conditions with `NOT`. It can be used at the **field level** or at the **top level** as an array of clauses.

```ts title="Field-level $not"
const users = await querier.findMany(User, {
  $where: { 
    status: 'active',
    name: { $not: { $startsWith: 'test' } },
  },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "User"
WHERE "status" = $1 AND NOT ("name" LIKE $2)
```

```ts title="Top-level $not"
const users = await querier.findMany(User, {
  $where: { 
    $not: [{ name: 'admin' }, { status: 'banned' }],
  },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "User"
WHERE NOT ("name" = $1 AND "status" = $2)
```

### `$nor` — Negate an `OR`

`$nor` negates combined `OR` conditions — records match only if **none** of the clauses are true.

```ts title="You write"
const users = await querier.findMany(User, {
  $where: { 
    $nor: [{ name: 'admin' }, { status: 'banned' }],
  },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "User"
WHERE NOT ("name" = $1 OR "status" = $2)
```

