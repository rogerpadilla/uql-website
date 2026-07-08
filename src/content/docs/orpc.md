---
title: oRPC
sidebar:
  order: 275
description: Expose UQL entities as oRPC procedures with type-safe pass-through inputs.
---

## oRPC Recipe

UQL queries are plain JSON, so they pass through [oRPC](https://orpc.dev) procedures without any adapter. There is nothing to install beyond your existing oRPC setup: procedures call the querier pool directly, and oRPC's `type<T>()` helper declares the pass-through input type.

```ts
import { os, type } from '@orpc/server';
import { getQuerierPool } from 'uql-orm';
import type { Query, Type } from 'uql-orm/type';
import { User } from './shared/models/index.js';

const pool = getQuerierPool();

function entityRouter<E extends object>(entity: Type<E>) {
  return {
    findMany: os
      .input(type<Query<E>>())
      .handler(({ input }) => pool.withQuerier((querier) => querier.findMany(entity, input))),
    insertOne: os
      .input(type<E>((value) => value)) // identity mapper: required when the input type is an open generic
      .handler(({ input }) => pool.transaction((querier) => querier.insertOne(entity, input))),
  };
}

export const router = { user: entityRouter(User) };
```

On the client, the query object is fully typed end to end:

```ts
const users = await client.user.findMany({
  $where: { email: { $endsWith: '@domain.com' } },
  $limit: 10,
});
```

:::caution[Validate public inputs]
`type<T>()` declares the input type without runtime validation, the same trust model as `passthrough<T>()` in the [tRPC recipe](/trpc). For procedures exposed to untrusted clients, validate with a schema (e.g. zod) and scope the query server-side. For tenant isolation, wrap the handler in `withContext(getContext(ctx), () => ...)` with a `security` [filter](/querying/filters) - non-bypassable and fail-closed - rather than hand-folding tenant filters into `$where`; see [Multi-tenancy](/multi-tenancy). Note that oRPC generates OpenAPI specs only from real schemas; type-only inputs are excluded.
:::

:::tip
Prefer oRPC or [tRPC](/trpc) when you want per-procedure contracts; prefer the [HTTP core](/extensions-http) for zero-boilerplate CRUD across many entities. oRPC's `RPCHandler` is fetch-native, so both mount side by side in one app.
:::
