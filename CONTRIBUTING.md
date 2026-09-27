# Contributing to Hamolus

Thanks for looking. Hamolus is young, so a good contribution is often a
correction to the docs rather than a new feature — and a correction is worth as
much as a feature here, because the whole project is documentation-driven.

## Where things are

```
packages/cli         the scaffolder (hamolus create / add / link / list)
packages/core        the API Worker — Hono + Drizzle on D1, KV, R2
packages/console     SolidJS + StyleX admin app (also the `add console` source)
packages/types       shared Zod schemas, types and DTOs
packages/panel       framework-neutral browser client for the Panel API
packages/mcp         MCP server exposing the core API as tools
packages/plugins     console plugin workspace (contracts + todo + kanban)
templates/           canonical CLI templates — edit these, never the copy
docs/                the documentation set
```

Two rules cover most of the surprising cases:

- **`templates/` is the source of truth.** `packages/cli` copies it into
  `packages/cli/templates` on `prepack`, so a published CLI ships the same
  files the repository develops against. Edit the template; the copy is generated.
- **`@hamolus/types` is the contract.** Any schema change lands there first,
  because core, console, panel and MCP all validate against it. A definition
  shape that is only enforced in the core is a shape the console will let a user
  break.

## Getting set up

Requires Node 20+ and pnpm 11 (the version is pinned in `packageManager`).

```bash
pnpm install
pnpm typecheck
pnpm build
```

The console's library build is separate and only needed for the generated-app
gate or a manual `hamolus add console`:

```bash
pnpm -F @hamolus/console build:lib
```

## Before you open a change

**Check whether a gate already covers it.** The repository ships its own tests as
`check:*` scripts, and a new one is usually a better contribution than a new
section of prose.

| Gate | Needs | What it proves |
| ---- | ----- | -------------- |
| `pnpm typecheck` | — | every package typechecks |
| `pnpm build` | — | every package builds |
| `pnpm check:markers` | — | the template *copy* is faithful, offline and fast |
| `pnpm check:workspace-glob` | — | workspace and glob regressions |
| `pnpm check:copyright` | — | every published source file carries the copyright/author notice, and every published manifest declares it |
| `pnpm check:code-definitions` | — | boot-time validation, duplicate detection, guard helpers, and that a failed write leaves the previous definitions standing |
| `pnpm check:localization` | — | localized fields, per-locale resolution, generated config validity |
| `pnpm check:panel-runtime` | — | the panel client against a fake core |
| `pnpm check:panel-acl` | a running core on `:8787` | panel ACL enforcement over HTTP |
| `pnpm check:scope-colony-resolution` | a running core | land/colony scope resolution over HTTP |
| `pnpm check:localization-api` | a running core | locale negotiation on real endpoints |
| `pnpm check:code-defined-core` | a generated `predefined` core | code-defined collections and panels serve and stay frozen |
| `pnpm check:generated-app` | a warm pnpm store + `build:lib` | a generated project installs, typechecks and builds |

The last five need a running Worker or a real install. They failing on a laptop
without that setup is not a regression — say which gates you ran.

**Read [the writing guide](docs/writing-guide.md).** It is short, and it covers
what a reviewer here will look for: mark the limits, never document a command
that does not run, comment decisions rather than mechanisms.

**Open an issue first for anything structural** — a new field type, a change to a
definition shape, a new package, a new template. Those touch several packages at
once and are much cheaper to agree on than to review.

## Making a change

1. Branch from `main`.
2. Keep it narrow. A rename of a field type is not a good disguise for a
   formatting change.
3. If you touch `packages/types`, run `pnpm -F @hamolus/types build` before
   typechecking the other packages — they resolve the built `dist`, so a stale
   build produces errors that are not real.
4. If you add or change a field type, the same change belongs in **all** of:
   `packages/types/src/field.ts` (the union and its Zod schema), the DDL map in
   `packages/core/src/db/table.ts`, the coercion in
   `packages/core/src/db/coerce.ts`, the read shape in
   `packages/core/src/db/queries.ts`, the console input in
   `packages/console/src/components/FormInput.tsx` and `Table.tsx`, the
   field editor in `FieldEditor.tsx`, and the panel metric allowlist in
   `packages/core/src/meta/panels.ts` and `src/routes/panels.ts`. A type that
   round-trips through the database but breaks the table renderer is not done.
5. Update the docs in the same change. A schema with no reference is a schema
   nobody can use.
6. Add a gate if the change introduces a rule that could silently regress.

## Copyright and author notices

`@hamolus/core` and `@hamolus/mcp` publish their `src/` directory rather than a
bundle, so the file a consumer reads is the file in this repository. Every source
file in `packages/**` therefore opens with the notice, verbatim, right at the top
(after a shebang if the file has one):

```ts
/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */
```

CSS and SQL carry the same block in their own comment syntax (`/* … */` and a run
of `--` lines), so a file's opening comment is its notice, not a second comment
above it.

Two rules differ on purpose:

- **Scaffolds get one line, not the block.** `templates/` and `examples/` are
  copied into someone else's project, where seven lines of license on every file
  is noise. They carry
  `// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT`
  (or `/* … */` in CSS, `<!-- … -->` in HTML) on the first line instead.
- **JSON carries no notice.** `package.json` and `tsconfig.json` are strict JSON
  and cannot hold a comment, and adding one to `wrangler.jsonc` would only make
  it inconsistent with the template copies of the same file. The published
  manifests declare `license`, `author`, `homepage`, `bugs` and `repository`
  instead, and a `prepack` hook copies the repository's `LICENSE` into the
  package (`scripts/copy-license.mjs`) so the tarball carries the text the
  `license` field claims.

`pnpm check:copyright` pins all of it. If you add a source file, copy the block
verbatim — a notice that drifts in wording is a notice where only the first file
still carries the right year and holder.

## Compatibility

Hamolus is pre-1.0 and follows a strict versioning policy while it is. See
[Releases](#releases) below for the numbers, and mark a change breaking in the
PR when it is one.

Definition shapes deserve particular care. **A definition is a row in a
database, and it does not migrate itself.** Adding a required key is breaking for
every stored row, even though the code change is additive. When you add a
required key:

- accept the old shape on read for at least one release;
- write the new shape going forward;
- say in the changelog what an existing row looks like and how to migrate it.

The same applies in reverse: a `PUT` only ever *adds* columns. Dropping,
renaming or retyping a field is a manual D1 migration, and the docs should say so
wherever a reader might reasonably expect the `PUT` to do it.

## Releases

**The six core packages ship together, at the same version number.** `@hamolus/core`,
`@hamolus/mcp`, `@hamolus/console`, `@hamolus/panel`, `@hamolus/types` and
`@hamolus/cli` are published in one pass. A generated project depends on several
of them at once, so a `^0.2.0` console against a `^0.1.0` core is a shape
mismatch waiting to happen; there is no value in a staggered release that nobody
can install cleanly.

**The console plugins under `packages/plugins/**` version independently.** They
are a separate release train on purpose — a plugin that did not change should not
claim to have shipped. That is also why the CLI holds a per-package fallback
table (`FALLBACK_RANGES` in `src/sources.ts`) rather than one constant: a single
constant hands an unchanged plugin a range for a version it was never published
at, and the failure lands on the user's `pnpm install`, for a package name they
never typed.

**Pre-1.0, the minor bump is the breaking one.** A release that changes
behaviour a current user depends on goes out as a minor bump. A release that only
adds goes out as a patch. `0.2.0` is what changing the MCP write default earned.

**`CHANGELOG.md` at the repository root is the public record**, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) form, grouped by package
where a release touches more than one. Each package README carries a **What's
new** pointer into it — write that line as part of the release, not afterwards,
so a reader on npm can tell what changed without leaving the package page.

**A release is a checklist, and the version lives in six places.** The pins are
not covered by the workspace resolution, and two of them are literals in source
rather than in a manifest, so nothing but the gate below will notice a miss:

```bash
pnpm check:package-versions   # lockstep versions, every template/example range, the CLI's
                              # fallback table, the reported CLI/server versions, the changelog
```

Then, in order: bump the six `package.json` versions, bump the ranges in
`templates/**`, `packages/cli/templates/**` and `examples/**`, update
`FALLBACK_RANGES` and `CLI_VERSION` / `SERVER_VERSION`, write the changelog entry,
`pnpm build && pnpm typecheck && pnpm -s check:package-versions`, publish
packages before the CLI (a generated project resolves the CLI's ranges at install
time), and tag `vX.Y.Z` on the release commit — the changelog's compare links
resolve to that tag, and they 404 without it.

## Commit messages

There is no established convention beyond the initial commit, so use
[Conventional Commits](https://www.conventionalcommits.org/) — it is what the
ecosystem's tooling expects and it reads well in a changelog:

```
feat(types): add a `custom_currency` field type
fix(console): render hasMany relation chips in field order
docs(definitions): document the config definition
refactor(core): extract scope resolution from the request handler
```

Scope is the package, or `definitions` for the docs. Keep the subject under ~72
characters and in the imperative.

## Pull requests

- Describe the problem before the solution, and say how you verified the fix.
- List the gates you ran, and the ones you skipped and why.
- Screenshots for anything visual in the console.
- One concern per PR. Mechanical refactors belong in their own.

## Reporting bugs

Open an issue with the Hamolus version, the package, the command you ran, what
you expected, and what happened — with the stack trace if there is one. A
minimal reproduction is worth more than a precise description.

Security issues are **not** a public issue. Use the repository's **Report
vulnerability** flow at
<https://github.com/hamolus-labs/hamolus/security/advisories/new> instead, so
the details stay private until a fix exists. Anything that is not worth
publishing can go to the contact address in the repository's `package.json`.

## See also

- [Writing guide](docs/writing-guide.md)
- [Definitions](docs/definitions/README.md)
- [Docs index](docs/README.md)
