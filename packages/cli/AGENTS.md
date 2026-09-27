# `@hamolus/cli` — the `hamolus` command

Scaffolds and edits projects: creates a project, adds a core/console/panel/mcp/seed/
configuration part, adds a console plugin, lists what a project contains, and points a
project's `@hamolus/*` dependencies at a local checkout.

## Zero runtime dependencies, on purpose

The published artifact is a **single dependency-free ESM file** (`dist/cli.js` from
`tsup.config.ts`). Argument parsing is `node:util`'s `parseArgs` rather than a CLI
framework so a `npx hamolus` install pulls in nothing. Keep it that way: a new
dependency here is a new dependency for every project that scaffolds.

`bin/hamolus.mjs` is a shim, not a build output. It prefers `dist/cli.js` and falls
back to running `src/cli.ts` directly on Node 22+ type stripping. **After editing the
sources, either rebuild or delete `dist/`** — otherwise the gate scripts below
exercise your previous build and report on it.

## Commands

```bash
pnpm -F @hamolus/cli typecheck
pnpm -F @hamolus/cli dev                     # node --watch --experimental-strip-types
pnpm -F @hamolus/cli build
pnpm hamolus -- <args>                       # run from source at the repo root

pnpm -F @hamolus/cli check:workspace-glob
pnpm -F @hamolus/cli check:plugin-config
pnpm -F @hamolus/cli check:generated-app     # slow: installs and builds a project
pnpm -F @hamolus/cli check:code-defined-core # needs a generated predefined core
```

`prepack` runs `scripts/copy-templates.mjs` and `scripts/copy-license.mjs`: the
repository's `templates/` tree and the root `LICENSE` are copied into the package on
the way out, and neither is committed (`packages/cli/templates/` and
`packages/*/LICENSE` are gitignored).

## Layout

| Path | Holds |
| ---- | ----- |
| `src/cli.ts` | command dispatch; `src/args.ts` parses; `src/help.ts` holds the help text |
| `src/commands/` | one file per command: `create`, `add-{console,panel,mcp,plugin,seed,configuration}`, `list`, `link`, `shared` |
| `src/templates.ts` | template resolution and `{{TOKEN}}` substitution |
| `src/project.ts` | project root resolution — every command starts here |
| `src/tsconfig.ts` | generated `tsconfig.json` files |
| `src/sources.ts`, `src/link.ts` | the source registry and `hamolus link` |
| `scripts/` | the gates plus the two `prepack` copy scripts |
| `templates/` | **generated copy** of the repository's `templates/` — never edit it |

## Invariants

- **A template is a directory of files containing `{{TOKEN}}` placeholders, and each
  command substitutes only the names in its own token map.** `applyTokens` leaves an
  unknown name untouched on purpose, so a typo ships a literal `{{…}}` into a user's
  source. `pnpm check:markers` proves every token is supplied by the command that
  renders it, and that generating from every template leaves no token behind — for all
  four core modes, which is where `{{CORE_MODE}}` and `{{PUBLIC_GETS}}` diverge.
- **The marker comments in a template are an API.** `hamolus add plugin` appends to the
  `plugins` array between `/* hamolus:plugins:start */` and `:end */`, and adds its
  import between the `imports` markers. Remove or move a marker and the command fails
  loudly with a "restore the markers" error — that is the designed behaviour, not a bug
  to work around. The `imports` markers live **above** `defineConsoleConfig({ … })` on
  purpose: inside the object literal, an `import` line does not parse.
- **Every command resolves the project root first** by walking up to `hamolus.json`.
  A directory without one is rejected before any manifest is read, so the CLI cannot
  be run from the repository root — it has no `hamolus.json`.
- **`--output` is resolved relative to the project root, not the CWD.**
- **Part names are `snake_case`** (`[a-z][a-z0-9_]*`). A directory may be named
  differently from the part (an example lives in `booking-kalendar/` with panel id
  `booking`), but the id always comes from the name.
- **A new part must register its directory as a workspace glob** in
  `pnpm-workspace.yaml`, or pnpm never sees the package. `check:workspace-glob` pins
  the insert, which must land inside the `packages:` block — an earlier version
  appended at the end of the file, where it was silently ignored.
- A generated `tsconfig.json` is **self-contained**: it must not extend the repository's
  `tsconfig.base.json`, because a generated project is not inside this repository.

## Conventions

- Copyright/author/SPDX header verbatim (`pnpm check:copyright`). `scripts/*.mjs` and
  `bin/*.mjs` keep the shebang on line one and the notice under it.
- Each gate script states in its header **why it exists**, what it needs (network? a
  running core? a warm pnpm store?), and that it is self-cleaning. Keep that promise:
  the gates run in a throwaway temp directory and touch no shared state.
- Document a command by what it guarantees, not by listing its flags — `src/help.ts` is
  the user-facing text and it should read like the docs.
