---
title: Logging & Monitoring
description: Professional-grade monitoring and logging with UQL.
sidebar:
  order: 160
---

UQL features a professional-grade, structured logging system designed for high visibility and sub-millisecond performance monitoring.

## Configuration

Logging is configured at the pool level, typically within your `uql.config.ts`. You can enable it by passing `logger: true` in the extra options, which uses the built-in `DefaultLogger`.

```ts
import { PgQuerierPool } from '@uql/core/postgres';

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

| Level              | Description                                                                               |
| :----------------- | :---------------------------------------------------------------------------------------- |
| `query`            | **Standard Queries**: Beautifully formatted SQL/Command logs with execution time.         |
| `slowQuery`        | **Bottleneck Alerts**: Dedicated logging for queries exceeding your `slowQuery.threshold`. Use `logParams: false` to omit params. |
| `error` / `warn`   | **System Health**: Detailed error traces and potential issue warnings.                    |
| `migration`        | **Audit Trail**: Step-by-step history of schema changes.                                  |
| `skippedMigration` | **Safety**: Logs blocked unsafe schema changes during `autoSync`.                         |
| `schema` / `info`  | **Lifecycle**: Informative logs about ORM initialization and sync events.                 |

## Visual Feedback

The `DefaultLogger` provides high-contrast, colored output out of the box:

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
import type { Logger } from '@uql/core';

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
Even if you disable general query logging in production (e.g., `logger: ['error', 'warn', 'slowQuery']`), UQL stays silent *until* a query exceeds your threshold, making it perfect for monitoring performance bottlenecks in real-time.
:::
