---
title: Hono
sidebar:
  order: 251
description: Mount UQL entities as a REST API in Hono with the fetch-native transport core, zero adapter required.
---

## Hono Recipe

Hono is fetch-native, so it mounts UQL's [HTTP transport core](/extensions-http) directly. `createFetchHandler` returns a web-standard `(request: Request) => Promise<Response>`, and `.mount()` binds it to a prefix and strips that prefix before the handler sees the request. There is nothing to install beyond `uql-orm`.

```ts
import { Hono } from 'hono';
import { createFetchHandler } from 'uql-orm/http';
import './uql.config.js'; // setQuerierPool + entity imports
import { User, Post } from './shared/models/index.js';

const handler = createFetchHandler({ include: [User, Post] });

const app = new Hono();
app.mount('/api', handler);

export default app; // Bun.serve, Deno.serve, Cloudflare Workers, Node via @hono/node-server
```

This mounts the full [wire protocol](/extensions-http#wire-protocol) for each entity (list, get, count, create, upsert, bulk operations, delete) plus the [`QUERY` transport](/extensions-http#http-query-rfc-10008). Because `.mount()` forwards every method to the handler, the `QUERY` method works here without extra routing.

### Composing with Hono routes and middleware

`.mount()` only claims the `/api` prefix, so your own Hono routes and middleware live side by side with the generated CRUD. Keep hand-written routes for read-modify-write logic, multi-entity transactions, aggregations, file uploads, and streaming:

```ts
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors());
app.get('/health', (c) => c.text('ok'));
app.post('/checkout', (c) => c.json(runCheckout(c.req))); // custom business logic
app.mount('/api', handler); // entity CRUD under /api
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
The same handler runs unchanged on Bun, Deno, Cloudflare Workers, and Node (via `@hono/node-server`); on Workers it pairs with [`uql-orm/d1`](/cloudflare-d1). Use the fetch handler for entity CRUD and hand-written Hono routes for everything else. For per-procedure contracts with an end-to-end typed client, see [tRPC](/trpc) and [oRPC](/orpc) instead.
:::
