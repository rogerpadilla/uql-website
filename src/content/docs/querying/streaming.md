---
title: Cursor Streaming
description: Process millions of rows with a stable memory footprint using native driver-level cursors.
---

For large result sets that exceed available memory, UQL provides `findManyStream()`. Instead of loading the entire result set into a TypeScript array, it returns an `AsyncIterable` that allows you to process rows one-by-one as they arrive from the database.

## Basic Usage

The `findManyStream` method accepts the same query object as `findMany`.

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

## Why use Streaming?

1.  **Memory Efficiency**: You can process 1,000,000 rows with the same memory footprint as processing 10 rows.
2.  **Early Processing**: Start handling the first row before the database has even finished finding the last one.
3.  **Backpressure**: UQL respects the database cursor's speed, ensuring your application isn't overwhelmed by data.

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

## RPC & Remote Bridges

Like all UQL queries, the stream query is fully serializable. If you are using the **Fullstack Bridge**, the streaming protocol is handled automatically over the network, allowing you to stream data from your database directly to a browser or mobile app.

---

**Senior Insight:** Streaming is powerful but holds a database connection open for the duration of the loop. Always ensure your processing logic inside the `for await` loop is fast, or use a technical queue if you need to perform heavy work on each row.
