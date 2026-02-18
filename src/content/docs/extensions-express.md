---
title: Express extension
sidebar:
  order: 300
description: This tutorial explains how to use the Express extension with the UQL orm.
---

## Express Extension

UQL provides a built-in Express middleware to automatically generate RESTful APIs for your entities with zero boilerplate. It handles the entire request lifecycle, including query parsing, transaction management, and automatic querier release.
:::note
This extension is completely optional. UQL works perfectly fine as a standalone ORM without it.
:::

### Quick Start

1. Initialize the `querierMiddleware` in your Express app:

```ts
import express from 'express';
import { querierMiddleware } from '@uql/core/express';
import { pool } from './uql.config.js';
import { User, Post } from './shared/models/index.js';

const app = express();
app.use(express.json());

// This will automatically generate routes like /api/user and /api/post
app.use('/api', querierMiddleware({
  include: [User, Post]
}));

app.listen(3000);
```

### Advanced Configuration

The middleware is highly customizable, allowing you to intercept requests, filter data based on the authenticated user, and more.

```ts
app.use('/api', querierMiddleware({
  // Intercept every request
  pre(req, meta) {
    console.log(`Processing ${req.method} on ${meta.name}`);
  },

  // Intercept save operations (POST, PATCH, PUT)
  preSave(req, meta) {
    // Automatically set the creatorId from the session
    req.body.creatorId = req.user.id;
  },

  // Intercept filter operations (GET, DELETE)
  preFilter(req, meta) {
    // Enforce Row-Level Security: users only see their own data
    req.query.$where = { 
      ...req.query.$where, 
      creatorId: req.user.id 
    };
  }
}));
```

### Hook Reference

| Hook | Lifecycle | Use Case |
| :--- | :--- | :--- |
| `pre` | Before every operation. | Logging, auditing, global validation. |
| `preSave` | Before `POST`, `PATCH`, `PUT`. | Injecting `creatorId`, `updatedAt`, or data sanitization. |
| `preFilter` | Before `GET`, `DELETE`. | Row-level security, tenant isolation, enforcing `softDelete`. |


### Generated Endpoints

For an entity named `User`, the following endpoints are automatically generated:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/user` | List users (supports pagination, filtering, and sorting). |
| `GET` | `/user/:id` | Get a single user by ID. |
| `POST` | `/user` | Create a new user. |
| `PATCH` | `/user/:id` | Update a user partially. |
| `PUT` | `/user` | Upsert a user (insert or update based on conflict paths). |
| `DELETE` | `/user/:id` | Delete a user (supports soft-delete if configured). |

:::tip
All `GET` endpoints support UQL's powerful [Serializable JSON Query Syntax](/querying/querier), allowing your frontend to perform complex joins and filters directly via URL parameters.
:::


