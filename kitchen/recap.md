# Recap

> Public session notes. This page is the presentable, shareable minutes of a
> working session — the counterpart to the private `.opencode/recap.md`.
> Anything here is safe to show a contributor or a reader who is not in the room.

## 2026-09-28 — One-click deploy, config disappointment, and the CVC idea

### Session goals

Two threads ran in this session:

1. Ship a real "Deploy to Cloudflare" entry point for the HM core, console and
   MCP packages, backed by standalone repositories that can never drift from
   `packages/*`.
2. Brainstorm what a "Hamolus framework" could be — what single-stack, MVC-like
   development looks like on top of a metadata-first core.

### Delivered

**Release verification.** `@hamolus/*` 0.2.8 is fully published and the registry
agrees with the workspace on all seven packages. Tag `v0.2.8` is on `origin` and
`upstream`; the tree is clean. A previously reported "broken publish" turned out
to be a stale installed CLI (`0.2.3`-era behavior) on a user machine, not a bad
release — the published `@hamolus/cli@0.2.8` is correct (templates pin
`^0.2.8`, the seed flow is present in the built artifact).

**Deploy repositories.** Added `scripts/export-deploy-repo.mjs`, which generates
standalone public repositories for the core, console and MCP from `packages/*`:

- rewrites `workspace:*` → `^0.2.8`
- strips placeholder D1/KV resource ids so Cloudflare auto-provisions them
- carries `tsconfig.base.json` and repoints `extends` to it
- writes a `pnpm-workspace.yaml` with the `allowBuilds` set and the
  `minimumReleaseAgeExclude` policy so a fresh install works on pnpm ≥ 10
- injects a real "Deploy to Cloudflare" button into the README
- ships a `--check` mode that diffs the export against `packages/*` and exits
  non-zero on drift

Pushed as the authoring GitHub account: `hamolus-labs/core` (`5262aa2`),
`hamolus-labs/console` (`3f88594`), `hamolus-labs/mcp` (`96d3dd5`). All three
repos are public and the buttons are live. The drift gate is mutation-tested.

Deploy notes for the buttons: secrets are never part of a button deploy. The core
needs `JWT_SECRET` and `ADMIN_KEY` set after first deploy; the MCP server needs
`CORE_ADMIN_KEY` plus `CORE_API_URL` pointed at the deployed core (its default
points at `localhost`). The console is static assets and needs no secrets.

### Direction on "configuration"

The existing `hamolus add configuration` produces a wrangler deployment preset
(which D1/KV/R2 a core binds), and the placeholder-id protection around it works.
That is not what was meant going forward: the request behind the term is a way to
seed, from the console, the KV-backed settings that the console itself exposes.
The deployment-preset command stays; the console-facing configuration seeding is
a separate, not-yet-built feature. The old command was made in an earlier session
and predates the current work.

### The CVC brainstorm

A stretch idea, still under consideration (not committed). Problem being solved:
single-stack, MVC-familiar development on top of a metadata-first core.

- **CVC, not MVC.** Model-View-Controller is a telling framing for people coming
  from Laravel, but the honest form is Collection-View-Controller: the "model"
  is a TypeScript interface that translates into a runtime collection, not a
  migration file or a class table.
- **View already exists.** Console = direct admin UI on the core; panels =
  end-user-facing UI. The panel system (`templates/panels/basic`, `@hamolus/panel`)
  is a working example of the "view" layer talking to the same model.
- **Single stack = one deploy, one mental model.** Backend and frontend in one
  worker, mirroring the ergonomics people get from Laravel but without the
  migration-file workflow.
- **Arrow of work.** The framework should begin with one seam: a TS model
  definition that generates both the collection and the view scaffolding. That is
  the whole product axis; everything else is a distractor.

Explicitly deferred: cross-database support (PostgreSQL, MariaDB, SQLite,
MongoDB). The core today is D1/SQLite-specific and would need a dialect layer
first. Decision flagged: multi-database is a heavily advertised keyword but a
large recurring cost; worth marketing, but not the feature that makes CVC work.

### Decisions

- Keep shipping releases; the CLI secret-generation behavior is confirmed good.
- Deployment repositories are generated, verified, and pushed. Drift protection
  is implemented; hooking the gate into `release.mjs` is an open follow-up.
- The console-facing configuration/seed feature is not built yet; the
  wrangler-preset command is unaffected.
- CVC framework: keep in exploration; no build work started.