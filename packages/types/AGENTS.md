# `@hamolus/types` — shared contracts

Zod schemas, TypeScript interfaces and API DTOs for collections, fields, records,
media, files, panels, auth and scope. Every other package in the workspace imports
from here, and the core validates every request body with these schemas.

## Commands

```bash
pnpm -F @hamolus/types typecheck   # tsc --noEmit
pnpm -F @hamolus/types build       # tsup -> dist/ (esm + cjs + d.ts)
pnpm -F @hamolus/types dev         # tsup --watch
```

**Build before you typecheck anything else.** The other packages resolve `@hamolus/types`
through its built `dist`, so a stale build produces type errors that are not real.

## Layout

| File | Holds |
| ---- | ----- |
| `field.ts` | the field-type union and its Zod schema — the most load-bearing file here |
| `collection.ts` | collection definition, field definition, and the shapes a record can take |
| `dto.ts` | the API envelopes: `PaginationMeta`, list/item responses, error payloads |
| `panel.ts` | panel manifest, panel view, and `panelQuerySchema` |
| `localization.ts` | `core.config.ts` / `console.config.ts` schemas, `defineCoreConfig`, `defineConsoleConfig` |
| `scope.ts` | `CORE_MODES`, land/colony identifiers |
| `auth.ts` | session/JWT payload shapes, permission enums |
| `group.ts` | groups, roles, privileges |
| `markdown.ts`, `currency.ts` | formatting helpers shared by console, core and panels |

## Invariants

- **A definition is a row in a database and it does not migrate itself.** Adding a
  required key to a definition schema breaks every stored row that predates it. Accept
  the old shape on read for at least one release, write the new shape going forward,
  and say in the changelog what an existing row looks like.
- **Adding or changing a field type touches eight packages.** The union and schema in
  `field.ts`, the DDL map in `@hamolus/core/src/db/table.ts`, coercion in
  `coerce.ts`, the read shape in `queries.ts`, the console input in `FormInput.tsx`
  and `Table.tsx`, `FieldEditor.tsx`, and the panel allowlists in the core. A type
  that round-trips through D1 but breaks the table renderer is not done.
- **The list query is `strict`.** An unknown key is rejected with `INVALID_QUERY`
  instead of being ignored, so panels and sites break loudly on a typo. Note the
  asymmetry: `panelQuerySchema` accepts only `page`, `pageSize`, `search`, `locale`,
  `sortBy`, `sortDir` — **no `filter`** — while the public list query also accepts
  `filter`.
- **Config schemas are `strict` too.** `defineConsoleConfig({ localization: … })`
  throws and names the file. A leftover key from an older template is a build error,
  which is the intended outcome.
- `ConsoleConfigOptions` (input) and `ConsoleConfigInput` (resolved) are separate
  types on purpose: `plugins` is optional for a host and always present after
  validation, and conflating them makes the empty config a type error.

## Gates

```bash
pnpm check:code-definitions   # @hamolus/core: offline definition contract
pnpm check:localization       # @hamolus/core: config + localized field rules
pnpm typecheck && pnpm build
```

## Conventions

- Every source file opens with the copyright/author/SPDX block. `pnpm check:copyright`
  enforces it verbatim; copy it exactly.
- Document the *why* above the *what*. The header of each file states what a reader
  must not break. Comments are English; commit messages follow Conventional Commits
  with the package as the scope.
- No runtime dependency except `zod`. This package is loaded in Workers, in Node, and
  in the browser bundle of every generated console — keep it that way.
