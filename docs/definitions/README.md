# Definitions

Hamolus has four kinds of definition. They are not interchangeable, and they do
not live in the same place — two are rows in D1, one is a file, one is a
JavaScript object in your core. Knowing which is which is most of the work.

| Definition | What it declares | Stored in | Changed by |
| ---------- | ----------------- | --------- | ---------- |
| [Collection](./collection-definition.md) | the fields of one table | D1 `_meta_collections` | `PUT /api/_meta/collections/{name}` |
| [Field](./field-definition.md) | one column of a collection | inside its collection | the same PUT — fields are never edited alone |
| [Panel](./panel-definition.md) | an app surface: views, metrics, access | D1 `_meta_panels` | `PUT /api/_meta/panels/{id}` |
| [Config](./config-definition.md) | project settings: locales, upload rules, theme | a file in the core | a deploy, not a request |

The first three are **metadata**: they live in the database, are edited from the
console, and the core validates and serves them over HTTP. The fourth is
**configuration**: it is TypeScript in your repo, it is read at boot, and changing
it means shipping a deploy. `templates/cores/*/core.config.ts` is where a
generated project keeps the second kind.

## Why the distinction matters

A collection definition is data, so a `PUT` can add a column to a live table
without a deploy. That is the whole appeal, and the whole hazard: the schema
lives in a database, so it drifts from the code, and two environments can be
quietly out of sync. Config does the opposite — it is code, so it is versioned,
reviewable, and identical everywhere, but nothing changes until you deploy.

A consequence worth stating plainly: **collection definitions are
console-first, config is file-first.** If you find yourself wanting to `PUT` a
setting, you probably want a collection field. If you find yourself editing a
locale list in D1, you have made a mistake.

## Reading order

If you are defining a data model, read [collections](./collection-definition.md)
then [fields](./field-definition.md) — the second is meaningless without the
first. If you are building an app surface, [panels](./panel-definition.md) is
self-contained and references collections by name. If you are setting up a
project, [config](./config-definition.md) comes first, because the locale list
it declares decides which fields can be `localized`.

## The one-sentence version of each

- A **collection** is a table: `{ name, label, primaryKey, fields, … }`.
- A **field** is a column: `{ name, type, … }` plus type-specific keys.
- A **panel** is a permissioned view over collections: `{ views, metrics, roles }`.
- The **config** is your project: `{ localization, uploads, console }`.

## Things the definitions share

- `.strict()` everywhere. An unknown key is a validation error, not a silent
  no-op — a typo in a field property fails the `PUT` instead of quietly doing
  nothing.
- Idempotent `PUT`. Sending the same definition twice is a no-op, so a script
  can be re-run.
- Definitions only ever **add**. A `PUT` creates a missing table and appends
  missing columns; it never drops, renames, or retypes. Those need a D1
  migration, by hand.
- Code-defined definitions exist for exactly this reason. A `predefined` core
  declares its collections in source control, so boot-time validation and a
  failed registration are both loud instead of silent. See the
  [`predefined` template](https://github.com/hamolus-labs/hamolus/tree/main/templates/cores/predefined).

## See also

- [Docs index](../README.md) — the wider documentation set.
- [Core API reference](../../packages/core/docs/api.md) — the HTTP surface for
  collections and panels.
- [Writing guide](../writing-guide.md) — how to write these docs and the code
  around them.
- [Deploying](../deploying.md) — bindings, secrets, configurations.
