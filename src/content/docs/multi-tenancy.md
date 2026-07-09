---
title: Multi-tenancy
sidebar:
  order: 130
description: Scope every query to the current tenant automatically with security filters and request context.
---

## Multi-tenancy & Row-Level Security

UQL scopes queries to the current tenant with a **`security` [filter](/querying/filters)** whose condition reads a per-request **context**. Once set up, every read, update, and delete - including relations and cascades - is scoped automatically. You never write `WHERE tenantId = ...` by hand, and you can't forget it.

### 1. Mark the tenant filter `security`

Its condition is a function of the ambient context:

```ts
import { Entity, Id, Field, Filter } from 'uql-orm';

@Filter('tenant', {
  // with no tenant, return `undefined` (instead of { companyId: undefined }) so the query throws instead of running unscoped
  condition: (ctx) => (ctx?.tenantId != null ? { companyId: ctx.tenantId } : undefined),
  security: true,
})
@Entity()
export class Invoice {
  @Id() id?: number;
  @Field() companyId?: number;
  @Field() total?: number;
}
```

Optionally type the context once so `ctx.tenantId` is typed everywhere:

```ts
declare module 'uql-orm' {
  interface UqlContext {
    tenantId: number;
    userId: string;
  }
}
```

### 2. Set the context for a unit of work

`withContext` establishes the ambient context; it propagates across `await`, `Promise.all`, and transactions - including the [pool-level reads](/querying/querier#parallel-reads-on-the-pool), so one wrapper scopes a whole parallel fan-out:

```ts
import { withContext } from 'uql-orm';

await withContext({ tenantId: 42 }, async () => {
  await querier.findMany(Invoice, { $where: { total: { $gt: 100 } } });
  // Generated SQL:
  //   SELECT ... FROM "Invoice" WHERE ("total" > $1) AND ("companyId" = $2)   -- $2 = 42

  await Promise.all([pool.findMany(Invoice, {}), pool.count(Invoice, {})]); // both scoped to tenant 42
});
```

Wire it once at your HTTP boundary and every request is scoped. `getContext` receives the framework's request; read the tenant from a **verified** source (a session store, or a decoded JWT) - never from client input, which a caller could forge to reach another tenant:

```ts
// framework-agnostic HTTP handler - tenant from the session
createRequestHandler({ getContext: (req) => ({ tenantId: req.session.tenantId }) });

// ...or from an auth layer that populated req.user (Passport, a guard, JWT middleware)
createRequestHandler({ getContext: (req) => ({ tenantId: req.user.tenantId }) });
```

```ts
// NestJS - see the NestJS guide
UqlModule.forRoot({ pool, getContext: (req) => ({ tenantId: req.user.tenantId }) });
```

### What `security: true` guarantees

- **Always applied** - `{ filters: false }` and per-name bypass are ignored for security filters.
- **Can't be widened by the client** - the condition is AND-merged as its own predicate, so a request sending `$where: { companyId: 999 }` becomes `companyId = 999 AND companyId = 42`, which matches no rows, never a cross-tenant read.
- **Fails closed** - if the context is missing (`tenantId` undefined, so the condition returns `undefined`), the query throws `UqlSecurityError` instead of running unscoped. (`onMissing: 'skip'` is rejected on security filters - they must fail closed.)
- **Wire-safe over HTTP** - the request parser only accepts query keys, so a remote client can't inject `filters`/`context` to bypass it. Always derive the tenant from a verified source (session, JWT), never from client input.

### Combining with soft-delete

Security and convenience filters compose. An `Invoice` that is also [soft-deletable](/entities/soft-delete) gets both predicates automatically:

```sql
SELECT ... FROM "Invoice" WHERE ("companyId" = $1) AND ("deletedAt" IS NULL)
```

A cross-tenant admin task can bypass *convenience* filters but never the security one:

```ts
querier.findMany(Invoice, {}, withDeleted()); // includes trashed, still tenant-scoped
```

### Non-HTTP contexts (jobs, scripts, tests)

Anything that isn't an HTTP request just wraps its work in `withContext`:

```ts
await withContext({ tenantId }, () => runNightlyBilling(tenantId));
```

For trusted work that must span **all** tenants (startup recovery, cleanup sweeps), give the condition a system branch that returns `{}` ("no restriction") and run those jobs under an explicit system context - queries with no context at all still fail closed:

```ts
condition: (ctx) => (ctx?.system ? {} : ctx?.tenantId != null ? { companyId: ctx.tenantId } : undefined),

await withContext({ system: true }, () => recoverStaleJobs()); // spans every tenant, deliberately
```

### Event-driven pipelines (emitters, timers, queues)

`withContext` uses `AsyncLocalStorage`, which follows `await` chains but does **not** propagate into event-callback ticks: an emitter listener, a timer, or a queued job runs outside the scope that registered it. Two tools cover those boundaries:

- **`captureContext()`** - capture once where the context exists, replay wherever the callback fires:

  ```ts
  const scoped = captureContext(); // e.g. when the session/queue item is created inside a scoped request
  deepgram.on('transcript', (t) => scoped(() => saveTranscript(t))); // runs with the captured context
  ```

- **`{ context }` per unit of work** - when pipeline code already knows its tenant locally (a `resource.tenantId` in hand), pass it right where the querier is acquired; no ambient wiring at all:

  ```ts
  await pool.withQuerier((q) => q.updateMany(Resource, { $where: { id } }, patch), { context: { tenantId } });
  ```

Rule of thumb: same mechanism, pick by scope - `withContext` scopes a **span** (a request, a whole job), `{ context }` scopes a **single pool call**, and `captureContext()` carries a span's context across callback boundaries.

Wrap your app's few **chokepoints** (event bus, queue runners, socket dispatch) rather than every function - everything they await inherits the context.

### Filling the tenant column on insert

Filters scope reads, updates, and deletes - inserts still need the tenant value on the row. Fill it from the ambient context so payloads never mention it (an explicitly provided value still wins):

```ts
@Field({ references: () => Company, updatable: false, onInsert: () => getContext()?.tenantId })
companyId?: number;
```

:::caution[Adopt fully - don't run two scoping mechanisms]
The tenant filter *replaces* hand-threading `tenantId` through every `$where` and insert. Migrate to it completely (filter + context wiring + `onInsert` fill, deleting the manual threading) or not at all - keeping both means two sources of truth for the same rule and doubles the audit surface.
:::

:::note[App-level filters vs database-level RLS]
Security filters enforce tenancy in the ORM: they cover every UQL query - reads, writes, relations, cascades - and can't be bypassed from the wire, but they do not apply to raw SQL (`querier.all(...)`) and only hold within this application. For the strongest isolation, pair them with **database-native row-level security** (e.g. Postgres RLS policies), which the database enforces regardless of app code or which service connects. The two are complementary: the app-level filter gives ergonomic, fail-closed scoping for everyday queries; DB-native RLS is the backstop. Scope any raw queries by hand.
:::

See [Query Filters](/querying/filters) for the full filter model (named, default-on, bypassable) that this builds on.
