---
title: Logging & Monitoring
description: Configure query logging, slow-query alerts, and custom loggers in UQL.
sidebar:
  order: 175
---

UQL includes a structured logging system that reports generated queries, per-query execution times, slow-query alerts, and migration activity.

## Configuration

Logging is configured at the pool level, typically within your `uql.config.ts`. You can enable it by passing `logger: true` in the extra options, which uses the built-in `DefaultLogger`.

```ts
import { PgQuerierPool } from 'uql-orm/postgres';

export const pool = new PgQuerierPool(
  { /* connection options */ },
  {
    // Enable all log levels with colored output
    logger: true,
    // Threshold in ms to log slow queries
    slowQuery: { threshold: 200 },
  }
);
```

### Advanced Configuration

You can selectively enable log levels by passing an array:

```ts
{
  // Only log errors, warnings, and slow queries
  logger: ['error', 'warn', 'slowQuery'],
  slowQuery: { threshold: 100 }
}
```

For production, a common pattern is:

```ts
{
  logger: ['error', 'warn', 'slowQuery', 'migration'],
  slowQuery: { threshold: 1000 }
}
```

### Omitting Parameters from Slow Query Logs

For security-sensitive environments, you can suppress query parameters from slow query logs:

```ts
{
  logger: true,
  slowQuery: { threshold: 500, logParams: false }
}
```

## Log Levels

| Level              | Description                                                                                              |
| :----------------- | :-------------------------------------------------------------------------------------------------------- |
| `query`            | Each executed SQL statement/command, with its parameters and execution time.                             |
| `slowQuery`        | Queries exceeding `slowQuery.threshold`. Use `logParams: false` to omit params.                          |
| `error` / `warn`   | Error traces and warnings.                                                                               |
| `migration`        | Step-by-step history of schema changes.                                                                  |
| `skippedMigration` | Unsafe schema changes blocked during `autoSync`.                                                         |
| `schema` / `info`  | ORM initialization and sync events.                                                                      |

## Output Format

The `DefaultLogger` writes colored output like this:

```text
query: SELECT * FROM "user" WHERE "id" = $1 -- [123] [2ms]
slow query: UPDATE "post" SET "title" = $1 -- ["New Title"] [1250ms]
error: Failed to connect to database: Connection timeout
skipped migration: Cannot drop column "old_field" in safe mode
```

## Custom Logger

You can provide your own logger by implementing the `Logger` interface or by passing a simple function.

### Custom Function

```ts
{
  logger: (query, values, duration) => {
    console.log(`Executing ${query} with ${values}. Took ${duration}ms`);
  }
}
```

### Custom Class

```ts
import type { Logger } from 'uql-orm';

class MyLogger implements Logger {
  logQuery(query: string, values?: unknown[], duration?: number) {
    // your implementation
  }
  logSlowQuery(query: string, values?: unknown[], duration?: number) {
    // your implementation
  }
  logWarn(message: string) {
    // your implementation
  }
  logError(message: string, error?: Error) {
    // your implementation
  }
  logInfo(message: string) {
    // your implementation
  }
  logSchema(message: string) {
    // your implementation
  }
  logMigration(message: string) {
    // your implementation
  }
  logSkippedMigration(message: string) {
    // your implementation
  }
}

// In your pool config:
{
  logger: new MyLogger()
}
```

:::tip
With general query logging disabled in production (e.g., `logger: ['error', 'warn', 'slowQuery']`), UQL stays silent until a query exceeds your threshold, which makes it a low-noise way to catch performance regressions.
:::
