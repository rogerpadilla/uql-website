---
title: Querying relations

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
