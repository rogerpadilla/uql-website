---
title: Transactions
sidebar:
  order: 170
description: Learn how to manage transactions and configure isolation levels in UQL.
---

## Transactions

Transactions ensure that a series of database operations either all succeed or all fail, maintaining data integrity. UQL provides several ways to handle transactions depending on your needs.

### 1. Declarative Transactions

Perfect for **NestJS** and other Dependency Injection frameworks. Use `@Transactional()` to wrap a method and `@InjectQuerier()` to access the managed connection. UQL automatically handles the entire lifecycle: acquiring/starting the transaction, committing on success, rolling back on error, and releasing the connection.

```ts
import { Transactional, InjectQuerier, type Querier } from 'uql-orm';
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

You can specify an isolation level directly at the decorator level:

```ts
@Transactional({ isolationLevel: 'serializable' })
async transferFunds(
  fromId: string, toId: string, amount: number,
  @InjectQuerier() querier?: Querier
) {
  // runs under serializable isolation
}
```

:::note
The `@Transactional()` decorator requires `experimentalDecorators` and `emitDecoratorMetadata` to be enabled in your `tsconfig.json`.
:::

---

### 2. Functional Transactions

The functional approach is the most convenient way to run transactions. UQL handles the entire lifecycle automatically.

#### Using `pool.transaction()`

Obtains a fresh querier from the pool, runs the callback in a transaction, and releases automatically:

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

#### Using `querier.transaction()`

If you already have an active `querier` instance, you can use its `transaction` method for automatic commit/rollback:

```ts
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

---

### 3. Imperative Transactions

For scenarios requiring granular control, you can manually manage the transaction lifecycle.

> [!WARNING]
> When using manual transactions, **always ensure queriers are released back to the pool**, even in the event of an error.

```ts
import { pool } from './uql.config.js';
import { User, Profile } from './shared/models/index.js';

async function registerUser(userData: Partial<User>, profileData: Partial<Profile>) {
  const querier = await pool.getQuerier();
  
  try {
    await querier.beginTransaction();

    const userId = await querier.insertOne(User, userData);
    await querier.insertOne(Profile, { ...profileData, userId });

    await querier.commitTransaction();
  } catch (error) {
    await querier.rollbackTransaction();
    throw error;
  } finally {
    await querier.release();
  }
}
```

---

## Isolation Levels

All transaction methods accept an optional `TransactionOptions` object to specify the [isolation level](https://en.wikipedia.org/wiki/Isolation_%28database_systems%29). This controls the degree of visibility a transaction has to changes made by other concurrent transactions.

### Supported Levels

| Level | Description |
| :--- | :--- |
| `read uncommitted` | Allows dirty reads — can see uncommitted changes from other transactions. |
| `read committed` | Only sees data committed before the query began. Default for most databases. |
| `repeatable read` | Ensures repeated reads within the transaction return the same result. |
| `serializable` | Strictest level — transactions execute as if they were serial. |

### Usage

Pass `isolationLevel` in the options object to any transaction method:

```ts
// Functional — pool.transaction()
const result = await pool.transaction(async (querier) => {
  const account = await querier.findOne(Account, { $where: { id: accountId } });
  await querier.updateOneById(Account, accountId, {
    balance: account.balance - amount,
  });
  return account;
}, { isolationLevel: 'serializable' });

// Functional — querier.transaction()
await querier.transaction(async () => {
  // operations...
}, { isolationLevel: 'repeatable read' });

// Imperative
await querier.beginTransaction({ isolationLevel: 'read committed' });
```

### Database Support

| Database | Behavior |
| :--- | :--- |
| **PostgreSQL** | Full support — uses `BEGIN TRANSACTION ISOLATION LEVEL ...`. |
| **MySQL / MariaDB** | Full support — uses `SET TRANSACTION ISOLATION LEVEL` before `START TRANSACTION`. |
| **SQLite / LibSQL** | Silently ignored (SQLite uses serializable by default). |
| **MongoDB** | Silently ignored. |

:::tip
The `isolationLevel` option is safely ignored on databases that don't support it — your code remains portable across all supported databases without conditional logic.
:::

---

## Nesting Behavior

When `querier.transaction()` or `@Transactional()` is called inside an existing transaction, UQL **reuses** the active transaction instead of starting a new one. This makes your code composable — a service method that uses `querier.transaction()` works correctly whether called standalone or from within another transaction.

```ts
const result = await pool.transaction(async (querier) => {
  await querier.insertOne(User, { name: 'Alice' });

  // This nested call reuses the outer transaction — no new BEGIN/COMMIT
  await querier.transaction(async () => {
    await querier.insertOne(Profile, { userId: 1, bio: '...' });
  });

  return querier.count(User, {});
});
// Both inserts are committed together by the outer transaction
```

If the inner callback throws, the error propagates to the outer transaction which rolls back **everything** — both outer and inner operations.

:::note
`beginTransaction()` is the lowest-level API and **does not** support composable transactions — it throws `TypeError('pending transaction')` if called inside an existing transaction. Use `querier.transaction()` or `@Transactional()` for that use case.
:::


---

## Transaction API Reference

| Method | Lifecycle | Isolation Level | Nesting |
| :--- | :--- | :--- | :--- |
| `pool.transaction(callback, opts?)` | **Automatic** — acquires, commits/rollbacks, releases. | ✅ via `opts` | Fresh querier |
| `pool.withQuerier(callback)` | **Automatic** — acquires and releases (no transaction). | N/A | N/A |
| `querier.transaction(callback, opts?)` | **Semi-Automatic** — commits/rollbacks (caller releases). | ✅ via `opts` | Reuses outer |
| `querier.beginTransaction(opts?)` | **Manual** — caller commits/rollbacks/releases. | ✅ via `opts` | Throws |
| `querier.commitTransaction()` | Commits the active transaction. | — | — |
| `querier.rollbackTransaction()` | Rolls back the active transaction. | — | — |
| `@Transactional({ isolationLevel? })` | **Automatic** — full lifecycle via decorator. | ✅ via options | Reuses outer |
