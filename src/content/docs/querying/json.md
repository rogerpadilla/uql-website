---
title: JSON / JSONB
sidebar:
  order: 160
  badge:
    text: New
    variant: success
description: Work with JSON/JSONB fields — type-safe filtering, atomic updates, and sorting across PostgreSQL, MySQL, MariaDB, and SQLite.
---

UQL provides first-class support for JSON/JSONB fields across **PostgreSQL**, **MySQL**, **MariaDB**, and **SQLite**. Query, update, and sort by nested JSON properties using a consistent, type-safe API — UQL generates dialect-specific SQL automatically.

## Entity Setup

Wrap JSONB field types with `Json<T>` to enable full type safety — IDE autocompletion for dot-notation paths, `$merge` keys, `$unset` keys, and `$push` targets.

```ts
import { Entity, Id, Field, Json } from 'uql-orm';

@Entity()
export class Company {
  @Id()
  id?: number;

  @Field()
  name?: string;

  @Field({ type: 'jsonb' })
  kind?: Json<{ public?: number; private?: number; tags?: string[] }>;

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

```ts title="You write"
const companies = await querier.findMany(Company, {
  $where: {
    'settings.isArchived': { $ne: true },
    'settings.theme': 'dark',
  },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "Company"
WHERE ("settings"->>'isArchived') IS DISTINCT FROM $1
  AND "settings"->>'theme' = $2
```

```sql title="Generated SQL (MySQL)"
SELECT * FROM `Company`
WHERE (`settings`->>'isArchived') <> ?
  AND (`settings`->>'theme') = ?
```

```sql title="Generated SQL (MariaDB)"
SELECT * FROM `Company`
WHERE JSON_VALUE(`settings`, '$.isArchived') <> ?
  AND JSON_VALUE(`settings`, '$.theme') = ?
```

```sql title="Generated SQL (SQLite)"
SELECT * FROM `Company`
WHERE json_extract(`settings`, '$.isArchived') IS NOT ?
  AND json_extract(`settings`, '$.theme') = ?
```

:::note[Null-Safe `$ne`]
For PostgreSQL and SQLite, JSON-path `$ne` uses null-safe operators (`IS DISTINCT FROM` and `IS NOT`) so absent keys (SQL `NULL`) are correctly included in results.
:::

:::note[MariaDB JSON Path Access]
MariaDB does not support MySQL's `->` / `->>` JSON shorthand operators. UQL uses `JSON_VALUE()` for MariaDB dot-notation filtering and sorting to keep SQL fully native and compatible.
:::

---

## Updating (`$merge` / `$unset` / `$push`)

Atomically merge or remove keys in JSON fields directly from update payloads. No need to overwrite the entire JSON value.

### `$merge` — Partial Update

Merge new key-value pairs into an existing JSON field. Existing keys not in `$merge` are preserved.

```ts title="You write"
await querier.updateOneById(Company, id, {
  kind: { $merge: { public: 1 } },
});
```

```sql title="Generated SQL (PostgreSQL)"
UPDATE "Company" SET "kind" = COALESCE("kind", '{}') || $1::jsonb WHERE "id" = $2
-- values: ['{"public":1}', id]
```

```sql title="Generated SQL (MySQL)"
UPDATE `Company` SET `kind` = JSON_SET(COALESCE(`kind`, '{}'), '$.public', CAST(? AS JSON)) WHERE `id` = ?
-- values: ['1', id]
```

```sql title="Generated SQL (MariaDB)"
UPDATE `Company` SET `kind` = JSON_SET(COALESCE(`kind`, '{}'), '$.public', CAST(? AS JSON)) WHERE `id` = ?
-- values: ['1', id]
```

```sql title="Generated SQL (SQLite)"
UPDATE `Company` SET `kind` = json_set(COALESCE(`kind`, '{}'), '$.public', json(?)) WHERE `id` = ?
-- values: ['1', id]
```

### `$unset` — Remove Keys

Remove specific keys from a JSON field.

```ts title="You write"
await querier.updateOneById(Company, id, {
  kind: { $unset: ['private'] },
});
```

```sql title="Generated SQL (PostgreSQL)"
UPDATE "Company" SET "kind" = ("kind") - 'private' WHERE "id" = $1
```

```sql title="Generated SQL (MySQL)"
UPDATE `Company` SET `kind` = JSON_REMOVE(`kind`, '$.private') WHERE `id` = ?
```

```sql title="Generated SQL (MariaDB)"
UPDATE `Company` SET `kind` = JSON_REMOVE(`kind`, '$.private') WHERE `id` = ?
```

```sql title="Generated SQL (SQLite)"
UPDATE `Company` SET `kind` = json_remove(`kind`, '$.private') WHERE `id` = ?
```

### `$push` — Append to Array

Append a value to the end of a JSON array using native array-append functions. Only keys whose type is an array are valid `$push` targets (type-checked at compile time).

```ts title="You write"
await querier.updateOneById(Company, id, {
  kind: { $push: { tags: 'new-tag' } },
});
```

```sql title="Generated SQL (PostgreSQL)"
UPDATE "Company" SET "kind" = jsonb_set("kind", '{tags}', COALESCE("kind"->'tags', '[]'::jsonb) || jsonb_build_array($1::jsonb)) WHERE "id" = $2
-- values: ['"new-tag"', id]
```

```sql title="Generated SQL (MySQL)"
UPDATE `Company` SET `kind` = JSON_ARRAY_APPEND(`kind`, '$.tags', CAST(? AS JSON)) WHERE `id` = ?
-- values: ['"new-tag"', id]
```

```sql title="Generated SQL (MariaDB)"
UPDATE `Company` SET `kind` = JSON_ARRAY_APPEND(`kind`, '$.tags', CAST(? AS JSON)) WHERE `id` = ?
-- values: ['"new-tag"', id]
```

```sql title="Generated SQL (SQLite)"
UPDATE `Company` SET `kind` = json_insert(`kind`, '$.tags[#]', json(?)) WHERE `id` = ?
-- values: ['"new-tag"', id]
```

### Combining Operators

`$merge`, `$unset`, and `$push` can be freely combined in a single update.

```ts title="You write"
await querier.updateOneById(Company, id, {
  kind: { $merge: { public: 1 }, $push: { tags: 'new-tag' }, $unset: ['private'] },
});
```

:::caution[Array Merging]
`$merge` uses **shallow, top-level key overwrite** semantics — arrays are replaced entirely, not appended to. To append elements to a JSON array, use `$push` instead.
:::

:::tip[Type Safety]
`$merge` keys, `$unset` keys, and `$push` targets are all validated against the JSON field's inner type `T` (from `Json<T>`). The IDE will autocomplete valid keys and reject invalid ones at compile time. `$push` additionally restricts targets to array-typed keys and expects the array's element type as the value.
:::

---

## Sorting (Dot-Notation)

Sort by nested JSON field values using the same dot-notation syntax.

```ts title="You write"
const companies = await querier.findMany(Company, {
  $sort: { 'kind.public': 'desc' },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "Company" ORDER BY "kind"->>'public' DESC
```

```sql title="Generated SQL (MySQL)"
SELECT * FROM `Company` ORDER BY (`kind`->>'public') DESC
```

```sql title="Generated SQL (MariaDB)"
SELECT * FROM `Company` ORDER BY JSON_VALUE(`kind`, '$.public') DESC
```

```sql title="Generated SQL (SQLite)"
SELECT * FROM `Company` ORDER BY json_extract(`kind`, '$.public') DESC
```

---

## Supported Dialects

All JSON features work across four SQL dialects:

| Feature                | PostgreSQL             | MySQL                    | MariaDB                  | SQLite               |
| ---------------------- | ---------------------- | ------------------------ | ------------------------ | -------------------- |
| Dot-notation filtering | `->>'key'`             | `->>'key'`               | `JSON_VALUE()`           | `json_extract()`     |
| `$merge`               | `\|\| ::jsonb`         | `JSON_SET()`             | `JSON_SET()`             | `json_set()`         |
| `$unset`               | `- 'key'`              | `JSON_REMOVE()`          | `JSON_REMOVE()`          | `json_remove()`      |
| `$push`                | `jsonb_set()` + `\|\|` | `JSON_ARRAY_APPEND()`    | `JSON_ARRAY_APPEND()`    | `json_insert()`      |
| Dot-notation sorting   | `->>'key'`             | `->>'key'`               | `JSON_VALUE()`           | `json_extract()`     |
| `$size`                | `jsonb_array_length()` | `JSON_LENGTH()`          | `JSON_LENGTH()`          | `json_array_length()`|
| `$all`                 | `@> ::jsonb`           | `JSON_CONTAINS()`        | `JSON_CONTAINS()`        | `json_each()`        |
| `$elemMatch`           | `jsonb_array_elements` | `JSON_TABLE()`           | `JSON_TABLE()`           | `json_each()`        |

## Dialect Compatibility

This page targets modern, actively maintained database lines. Baselines below reflect the current compatibility target for generated SQL:

| Dialect | Practical baseline | Notes |
| ------- | ------------------ | ----- |
| PostgreSQL | 16+ | Uses `jsonb` operators/functions (`->>`, `||`, `-`, `jsonb_set`, `jsonb_array_elements`) |
| MySQL | 8.4+ | Uses `->>`, `JSON_SET`, `JSON_REMOVE`, `JSON_ARRAY_APPEND`, `JSON_TABLE` |
| MariaDB | 12.2+ | Uses `JSON_VALUE` for dot-notation path extraction (not `->>`), plus `JSON_SET`, `JSON_REMOVE`, `JSON_ARRAY_APPEND`, `JSON_TABLE` |
| SQLite | 3.45+ | Uses `json_extract`, `json_set`, `json_remove`, and `json_insert(..., '$[#]', ...)` for append |

::::note[About older versions]
UQL may work on earlier versions for many JSON features, but this guide intentionally optimizes for the cleanest SQL and behavior on modern maintained releases.
::::


:::tip[PostgreSQL: Use `jsonb` over `json`]
For PostgreSQL, always prefer `type: 'jsonb'` over `type: 'json'`. JSONB is binary-stored, indexable, and faster for queries. Array operators (`$size`, `$all`, `$elemMatch`) use JSONB-specific functions (`jsonb_array_length`, `@>`, `jsonb_array_elements`) which require JSONB columns.
:::

:::note
MongoDB stores JSON natively — no special operators are needed. These features are specifically designed for SQL databases where JSON is stored in dedicated column types.
:::
