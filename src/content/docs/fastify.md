---
title: Fastify
sidebar:
  order: 305
description: Serve UQL entities as a REST API in Fastify by bridging the framework-agnostic request handler.
---

## Fastify Recipe

Fastify is not fetch-native, so instead of `createFetchHandler` it binds the [HTTP transport core](/extensions-http) through `createRequestHandler`, which takes a plain normalized request object and returns a `{ status, body }` result. The bridge is a single catch-all route.

```ts
import Fastify from 'fastify';
import { createRequestHandler, toErrorResponse } from 'uql-orm/http';
import './uql.config.js'; // setQuerierPool + entity imports
import { User, Post } from './shared/models/index.js';

const fastify = Fastify();
const handle = createRequestHandler({ include: [User, Post] });

fastify.all<{
  Params: { entityPath: string; subPath?: string };
  Querystring: Record<string, unknown>;
}>('/api/:entityPath/:subPath?', async (req, reply) => {
  const { entityPath, subPath } = req.params;
  const pending = handle({
    method: req.method,
    entityPath,
    subPath,
    query: req.query,
    body: req.body,
    context: req, // passed through to hooks
  });
  // unknown entity/route: fall through to your own routes
  if (!pending) return reply.callNotFound();
  try {
    const { status, body } = await pending;
    return reply.status(status).send(body);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return reply.status(status).send(body);
  }
});

await fastify.listen({ port: 3000 });
```

This serves the full [wire protocol](/extensions-http#wire-protocol) for each entity (list, get, count, create, upsert, bulk operations, delete). `createRequestHandler` returns `undefined` for an unknown entity or route, so `reply.callNotFound()` falls through to your own routes, and thrown hook errors map to the canonical [`{ error: { message, code } }` envelope](/extensions-http#wire-protocol) via `toErrorResponse` (a numeric `status` on the error becomes the HTTP status).

:::note[`QUERY` transport not covered]
`fastify.all` registers the standard verbs only, so this bridge serves the `GET` read transport but not the [`QUERY` method](/extensions-http#http-query-rfc-10008). Fastify parses `application/json` bodies out of the box; for the write routes that is all you need.
:::

### Hooks

`createRequestHandler` accepts the core's [`pre`, `preSave`, `preFilter`, and `post` hooks](/extensions-http#authorization-and-tenant-scoping-hooks). The hook `context` is whatever you pass as `context` above, here the Fastify `request`, so session and tenant state are directly at hand:

```ts
const handle = createRequestHandler({
  include: [User, Post],
  async preFilter({ query, context }) {
    // context is the Fastify request; abort by throwing with a numeric status
    if (!context.user) {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    }
    query.$where ??= {};
    Object.assign(query.$where, { creatorId: context.user.id });
  },
});
```

:::tip[Multi-tenancy: prefer `getContext` + a `security` filter]
Hand-folding `$where` works, but for tenant isolation prefer passing `getContext` to `createRequestHandler` plus a `security` [filter](/querying/filters). That scopes **every** query in the request automatically, can't be bypassed from the wire, and fails closed if the context is missing. See [Multi-tenancy](/multi-tenancy).
:::

:::tip
Use the bridge for entity CRUD and hand-written Fastify routes for everything else; unknown routes fall through via `callNotFound()`, so both coexist under the same prefix. For per-procedure contracts with an end-to-end typed client, see [tRPC](/trpc) and [oRPC](/orpc) instead.
:::
