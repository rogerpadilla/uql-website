---
title: Relations between entities
sidebar:
  order: 70
description: This tutorial explains how to use relations in the entities with the UQL orm.
---

## Relations between entities

Relationships are a core part of any ORM. UQL makes it easy to define and query relationships with full type safety and context awareness.

### Defining Relationships

Take any class and annotate it with the decorators from `@uql/core`. You can use `mappedBy` as a string or a callback for better refactoring support.

```ts
import { v7 as uuidv7 } from 'uuid';
import { Entity, Id, Field, OneToOne, OneToMany, ManyToOne, ManyToMany, type Relation } from '@uql/core';

@Entity()
export class User {
  @Id({ 
    type: 'uuid', 
    onInsert: () => uuidv7() 
  })
  id?: string;

  @Field()
  name?: string;

  /**
   * One-to-One: A user has one profile.
   * mappedBy can be a callback for better refactoring support.
   */
  @OneToOne({
    entity: () => Profile,
    mappedBy: (profile) => profile.user,
    cascade: true,
  })
  profile?: Relation<Profile>;

  /**
   * One-to-Many: A user can have many posts.
   */
  @OneToMany({
    entity: () => Post,
    mappedBy: (post) => post.author,
  })
  posts?: Relation<Post>[];
}

@Entity()
export class Profile {
  @Id({ 
    type: 'uuid', 
    onInsert: () => uuidv7() 
  })
  id?: string;

  @Field()
  picture?: string;

  /**
   * Foreign key field. The 'reference' property links to the target entity.
   * The 'foreignKey' option allows custom constraint naming.
   */
  @Field({ 
    references: () => User, 
    foreignKey: 'fk_profile_user' 
  })
  userId?: string;

  @OneToOne({ entity: () => User })
  user?: User;
}

@Entity()
export class Post {
  @Id()
  id?: number;

  @Field()
  title?: string;

  @Field({ references: () => User })
  authorId?: string;

  @ManyToOne({ entity: () => User })
  author?: User;

  /**
   * Many-to-Many: A post can have many tags.
   * 'through' specifies the pivot entity.
   */
  @ManyToMany({
    entity: () => Tag,
    through: () => PostTag,
    cascade: true,
  })
  tags?: Tag[];
}

@Entity()
export class Tag {
  @Id({ 
    type: 'uuid', 
    onInsert: () => uuidv7() 
  })
  id?: string;

  @Field()
  name?: string;
}

@Entity()
export class PostTag {
  @Id({ 
    type: 'uuid', 
    onInsert: () => uuidv7() 
  })
  id?: string;

  @Field({ references: () => Post })
  postId?: number;

  @Field({ references: () => Tag })
  tagId?: string;
}
```

### Handling Circular Dependencies

In modern ESM environments, circular dependencies between entity classes can sometimes cause issues. UQL provides a `Relation<T>` utility type to safely handle these scenarios while maintaining full type safety.

```ts
import { Entity, Id, Field, OneToOne, type Relation } from '@uql/core';

@Entity()
export class User {
  @Id({ type: 'uuid' })
  id?: string;

  @OneToOne({ entity: () => Profile, mappedBy: 'user' })
  profile?: Relation<Profile>; // Use Relation<T> for linked properties
}
```

:::tip
Always use `Relation<T>` for properties decorated with `@OneToOne`, `@OneToMany`, `@ManyToOne`, or `@ManyToMany`. It ensures TypeScript correctly resolves types even when entities reference each other.
:::

&nbsp;

### Querying Relations

When you query relations in UQL, the syntax remains consistent and type-safe. You can select specific fields from related entities or filter based on them.

```ts
// Assuming `querier` is obtained from the pool
const posts = await querier.findMany(Post, {
  $select: {
    id: true,
    title: true,
    author: {
      $select: ['name', 'email']
    },
    tags: {
      $select: ['name'],
      $where: { name: { $startsWith: 'typescript' } }
    }
  },
  $where: {
    author: { name: 'Roger' }
  }
});
```

Check the [querying relations](/querying/relations) section for more advanced examples on deep filtering and selection.

---

Continue reading about [Soft Delete](/entities/soft-delete).
