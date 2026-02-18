---
sidebar:
  order: 155
title: Naming Strategy Overview
description: This tutorial explains how to use naming strategies with UQL.
---

## Naming Strategies

Naming strategies allow you to automatically translate between your TypeScript code (usually `camelCase`) and your database schema (often `snake_case`). This keeps your database following standard conventions while your code stays idiomatic TypeScript.

### Built-in Strategies

UQL comes with two built-in naming strategies:

| Strategy                  | Behavior                                                 |
| :------------------------ | :------------------------------------------------------- |
| `DefaultNamingStrategy`   | Keeps names exactly as they are in your TypeScript code. |
| `SnakeCaseNamingStrategy` | Automatically converts `camelCase` to `snake_case`.      |

### Using a Naming Strategy

Configure the naming strategy when initializing your `pool` in your `uql.config.ts`. This affects both runtime queries and [schema generation/migrations](/migrations).

```ts
// uql.config.ts
import { SnakeCaseNamingStrategy, type Config } from '@uql/core';
import { PgQuerierPool } from '@uql/core/postgres';

export const pool = new PgQuerierPool(
  { host: 'localhost', database: 'my_db' },
  {
    // CamelCase -> snake_case translation
    namingStrategy: new SnakeCaseNamingStrategy()
  }
);

export default {
  pool,
  migrationsPath: './migrations',
} satisfies Config;
```


### How it works

When using `SnakeCaseNamingStrategy`:
- **Entity**: `UserAccount` → table `user_account`
- **Field**: `createdAt` → column `created_at`
- **Relations**: `authorId` → column `author_id`

### Custom Naming Strategy

You can implement your own naming strategy by extending the `NamingStrategy` interface or inheriting from `DefaultNamingStrategy`.

```ts
import { DefaultNamingStrategy } from '@uql/core';

export class MyCustomNamingStrategy extends DefaultNamingStrategy {
  // Add a prefix to all table names
  override tableName(entityName: string): string {
    return `tbl_${super.tableName(entityName)}`;
  }

  // Force all column names to uppercase
  override columnName(propertyName: string): string {
    return propertyName.toUpperCase();
  }
}
```

