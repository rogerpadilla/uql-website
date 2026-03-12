---
title: Semantic Search
sidebar:
  order: 108
  badge:
    text: New
    variant: success
description: Vector similarity search with $vector, $distance, and $project across PostgreSQL, MariaDB, SQLite, and MongoDB Atlas.
---

UQL provides first-class vector similarity search, enabling AI-powered semantic queries out of the box. Works across **PostgreSQL** (pgvector), **MariaDB**, **SQLite** (sqlite-vec), and **MongoDB Atlas** (`$vectorSearch`).

## Entity Setup

Define a vector field with `type: 'vector'` and `dimensions`. Optionally, add a vector index for efficient approximate nearest-neighbor (ANN) search.

```ts title="You write"
import { Entity, Id, Field, Index } from 'uql-orm';

@Entity()
@Index(['embedding'], { type: 'hnsw', distance: 'cosine', m: 16, efConstruction: 64 })
export class Article {
  @Id() id?: number;
  @Field() title?: string;
  @Field() category?: string;

  @Field({ type: 'vector', dimensions: 1536 })
  embedding?: number[];
}
```

:::tip[Automatic Extension]
For Postgres, UQL automatically emits `CREATE EXTENSION IF NOT EXISTS vector` when your schema includes vector columns. No manual setup needed.
:::

---

## Query by Similarity

Use `$sort` on a vector field with `$vector` and an optional `$distance` metric:

```ts title="You write"
const results = await querier.findMany(Article, {
  $select: { id: true, title: true },
  $sort: { embedding: { $vector: queryEmbedding, $distance: 'cosine' } },
  $limit: 10,
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "id", "title" FROM "Article"
ORDER BY "embedding" <=> $1::vector
LIMIT 10
```

```sql title="Generated SQL (MariaDB)"
SELECT `id`, `title` FROM `Article`
ORDER BY VEC_DISTANCE_COSINE(`embedding`, ?)
LIMIT 10
```

```sql title="Generated SQL (SQLite)"
SELECT `id`, `title` FROM `Article`
ORDER BY vec_distance_cosine(`embedding`, ?)
LIMIT 10
```

For MongoDB, UQL translates into a [`$vectorSearch`](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/) aggregation pipeline:

```json title="Generated Pipeline (MongoDB Atlas)"
[
  {
    "$vectorSearch": {
      "index": "embedding_index",
      "path": "embedding",
      "queryVector": [/* queryEmbedding */],
      "numCandidates": 100,
      "limit": 10
    }
  }
]
```

:::note[MongoDB Atlas Requirement]
MongoDB vector search requires an Atlas cluster with a [vector search index](https://www.mongodb.com/docs/atlas/atlas-vector-search/create-index/) configured on the target field. The distance metric is defined in the Atlas index — the `$distance` parameter is accepted for API consistency but ignored by MongoDB.
:::

### Combined with Filtering

Vector search composes naturally with `$where` and regular `$sort` fields:

```ts title="You write"
const results = await querier.findMany(Article, {
  $where: { category: 'science' },
  $sort: { embedding: { $vector: queryVec, $distance: 'cosine' }, title: 'asc' },
  $limit: 10,
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "Article"
WHERE "category" = $1
ORDER BY "embedding" <=> $2::vector, "title" ASC
LIMIT 10
```

```sql title="Generated SQL (MariaDB)"
SELECT * FROM `Article`
WHERE `category` = ?
ORDER BY VEC_DISTANCE_COSINE(`embedding`, ?), `title` ASC
LIMIT 10
```

```sql title="Generated SQL (SQLite)"
SELECT * FROM `Article`
WHERE `category` = ?
ORDER BY vec_distance_cosine(`embedding`, ?), `title` ASC
LIMIT 10
```

For MongoDB, `$where` is merged into the `$vectorSearch.filter` for optimal pre-filtering, and secondary sorts become a separate `$sort` stage:

```json title="Generated Pipeline (MongoDB Atlas)"
[
  {
    "$vectorSearch": {
      "index": "embedding_index",
      "path": "embedding",
      "queryVector": [/* queryVec */],
      "numCandidates": 100,
      "limit": 10,
      "filter": { "category": "science" }
    }
  },
  { "$sort": { "title": 1 } }
]
```

:::tip[MongoDB Pre-Filtering]
UQL merges `$where` into the `$vectorSearch.filter` instead of adding a separate `$match` stage. This is the recommended Atlas approach — it uses the search index for filtering, avoiding a full collection scan after the vector search.
:::

---

## Distance Metrics

| Metric | Postgres Operator | MariaDB Function | SQLite Function | MongoDB Atlas | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cosine` | `<=>` | `VEC_DISTANCE_COSINE` | `vec_distance_cosine` | ✅ (index-defined) | Text embeddings (OpenAI, Cohere) |
| `l2` | `<->` | `VEC_DISTANCE_EUCLIDEAN` | `vec_distance_L2` | ✅ (index-defined) | Image search, spatial data |
| `inner` | `<#>` | — | — | ✅ (index-defined) | Maximum inner product |
| `l1` | `<+>` | — | — | — | Manhattan distance |
| `hamming` | `<~>` | — | `vec_distance_hamming` | — | Binary embeddings |

If omitted, `$distance` defaults to `'cosine'`. You can also set a default per-field:

```ts
@Field({ type: 'vector', dimensions: 1536, distance: 'l2' })
embedding?: number[];
```

Queries on this field will use `l2` unless overridden with `$distance` at query time.

---

## Distance Projection

Project the computed distance as a named field in the result with `$project`:

```ts title="You write"
import type { WithDistance } from 'uql-orm';

const results = await querier.findMany(Article, {
  $select: { id: true, title: true },
  $sort: { embedding: { $vector: queryVec, $distance: 'cosine', $project: 'similarity' } },
  $limit: 10,
}) as WithDistance<Article, 'similarity'>[];

results.forEach((r) => console.log(r.title, r.similarity));
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "id", "title", "embedding" <=> $1::vector AS "similarity" FROM "Article"
ORDER BY "similarity"
LIMIT 10
```

```sql title="Generated SQL (MariaDB)"
SELECT `id`, `title`, VEC_DISTANCE_COSINE(`embedding`, ?) AS `similarity` FROM `Article`
ORDER BY `similarity`
LIMIT 10
```

```sql title="Generated SQL (SQLite)"
SELECT `id`, `title`, vec_distance_cosine(`embedding`, ?) AS `similarity` FROM `Article`
ORDER BY `similarity`
LIMIT 10
```

For MongoDB, `$project` adds a `$meta: 'vectorSearchScore'` projection:

```json title="Generated Pipeline (MongoDB Atlas)"
[
  { "$vectorSearch": { "index": "embedding_index", "path": "embedding", "queryVector": ["..."], "numCandidates": 100, "limit": 10 } },
  { "$project": { "id": true, "title": true, "similarity": { "$meta": "vectorSearchScore" } } }
]
```

:::tip[Type Safety]
`WithDistance<Article, 'similarity'>` adds a typed `similarity: number` property to each result. Your IDE autocompletes `r.similarity` and catches typos at compile time.
:::

:::note[Performance]
For SQL dialects, when `$project` is set, UQL references the projected alias in `ORDER BY` instead of recomputing the distance expression. For MongoDB, Atlas returns the score via `$meta` with no extra computation.
:::

---

## Vector Types

UQL supports three vector storage types — use the one that best fits your model and performance needs:

| Type | SQL (Postgres) | Storage | Max Dimensions | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| `'vector'` | `VECTOR(n)` | 32-bit float | 2,000 | Standard embeddings (OpenAI, etc.) |
| `'halfvec'` | `HALFVEC(n)` | 16-bit float | 4,000 | 50% storage savings, near-identical accuracy |
| `'sparsevec'` | `SPARSEVEC(n)` | Sparse | 1,000,000 | SPLADE, BM25-style sparse retrieval |

```ts title="Examples"
@Field({ type: 'vector', dimensions: 1536 })    // OpenAI ada-002
embedding?: number[];

@Field({ type: 'halfvec', dimensions: 1536 })   // Same model, half storage
embedding?: number[];

@Field({ type: 'sparsevec', dimensions: 30000 }) // SPLADE sparse
sparseEmbedding?: number[];
```

:::note
`halfvec` and `sparsevec` are Postgres-only (pgvector). MariaDB and SQLite map them to their native `VECTOR` type — your entities work everywhere, UQL handles the translation.
:::

---

## Vector Indexes

Define vector indexes with `@Index()` for efficient approximate nearest-neighbor (ANN) search:

| Index Type | Postgres | MariaDB | MongoDB Atlas | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `hnsw` | ✅ `USING hnsw` with operator classes | ❌ | ❌ | Best accuracy, higher memory |
| `ivfflat` | ✅ `USING ivfflat` with `lists` param | ❌ | ❌ | Faster build, large datasets |
| `vector` | — | ✅ Inline `VECTOR INDEX` | ❌ | MariaDB's native vector index |
| `vectorSearch` | — | — | ✅ Atlas vector search index | MongoDB's managed ANN index |

```ts title="Postgres HNSW"
@Index(['embedding'], { type: 'hnsw', distance: 'cosine', m: 16, efConstruction: 64 })
```

```ts title="Postgres IVFFlat"
@Index(['embedding'], { type: 'ivfflat', distance: 'l2', lists: 100 })
```

```ts title="MariaDB"
@Index(['embedding'], { type: 'vector', distance: 'cosine', m: 8 })
```

```ts title="MongoDB Atlas"
@Index(['embedding'], { type: 'vectorSearch', name: 'my_search_index' })
```

:::note
SQLite (sqlite-vec) does not support vector-specific index creation syntax. Standard indexes apply.
:::

:::note[MongoDB Atlas]
For MongoDB, the `@Index` decorator with `type: 'vectorSearch'` tells UQL which Atlas index to reference in the `$vectorSearch` stage. The actual index must be created in Atlas — UQL does not manage Atlas search index creation.
:::
