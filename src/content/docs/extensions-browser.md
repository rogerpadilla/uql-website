---
title: Browser
sidebar:
  order: 400
description: Run type-safe UQL queries from the browser with HttpQuerier and shared entity classes.
---

## Browser Extension

The `uql-orm/browser` extension allows you to consume UQL REST APIs (served by the [HTTP core](/extensions-http) or the [Express Extension](/extensions-express)) on the frontend with the same type-safe syntax you use on the backend.
:::note
This extension is completely optional. UQL works perfectly fine as a standalone ORM without it.
:::

### Quick Start

1.  **Initialize the HttpQuerier**:

    ```ts
    import { HttpQuerier } from 'uql-orm/browser';

    // Configure the frontend to point to your backend API
    const querier = new HttpQuerier('https://api.yourdomain.com/api');
    ```

2.  **Query Data**: Interact with your entities as if you were on the backend.

    ```ts
    import { User } from './shared/models/index.js';

    const { data: users } = await querier.findMany(User, {
      $select: { email: true },
      $populate: { profile: { $select: { picture: true } } },
      $where: { email: { $endsWith: '@domain.com' } },
      $sort: { createdAt: 'desc' },
      $limit: 10
    });
    ```

### Client API

Every wire operation has a typed method: `findMany`, `findManyAndCount`, `findOne`, `findOneById`, `count`, `insertOne`, `insertMany`, `saveOne` (upsert via `PUT`), `saveMany`, `updateOneById`, `updateMany`, `deleteOneById`, and `deleteMany`. Responses are `{ data, count? }`.

Failed requests throw a `RequestError` carrying the server's message and the numeric HTTP `status`, so status-driven flows (401 redirect to login, 402 payment required, error-boundary routing) work without string matching:

```ts
import { RequestError } from 'uql-orm/browser';

try {
  await querier.findMany(User, {});
} catch (err) {
  if (err instanceof RequestError && err.status === 401) {
    location.href = '/login';
  }
}
```

Long-running or cancelable calls take an `AbortSignal`:

```ts
await querier.findMany(User, q, { signal: AbortSignal.timeout(120_000) });
```

### HTTP QUERY transport

Opt in to the new `QUERY` method (RFC 10008) to send read queries in the request body instead of the URL, avoiding URL-length limits for large `$where`/`$populate` queries:

```ts
const querier = new HttpQuerier('/api', { readMethod: 'QUERY' });
```

`findOne`, `findMany`, and `count` then use `QUERY`; writes and by-id reads keep their canonical methods. The default stays `GET` because cross-origin `QUERY` requires a CORS preflight and some proxies/CDNs do not forward the method yet; the server accepts both transports simultaneously, so you can switch per client.

For non-CRUD action endpoints (`/api/payments/checkout`, `/api/resources/regenerate`, ...), the underlying typed helpers `get`, `post`, `put`, `patch`, `remove`, and `query` are exported from `uql-orm/browser` as an escape hatch; they share the same envelope, headers, notifications, and `RequestError` behavior.

The mapping stays in sync with the server automatically: URLs derive from the shared `CRUD_ROUTES` contract in `uql-orm/http`, and a compile-time check guarantees the client covers every wire operation.

### Shared Entities & Type Safety

Because queries are validated against your entity classes, you can share those classes between backend and frontend and get the same types on both sides.

```ts
// shared/models/User.ts
import { Entity, Id, Field } from 'uql-orm';

@Entity()
export class User {
  @Id()
  id?: string;

  @Field()
  name?: string;
}

// frontend/app.ts
import { User } from '../shared/models/User.js';
const { data: users } = await querier.findMany(User, { 
  $where: { name: { $startsWith: 'A' } } 
});
// 'users' is automatically typed as User[]
```

### Authentication & Headers

Pass `headers` per call for JWT tokens or other credentials; they are merged over the JSON defaults:

```ts
const users = await querier.findMany(User, {
  $where: { status: 'active' }
}, {
  headers: {
    'Authorization': `Bearer ${session.token}`,
    'X-Custom-Header': 'value'
  }
});
```

For SSR, or to avoid repeating the token on every call, set instance-level default headers. Per-call headers win over instance defaults:

```ts
// one scoped instance per server-side request; no shared global state
const querier = new HttpQuerier('/api', {
  headers: { Authorization: `Bearer ${session.token}` },
});
```

:::tip
Combined with the server-side hooks of the [HTTP core](/extensions-http), this gives you a type-safe data layer from the browser all the way to the database: the query you send is the same object the server writes ([one query, every transport](/querying/querier#the-same-query-every-transport)). Using TanStack Query? See the [React Query recipe](/react-query): the serializable query object doubles as the cache key.
:::

### Request notifications

`uql-orm/browser` exposes a small pub/sub bus (`on`) emitting `start`, `success`, `error`, and `complete` phases per request, handy for a global loading spinner in vanilla apps. It is optional: libraries like React Query already track loading/error state, so pass `{ silent: true }` and skip the bus there.
