---
title: Comparison Operators
sidebar:
  order: 130
description: This tutorial explains how to use comparison operators with the UQL orm.
---

## Comparison Operators

UQL provide a comprehensive set of operators for comparing field values. These operators are context-aware, meaning they are typed according to the field they are applied to.

| Name           | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `$eq`          | Equal to.                                                                          |
| `$ne`          | Not equal to.                                                                      |
| `$lt`          | Less than.                                                                         |
| `$lte`         | Less than or equal to.                                                             |
| `$gt`          | Greater than.                                                                      |
| `$gte`         | Greater than or equal to.                                                          |
| `$startsWith`  | Starts with (case-sensitive).                                                      |
| `$istartsWith` | Starts with (case-insensitive).                                                    |
| `$endsWith`    | Ends with (case-sensitive).                                                        |
| `$iendsWith`   | Ends with (case-insensitive).                                                      |
| `$includes`    | Contains substring (case-sensitive).                                               |
| `$iincludes`   | Contains substring (case-insensitive).                                             |
| `$in`          | Value matches any in a given array.                                                |
| `$nin`         | Value does not match any in a given array.                                         |
| `$between`     | Value is between two bounds (inclusive). E.g. `{ age: { $between: [18, 65] } }`.   |
| `$isNull`      | Field is null. E.g. `{ deletedAt: { $isNull: true } }`.                           |
| `$isNotNull`   | Field is not null. E.g. `{ email: { $isNotNull: true } }`.                        |
| `$all`         | Array contains all specified values. E.g. `{ tags: { $all: ['ts', 'orm'] } }`.    |
| `$size`        | Array has the specified length. E.g. `{ tags: { $size: 3 } }`.                    |
| `$elemMatch`   | Array contains an element matching the condition. E.g. `{ addresses: { $elemMatch: { city: 'NYC' } } }`. |
| `$text`        | Full-text search (where supported by the database).                                |

&nbsp;

### Practical Example

```ts title="You write"
import { User } from './shared/models/index.js';

const users = await querier.findMany(User, {
  $select: { id: true, name: true },
  $where: { 
    name: { $istartsWith: 'Some', $ne: 'Something' },
    age: { $gte: 18, $lte: 65 }
  },
  $sort: { name: 'asc' },
  $limit: 50
});
```


### Context-Aware SQL Generation

UQL transparently handles the differences between database vendors. For example, `$istartsWith` is translated to `ILIKE` in PostgreSQL, but to `LOWER(field) LIKE 'some%'` in MySQL.

```sql title="Generated SQL (PostgreSQL)"
SELECT "id", "name" FROM "User"
WHERE ("name" ILIKE $1 AND "name" <> $2) AND ("age" >= $3 AND "age" <= $4)
ORDER BY "name"
LIMIT 50
```

```sql title="Generated SQL (MySQL/SQLite)"
SELECT `id`, `name` FROM `User`
WHERE (LOWER(`name`) LIKE ? AND `name` <> ?) AND (`age` >= ? AND `age` <= ?)
ORDER BY `name`
LIMIT 50
```

&nbsp;

### JSONB Dot-Notation Operators

All comparison operators listed above also work on nested JSON field paths using **dot-notation** (e.g., `'settings.isArchived': { $ne: true }`). UQL generates dialect-specific SQL automatically across PostgreSQL, MySQL, and SQLite.

See the dedicated [JSON / JSONB](/querying/json) page for full documentation including filtering, `$merge`/`$unset` update operators, and sorting by JSON paths.
