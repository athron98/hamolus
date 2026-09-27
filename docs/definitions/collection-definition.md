# Collection definition

A **collection definition** is the schema of one table. Hamolus stores it as
metadata in `_meta_collections`, creates and migrates the physical D1 table from
it, validates every record payload against it, and generates the console screens
for it. Nothing about a collection is hard-coded in the Worker: a definition is
data.

| | |
| --- | --- |
| Schema | `collectionDefinitionSchema` — `packages/types/src/collection.ts` |
| Types | `CollectionDefinition`, `CollectionDefinitionInput` |
| Record validator | `buildEntitySchema(def, languages?)` |
| DDL | `buildCreateTableSql` / `addColumnSql` — `packages/core/src/db/table.ts` |
| Store | `putCollection` / `deleteCollection` / `listCollections` — `packages/core/src/meta/store.ts` |
| API | `/_meta/collections` — see [api.md](../../packages/core/docs/api.md#collection-meta-_meta-collections) |

## A complete definition

```ts
// core/src/collections/posts.ts
import type { CollectionDefinitionInput } from '@hamolus/types'

export const POSTS = {
  name: 'posts',
  label: 'Posts',
  description: 'Editorial content, defined in code.',
  group: 'Content',
  icon: 'file',
  timestamps: true,
  softDelete: false,
  primaryKey: 'id',
  fields: [
    { name: 'title', type: 'string', label: 'Title', required: true },
    { name: 'slug', type: 'slug', label: 'Slug', unique: true, required: true },
    { name: 'excerpt', type: 'text', label: 'Excerpt' },
    { name: 'body', type: 'richtext', label: 'Body', format: 'markdown' },
    { name: 'published', type: 'boolean', label: 'Published', default: false },
    { name: 'published_at', type: 'datetime', label: 'Published at' },
  ],
} satisfies CollectionDefinitionInput
```

The identical object over HTTP:

```bash
curl -X PUT http://localhost:8787/api/_meta/collections/posts \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{
    "name": "posts",
    "label": "Posts",
    "timestamps": true,
    "primaryKey": "id",
    "fields": [
      { "name": "title", "type": "string", "required": true },
      { "name": "slug",   "type": "slug",   "required": true, "unique": true }
    ]
  }'
```

## Every property

`.strict()` — unknown keys are rejected.

| Property | Type | Required | Default | Notes |
| -------- | ---- | -------- | ------- | ----- |
| `name` | `string` | ✅ | — | `^[a-z][a-z0-9_]*$` (snake_case). Also the D1 table name. May not contain `__` or end with a reserved name. |
| `label` | `string` | ✅ | — | Non-empty. Human label in the console. |
| `description` | `string` | | — | Shown in the collection header. |
| `group` | `string` | | — | Navigation grouping. Either a registered group id, or any label — an unregistered value still renders as an implicit root group. |
| `icon` | `string` | | — | Console sidebar icon name. Unknown names fall back to a folder glyph. |
| `timestamps` | `boolean` | | `false` | Adds `created_at` / `updated_at`, both `NOT NULL` with a `strftime` default. |
| `softDelete` | `boolean` | | `false` | Adds `deleted_at TEXT`; deletes set it instead of dropping the row. |
| `primaryKey` | `string` | | `'id'` | The key field. See [the primary key](#the-primary-key). |
| `fields` | `FieldDefinition[]` | ✅ | — | At least one. See [field definition](./field-definition.md). |

`CollectionDefinitionInput` is `z.input<typeof collectionDefinitionSchema>`:
identical except that `primaryKey` is optional, which is what lets a hand-written
literal omit it.

### Validation rules

Beyond the per-property rules, `collectionDefinitionSchema.superRefine` adds:

1. **Reserved names.** `name` may not be, or end with, `_meta`, `_auth` or
   `health` — the message is `'posts_health' is a reserved name (health)`.
2. **No `__` in the name.** `__` is the physical-table separator between scope
   ids, so it is reserved.
3. **No duplicate fields.** Keyed on `name:type`, and the reported path points
   at the first occurrence.

Note that rule 3 keys on the pair, not the name alone: two fields sharing a name
but differing in type are *not* caught by the schema.

### Reserved names

```ts
export const RESERVED_COLLECTION_NAMES = ['_meta', '_auth', 'health'] as const
```

The check is `def.name.endsWith(r) || r === def.name`. Since the snake_case regex
already forbids a leading underscore, only the suffix form is reachable — so
`my_health` and `content_meta` are rejected too. `privileges` is a fourth
protected name, but it is enforced by the routes rather than the schema: a `PUT`
on it returns `403 The 'privileges' definition is managed by the platform`.

## The physical table

One table per scope, always fully qualified:

```
{land}__{colony}__{collection}
```

- default scope → `root_lnd__root_cny__posts`
- a named land/colony → `acme_lnd__purchasing_cny__posts`

Because each table belongs to exactly one scope, record tables carry no
`land`/`colony` columns and keep a single-column primary key. The resolved name
travels on the parsed definition as a **non-enumerable symbol**
(`PHYSICAL_TABLE`), so it never leaks into JSON.

### Generated DDL

```sql
CREATE TABLE IF NOT EXISTS "root_lnd__root_cny__posts" (
  "id"           TEXT PRIMARY KEY,
  "title"        TEXT NOT NULL,
  "slug"         TEXT NOT NULL UNIQUE,
  "excerpt"      TEXT,
  "body"         TEXT,
  "published"    INTEGER DEFAULT false,
  "published_at" TEXT,
  "created_at"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "created_by"   TEXT,
  "updated_by"   TEXT
)
```

Column types come from `SQLITE_COLUMN`: `NUMERIC` for `number`, `currency` and
`custom_currency`, `INTEGER` for `boolean`, `TEXT` for everything else. `required` adds `NOT NULL`,
`unique` adds `UNIQUE`, and a `default` is rendered into the column `DEFAULT` —
strings quoted with `''` escaping, numbers and booleans as bare literals, and
anything else as JSON text. `auditColumns()` appends the `created_by` /
`updated_by` / `deleted_by` columns that the tables above already show.

### Audit columns

`timestamps` and `softDelete` also add audit columns, unless a declared field
already claims the name:

| Flag | Adds |
| ---- | ---- |
| `timestamps` | `created_at`, `updated_at`, `created_by`, `updated_by` |
| `softDelete` | `deleted_at`, `deleted_by` |

A user field named `created_by` keeps its own column — the audit column is simply
not added.

## `PUT` migrates; it never drops

`PUT /api/_meta/collections/{name}` is idempotent and additive:

1. `CREATE TABLE IF NOT EXISTS` for the whole table.
2. `PRAGMA table_info` diff, then `ALTER TABLE … ADD COLUMN` for each new field,
   followed by a second loop backfilling the audit columns on older tables.

So adding a field and redeploying adds the column without touching records. What
it will **not** do:

- **drop** a column that is no longer in the definition — the orphan stays;
- **rename** or **retype** a column;
- **widen** a `NOT NULL` that already exists.

Those need a manual migration. And `DELETE /_meta/collections/{name}` is a hard
`DROP TABLE` — it takes the data with it.

## The primary key

`primaryKey` names the key field and defaults to `id`. The column is created
whether or not `id` is in `fields`, which is why a normal definition does not
list it:

```ts
{ name: 'posts', primaryKey: 'id', fields: [ /* no id field */ ] }
```

`pkField()` synthesizes `{ name: 'id', type: 'id' }` when the declaration is
missing, and that synthetic field is what DDL, record reads and panel field
resolution all fall back to. Records are created with `crypto.randomUUID()` in
the key column, and a client-supplied value is honoured when present — which is
why a panel view can list `id` under `fields.read` for a collection that never
declares it.

Declaring the key explicitly is supported and is what the platform-owned
`privileges` collection does. Declaring it **twice** — once as `primaryKey` and
once as a field of a different type — is a mistake the duplicate check will not
catch.

## Records

Once the collection exists, the generic endpoints serve it:

```
GET    /api/{collection}            list   (page, pageSize, search, filters, sort, locale)
POST   /api/{collection}            create
GET    /api/{collection}/{id}       read
PUT    /api/{collection}/{id}       replace
PATCH  /api/{collection}/{id}       partial update
DELETE /api/{collection}/{id}       delete (or soft delete)
```

`buildEntitySchema(def, languages?)` builds the write-time validator from the
field list. It is `.strict()`, which is the SQL-injection guard: an unknown key in
a record payload is a validation error, never a column name. It also **skips
every field of `type: 'id'`**, so the key is not part of the record input object.

The value of each field is validated by `fieldValueSchema` — see
[field definition](./field-definition.md#field-types) for the per-type table.

## Two ways to own a definition

A collection can be created at runtime through the console or the API, or
declared in source control. They coexist: a collection that exists in D1 but is
not listed in code stays console-editable.

| | Console / API | Code (`src/collections`) |
| --- | ------------- | ------------------------ |
| Declared in | the console, or `PUT /_meta/collections/{name}` | a TypeScript literal passed to `setCodeDefinitions()` |
| Reviewed by | a database row | a pull request |
| `PUT` / `DELETE` | allowed | `403 CODE_DEFINED_COLLECTION` |
| Records | fully editable | fully editable |
| Survives a redeploy | yes | yes — re-applied on boot |

Code-defined collections are re-applied to **every registered scope** on the
first scoped request after boot, so a land created later starts from the same
baseline. See [Code-defined collections](#code-defined-collections) below and
[architecture](../../packages/core/docs/architecture.md) for the boot sequence.

## Code-defined collections

```ts
// core/src/index.ts
import app, { setCodeDefinitions, setCoreConfig } from '@hamolus/core'
import { config } from '../core.config'
import { collections } from './collections'

setCoreConfig(config)
setCodeDefinitions({ collections, panels: [] })

export default app
```

```ts
// core/src/collections/index.ts
import type { CodeDefinitions } from '@hamolus/core'
import { POSTS } from './posts'

export const collections = [POSTS] satisfies NonNullable<CodeDefinitions['collections']>

export default collections
```

`setCodeDefinitions()` runs at module scope and does three things:

1. **Validates every definition at boot.** An invalid literal throws there and
   then, not on the first request — and *every* problem is reported at once, not
   just the first.
2. **Rejects duplicates** by collection name, in the same pass.
3. **Leaves the previous set standing** if the new one is invalid, so a failed
   registration cannot unregister a working schema.

Then, per scope, on the first scoped request:

- collections are written **before** panels, because a panel view may reference a
  collection and the panel writer refuses a manifest pointing at an unregistered
  one;
- each write is the same `putCollection` the API uses — an unconditional upsert,
  so the file is authoritative and re-applying it is harmless;
- the scope is latched only **after** the write completes, so a transient failure
  retries on the next request rather than being remembered as done;
- each scope has its own `_meta_collections` row and its own physical table.

Consequences worth planning for:

- **Removing a definition from the file does not delete it.** It stops being
  re-applied and stops being frozen; the row and the table survive as
  console-managed state. Drop the collection explicitly if you meant to.
- **Dropping a field does not drop the column.** See
  [PUT migrates; it never drops](#put-migrates-it-never-drops).
- **A seed that `PUT`s a code-defined name gets a 403.** Seed scripts should skip
  names the core owns.
- The freeze is **scope-independent**: `isCodeCollection()` checks the in-memory
  list, so `PUT` in a new land is refused just the same.

## Navigation groups

`group` is a soft reference. Any value works — an unregistered one still renders
as an implicit root group whose label is the raw value. To get a real nested
tree, register the group:

```ts
// groupDefinitionSchema — packages/types/src/group.ts
{ id: 'content_blog', label: 'Blog', parent: 'content', icon: 'file' }
```

`GET /_meta/groups`, `PUT /_meta/groups/{id}` and `DELETE /_meta/groups/{id}`
manage them. An unknown `parent` is `400 GROUP_PARENT_NOT_FOUND`, a cycle is
`400 GROUP_CYCLE`, and deleting a group still in use is `400 GROUP_IN_USE`.
`buildGroupTree()` resolves groups + collections into the tree the console
navigates: registered ids nest, unregistered values become implicit roots,
collections are de-duplicated by name, and siblings sort by label.

## Endpoints

| Method | Endpoint | Permission | Behaviour |
| ------ | -------- | ---------- | --------- |
| `GET` | `/_meta/collections` | `collections.read` | All definitions for the scope. |
| `GET` | `/_meta/collections/{name}` | `collections.read` | One definition; `404 NOT_FOUND` if unknown. |
| `PUT` | `/_meta/collections/{name}` | `collections.write` | Create/update + create/migrate the table. `403 CODE_DEFINED_COLLECTION` when frozen. |
| `DELETE` | `/_meta/collections/{name}` | `collections.write` | Drop table + metadata. `403 CODE_DEFINED_COLLECTION` when frozen. |

```bash
TOKEN=$(curl -s -X POST http://localhost:8787/api/_auth/token \
  -H 'content-type: application/json' -d '{"key":"dev-admin-key-change-me"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

curl -s http://localhost:8787/api/_meta/collections -H "authorization: Bearer $TOKEN"
```

## Errors

| Code | Status | Cause |
| ---- | ------ | ----- |
| `INVALID_COLLECTION` | 400 | The definition failed `collectionDefinitionSchema` — the message names the failing path. |
| `NOT_FOUND` | 404 | `GET`/`DELETE` on a collection that is not registered. |
| `CODE_DEFINED_COLLECTION` | 403 | The collection is declared in code. |
| `FORBIDDEN` | 403 | `privileges` is platform-managed. |
| `VALIDATION` | 400 | A record payload failed `buildEntitySchema`. |

## Current gaps

- `indexed` on a field creates no index — see
  [field definition → current gaps](./field-definition.md#current-gaps).
- Relations are not enforced: no foreign keys, no referential validation, no
  populate on read.
- Column drops and renames are not part of `PUT`. A destructive schema change is
  a manual migration plus a data move.
- `DELETE` is a hard drop. There is no "archive this collection" that keeps the
  rows.
- The definition DTO carries **no** `codeDefined` / `frozen` flag. A client
  cannot tell a frozen definition from a console-made one without attempting a
  write and reading the 403.

## See also

- [Field definition](./field-definition.md) — the 19 field types and their values.
- [Panel definition](./panel-definition.md) — how a manifest references a
  collection.
- [Config definition](./config-definition.md) — project settings and locales.
- [Core API reference](../../packages/core/docs/api.md) — records, relations,
  errors.
- [Architecture](../../packages/core/docs/architecture.md) — the boot sequence and
  scope resolution.
