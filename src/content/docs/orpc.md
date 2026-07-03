---
title: oRPC
sidebar:
  order: 275
description: Expose UQL entities as oRPC procedures with type-safe pass-through inputs.
---

## oRPC Recipe

UQL queries are plain JSON, so they pass through [oRPC](https://orpc.dev) procedures without any adapter. oRPC's `type<T>()` helper declares a type-only input, which fits UQL's `Query<E>` exactly, and routers are plain objects:

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
      .input(type<E>((value) => value)) // identity mapper: needed when the input type is an open generic
      .handler(({ input }) => pool.transaction((querier) => querier.insertOne(entity, input))),
  };
}

export const router = { user: entityRouter(User) };
```

Mount it in any fetch-native runtime with the `RPCHandler`; it composes with the [HTTP core](/extensions-http) on the same server:

```ts
import { RPCHandler } from '@orpc/server/fetch';
import { router } from './router.js';

const rpc = new RPCHandler(router);

export default {
  async fetch(request: Request) {
    const { matched, response } = await rpc.handle(request, { prefix: '/rpc' });
    return matched ? response : new Response('Not Found', { status: 404 });
  },
};
```

On the client, the query object is fully typed end to end:

```ts
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { router } from './router.js';

const link = new RPCLink({ url: 'https://api.example.com/rpc' });
const client: RouterClient<typeof router> = createORPCClient(link);

const users = await client.user.findMany({
  $where: { email: { $endsWith: '@domain.com' } },
  $limit: 10,
});
```

:::caution[Validate public inputs]
`type<T>()` declares the input type without runtime validation, the same trust model as the cast in the [tRPC recipe](/trpc). For procedures exposed to untrusted clients, validate with a schema (e.g. zod) and scope the query server-side, the way the [HTTP core hooks](/extensions-http) fold tenant filters into `$where`. Note that oRPC generates OpenAPI specs only from real schemas; type-only inputs are excluded.
:::

:::tip
Prefer oRPC or [tRPC](/trpc) when you want per-procedure contracts; prefer the [HTTP core](/extensions-http) for zero-boilerplate CRUD across many entities. They compose fine in one app.
:::
