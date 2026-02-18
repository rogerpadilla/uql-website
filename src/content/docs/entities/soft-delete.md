---
title: Soft-Delete for entities
sidebar:
  order: 80
description: This tutorial explains how to use soft-delete in the entities with the UQL orm.
---

## Soft-Delete

Soft-delete allows you to mark records as "deleted" instead of physically removing them from the database. This is essential for auditing, data recovery, and maintaining relational integrity.

### Configuration

To enable soft-delete, set `softDelete: true` in the `@Entity` decorator and specify a field with an `onDelete` callback.

```ts
import { Entity, Id, Field } from '@uql/core';

@Entity({ softDelete: true })
export class User {
  @Id()
  id?: number;

  @Field()
  name?: string;

  /**
   * The 'onDelete' callback instructs UQL what value to set when deleting.
   * A common value is a timestamp (Date).
   */
  @Field({ 
    type: 'timestamptz', 
    onDelete: () => new Date() 
  })
  deletedAt?: Date;
}
```

### Automatic Transformation

When soft-delete is enabled, UQL automatically transforms `delete` operations into `update` operations and adds filters to all `find` operations.

#### 1. Deleting a record
```ts
await querier.deleteOneById(User, 1);
```

**Resulting SQL:**
```sql
UPDATE "User" SET "deletedAt" = '2025-12-30T12:00:00Z' WHERE "id" = 1
```

#### 2. Querying records
By default, soft-deleted records are excluded from all queries.

```ts
const users = await querier.findMany(User, { $select: { id: true, name: true } });
```

**Resulting SQL:**
```sql
SELECT "id", "name" FROM "User" WHERE "deletedAt" IS NULL
```

### Advanced: Including Soft-Deleted Records

If you need to include soft-deleted records (e.g., for an admin panel), you can bypass the filter in the query options.

```ts
const allUsers = await querier.findMany(User, {
  $where: { /* your filters */ }
}, { 
  // Bypass soft-delete filter
  softDelete: false 
});
```

---

Continue reading about [Virtual Fields](/entities/virtual-fields).



