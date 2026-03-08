---
title: JSON / JSONB
sidebar:
  order: 160
  badge:
    text: New
    variant: success
description: Work with JSON/JSONB fields — type-safe filtering, atomic updates, and sorting across PostgreSQL, MySQL, and SQLite.
---

UQL provides first-class support for JSON/JSONB fields across **PostgreSQL**, **MySQL**, and **SQLite**. Query, update, and sort by nested JSON properties using a consistent, type-safe API — UQL generates dialect-specific SQL automatically.

## Entity Setup

Wrap JSONB field types with `Json<T>` to enable full type safety — IDE autocompletion for dot-notation paths, `$merge` keys, and `$unset` keys.

```ts
import { Entity, Id, Field, Json } from 'uql-orm';

@Entity()
export class Company {
  @Id()
  id?: number;

  @Field()
  name?: string;

  @Field({ type: 'jsonb' })
  kind?: Json<{ public?: number; private?: number }>;

  @Field({ type: 'jsonb' })
  settings?: Json<{ isArchived?: boolean; theme?: string; locale?: string }>;
}
```

:::tip[Why `Json<T>`?]
Without `Json<T>`, plain object types like `{ public?: number }` are classified as `RelationKey` instead of `FieldKey`, breaking usage in `$where`, `$select`, `$sort`, and `$merge`. The `Json<T>` marker type solves this cleanly.
:::

---

## Filtering (Dot-Notation)

Query nested JSON properties using dot-notation paths in `$where`. All [comparison operators](/querying/comparison-operators) are supported.

```ts
const companies = await querier.findMany(Company, {
  $where: {
    'settings.isArchived': { $ne: true },
    'settings.theme': 'dark',
  },
});
```

**PostgreSQL:**
```sql
SELECT * FROM "Company"
WHERE ("settings"->>'isArchived') IS DISTINCT FROM $1
  AND "settings"->>'theme' = $2
```

**MySQL:**
```sql
SELECT * FROM `Company`
WHERE JSON_EXTRACT(`settings`, '$.isArchived') <> ?
  AND JSON_EXTRACT(`settings`, '$.theme') = ?
```

**SQLite:**
```sql
SELECT * FROM `Company`
WHERE json_extract(`settings`, '$.isArchived') IS NOT ?
  AND json_extract(`settings`, '$.theme') = ?
```

:::note[Null-Safe `$ne`]
JSONB `$ne` uses null-safe operators (`IS DISTINCT FROM` on PostgreSQL, `IS NOT` on SQLite) so absent keys (SQL `NULL`) are correctly included in results.
:::

---

## Updating (`$merge` / `$unset`)

Atomically merge or remove keys in JSON fields directly from update payloads. No need to overwrite the entire JSON value.

### `$merge` — Partial Update

Merge new key-value pairs into an existing JSON field. Existing keys not in `$merge` are preserved.

```ts
await querier.updateOneById(Company, id, {
  kind: { $merge: { public: 1 } },
});
```

**PostgreSQL:**
```sql
UPDATE "Company" SET "kind" = COALESCE("kind", '{}') || $1::jsonb WHERE "id" = $2
-- values: ['{"public":1}', id]
```

**MySQL:**
```sql
UPDATE `Company` SET `kind` = JSON_MERGE_PATCH(COALESCE(`kind`, '{}'), ?) WHERE `id` = ?
-- values: ['{"public":1}', id]
```

**SQLite:**
```sql
UPDATE `Company` SET `kind` = json_patch(COALESCE(`kind`, '{}'), ?) WHERE `id` = ?
-- values: ['{"public":1}', id]
```

### `$unset` — Remove Keys

Remove specific keys from a JSON field.

```ts
await querier.updateOneById(Company, id, {
  kind: { $unset: ['private'] },
});
```

**PostgreSQL:**
```sql
UPDATE "Company" SET "kind" = ("kind") - 'private' WHERE "id" = $1
```

**MySQL:**
```sql
UPDATE `Company` SET `kind` = JSON_REMOVE(`kind`, '$.private') WHERE `id` = ?
```

**SQLite:**
```sql
UPDATE `Company` SET `kind` = json_remove(`kind`, '$.private') WHERE `id` = ?
```

### Combined `$merge` + `$unset`

Both operations can be combined in a single update.

```ts
await querier.updateOneById(Company, id, {
  kind: { $merge: { public: 1 }, $unset: ['private'] },
});
```

:::caution[Array Merging]
`$merge` uses RFC 7396 (`JSON_MERGE_PATCH`) under the hood in MySQL and SQLite. This means **arrays are replaced entirely**, not appended to. If `kind` contains an array like `tags: ['a']`, merging `{ tags: ['x'] }` results in `tags: ['x']`, not `tags: ['a', 'x']`.
:::

:::tip[Type Safety]
Both `$merge` keys and `$unset` keys are validated against the JSON field's inner type `T` (from `Json<T>`). The IDE will autocomplete valid keys and reject invalid ones at compile time.
:::

---

## Sorting (Dot-Notation)

Sort by nested JSON field values using the same dot-notation syntax.

```ts
const companies = await querier.findMany(Company, {
  $sort: { 'kind.public': 'desc' },
});
```

**PostgreSQL:**
```sql
SELECT * FROM "Company" ORDER BY "kind"->>'public' DESC
```

**MySQL:**
```sql
SELECT * FROM `Company` ORDER BY JSON_EXTRACT(`kind`, '$.public') DESC
```

**SQLite:**
```sql
SELECT * FROM `Company` ORDER BY json_extract(`kind`, '$.public') DESC
```

---

## Supported Dialects

All JSON features work across three SQL dialects:

| Feature                | PostgreSQL     | MySQL                | SQLite           |
| ---------------------- | -------------- | -------------------- | ---------------- |
| Dot-notation filtering | `->>'key'`     | `JSON_EXTRACT()`     | `json_extract()` |
| `$merge`               | `\|\| ::jsonb` | `JSON_MERGE_PATCH()` | `json_patch()`   |
| `$unset`               | `- 'key'`      | `JSON_REMOVE()`      | `json_remove()`  |
| Dot-notation sorting   | `->>'key'`     | `JSON_EXTRACT()`     | `json_extract()` |

:::note
MongoDB stores JSON natively — no special operators are needed. These features are specifically designed for SQL databases where JSON is stored in dedicated column types.
:::
