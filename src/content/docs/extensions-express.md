---
title: Express
sidebar:
  order: 300
description: Auto-generate REST endpoints for your entities with the UQL Express middleware.
---

## Express Extension

UQL provides a built-in Express middleware to automatically generate RESTful APIs for your entities with zero boilerplate. It is a thin adapter over the framework-agnostic [HTTP transport core](/extensions-http), which owns the route table, the request/response envelopes, and the hook system; this page covers only what is Express-specific.
:::note
This extension is completely optional. UQL works perfectly fine as a standalone ORM without it.
:::

### Quick Start

```ts
import express from 'express';
import { querierMiddleware } from 'uql-orm/express';
import { pool } from './uql.config.js';
import { User, Post } from './shared/models/index.js';

const app = express();
app.use(express.json());

// This will automatically generate routes like /api/user and /api/post
app.use('/api', querierMiddleware({
  include: [User, Post]
}));

app.listen(3000);
```

This mounts the full [wire protocol](/extensions-http#wire-protocol) for each entity (list, get, count, create, upsert, bulk operations, delete, plus the [`QUERY` transport](/extensions-http#http-query-rfc-10008)). Unknown entities and routes fall through via `next()`, so the middleware composes with your custom routes (webhooks, payments, SSE) on the same app.

### Hooks

The middleware accepts the core's [`pre`, `preSave`, `preFilter`, and `post` hooks](/extensions-http#authorization-and-tenant-scoping-hooks). Under Express, `ctx.context` is the `express.Request`, so session and tenant state are directly at hand:

```ts
app.use('/api', querierMiddleware({
  include: [User, Post],

  // Intercept save operations (POST, PUT, PATCH)
  preSave(ctx) {
    // Automatically set the creatorId from the session
    ctx.body = { ...(ctx.body as object), creatorId: ctx.context.user.id };
  },

  // Intercept filter operations (GET, DELETE)
  async preFilter({ query, context }) {
    // Enforce Row-Level Security: users only see their own data.
    // Abort by throwing an Error with a numeric status, e.g.
    // throw Object.assign(new Error('unauthorized'), { status: 401 });
    await ensureAuthenticated(context);
    query.$where ??= {};
    Object.assign(query.$where, { creatorId: context.user.id });
  }
}));
```

:::tip[Multi-tenancy: prefer `getContext` + a `security` filter]
Hand-folding `$where` in `preFilter` works, but for tenant isolation prefer passing `getContext` to `querierMiddleware` (it takes the same options as the [HTTP core](/extensions-http)) plus a `security` [filter](/querying/filters). That scopes **every** query in the request automatically, can't be bypassed from the wire, and fails closed if the context is missing. See [Multi-tenancy](/multi-tenancy).
:::

### Error handling

Errors go to `next(err)`, so your own error middleware keeps working. The exported `errorHandler` renders the canonical [`{ error: { message, code } }` envelope](/extensions-http#wire-protocol), honoring a numeric `status` thrown by hooks:

```ts
import { errorHandler } from 'uql-orm/express';

app.use('/api', querierMiddleware({ include: [User] }));
app.use(errorHandler);
```

:::note[Dynamic ID Mapping]
The middleware automatically detects the primary key defined via `@Id()` in your entity metadata. Route parameters like `:id` are not hardcoded to the property name `id`, but are mapped dynamically to whatever you've defined as your entity's identifier (e.g., `uuid`, `itemNo`, etc.).
:::

:::tip
All `GET` endpoints support UQL's [serializable JSON query syntax](/querying/querier), allowing your frontend to perform complex joins and filters directly via URL parameters. Remember to enable a JSON body parser (`app.use(express.json())`) for the write routes and the `QUERY` transport.
:::
