---
sidebar:
  order: 150
  badge:
    text: New
    variant: success
title: Migrations
description: Learn how to manage database schema evolution with UQL's migration system, CLI commands, and Entity-First synchronization.
---

## Database Migrations

UQL takes an **Entity-First** approach: you modify your TypeScript entity classes, and UQL auto-generates the migration files for you.

:::important[Your entities are the single source of truth]
**No need to write DDL manually.** UQL diffs your entities against the live database and generates the exact SQL needed. The only thing you maintain is your entity classes — UQL handles everything else.

```bash
# 1. Update your entity (add a field, change a type, add a relation...)
# 2. Auto-generate the migration
npx uql-migrate generate:entities add_user_nickname

# 3. Review and apply
npx uql-migrate up
```

That's it. No manual `ALTER TABLE`, no keeping entities and migrations in sync, no schema DSLs.

Want manual migrations for data backfills or custom SQL? You can do that too — full automation + full control when you need it.
:::

### 1. Unified Configuration

Reuse the same `uql.config.ts` for both your application bootstrap and the CLI. This ensures your app and migrations share the same settings (like [Naming Strategies](/naming-strategy)).

```typescript
// uql.config.ts
import type { Config } from 'uql-orm';
import { PgQuerierPool } from 'uql-orm/postgres';
import { User, Post } from './entities';

export default {
  pool: new PgQuerierPool({ 
    host: 'localhost',
    user: 'theUser',
    password: 'thePassword',
    database: 'theDatabase'
  }),
  entities: [User, Post],
  migrationsPath: './migrations',
} satisfies Config;
```

There is **no** top-level `dialect` field in `Config`: migrations and `uql-migrate` infer the database kind from **`pool.dialect.dialectName`**. On `QuerierPool`, the dialect instance is exposed as **`dialect`** (older releases used `dialectInstance`). The CLI validates that the default export looks like a real pool (`getQuerier`, `transaction`, `withQuerier`, and a dialect) via **`assertCliConfig`** from `uql-orm/migrate`.

By default, the CLI looks for `uql.config.ts` in the project root, but you can specify a custom path using the `--config` / `-c` flag.

### 2. Manage via CLI

Use the CLI to manage your database schema evolution.

| Command                    | Description                                                                                                       |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `generate <name>`          | Creates an empty timestamped file for **manual** SQL migrations (e.g., data backfills).                           |
| `generate:entities <name>` | **Auto-generates** a migration by diffing your entities against the current DB schema.                            |
| `generate:from-db`         | **Scaffolds Entities** from an existing database. Includes **Smart Relation Detection**.                          |
| `drift:check`              | **Drift Detection**: Compares your defined entities against the actual database schema and reports discrepancies. |
| `up`                       | Applies all pending migrations.                                                                                   |
| `down`                     | Rolls back the last applied migration batch.                                                                      |
| `status`                   | Shows which migrations have been executed and which are pending.                                                  |

#### Common Workflows

**Start a new project from scratch:**

```bash
# 1. Define your entities in TypeScript
# 2. Auto-generate the initial migration
npx uql-migrate generate:entities initial_schema

# 3. Apply it
npx uql-migrate up
```

**Evolve an existing schema (add a field to your entity, then generate the diff):**

```bash
# You added @Field() nickname?: string to User entity
npx uql-migrate generate:entities add_user_nickname

# Review the generated migration, then apply
npx uql-migrate up
```

**Adopt UQL on an existing database:**

```bash
# Scaffold entities from your live DB
npx uql-migrate generate:from-db --output ./src/entities

# Check if entities match the DB
npx uql-migrate drift:check
```

**Manual migration for data backfills or custom SQL:**

```bash
npx uql-migrate generate seed_default_roles
# Edit the generated file, then apply
npx uql-migrate up
```

**Day-to-day commands:**

```bash
# Check migration status
npx uql-migrate status

# Rollback the last batch
npx uql-migrate down

# Use a custom config path
npx uql-migrate up --config ./configs/uql.config.ts
```

:::tip[Bun Users]
If you are using Bun's native SQL drivers, use `BunSqlQuerierPool` in your configuration to avoid installing external driver packages like `pg` or `mysql2`:

```ts
// uql.config.ts
import type { Config } from 'uql-orm';
import { BunSqlQuerierPool } from 'uql-orm/bunSql';

export default {
  pool: new BunSqlQuerierPool({ url: process.env.DATABASE_URL! }),
  // entities, migrationsPath, ...
} satisfies Config;
```

The pool constructor takes Bun’s `SQL.Options` (e.g. `{ url }`, `{ adapter, hostname, ... }`, or SQLite `filename`). The migrator reads the dialect id from `pool.dialect.dialectName`.

When running migrations, use the `--bun` flag to ensure Bun's high-performance runtime handles TypeScript resolution and native driver loading:
```bash
bun run --bun uql-migrate up
```
Or add a script to your `package.json`: `"uql": "bun run --bun uql-migrate status"`.
:::

### 3. Entity-First Synchronization (Development)

In development, you can use `autoSync` to automatically keep your database in sync with your entities without manual migrations. It uses the **Schema AST** engine to perform graph-based comparison and is **safe by default**, meaning it only adds missing tables and columns while **blocking** any destructive operations (column drops or type alterations) to prevent data loss.

:::note[Important]
For `autoSync` to detect your entities, they must be **loaded** (imported) before calling `autoSync`.
:::

**Using Your Config (Recommended)**

```ts
import { Migrator } from 'uql-orm/migrate';
import config from './uql.config.js';

const migrator = new Migrator(config.pool, {
  entities: config.entities,
});

// Automatically add missing tables and columns
await migrator.autoSync({ logging: true });
```

**Explicit Entities**

```ts
import { Migrator } from 'uql-orm/migrate';
import { User, Profile, Post } from './entities/index.js';
import { pool } from './uql.config.js';

const migrator = new Migrator(pool, {
  entities: [User, Profile, Post],
});
await migrator.autoSync({ logging: true });
```

### Advanced Capabilities

The synchronization engine is built on a powerful **Schema AST (Abstract Syntax Tree)** that treats your database schema as a graph, not just a list of tables.

#### 1. Schema AST Engine
*   **Graph-Based Diffing**: Handles complex circular dependencies and ensures correct topological sort order when creating or dropping tables.
*   **100% Accurate**: Eliminates "phantom diffs" by understanding the semantic differences between dialect-specific types (e.g., `INTEGER` vs `INT`).

#### 2. Smart Relation Detection
When scaffolding entities from an existing database (`generate:from-db`), UQL automatically detects relationships by analyzing your schema:

*   **Explicit Foreign Keys**: Standard foreign keys are mapped to `@OneToMany` / `@ManyToOne`.
*   **One-to-One Relations**: Detected when a foreign key column also has a **unique constraint**.
*   **Many-to-Many Relations**: Automatically identified by detecting **Junction Tables** (tables with exactly two foreign keys and no other business data).
*   **Naming Conventions**: If foreign keys are missing, UQL infers logical relations from column naming patterns like `user_id` → `User`.

#### 3. Drift Detection
Ensure production safety with `drift:check`. It compares your TypeScript entity definitions against the actual running database and reports:
*   **Critical**: Missing tables or columns, type mismatches that risk data truncation.
*   **Warning**: Missing indexes or unexpected columns.

#### 4. Bidirectional Index Sync
Indexes are synchronized in both directions:
*   **Entity → DB**: `@Field({ index: true })` creates an index in the database.
*   **DB → Entity**: Existing database indexes are reflected in generated entity files.

### Other Features
- **64-bit Primary Keys**: Auto-increment primary keys use `BIGINT` across all dialects for TypeScript `number` compatibility.
- **SQLite STRICT Mode**: Tables generated for SQLite, LibSQL, and Cloudflare D1 use **STRICT mode** by default.
- **Safe Primary Keys**: Primary keys are immune to automated alterations during `autoSync`.
- **Foreign Key Inheritance**: Foreign key columns automatically inherit the exact SQL type of their referenced primary keys.

---

## Migration Builder API

When writing manual migrations (via `generate`), you have access to a fluent, type-safe API for defining your schema.

### Real-World Example

A typical migration that adds a new table with relationships and modifies an existing one:

```typescript
import { defineMigration, t } from 'uql-orm/migrate';

export default defineMigration({
  async up(m) {
    // Create a new table
    await m.createTable('articles', (t) => {
      t.id();                                         // BIGINT auto-increment PK
      t.string('title', { length: 200 });             // VARCHAR(200) NOT NULL
      t.string('slug', { length: 200, unique: true });
      t.text('body');                                  // TEXT NOT NULL
      t.boolean('published', { defaultValue: false });
      t.timestamp('published_at', { nullable: true });
      t.timestamp('created_at', { defaultValue: t.now() });

      // Foreign key to users table
      t.integer('author_id', {
        references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
      });

      // Composite index for common queries
      t.index(['published', 'created_at']);
    });

    // Modify an existing table
    await m.alterTable('users', (t) => {
      t.addColumn('bio', (c) => c.text());
      t.addColumn('avatar_url', (c) => c.string({ length: 500 }).nullable());
      t.addIndex(['email']);
    });
  },

  async down(m) {
    // Reverse in opposite order
    await m.alterTable('users', (t) => {
      t.dropIndex('idx_users_email');
      t.dropColumn('avatar_url');
      t.dropColumn('bio');
    });

    await m.dropTable('articles');
  },
});
```

### Comprehensive Column Types

```typescript
import { defineMigration, t } from 'uql-orm/migrate';

export default defineMigration({
  async up(m) {
    await m.createTable('all_types_demo', (t) => {
      // --- Numeric Types ---
      t.id();                                              // Auto-incrementing PK (BigInt)
      t.integer('user_age', { nullable: true });
      t.smallint('status_id', { defaultValue: 0 });
      t.bigint('view_count', { defaultValue: 0n });
      t.float('rating');
      t.double('precise_score');
      t.decimal('price', { precision: 10, scale: 2 });

      // --- String Types ---
      t.string('username', { length: 50, unique: true }); // VARCHAR(50)
      t.string('email');                                   // VARCHAR(255) by default
      t.char('country_code', { length: 2 });
      t.text('bio');

      // --- Boolean ---
      t.boolean('is_active', { defaultValue: true });

      // --- Date & Time ---
      t.date('birth_date');
      t.time('daily_alarm');
      t.timestamp('created_at', { defaultValue: t.now() });
      t.timestamptz('updated_at');

      // --- JSON & Advanced ---
      t.json('settings');
      t.jsonb('metadata');                                 // Binary JSON (Postgres)
      t.uuid('external_id', { defaultValue: t.uuid() });
      t.blob('file_data');
      t.vector('embedding', { dimensions: 1536 });        // Vector for AI/ML

      // --- Relationships ---
      t.integer('author_id', {
        references: {
          table: 'users',
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        },
      });

      // --- Composite Constraints ---
      t.unique(['username', 'email']);
      t.index(['is_active', 'created_at']);
      t.comment('A comprehensive demo table');
    });
  },

  async down(m) {
    await m.dropTable('all_types_demo');
  },
});
```

### Alter Table Operations

```typescript
await m.alterTable('users', (t) => {
  // Add columns
  t.addColumn('nickname', (c) => c.string({ length: 100 }));

  // Drop columns
  t.dropColumn('legacy_field');

  // Rename columns
  t.renameColumn('full_name', 'name');

  // Alter column type
  t.alterColumn('email', (c) => c.string({ length: 300 }));

  // Indexes
  t.addIndex(['nickname']);
  t.dropIndex('idx_users_old_name');

  // Foreign keys
  t.addForeignKey(['profile_id'], {
    table: 'profiles',
    columns: ['id'],
  });
  t.dropForeignKey('fk_users_legacy');
});

// Raw SQL (escape hatch)
await m.raw('CREATE VIEW active_users AS SELECT * FROM users WHERE is_active = true');
```

### Column Options Reference

All column methods accept an optional settings object:

| Option          | Type                  | Default     | Description                                               |
| :-------------- | :-------------------- | :---------- | :-------------------------------------------------------- |
| `nullable`      | `boolean`             | `false`     | Allow NULL values? (**Default is NOT NULL**)              |
| `defaultValue`  | `any`                 | `undefined` | Default value (use `t.now()`, `t.uuid()` for expressions) |
| `unique`        | `boolean`             | `false`     | Add a unique constraint                                   |
| `primaryKey`    | `boolean`             | `false`     | Mark as primary key                                       |
| `autoIncrement` | `boolean`             | `false`     | Enable auto-increment (integers only)                     |
| `index`         | `boolean` \| `string` | `false`     | Create an index (bool=auto-name, string=custom-name)      |
| `comment`       | `string`              | -           | Database comment for the column                           |
| `references`    | `object`              | -           | Define Foreign Key (see examples above)                   |

---

Check out the [getting started](/getting-started) guide for more details on setting up your project.
