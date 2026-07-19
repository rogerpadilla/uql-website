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
import type { Query, Type } from 'uql-orm/type';
import { pool } from './uql.config.js';
import { User } from './shared/models/index.js';

const t = initTRPC.create();

function passthrough<T>(): (value: unknown) => T {
  return (value) => value as T;
}

function entityRouter<E extends object>(entity: Type<E>) {
  return t.router({
    findMany: t.procedure
      .input(passthrough<Query<E>>())
      .query(({ input }) => pool.findMany(entity, input)),
    insertOne: t.procedure
      .input(passthrough<E>())
      .mutation(({ input }) => pool.transaction((querier) => querier.insertOne(entity, input))),
  });
}

export const appRouter = t.router({
  user: entityRouter(User),
});
```

On the client, the whole query - filters, sorting, and nested relation loading - is fully typed end to end and reaches the server as plain JSON, with no per-procedure schema to keep in sync:

```ts
const users = await trpc.user.findMany.query({
  $select: { id: true, name: true },
  $where: { status: 'active', email: { $endsWith: '@domain.com' } },
  // load each user's recent published posts in the same round-trip
  $populate: { posts: { $select: { title: true }, $where: { published: true }, $sort: { createdAt: 'desc' }, $limit: 5 } },
  $sort: { createdAt: 'desc' },
  $limit: 10,
});
// `users` is fully typed: User[], each with a typed `posts: Post[]`
```

:::caution[Validate public inputs]
`passthrough<T>()` declares the input type without runtime validation, trusting the caller's shape. For procedures exposed to untrusted clients, validate with a schema (e.g. zod) and scope the query server-side. For tenant isolation, wrap the procedure body in `withContext(getContext(ctx), () => ...)` with a `security` [filter](/querying/filters) - non-bypassable and fail-closed - rather than hand-folding tenant filters into `$where`. See [Multi-tenancy](/multi-tenancy).
:::

:::tip
Prefer tRPC when you want per-procedure contracts and its client tooling; prefer the [HTTP core](/extensions-http) when you want zero-boilerplate CRUD for many entities. They compose fine in one app, and the query object is identical either way: [one query, every transport](/querying/querier#the-same-query-every-transport).
:::
