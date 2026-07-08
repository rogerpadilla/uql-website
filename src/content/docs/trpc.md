---
title: tRPC
sidebar:
  order: 270
description: Expose UQL entities as tRPC procedures with the serializable JSON query as procedure input.
---

## tRPC Recipe

UQL queries are plain JSON, so they pass through tRPC procedures without any adapter. There is nothing to install beyond your existing tRPC setup: procedures call the querier pool directly.

```ts
import { initTRPC } from '@trpc/server';
import { getQuerierPool } from 'uql-orm';
import type { Query, Type } from 'uql-orm/type';
import { User } from './shared/models/index.js';

const t = initTRPC.create();
const pool = getQuerierPool();

function passthrough<T>(): (value: unknown) => T {
  return (value) => value as T;
}

function entityRouter<E extends object>(entity: Type<E>) {
  return t.router({
    findMany: t.procedure
      .input(passthrough<Query<E>>())
      .query(({ input }) => pool.withQuerier((querier) => querier.findMany(entity, input))),
    insertOne: t.procedure
      .input(passthrough<E>())
      .mutation(({ input }) => pool.transaction((querier) => querier.insertOne(entity, input))),
  });
}

export const appRouter = t.router({
  user: entityRouter(User),
});
```

On the client, the query object is fully typed end to end:

```ts
const users = await trpc.user.findMany.query({
  $where: { email: { $endsWith: '@domain.com' } },
  $limit: 10,
});
```

:::caution[Validate public inputs]
`passthrough<T>()` declares the input type without runtime validation, trusting the caller's shape. For procedures exposed to untrusted clients, validate with a schema (e.g. zod) and scope the query server-side. For tenant isolation, wrap the procedure body in `withContext(getContext(ctx), () => ...)` with a `security` [filter](/querying/filters) - non-bypassable and fail-closed - rather than hand-folding tenant filters into `$where`. See [Multi-tenancy](/multi-tenancy).
:::

:::tip
Prefer tRPC when you want per-procedure contracts and its client tooling; prefer the [HTTP core](/extensions-http) when you want zero-boilerplate CRUD for many entities. They compose fine in one app.
:::
