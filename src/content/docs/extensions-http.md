---
title: HTTP (any framework)
sidebar:
  order: 250
description: Serve UQL entities over HTTP from any framework with the framework-agnostic transport core.
---

## The HTTP transport core

`uql-orm/http` turns your entities into a REST API without tying you to a web framework. It contains the whole transport: the route table, the request/response envelopes, query (de)serialization, querier lifecycle, transactions, and authorization hooks. Framework adapters are thin bindings on top:

- `createFetchHandler` returns a web-standard `(request: Request) => Promise<Response>` that mounts natively on Hono, Elysia, Next.js route handlers, Bun.serve, Deno.serve, Cloudflare Workers, SvelteKit, and Astro.
- [`uql-orm/express`](/extensions-express) binds the same core to Express.
- `createRequestHandler` is the underlying normalized-request handler if you need to bind a framework that is neither fetch-native nor Express (see the Fastify bridge below).

:::note
This layer is completely optional. UQL works perfectly fine as a standalone ORM without it.
:::

The query object you serve here is the same one you write on the server and send from the browser: see [one query, every transport](/querying/querier#the-same-query-every-transport).

### Quick start (any fetch-native runtime)

```ts
import { createFetchHandler } from 'uql-orm/http';
import './uql.config.js'; // setQuerierPool + entity imports
import { User, Post } from './shared/models/index.js';

const handler = createFetchHandler({ include: [User, Post] });
```

Mount it:

```ts
// Bun
Bun.serve({ fetch: handler });

// Hono (prefix stripped automatically by mount)
import { Hono } from 'hono';
const app = new Hono();
app.mount('/api', handler);

// Elysia (prefix stripped automatically by mount)
import { Elysia } from 'elysia';
new Elysia().mount('/api', handler).listen(3000);

// Next.js: app/api/uql/[[...uql]]/route.ts
const handler = createFetchHandler({ include: [User], basePath: '/api/uql' });
export { handler as GET, handler as HEAD, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

// Cloudflare Workers (pairs well with uql-orm/d1)
export default { fetch: handler };

// Deno
Deno.serve(handler);

// SvelteKit: src/routes/api/[...uql]/+server.ts
const handler = createFetchHandler({ include: [User], basePath: '/api' });
export const fallback = ({ request }) => handler(request);

// Astro: src/pages/api/uql/[...uql].ts (on-demand rendering: SSR adapter required)
const handler = createFetchHandler({ include: [User], basePath: '/api/uql' });
export const prerender = false;
export const ALL = ({ request }) => handler(request);
```

Use `basePath` to strip a URL prefix when the runtime does not strip it for you (Next.js, SvelteKit, Astro, plain `Bun.serve` under a sub-path).

For a fuller walkthrough with hooks and route composition, see the dedicated [Hono](/hono) and [Elysia](/elysia) recipes.

### Wire protocol

For an entity named `User` (paths derive from the kebab-cased class name):

| Operation       | Method   | Endpoint      | Body      | Description                                          |
| :-------------- | :------- | :------------ | :-------- | :--------------------------------------------------- |
| `findMany`      | `GET`    | `/user`       |           | List records; add `?count=true` for the total count. |
| `findOne`       | `GET`    | `/user/one`   |           | First record matching the query.                     |
| `count`         | `GET`    | `/user/count` |           | Count matching records.                              |
| `findOneById`   | `GET`    | `/user/:id`   |           | One record by primary key.                           |
| `insertOne`     | `POST`   | `/user`       | object    | Insert a record.                                     |
| `insertMany`    | `POST`   | `/user/many`  | array     | Insert many records.                                 |
| `saveOne`       | `PUT`    | `/user`       | object    | Insert or update (upsert).                           |
| `saveMany`      | `PUT`    | `/user/many`  | array     | Insert or update many.                               |
| `updateMany`    | `PATCH`  | `/user`       | object    | Bulk partial update of records matching `$where`.    |
| `updateOneById` | `PATCH`  | `/user/:id`   | object    | Partial update by primary key.                       |
| `deleteOneById` | `DELETE` | `/user/:id`   |           | Delete by primary key.                               |
| `deleteMany`    | `DELETE` | `/user`       |           | Bulk delete of records matching the query.           |

For entities with a [soft-delete](/entities/soft-delete) field, both delete routes soft-delete by default; pass `?hardDelete=true` to permanently remove the records instead.

All `GET` endpoints accept UQL's [serializable JSON query syntax](/querying/querier): `$select`, `$populate`, `$exclude`, `$where`, and `$sort` travel as JSON strings in the query string; `$skip` and `$limit` as numbers. Writes run inside a transaction; reads acquire and release a pooled querier automatically. `HEAD` requests are served as their `GET` counterparts, and malformed JSON in the query string or body is rejected with a `400`.

#### HTTP QUERY (RFC 10008)

The read routes also accept the new `QUERY` method as an alternate transport: same semantics as `GET` (safe, idempotent, cacheable), but the JSON query travels in the request body, so large `$where`/`$populate` queries never hit URL-length limits or percent-encoding overhead.

| Method  | Endpoint      | Equivalent to    |
| :------ | :------------ | :--------------- |
| `QUERY` | `/user`       | `GET /user`      |
| `QUERY` | `/user/one`   | `GET /user/one`  |
| `QUERY` | `/user/count` | `GET /user/count`|

Supported out of the box by `createFetchHandler`, the Express adapter, Node 22+, and Bun. The host framework must route the method too: SvelteKit's `fallback` export does, while Next.js route handlers only accept the standard verbs, so keep `GET` there. Cross-origin browser calls trigger a CORS preflight (QUERY is not a safelisted method), and some proxies/CDNs may not forward unknown methods yet, which is why the [browser client](/extensions-browser) keeps `GET` as the default and makes `QUERY` opt-in.

Responses use one envelope everywhere:

```jsonc
// success
{ "data": ..., "count": 3 }

// error (status mirrors `code`)
{ "error": { "message": "forbidden", "code": 403 } }
```

The route table is exported as `CRUD_ROUTES`, and its keys are compile-time constrained to `UniversalQuerier` method names, so the server adapters, the [browser client](/extensions-browser), and your own tooling share a single source of truth.

### Authorization and tenant scoping (hooks)

Hooks run before the querier is touched. They can be async, receive the adapter's native request as `context`, and abort by throwing (a numeric `status` on the error becomes the HTTP status):

```ts
const handler = createFetchHandler({
  include: [Resource],
  async preFilter({ query, context }) {
    // context is the web Request (with uql-orm/express it is the express req)
    const user = await authenticate(context.headers.get('authorization'));
    if (!user) {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    }
    // fold tenant scoping into the query; runs for every GET and DELETE
    query.$where ??= {};
    Object.assign(query.$where, { workspaceId: user.activeWorkspaceId });
  },
  preSave(ctx) {
    // runs for POST, PUT, and PATCH; reassign ctx.body to sanitize or inject fields
    ctx.body = { ...(ctx.body as object), updatedAt: Date.now() };
  },
});
```

| Hook        | Lifecycle                          | Use case                                                       |
| :---------- | :--------------------------------- | :------------------------------------------------------------- |
| `pre`       | Before every operation.            | Logging, auditing, global validation.                          |
| `preSave`   | Before `POST`, `PUT`, `PATCH`.     | Injecting `creatorId`, sanitization.                           |
| `preFilter` | Before `GET`, `DELETE`.            | Row-level security, tenant isolation, forcing soft-delete (`hardDelete: false`). |
| `post`      | After the operation (post-commit). | Response shaping: strip secrets, derive presentation fields.   |

The hook context also carries `meta` (entity metadata), `op` (e.g. `'findMany'`), and `method`, so a single hook can branch per entity or per operation.

### Tenant scoping (recommended: `getContext` + security filters)

Hand-folding `workspaceId` into `$where` (above) works, but for real multi-tenancy prefer a `security` [filter](/querying/filters) plus the `getContext` option. `getContext` derives the context from the verified request and runs the whole request inside `withContext`, so **every** query - reads, writes, relations, cascades - is scoped automatically, can't be bypassed from the wire, and fails closed if the context is missing:

```ts
const handler = createFetchHandler({
  include: [Invoice],
  getContext: (req) => ({ tenantId: authenticate(req).tenantId }), // from a verified session / JWT
});
```

```ts
@Filter('tenant', {
  condition: (ctx) => (ctx?.tenantId != null ? { companyId: ctx.tenantId } : undefined),
  security: true,
})
@Entity()
export class Invoice {}
```

See [Multi-tenancy](/multi-tenancy) for the full walkthrough.

`post` receives the mutable success envelope, which covers sanitization that a forced `$select`/`$exclude` cannot express, like deriving flags from stripped secrets:

```ts
post({ meta }, envelope) {
  if (meta.entity === Integration) {
    envelope.data = (envelope.data as Integration[]).map(({ accessToken, ...rest }) => ({
      ...rest,
      hasAccessToken: !!accessToken,
    }));
  }
}
```

### Composing with custom routes

The handlers intentionally cover only single-entity CRUD: anything else returns a 404 from `createFetchHandler` and falls through via `next()` in the Express adapter, so both styles share one prefix. Keep hand-written routes next to them for read-modify-write logic (compute a value from current state, then write), multi-entity transactions (`pool.transaction`), aggregations (`querier.aggregate`), raw SQL and vector search, file uploads, streaming/SSE, and third-party side effects (payments, OAuth, webhooks).

### Bridging a non-fetch framework (Fastify example)

`createRequestHandler` takes a plain normalized object, so a bridge is a few lines (see the dedicated [Fastify recipe](/fastify) for hooks and error handling):

```ts
import { createRequestHandler, toErrorResponse } from 'uql-orm/http';

const handle = createRequestHandler({ include: [User] });

fastify.all('/api/:entityPath/:subPath?', async (req, reply) => {
  const { entityPath, subPath } = req.params;
  const pending = handle({
    method: req.method,
    entityPath,
    subPath,
    query: req.query,
    body: req.body,
    context: req,
  });
  if (!pending) return reply.callNotFound();
  try {
    const { status, body } = await pending;
    reply.status(status).send(body);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    reply.status(status).send(body);
  }
});
```

`fastify.all` registers the standard verbs only, so this bridge serves the `GET` transport but not `QUERY`.

:::caution[Minification]
Entity routes derive from `entity.name` at runtime. If you minify your server bundle, keep class names intact (`keep_classnames` in terser, `keepNames` in esbuild), otherwise routes and client URLs change.
:::
