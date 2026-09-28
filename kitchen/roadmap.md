# Roadmap

> Public roadmap. Order and scope are living decisions — this page is the
> single place to discuss priorities before they hit planning.md.

## Compass

Hamolus is a headless CMS that is MCP-first and metadata-first. The "model" is a
runtime collection, not code. Anything we build should make that axis stronger,
not bury it under tooling that assumes a compile-time schema.

## Now (in flight)

- **One-click deploy to Cloudflare** for core, console and MCP. Repos live at
  `hamolus-labs/{core,console,mcp}`; generated from `packages/*` via
  `scripts/export-deploy-repo.mjs`; drift is gated by `--check`.
- **Hook the deploy gate into the release pipeline** so the check runs on every
  release instead of by hand. (That gap is how a stale repo went unnoticed
  before.)
- **Console health.** Bugs, features that do not match intent, and display/UX
  that is not yet right. Worked through a list, one at a time, confirmed with the
  author.

## Next (queued)

- **Console-facing configuration.** A way to seed and edit the KV-backed
  settings that the console exposes. This is a "configuration" in name only — it
  is the settings surface of the console, and it does not exist yet. Distinct
  from `hamolus add configuration`, which generates a wrangler deployment preset
  and stays as-is.
- **Site deploy** (deferred by the author).

## Exploration (not committed)

- **CVC — Collection-View-Controller, a single-stack framework.** Positioned for
  people who are comfortable with Laravel: write a TypeScript model, get a
  runtime collection + a view. Console = direct admin UI; panels = end-user UI;
  both are views over the same collection. The honest framing is CVC, not MVC.

### CVC — the arrow of work

Start with exactly one seam: **a TS model definition that generates both the
collection and the view scaffolding.** That seam is the whole product axis.
Everything else (CLI sugar, more view kinds, generators) is a distractor until
it works.

### Explicitly deferred — multi-database

PostgreSQL, MariaDB, SQLite and MongoDB are all on the table as an eventual
capability, but they are not the CVC foundation:

- The core is D1/SQLite-specific in its schema and DDL builder. Supporting a
  second dialect requires a proper storage layer, not a config flag.
- MongoDB has no DDL — it is a separate product path, not a third dialect.
- Multi-database is a compelling marketing keyword but a permanent cost (every
  dialect is a gate, a test suite, a corner-case list, forever).
- Doing CVC well on D1 first is what makes CVC attractive; multi-database
  should follow, not lead.

Explicitly out of scope for now: nothing is carved in stone, but a framework
that promises five databases on day one is a risk, not a feature.