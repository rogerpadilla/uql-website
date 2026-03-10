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
