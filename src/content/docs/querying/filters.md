---
title: Query Filters
sidebar:
  order: 115
description: Named, default-on $where fragments for soft-delete, multi-tenancy, and row-level security.
---

## Query Filters

A **filter** is a named `$where` fragment attached to an entity and applied to every query unless bypassed. It's UQL's equivalent of EF Core global query filters or Eloquent global scopes - a JSON-native default `$where`. [Soft-delete](/entities/soft-delete) is the built-in example; you can define your own for visibility flags, multi-tenancy, and more.

### Defining a filter

Use the `@Filter` decorator, the `@Entity({ filters })` option, or `defineFilter`:

```ts
import { Entity, Id, Field, Filter } from 'uql-orm';

@Filter('active', { condition: { status: 'active' }, default: false })
@Entity()
export class Task {
  @Id() id?: number;
  @Field() status?: string;
}
```

- **`condition`** - a `$where` fragment (or a function returning one, see [context](#parameterized-filters--context)).
- **`default`** - whether it applies unless bypassed. Defaults to `true`; set `false` for opt-in filters like `active` above.

A default-on filter's keys are only added when your `$where` doesn't already mention them, so an explicit `$where` on that field opts out.

The decorator-free equivalent, via `defineFilter` (see [Imperative Definition](/entities/imperative)):

```ts
import { defineEntity, defineField, defineFilter, defineId } from 'uql-orm';

class Task {}

defineId(Task, 'id', { type: Number });
defineField(Task, 'status', { type: String });
defineFilter(Task, 'active', { condition: { status: 'active' }, default: false });
defineEntity(Task, {});
```

### Bypassing filters

Every read/update/delete accepts `QueryOptions.filters`:

```ts
querier.findMany(Task, {}, { filters: false });            // disable all filters
querier.findMany(Task, {}, { filters: { softDelete: false } }); // disable one
querier.findMany(Task, {}, { filters: { active: true } });      // force-enable a default:false filter
```

### Parameterized filters & context

A filter condition can be a function of an ambient **context** (e.g. the current tenant). Set the context for a span with `withContext` (and read it anywhere with `getContext()`); it propagates across `await`s, `Promise.all`, and transactions - but **not** into event-callback ticks (emitters, timers, queues): bridge those with `captureContext()`, or scope a single pool call with `pool.withQuerier(cb, { context })` (see [event-driven pipelines](/multi-tenancy#event-driven-pipelines-emitters-timers-queues)):

```ts
import { withContext } from 'uql-orm';

@Filter('tenant', {
  // with no tenant, return `undefined` (instead of { companyId: undefined }) so the query throws instead of running unscoped
  condition: (ctx) => (ctx?.tenantId != null ? { companyId: ctx.tenantId } : undefined),
  security: true,
})
@Entity()
export class Invoice { /* ... */ }

await withContext({ tenantId: 42 }, () => querier.findMany(Invoice, {}));
// generates: ... WHERE (companyId = 42)
```

### Security filters (row-level security)

Mark a filter `security: true` to enforce tenant isolation / RLS. Security filters:

- are **always applied** - `filters: false` and per-name bypass are ignored;
- are **AND-merged** as an independent predicate, so a client `$where` on the same field can't widen them (`companyId = 'other' AND companyId = 42` matches no rows);
- **fail closed** - if the condition can't resolve (missing context), the query throws `UqlSecurityError` instead of running unscoped. (Set `onMissing: 'skip'` only on non-security filters.)

A condition may return `{}` to mean "resolved: no restriction" - the escape hatch for **trusted cross-tenant work** (startup recovery, maintenance jobs) that runs under an explicit system context, while a missing context still fails closed:

```ts
condition: (ctx) => (ctx?.system ? {} : ctx?.tenantId != null ? { companyId: ctx.tenantId } : undefined),
// withContext({ system: true }, () => ...) -> unscoped; no context -> throws
```

### Over HTTP

`createRequestHandler({ getContext })` derives the context from the (verified) request and runs the whole request inside `withContext`, so filters scope automatically:

```ts
createRequestHandler({
  getContext: (req) => ({ tenantId: req.user.tenantId }),
});
```

The wire parser allowlists query keys, so a remote client **cannot** send `filters` or `context` to bypass a security filter - those are server-only. Derive tenant/auth from a trusted source (session, verified JWT), never from client input.
