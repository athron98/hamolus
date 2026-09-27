---
name: hamolus-collections
description: Use ONLY when creating, reviewing, or editing Hamolus collection definitions. Creates a collection in code (core/src/collections) or over HTTP, with correct names, timestamps, PK, groups, and the 'PUT migrates; never drops' rule. Front-load keywords: collection definition, collectionDefinitionSchema, code-defined collection, _meta_collections.
---

# Hamolus — Collections

Create and validate collection definitions exactly per `docs/definitions/collection-definition.md`. A collection is metadata (`_meta_collections`) + a scoped D1 table; code-defined collections are frozen against runtime `PUT/DELETE` but records stay editable.

## When to use

Use this skill when the user says: create collection, add collection, define collection, code-defined collection, collection schema. Do **NOT** use for fields alone (use `hamolus-fields`), panels (use `hamolus-panels`), or config (use `hamolus-config`).

## Hard rules

1. **Name**: `^[a-z][a-z0-9_]*$`, snake_case. No `__`. May not end with `_meta`, `_auth`, `health`. `privileges` is platform-managed (cannot PUT).
2. **PK**: defaults to `id`. Do not list `id` in `fields` unless explicitly declared; `pkField()` synthesizes it.
3. **PUT migrates, never drops**: adding fields adds columns (ALTER TABLE ADD COLUMN); renames/retypes/drops are manual migrations. State this in any explanation.
4. **Code-defined**: lives in `core/src/collections/*.ts`, exported via `core/src/collections/index.ts`, registered with `setCodeDefinitions({ collections, panels })` in `core/src/index.ts`. Removing from file does not delete DB/table.
5. **Validation**: `collectionDefinitionSchema` is `.strict()`; unknown keys rejected.
6. **Timestamps/audit**: `timestamps` adds `created_at/updated_at/created_by/updated_by`; `softDelete` adds `deleted_at/deleted_by`. Audit not added if a field already uses that name.

## Path conventions

- Code-defined: `templates/cores/predefined/src/collections/posts.ts` is the canonical example. Mirror its header comments (why frozen, records editable, migration note).
- Export barrel: `core/src/collections/index.ts` exports array `collections` satisfying `NonNullable<CodeDefinitions['collections']>`.
- Wire: `core/src/index.ts` calls `setCodeDefinitions` after `setCoreConfig`.

## Write shape (TypeScript)

```ts
import type { CollectionDefinitionInput } from '@hamolus/types'

export const POSTS = {
  name: 'posts',
  label: 'Posts',
  description: 'Editorial content, defined in code.',
  group: 'Content',
  icon: 'file',
  timestamps: true,
  primaryKey: 'id',
  fields: [
    // use hamolus-fields to populate
  ],
} satisfies CollectionDefinitionInput
```

Do NOT invent helpers (`defineCollection`). Use plain object + `satisfies CollectionDefinitionInput`.

## HTTP shape (reference)

`PUT /api/_meta/collections/{name}` with body = definition (no wrapper). Returns 403 `CODE_DEFINED_COLLECTION` if frozen in code.

## Checklist

- [ ] Name matches regex, not reserved
- [ ] `label` non-empty
- [ ] `primaryKey` valid (default `id`)
- [ ] `fields` non-empty
- [ ] Barrel + wire-up updated if code-defined
- [ ] Notes: migration rule + freeze semantics included in file header if code-defined

## References

- `docs/definitions/collection-definition.md` (authoritative)
- `packages/types/src/collection.ts`, `packages/core/src/meta/store.ts`, `packages/core/src/definitions.ts`
- Example: `templates/cores/predefined/src/collections/posts.ts`
