---
title: Transactions & Scoped Queriers
sidebar:
  order: 170
description: Learn how to scope connection lifetime with withQuerier and manage transactions in UQL.
---

## Scoped Queriers

When you need a querier for one or more operations but don't need a transaction, use `pool.withQuerier()`. It acquires a querier, runs your callback, and guarantees release — even if an error is thrown.

```ts
import { pool } from './uql.config.js';
import { User } from './shared/models/index.js';

const users = await pool.withQuerier(async (querier) => {
  return querier.findMany(User, { $limit: 10 });
});
// querier is automatically released here
```

This is especially useful when you want to **release the connection before doing slow non-DB work** (e.g. calling an external API or LLM), preventing connection pool starvation:

```ts
// Phase 1 — read from DB (connection held briefly)
const data = await pool.withQuerier(async (querier) => {
  return querier.findOne(Resource, { $where: { id: resourceId } });
});

// Phase 2 — slow external call (no connection held)
const result = await callExternalApi(data);

// Phase 3 — write result back (connection held briefly)
await pool.withQuerier(async (querier) => {
  await querier.updateOneById(Resource, resourceId, { result });
});
```

---

## Transactions

Transactions ensure that a series of database operations either all succeed or all fail, maintaining data integrity. UQL provides several ways to handle transactions depending on your needs.

## 1. Declarative Transactions

Perfect for **NestJS** and other Dependency Injection frameworks and/or where you have Services or Repositories. Use `@Transactional()` to wrap a method and `@InjectQuerier()` to access the managed connection as a parameter of the function. UQL automatically handles the entire lifecycle: acquiring/starting the transaction, committing on success, rolling back on error, and releasing the connection.

```ts
import { Transactional, InjectQuerier, type Querier } from '@uql/core';
import { User, Profile } from './shared/models/index.js';

export class UserService {
  @Transactional()
  async register(
    userData: Partial<User>, 
    profileData: Partial<Profile>, 
    @InjectQuerier() 
    querier?: Querier
  ) {
    const userId = await querier.insertOne(User, userData);
    await querier.insertOne(Profile, { ...profileData, userId });
  }
}
```

:::note
The `@Transactional()` decorator requires `experimentalDecorators` and `emitDecoratorMetadata` to be enabled in your `tsconfig.json`.
:::

---

## 2. Functional Transactions (Recommended for general cases)

The functional approach is the most convenient way to run transactions manually. UQL automatically handles the entire lifecycle: acquiring/starting the transaction, committing on success, rolling back on error, and releasing the connection.

### Using `querier.transaction()`

If you already have an active `querier` instance, you can use its `transaction` method to achieve automatic commit/rollback behavior.

```ts
import { pool } from './uql.config.js';
import { User, Profile } from './shared/models/index.js';

const querier = await pool.getQuerier();

try {
  const result = await querier.transaction(async () => {
    const userId = await querier.insertOne(User, { name: '...' });
    await querier.insertOne(Profile, { userId, bio: '...' });
    return userId;
  });
} finally {
  await querier.release();
}
```

### Using `pool.transaction()`

This is an alternative way to run a group of operations atomically by obtaining a fresh connection from the pool.

```ts
import { pool } from './uql.config.js';
import { User, Profile } from './shared/models/index.js';

const result = await pool.transaction(async (querier) => {
  const user = await querier.findOne(User, { $where: { email: '...' } });
  const profileId = await querier.insertOne(Profile, { userId: user.id, bio: '...' });
  return { userId: user.id, profileId };
});
// The querier is automatically released after the transaction
```

---

## 3. Imperative Transactions

For scenarios requiring granular control over the transaction lifecycle, you can manually manage the transaction on a `querier` instance.

> [!WARNING]
> When using manual transactions, **always ensure queriers are released back to the pool**, even in the event of an error.

```ts
import { pool } from './uql.config.js';
import { User, Profile } from './shared/models/index.js';

async function registerUser(userData: any, profileData: any) {
  // 1. Obtain a querier from the pool
  const querier = await pool.getQuerier();
  
  try {
    // 2. Start the transaction
    await querier.beginTransaction();

    const userId = await querier.insertOne(User, userData);
    await querier.insertOne(Profile, { ...profileData, userId });

    // 3. Commit the transaction
    await querier.commitTransaction();
  } catch (error) {
    // 4. Rollback on error
    await querier.rollbackTransaction();
    throw error;
  } finally {
    // 5. Always release the querier
    await querier.release();
  }
}
```

## Summary Table

| Approach                | Lifecycle Management | Use Case                                       |
| :---------------------- | :------------------- | :--------------------------------------------- |
| `pool.withQuerier()`    | **Automatic**        | Scoped connection without transaction overhead. |
| `@Transactional()`      | **Automatic**        | NestJS and DI frameworks.                       |
| `querier.transaction()` | **Semi-Automatic**   | When you already have a querier.                |
| `pool.transaction()`    | **Automatic**        | General purpose standalone transactions.        |
| `beginTransaction()`    | **Manual**           | Extreme control, low-level needs.               |
