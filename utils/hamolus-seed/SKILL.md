---
name: hamolus-seed
description: Use ONLY when writing or running a Hamolus seed script to populate a core with data. Knows the self-cleaning pattern, DRY_RUN, ADMIN_KEY auth, skip code-defined collections, dependency order, and how to author via 'hamolus add seed'. Front-load keywords: seed, seed script, pnpm seed, self-cleaning, _notes, DRY_RUN.
---

# Hamolus — Seed

Write a seed that fills a core with representative data. Seeds are **plain Node scripts** (no build, no deps, just `fetch`), self-cleaning, and scoped to what they own.

## When to use

User says: seed, seed data, populate core, demo data, pnpm seed. NOT for schema/fields/panels (those are definitions) unless asked to seed alongside.

## Authoring path

Prefer the CLI so tokens, manifest, README are generated:

```bash
hamolus add seed <snake_case_name> -o <dir-in-project>
# writes <dir>/index.mjs + README.md, tokens SEED_ID/SEED_NAME/SEED_SLUG filled
```

`templates/seeds/basic/index.mjs` is the canonical starting point. Read it before hand-rolling.

## Run pattern

`hamolus add seed` writes a **self-contained package** next to the script, so run it
from inside the seed directory:

```bash
cd <seed-dir>
pnpm typecheck                                  # node --check ./index.mjs — free syntax gate
BASE=http://localhost:8787 ADMIN_KEY=dev-admin-key-change-me pnpm seed
BASE=https://<core> ADMIN_KEY=<key> DRY_RUN=1 pnpm seed   # dry run
```

- `BASE` = core origin; the script appends `/api`.
- `ADMIN_KEY` mints a short-lived admin token (`POST /_auth/token`) used as `Bearer` on every call.
- `DRY_RUN=1` prints intended writes, changes nothing.
- `pnpm typecheck` is `node --check` — run it before `seed`; it is the cheapest way to
  catch a syntax error in a script you are about to point at a real core.

## Hard rules (the template already handles these; keep them if you diverge)

1. **Auth**: mint token from `ADMIN_KEY`, send `authorization: Bearer` on every call. No login step.
2. **Self-cleaning**: before creating, delete the collections/media this seed owns (via metadata endpoints, which also drop the physical D1 table + R2 objects). Re-running must not duplicate. Do **not** truncate tables manually.
3. **Scoped**: only touch this seed's own collection/media group; safe against a core with other data.
4. **Skip code-defined collections**: a `PUT` on a name the core owns returns `403 CODE_DEFINED_COLLECTION`. If the collection is declared in `core/src/collections`, do not re-`PUT` it — only insert records (or skip entirely).
5. **Dependency order**: array `collections` is applied in order; a later collection may reference an earlier one's records (e.g. relations). Order matters.
6. **Records keyed per definition**: each entry is `{ definition, records }`. Append another entry to add a collection; nothing else changes.

## Shape

```js
const collections = [
  {
    definition: { name: COLLECTION, label, description, group, icon, timestamps, fields: [...] },
    records: [ { /* … */ } ],
  },
]
```

`definition` is a normal `collectionDefinition` (see `hamolus-collections`). `records` are plain objects matching the field names.

## Checklist

- [ ] Authored via `hamolus add seed` (or mirrors template tokens/notice)
- [ ] `pnpm typecheck` (`node --check`) passes before pointing it at any core
- [ ] Dry run with `DRY_RUN=1` reviewed before a real run
- [ ] Self-cleaning delete of owned collection/media before recreate
- [ ] Does not `PUT` a code-defined collection
- [ ] Collection order satisfies any relation dependencies
- [ ] Records match field types/names exactly
- [ ] One-line copyright notice at top (scaffold rule)

## References

- `templates/seeds/basic/index.mjs` (canonical)
- `docs/definitions/collection-definition.md` (definition shape)
- `packages/cli/src/commands/add-seed.ts` (tokens, manifest, README)
