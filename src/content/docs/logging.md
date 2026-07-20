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
    slowQuery: 200,
  }
);
```

### Advanced Configuration

You can selectively enable log levels by passing an array:

```ts
{
  // Only log errors and warnings at the regular query level
  logger: ['error', 'warn'],
  // Independent of `logger`'s levels: any query at or past 200ms is logged as slow regardless
  slowQuery: 200
}
```

`slowQuery` doesn't need a matching entry in `logger`'s level array - setting the threshold is what turns slow-query alerts on, on top of whatever regular levels you've enabled.

For production, a common pattern is to go silent except for problems:

```ts
{
  // No regular query/info logging at all
  logger: ['error', 'warn', 'migration'],
  // ...but still alert on anything past a second
  slowQuery: 1000
}
```

### Including Bound Values in Logs

Bound values are **never logged by default** - `logValues` defaults to `false`, so logs carry SQL text only, since query parameters may hold PII or other sensitive data. Opt in explicitly if you want them (e.g. in a local/dev environment):

```ts
{
  logger: true,
  slowQuery: 500,
  logValues: true
}
```

`logValues` applies uniformly to regular query logs and slow-query alerts alike; it isn't tied to `slowQuery` specifically.

## Log Levels

| Level              | Description                                                                                              |
| :----------------- | :-------------------------------------------------------------------------------------------------------- |
| `query`            | Each executed SQL statement/command, with its parameters and execution time.                             |
| `error` / `warn`   | Error traces and warnings.                                                                               |
| `migration`        | Step-by-step history of schema changes.                                                                  |
| `skippedMigration` | Unsafe schema changes blocked during `autoSync`.                                                         |
| `schema` / `info`  | ORM initialization and sync events.                                                                      |

:::note[Slow-query alerts aren't a log level]
Queries at or past the `slowQuery` threshold (in milliseconds) are always logged as slow, independent of which levels are enabled in `logger` - there's no `'slowQuery'` entry to add to that array. Use `logValues: true` if you also want bound values included in these alerts.
:::

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

### Routing Slow-Query Alerts Elsewhere

`logQuery` and `logSlowQuery` are two separate methods on `Logger`, called independently - so a single logger can already send slow-query alerts somewhere entirely different from regular query logs, with no extra configuration:

```ts
import type { Logger } from 'uql-orm';

class MyLogger implements Logger {
  logQuery(query: string, values?: unknown[], duration?: number) {
    console.log(`query: ${query}`, values, duration);
  }
  logSlowQuery(query: string, values?: unknown[], duration?: number) {
    pagerduty.alert(`Slow query (${duration}ms): ${query}`);
  }
}

// In your pool config:
{
  logger: new MyLogger(),
  slowQuery: 500
}
```

If you just want to keep `DefaultLogger`'s console formatting for regular queries and only add custom alerting for slow ones, extend it and override a single method - `super.logSlowQuery(...)` keeps the console line too, if you want both:

```ts
import { DefaultLogger } from 'uql-orm';

class AlertingLogger extends DefaultLogger {
  override logSlowQuery(query: string, values?: unknown[], duration?: number) {
    super.logSlowQuery(query, values, duration); // still print to console
    pagerduty.alert(`Slow query (${duration}ms): ${query}`);
  }
}

// In your pool config:
{
  logger: new AlertingLogger(),
  slowQuery: 500
}
```

No dedicated "slow-query logger" option is needed for this - it falls directly out of `Logger`'s two independent methods plus `DefaultLogger` being a plain, subclassable class.

:::tip
With general query-level logging disabled in production (e.g., `logger: ['error', 'warn']`, no `'query'`), setting `slowQuery` keeps UQL silent until a query exceeds your threshold, which makes it a low-noise way to catch performance regressions.
:::
