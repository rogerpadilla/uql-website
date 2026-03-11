---
title: Deep Relations

sidebar:
  order: 150
description: This tutorial explains how to use relations in the queries with the UQL orm.
---

## Querying relations

UQL's query syntax is context-aware. When you query a relation, the available fields and operators are automatically suggested and validated based on that related entity.

### Basic Selection

You can select specific fields from a related entity using a nested object.

```ts title="You write"
import { User } from './shared/models/index.js';

const users = await querier.findMany(User, {
  $select: {
    id: true,
    name: true,
    profile: { $select: { picture: true } } // Select specific fields from a 1-1 relation
  },
  $where: {
    email: { $iincludes: '@example.com' }
  }
});
```

```sql title="Generated SQL (PostgreSQL)"
-- Main query with LEFT JOIN for OneToOne relation
SELECT "User"."id", "User"."name",
       "profile"."picture" "profile.picture"
FROM "User"
LEFT JOIN "Profile" "profile" ON "profile"."userId" = "User"."id"
WHERE "User"."email" ILIKE '%@example.com%'
```

### Advanced: Deep Selection & Mandatory Relations

Use `$required: true` to enforce an `INNER JOIN` (by default UQL uses `LEFT JOIN` for nullable relations).

```ts title="You write"
import { User } from './shared/models/index.js';

const latestUsersWithProfiles = await querier.findOne(User, {
  $select: {
    id: true,
    name: true,
    profile: {
      $select: { picture: true, bio: true },
      $where: { bio: { $ne: null } },
      $required: true // Enforce INNER JOIN
    }
  },
  $sort: { createdAt: 'desc' },
});
```

```sql title="Generated SQL (PostgreSQL)"
-- INNER JOIN enforced by $required: true
SELECT "User"."id", "User"."name",
       "profile"."picture" "profile.picture", "profile"."bio" "profile.bio"
FROM "User"
INNER JOIN "Profile" "profile" ON "profile"."userId" = "User"."id"
  AND "profile"."bio" IS NOT NULL
ORDER BY "User"."createdAt" DESC
LIMIT 1
```

### Filtering on Related Collections

You can filter and sort when querying collections (One-to-Many or Many-to-Many).

```ts title="You write"
import { User } from './shared/models/index.js';

const authorsWithPopularPosts = await querier.findMany(User, {
  $select: {
    id: true,
    name: true,
    posts: {
      $select: { title: true, createdAt: true },
      $where: { title: { $iincludes: 'typescript' } },
      $sort: { createdAt: 'desc' },
      $limit: 5
    }
  },
  $where: {
    name: { $istartsWith: 'a' }
  }
});
```

```sql title="Generated SQL (PostgreSQL)"
-- Main query (parent rows)
SELECT "User"."id", "User"."name" FROM "User"
WHERE "User"."name" ILIKE $1
```

```sql title="Generated SQL (PostgreSQL) — separate query"
-- OneToMany relation loaded via a second query
SELECT "Post"."title", "Post"."createdAt", "Post"."authorId"
FROM "Post"
WHERE "Post"."authorId" IN ($1, $2, ...)
  AND "Post"."title" ILIKE '%typescript%'
ORDER BY "Post"."createdAt" DESC
LIMIT 5
```

### Sorting by Related Fields

UQL allows sorting by fields of related entities directly in the `$sort` object.

```ts title="You write"
const items = await querier.findMany(Item, {
  $select: { id: true, name: true },
  $sort: { 
    tax: { name: 1 }, 
    measureUnit: { name: 1 }, 
    createdAt: 'desc' 
  }
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT "Item"."id", "Item"."name"
FROM "Item"
LEFT JOIN "Tax" "tax" ON "tax"."id" = "Item"."taxId"
LEFT JOIN "MeasureUnit" "measureUnit" ON "measureUnit"."id" = "Item"."measureUnitId"
ORDER BY "tax"."name", "measureUnit"."name", "Item"."createdAt" DESC
```

&nbsp;

### Relation Filtering (EXISTS Subqueries)

Filter parent entities based on conditions on their **ManyToMany** or **OneToMany** relations. UQL generates efficient `EXISTS` subqueries automatically.

#### ManyToMany

```ts title="You write"
// Find all posts that have a tag named 'typescript'
const posts = await querier.findMany(Post, {
  $where: { tags: { name: 'typescript' } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "Post"
WHERE EXISTS (
  SELECT 1 FROM "PostTag"
  WHERE "PostTag"."postId" = "Post"."id"
    AND "PostTag"."tagId" IN (
      SELECT "Tag"."id" FROM "Tag" WHERE "Tag"."name" = $1
    )
)
```

#### OneToMany

```ts title="You write"
// Find users who have authored posts with 'typescript' in the title
const users = await querier.findMany(User, {
  $where: { posts: { title: { $iincludes: 'typescript' } } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "User"
WHERE EXISTS (
  SELECT 1 FROM "Post"
  WHERE "Post"."authorId" = "User"."id"
    AND "Post"."title" ILIKE '%typescript%'
)
```

:::tip[Combining with Other Filters]
Relation filters compose naturally with regular field comparisons and logical operators:
```ts
const posts = await querier.findMany(Post, {
  $where: {
    title: { $istartsWith: 'guide' },
    tags: { name: 'important' },
  },
});
```
:::

### Relation Count Filtering (`$size` Subqueries)

Filter parent entities by the **number** of related records using `$size`. UQL generates efficient `COUNT(*)` subqueries. Accepts a number for exact match or any [comparison operator](/querying/comparison-operators) (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$between`).

#### OneToMany

```ts title="You write"
// Find categories with at least 2 measure units
const categories = await querier.findMany(MeasureUnitCategory, {
  $where: { measureUnits: { $size: { $gte: 2 } } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "MeasureUnitCategory"
WHERE (SELECT COUNT(*) FROM "MeasureUnit"
       WHERE "MeasureUnit"."categoryId" = "MeasureUnitCategory"."id") >= $1
  AND "deletedAt" IS NULL
```

#### ManyToMany

```ts title="You write"
// Find items with more than 5 tags
const items = await querier.findMany(Item, {
  $where: { tags: { $size: { $gt: 5 } } },
});
```

```sql title="Generated SQL (PostgreSQL)"
SELECT * FROM "Item"
WHERE (SELECT COUNT(*) FROM "ItemTag"
       WHERE "ItemTag"."itemId" = "Item"."id") > $1
```

#### Multiple Comparison Operators

```ts title="You write"
// Find items with between 2 and 10 tags
const items = await querier.findMany(Item, {
  $where: { tags: { $size: { $between: [2, 10] } } },
});
```

:::note
`$size` with an exact number (`$size: 3`) also works for relation count — equivalent to `$size: { $eq: 3 }`.
:::
