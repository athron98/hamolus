---
name: hamolus-verify
description: Use ONLY when deciding which Hamolus checks/gates to run after a change, or when a gate failed. Separates offline gates from live gates needing a running core, lists the root 'pnpm check:*' names and the deploy-repository drift gate, and states which failures are environmental. Front-load keywords: pnpm check, gate, typecheck, build, check:code-definitions, check:panel-acl, deploy repos, export-deploy-repo, verify.
---

# Hamolus — Verify

Pick the right gates for the change and read a failure correctly. From the repository root.

## When to use

Before proposing any change to `packages/**`, `templates/**`, or `examples/**`. Also when the user asks "is it green", "run the checks", or reports a gate failure.

## Always run (offline, no core needed)

```bash
pnpm typecheck
pnpm build
pnpm check:markers              # template copy faithful + theme script parity
pnpm check:copyright            # every published file carries its notice
pnpm check:code-definitions     # offline definition contract (core)
pnpm check:localization         # config + localized field rules (core)
pnpm check:workspace-glob       # pnpm-workspace.yaml globs (cli)
pnpm check:panel-runtime        # panel SDK vs template (panel)
pnpm -F @hamolus/cli check:plugin-config   # host↔plugin contract (cli, no root pass-through)
```

`pnpm check:plugin-config` is **not** a root script — it only exists in
`@hamolus/cli`, so invoke it with `-F`. A root pass-through exists for
`check:code-definitions` and `check:code-defined-core` but not for this one.

`pnpm build` for `@hamolus/core` and `@hamolus/mcp` is `wrangler deploy --dry-run` — a compile check, not a bundle.

**Build order matters:** `@hamolus/types` must be built before other packages typecheck (they resolve it through `dist`). A stale types build produces type errors that are not real — rebuild first, then believe the error.

## The deploy-repository gate (offline, needs a local clone)

The "Deploy to Cloudflare" buttons in the READMEs are backed by generated copies of
`packages/{core,console,mcp}` in `hamolus-labs/{core,console,mcp}`. Those copies are
**never edited by hand** — a stale copy would deploy old code behind a button that
looks current (that is exactly how `athron98/hamolus-core` rotted).

When `packages/core`, `packages/console` or `packages/mcp` (or `tsconfig.base.json`)
change, re-export to a local clone and verify no drift:

```bash
node scripts/export-deploy-repo.mjs --dest <clone-dir>        # regenerate the copies
node scripts/export-deploy-repo.mjs --check --dest <clone-dir>  # fail if the clones drifted
```

`--check` exports into a scratch directory and diffs against `--dest`; exit non-zero
names the file that drifted. It is offline and self-cleaning (`node_modules/.cache`).
If the change must reach the live repositories, the diff files are then committed
and pushed in `hamolus-labs/*` — never edited in place there. Placeholder resource
ids are intentionally stripped by the export (auto-provisioning), so a `--check`
against the monorepo's own `wrangler.jsonc` is the wrong comparison.

## Live gates (need a core on `127.0.0.1:8787` or a warm install)

```bash
pnpm -F @hamolus/core dev        # in another terminal

pnpm check:panel-acl             # panel ACL over HTTP
pnpm check:scope-colony-resolution
pnpm check:localization-api
pnpm check:code-defined-core     # generated predefined core (cli)
pnpm check:generated-app         # installs and builds a generated console (slow)
```

These are **not broken** when they fail on a laptop without a running core or a warm pnpm store. Say which gates you actually ran.

## Choosing by change

| Changed | Run |
| ------- | --- |
| A field type or collection schema | `typecheck`, `build`, `check:code-definitions`, `check:panel-runtime`, `check:panel-acl` |
| A panel manifest | `check:code-definitions`, `check:panel-acl`, `check:panel-runtime` |
| `core.config.ts` / localization | `check:localization`, `check:localization-api` |
| `console.config.ts` / plugins | `check:plugin-config` (via `-F @hamolus/cli`), `check:markers`, `check:generated-app` |
| A template | `check:markers`, `check:generated-app`, `typecheck`, `build` |
| Anything published | `check:copyright` |
| A new package/plugin directory | `check:workspace-glob` |
| `packages/core` / `console` / `mcp` or `tsconfig.base.json` | deploy-repo gate (`export-deploy-repo.mjs --check`) + rebuild `@hamolus/types` first |

## Reading a failure

- **`check:code-definitions` says "dist types newer than src"** → rebuild `@hamolus/types` first. The gate is telling you the truth.
- **Live gates fail identically on a clean tree** → environmental (no core / cold store), not a regression. Verify on a clean checkout before claiming a regression.
- **`check:generated-app` is slow** (installs + builds a generated console). Build `@hamolus/console` (`build:lib`) first or it exercises a stale library.
- **Copyright gate is exact-match**, not a heuristic: copy the header verbatim.

## Reporting

State which gates ran and their counts, and separate "green" from "not run / environmental". Never imply a live gate passed when it was skipped.

## References

- `docs/writing-guide.md` → Checks
- `CONTRIBUTING.md`
- Root `package.json` `scripts`
- Per-package `AGENTS.md` (`packages/*/AGENTS.md`) for gate specifics
