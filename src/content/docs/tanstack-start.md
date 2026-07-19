---
title: TanStack Start
sidebar:
  order: 62
description: Use UQL in TanStack Start via type-safe server functions and a catch-all server route that mounts the HTTP transport core.
---

## TanStack Start Recipe

TanStack Start is full-stack and fetch-native, so UQL plugs in two ways: call the pool from type-safe **server functions**, or mount the [HTTP transport core](/extensions-http) as a catch-all **server route** for zero-boilerplate CRUD. Nothing to install beyond `uql-orm`.

### Server functions

A UQL query is plain JSON, so it passes through a server function as the validated input with full end-to-end types, no adapter:

```ts
import { createServerFn } from '@tanstack/react-start';
import type { Query } from 'uql-orm/type';
import { pool } from './uql.config.js';
import { User } from './shared/models/index.js';

export const listUsers = createServerFn({ method: 'GET' })
  .validator((query: Query<User>) => query) // type-only pass-through
  .handler(({ data }) => pool.findMany(User, data));

export const createUser = createServerFn({ method: 'POST' })
  .validator((user: User) => user)
  .handler(({ data }) => pool.transaction((querier) => querier.insertOne(User, data)));
```

From a component or route loader, the whole query, including nested relation loading, stays typed end to end:

```ts
const users = await listUsers({
  data: {
    $select: { id: true, name: true },
    $where: { status: 'active' },
    $populate: { posts: { $select: { title: true }, $where: { published: true }, $limit: 5 } },
    $sort: { createdAt: 'desc' },
    $limit: 10,
  },
});
// `users` is typed User[], each with a typed `posts: Post[]`
```

:::caution[Validate public inputs]
`(query) => query` declares the input type without runtime validation, the same trust model as the [tRPC](/trpc) and [oRPC](/orpc) recipes. For functions reachable by untrusted clients, validate with a schema (e.g. zod) and scope the query server-side; for tenant isolation, run the handler inside `withContext(getContext(), () => ...)` with a `security` [filter](/querying/filters). See [Multi-tenancy](/multi-tenancy).
:::

### Auto-generated CRUD (catch-all server route)

To expose every entity as REST without a function per operation, mount `createFetchHandler` in a splat server route, `src/routes/api/uql/$.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router';
import { createFetchHandler } from 'uql-orm/http';
import './uql.config.js'; // registers the default querier pool
import { User, Post } from './shared/models/index.js';

const handler = createFetchHandler({ include: [User, Post], basePath: '/api/uql' });

export const Route = createFileRoute('/api/uql/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      HEAD: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
      PATCH: ({ request }) => handler(request),
      DELETE: ({ request }) => handler(request),
    },
  },
});
```

TanStack Start does not strip the route prefix, so pass `basePath: '/api/uql'` to match the splat mount. Every included entity now has typed REST endpoints (`/api/uql/user`, ...) consumable from the browser with [`HttpQuerier`](/extensions-browser).

:::note[`QUERY` transport]
The `handlers` map keys are standard HTTP verbs, so this route serves the `GET` read transport but not the [`QUERY` method](/extensions-http#http-query-rfc-10008); keep `GET` here.
:::

### Hooks and multi-tenancy

`createFetchHandler` accepts the core's [`pre`, `preSave`, `preFilter`, and `post` hooks](/extensions-http#authorization-and-tenant-scoping-hooks); the hook `context` is the web `Request`. For real tenant isolation prefer `getContext` plus a `security` [filter](/querying/filters), so every query in the request is scoped automatically, can't be bypassed from the wire, and fails closed if the context is missing. See [Multi-tenancy](/multi-tenancy).

:::tip
Use server functions for typed, per-operation calls and the catch-all route for zero-boilerplate CRUD across many entities; they compose in one app. The query object is identical either way: [one query, every transport](/querying/querier#the-same-query-every-transport).
:::
