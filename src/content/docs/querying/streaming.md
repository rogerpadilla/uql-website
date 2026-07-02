---
title: Cursor Streaming
description: Process millions of rows with a stable memory footprint using native driver-level cursors.
---

For large result sets that exceed available memory, UQL provides `findManyStream()`. Instead of loading the entire result set into a TypeScript array, it returns an `AsyncIterable` that allows you to process rows one-by-one as they arrive from the database.

## Basic Usage

The `findManyStream` method accepts the same **shape** of query object as `findMany`, but **not every `findMany` feature is available on the stream path** (see [Relations & streaming](#relations--streaming) below).

```ts
const results = querier.findManyStream(User, {
  $select: { id: true, email: true },
  $where: { status: 'active' },
});

for await (const user of results) {
  // Process each user row-by-row
  console.log(`Processing: ${user.email}`);
}
```

## Relations & streaming

UQL keeps streaming memory-friendly by not running the same follow-up work as `findMany` for every backend.

| Backend | Joinable relations (e.g. many-to-one, one-to-one) | To-many (one-to-many, many-to-many) |
| :--- | :--- | :--- |
| **SQL** (`AbstractSqlQuerier`) | Still emitted in the streamed SQL (joins + projected columns). | **Not supported** — To-many relations are filled as a post-processing step which is incompatible with row-by-row streaming. Requesting these keys in `$select` or `$populate` **throws a `TypeError`**. |
| **MongoDB** (`MongodbQuerier`) | **Not supported** — MongoDB streams use a plain `find` cursor which cannot efficiently load UQL's aggregation-based relations. Requesting any relation keys in `$select` or `$populate` **throws a `TypeError`**. | Same as joinable. |

For relation-heavy reads, use [`findMany`](/querying/querier) with [`$populate`](/querying/relations).

## Why use Streaming?

Memory stays flat regardless of result size, since rows are processed as they arrive rather than buffered into an array. You also start handling the first row before the database finishes producing the last one, and because iteration drives the cursor, the database only sends rows as fast as your loop consumes them.

## Native Driver Implementation

UQL uses the optimal streaming mechanism for each individual driver:

| Driver | Implementation |
| :--- | :--- |
| **PostgreSQL** (`pg`) | Native cursor via `pg-query-stream`. |
| **MySQL** (`mysql2`) | Result set streaming via `.stream()`. |
| **SQLite** (`better-sqlite3`) | Iteration via `.iterate()`. |
| **Bun SQL** (`bun:sql`) | Native iteration via generator-wrapped `iterate()`. |
| **MongoDB** (`mongodb`) | Native MongoDB `Cursor`. |
| **LibSQL** / **D1** | Emulated streaming (async row fetching). |

:::caution
Streaming holds a database connection open for the duration of the loop. Keep the processing logic inside the `for await` loop fast; if each row needs heavy work, push it to a task queue and let the loop move on.
:::
