---
title: Elysia
sidebar:
  order: 252
description: Mount UQL entities as a REST API in Elysia with the fetch-native transport core, zero adapter required.
---

## Elysia Recipe

Elysia is fetch-native, so it mounts UQL's [HTTP transport core](/extensions-http) directly. `createFetchHandler` returns a web-standard `(request: Request) => Promise<Response>`, and `.mount()` binds it to a prefix and strips that prefix before the handler sees the request. There is nothing to install beyond `uql-orm`.

```ts
import { Elysia } from 'elysia';
import { createFetchHandler } from 'uql-orm/http';
import './uql.config.js'; // setQuerierPool + entity imports
import { User, Post } from './shared/models/index.js';

const handler = createFetchHandler({ include: [User, Post] });

new Elysia().mount('/api', handler).listen(3000);
```

This mounts the full [wire protocol](/extensions-http#wire-protocol) for each entity (list, get, count, create, upsert, bulk operations, delete) plus the [`QUERY` transport](/extensions-http#http-query-rfc-10008). Because `.mount()` forwards every method to the handler, the `QUERY` method works here without extra routing (unlike Next.js route handlers).

### Composing with Elysia routes and plugins

`.mount()` only claims the `/api` prefix, so your own Elysia routes, plugins, and lifecycle hooks live side by side with the generated CRUD. Keep hand-written routes for read-modify-write logic, multi-entity transactions, aggregations, file uploads, and streaming:

```ts
new Elysia()
  .use(cors())
  .get('/health', () => 'ok')
  .post('/checkout', ({ body }) => runCheckout(body)) // custom business logic
  .mount('/api', handler) // entity CRUD under /api
  .listen(3000);
```

### Hooks

`createFetchHandler` accepts the core's [`pre`, `preSave`, `preFilter`, and `post` hooks](/extensions-http#authorization-and-tenant-scoping-hooks). The hook `context` is the web `Request`, so read auth and tenant state from its headers:

```ts
const handler = createFetchHandler({
  include: [User, Post],
  async preFilter({ query, context }) {
    // context is the web Request; abort by throwing with a numeric status
    const user = await authenticate(context.headers.get('authorization'));
    if (!user) {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    }
    query.$where ??= {};
    Object.assign(query.$where, { creatorId: user.id });
  },
});
```

:::tip[Multi-tenancy: prefer `getContext` + a `security` filter]
Hand-folding `$where` works, but for tenant isolation prefer passing `getContext` to `createFetchHandler` plus a `security` [filter](/querying/filters). That scopes **every** query in the request automatically, can't be bypassed from the wire, and fails closed if the context is missing. See [Multi-tenancy](/multi-tenancy).
:::

:::tip
Use the fetch handler for entity CRUD and hand-written Elysia routes for everything else; unknown routes under the prefix return a 404 from the handler, so both styles coexist. For per-procedure contracts with an end-to-end typed client, see [tRPC](/trpc) and [oRPC](/orpc) instead.
:::
