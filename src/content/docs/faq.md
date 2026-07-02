---
title: FAQ
sidebar:
  order: 600
  label: FAQ
description: Frequently asked questions about UQL ORM
---

## Getting Started

### What is UQL and when should I use it?

UQL is a JSON-native ORM for TypeScript that offers:
- **Serializable queries**: plain JSON objects you can cache, send over HTTP, or store
- **No codegen**: your TypeScript classes are the schema, no build step needed
- **One API everywhere**: the same syntax works on PostgreSQL, MySQL, MongoDB, SQLite, and edge runtimes
- **Fast SQL generation**: fastest in all 8 categories of our [open benchmark](/comparison#performance)

### How is UQL different from Prisma, Drizzle, or TypeORM?

| Feature | UQL | Prisma | Drizzle | TypeORM |
|---------|-----|--------|---------|---------|
| Query format | JSON object | Object literal | Function chains | Method chains |
| Codegen | None needed | Required | None | None |
| Multi-DB API | One syntax | Mostly consistent | Per-dialect schemas | Diverges for MongoDB |
| Browser queries | Built-in | Not supported | Manual | Manual |
| Vector search | Native operator | Via extension | Via extension | Raw SQL |

### Is UQL production-ready?

Yes. UQL powers [Variability.ai](https://variability.ai), an AI meeting intelligence platform, in production.

---

## Installation & Setup

### Which database drivers do I need?

| Database | Driver Package |
|----------|----------------|
| PostgreSQL | `pg` |
| MySQL | `mysql2` |
| MariaDB | `mariadb` or `mysql2` |
| SQLite | `better-sqlite3` |
| MongoDB | `mongodb` |
| Bun SQL Native | Built-in (no install) |
| Cloudflare D1 | `uql-orm/d1` |
| Neon | `@neondatabase/serverless` |

For Bun, you don't need external drivers — Bun's native SQL supports PostgreSQL, MySQL, and SQLite out of the box.

### Do I need special TypeScript configuration?

If using **decorators** (`@Entity()`, `@Field()`):
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

If using the **imperative API** (`defineEntity`), no special configuration needed.

Always ensure `"module": "NodeNext"` or `"module": "ESNext"` in your `tsconfig.json`.

---

## Core Concepts

### What does "JSON-native" mean?

A UQL query is a plain JavaScript object:

```ts
{
  $select: { id: true, name: true },
  $where: { email: { $endsWith: '@uql-orm.dev' } },
  $sort: { createdAt: 'desc' },
  $limit: 10
}
```

Because the query is data rather than code, you can `JSON.stringify()` it and send it over HTTP, cache it, diff it programmatically, or share it between backend and frontend.

### What's the difference between `type` and `columnType`?

Use `type` for portability, `columnType` for precise SQL control:

```ts
// Recommended: cross-database portable
@Field({ type: 'uuid' })

// Use rarely: exact SQL control
@Field({ columnType: 'CHAR(36)' })
```

`type: 'uuid'` generates `UUID` on Postgres but `CHAR(36)` on MySQL automatically.

### What's the difference between `$select` and `$populate`?

- **`$select`** — Scalar fields (strings, numbers, dates, JSON)
- **`$populate`** — Related entities (relations)

```ts
{
  $select: { id: true, name: true },           // scalar fields
  $populate: { posts: { $select: { title: true } } }  // relations
}
```

---

## Queries & Relations

### How do I filter by nested JSON properties?

Use dot-notation paths in `$where`:

```ts
await querier.findMany(Company, {
  $where: {
    'settings.isArchived': { $ne: true },
    'settings.theme': 'dark',
  },
});
```

Works across all SQL dialects — UQL generates dialect-specific SQL automatically.

### How do I join relations?

```ts
await querier.findMany(Post, {
  $select: { id: true, title: true },
  $populate: {
    author: { $select: { id: true, name: true } }
  },
  $where: { author: { name: 'Roger' } }
});
```

UQL automatically generates efficient SQL with joins.

### How do I count related records?

```ts
await querier.findMany(Category, {
  $where: {
    measureUnits: { $size: { $gte: 2 } }
  }
});
```

Uses efficient `COUNT(*)` subqueries.

---

## Migrations & Schema

### Do I need to write SQL migrations manually?

No. UQL uses an **Entity-First** approach:

```bash
# 1. Update your entity class
# 2. Auto-generate the migration
npx uql-migrate generate:entities add_user_nickname

# 3. Apply it
npx uql-migrate up
```

UQL diffs your entities against the live database and generates the exact SQL.

### Can I still write manual migrations?

Yes. Use `generate` for manual SQL:

```bash
npx uql-migrate generate seed_default_roles
# Edit the generated file
npx uql-migrate up
```

---

## Advanced Features

### How does vector search work?

```ts
const results = await querier.findMany(Article, {
  $sort: {
    embedding: {
      $vector: queryEmbedding,
      $distance: 'cosine',
      $project: 'similarity'
    }
  },
  $limit: 10
});
```

Works on PostgreSQL (pgvector), CockroachDB, MariaDB, SQLite (sqlite-vec), and MongoDB Atlas, all with the same query syntax. See [Semantic Search](/querying/semantic-search).

### What's the performance like?

In our [open benchmark](/comparison#performance) of SQL-generation speed, UQL is the fastest entry in all 8 query categories, on average ~2.4× faster than the runner-up. Two design choices drive this:
- Schema metadata (tables, columns, relations) is pre-computed once at startup
- SQL is written directly into a string buffer, avoiding intermediate objects

---

## Troubleshooting

### Why am I getting "Decorators not working"?

1. Ensure `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json`
2. Set `"module": "NodeNext"` or `"module": "ESNext"`
3. Ensure `"type": "module"` in `package.json`
4. Use `.js` extensions in imports (TypeScript resolves to `.ts`)

### Why am I getting "Connection refused"?

1. Verify your database is running
2. Check credentials in `uql.config.ts`
3. Ensure the database exists (`createdb your_db`)
4. For Docker, verify network settings and port mappings

### Why is my query slow?

1. Check if you're missing indexes on filtered columns
2. Use `findManyStream` for large result sets
3. Consider pagination with `$limit` and `$skip`
4. Enable [query logging](/logging) to see the generated SQL and per-query timings
