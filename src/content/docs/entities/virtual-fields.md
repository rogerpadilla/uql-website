---
title: Virtual-Fields for entities
sidebar:
  order: 90
description: This tutorial explains how to use virtual-fields in the entities with the UQL orm.
---

## Virtual Fields

The `virtual` property of the `@Field` decorator allows you to define non-persistent fields whose values are calculated at runtime using SQL or MongoDB expressions.

UQL's virtual fields use the `QueryContext` pattern, ensuring robust SQL generation and top-tier performance.

```ts
import { Entity, Id, Field, ManyToMany, raw } from '@uql/core';
import { v7 as uuidv7 } from 'uuid';

@Entity()
export class Item {
  @Id({ type: 'uuid', onInsert: () => uuidv7() })
  id?: string;

  @Field()
  name?: string;

  @ManyToMany({ entity: () => Tag, through: () => ItemTag, cascade: true })
  tags?: Tag[];

  @Field({
    /**
     * Define the value for a non-persistent field using a sub-query.
     */
    virtual: raw(({ ctx, dialect, escapedPrefix }) => {
      ctx.append('(');
      dialect.count(ctx, ItemTag, {
        $where: {
          itemId: raw(({ ctx }) => ctx.append(`${escapedPrefix}.id`))
        }
      }, { autoPrefix: true });
      ctx.append(')');
    })
  })
  tagsCount?: number;
}
```

&nbsp;

### Querying with Virtual Fields

Virtual fields behave exactly like regular fields in your queries. You can select them or filter by them.

#### 1. Selection
```ts
const items = await querier.findMany(Item, { 
  $select: { id: true, tagsCount: true } 
});
```

**Generated SQL:**
```sql
SELECT
  "id",
  (SELECT COUNT(*) FROM "ItemTag" WHERE "ItemTag"."itemId" = "id") "tagsCount"
FROM "Item"
```

#### 2. Filtering
```ts
const items = await querier.findMany(Item, {
  $select: { id: true },
  $where: {
    tagsCount: { $gte: 10 },
  },
});
```


**Generated SQL:**
```sql
SELECT "id" FROM "Item"
WHERE (SELECT COUNT(*) FROM "ItemTag" WHERE "ItemTag"."itemId" = "id") >= 10
```

---

Continue reading about [Inheritance](/entities/inheritance).

