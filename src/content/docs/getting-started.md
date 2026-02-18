---
title: Quick Start
sidebar:
  order: 1
  label: Quick Start
root: true
description: Go from zero to a working UQL query in under three minutes.
---

**[UQL](/)** is the JSON-native query protocol for TypeScript. It is engineered to be **fast**, **safe**, and **universally compatible**.

- **Runs Everywhere**: Node.js, Bun, Deno, Cloudflare Workers, Electron, React Native, and the Browser.
- **Unified API**: A consistent interface for PostgreSQL, MySQL, MariaDB, SQLite, LibSQL, Neon, D1, and MongoDB.

---

## 1. Install

Install the core and your preferred driver:

```sh
npm install @uql/core pg # or mysql2, better-sqlite3, mongodb, etc.
```

---

## 2. Fast-Track Example

Here is a complete example of defining an entity, setting up a pool, and running a query.

```ts
// entities.ts
import { Entity, Id, Field, Relation } from '@uql/core';

@Entity()
export class User {
  @Id({ type: 'uuid' })
  id?: string;

  @Field({ unique: true })
  email?: string;

  @Field()
  name?: string;
}

// uql.config.ts
import { PgQuerierPool } from '@uql/core/postgres';
import { User } from './entities.js';

export const pool = new PgQuerierPool(
  { host: 'localhost', database: 'uql_app' },
  { entities: [User] }
);

// app.ts
import { pool } from './uql.config.js';
import { User } from './entities.js';

const users = await pool.transaction(async (querier) => {
  return await querier.findMany(User, {
    $select: ['id', 'name'],
    $where: { email: { $endsWith: '@uql.io' } },
    $limit: 10,
  });
});

console.log(users);
```

---

## Next Steps

Now that you've seen the basics, dive deeper into the core concepts:

- **[Define Entities](/entities/basic)**: Explore all decorators and type abstractions.
* **[Define Relations](/entities/relations)**: Map complex relationships with ease.
- **[Querying](/querying/querier)**: Learn about deep selection, filtering, and sorting.
- **[Transactions](/transactions)**: Master automatic and manual transaction patterns.
- **[Migrations](/migrations)**: Manage your schema evolution with the CLI and Drift Detection.
