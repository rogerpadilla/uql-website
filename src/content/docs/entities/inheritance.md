---
title: Inheritance
sidebar:
  order: 100
description: Share fields across entities with abstract base classes and inheritance in UQL.
---

## Inheritance between entities

UQL supports both abstract and concrete inheritance, allowing you to reuse field definitions and relationship configurations across your domain model.

### Base Entity Pattern

A common pattern is to define a base class with common fields like `id`, `createdAt`, and `updatedAt`.

```ts
import { v7 as uuidv7 } from 'uuid';
import { Entity, Id, Field, OneToOne, type Relation } from 'uql-orm';

/**
 * An abstract class for shared audit fields.
 */
export abstract class BaseEntity {
  @Id({ onInsert: () => uuidv7() })
  id?: string;

  @Field({ type: 'timestamptz', onInsert: () => new Date() })
  createdAt?: Date;

  @Field({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt?: Date;
}

/**
 * 'Company' inherits all fields from 'BaseEntity'.
 */
@Entity()
export class Company extends BaseEntity {
  @Field({ length: 150 })
  name?: string;

  @Field({ type: 'text' })
  description?: string;
}
```

### Specifying Custom Metadata

You can customize the entity name and field properties in the child classes.

```ts
/**
 * You can also specify a custom table name.
 */
@Entity({ name: 'user_profile' })
export class Profile extends BaseEntity {
  @Field({ name: 'image', type: 'text' })
  picture?: string;

  @Field({ references: () => User })
  userId?: string;

  @OneToOne({ entity: () => User })
  user?: Relation<User>;
}
```


```ts
@Entity()
export class User extends BaseEntity {
  @Field()
  name?: string;

  @Field({ updatable: false })
  email?: string;

  @Field({ eager: false })
  password?: string;

  @OneToOne({ entity: () => Profile, mappedBy: 'userId', cascade: true })
  profile?: Relation<Profile>;
}
```

### Advanced: Custom Identifier Keys

If your database uses a different primary key name (like `pk`), you can use the `idKey` symbol to maintain type safety.

```ts
import { Entity, Id, Field, idKey } from 'uql-orm';

@Entity()
export class TaxCategory extends BaseEntity {
  /**
   * Specifies the name of the identifier property for type inference.
   */
  [idKey]?: 'pk';

  @Id({ onInsert: () => uuidv7() })
  pk?: string;

  @Field()
  name?: string;
}
```

Inherited fields behave exactly like fields declared on the class itself: the query engine understands them, so `Company.id` or `Profile.createdAt` get full auto-completion and validation, and changing a base field type propagates to every child entity.