# Changelog

All notable changes to Hamolus are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
while pre-1.0. Versioning is described under [Releases](#releases) below.

## [Unreleased]

Nothing yet.

## [0.2.1] — 2026-09-28

A republish. No source change — the code in `0.2.1` is byte-for-byte the code
that was in `0.2.0`.

### Fixed

- **Four packages could not be installed at all.** `@hamolus/core`,
  `@hamolus/mcp`, `@hamolus/console` and `@hamolus/panel` were published with
  the `workspace:*` protocol left literally in their `dependencies`. Only pnpm
  rewrites that protocol to a real range when packing; the `0.2.0` tarballs
  were built by `npm publish`, which passes the manifest through untouched. npm
  refuses that URL type outright, so `npm i @hamolus/core@0.2.0` failed with
  `EUNSUPPORTEDPROTOCOL` before any code ran. `pnpm publish` produces the
  correct `@hamolus/types` pin; the `0.2.1` tarballs were built with it.
- `@hamolus/cli@0.2.0` and `@hamolus/types@0.2.0` were unaffected — neither
  depends on a workspace sibling — and stayed on the registry. They are
  republished here anyway, so the six core packages share one version.

If you saw `EUNSUPPORTEDPROTOCOL` installing any `@hamolus/*` package, that is
this. `pnpm up "@hamolus/*@^0.2.1"` is the fix.

## [0.2.0] — 2026-09-28

The MCP server's release. A collection is now a first-class thing an agent is
allowed to see, and a definition says what that is.

All six core packages are published in lockstep at `0.2.0`: `@hamolus/cli`,
`@hamolus/console`, `@hamolus/core`, `@hamolus/mcp`, `@hamolus/panel` and
`@hamolus/types`. The three console plugins (`@hamolus/plugin-console-*`) are
unchanged and stay at `0.1.0` — they version independently, so a release that
does not touch them does not claim to.

### Breaking

- **Collections are read-only through MCP unless you say otherwise.** Every
  collection now carries an `mcp` key — `read`, `write` or `hide` — and the
  default for a collection that does not set it is `read`. In `0.1.0` an MCP
  server could create, update and delete records in any collection. In `0.2.0`
  it cannot, until the definition says `mcp: 'write'`.

  This is the whole point of the release: the mode that is safe is the one you
  get for free, and the mode that hands an agent write access is the one
  somebody has to type on purpose. If you want the old behaviour back:

  ```ts
  // packages/core/src/collections/posts.ts
  { name: 'posts', mcp: 'write', fields: [ /* … */ ] }
  ```

  Or over the API, `PUT /api/_meta/collections` with `"mcp": "write"` in the
  definition, or through `put_collection` on the MCP server.

- **`hide` refuses collection management, not just data access.** A collection
  with `mcp: 'hide'` is absent from the tool and resource indexes and refuses
  every read, and `put_collection` / `delete_collection` refuse it too — so a
  server that cannot see a hidden collection also cannot un-hide it. Change the
  mode from the console or the REST API.

- **`@hamolus/mcp` is no longer a single opaque file.** `src/tools.ts` is gone,
  split into `src/tools/{records,media,meta,admin}.ts` plus shared helpers. It
  is a source-level change only; the package still ships raw TypeScript and the
  tool names and wire behaviour are unchanged apart from the mode above.

### Added — `@hamolus/mcp`

- **Resources.** `hamolus://` static resources — `collections`, `settings`,
  `localization`, `stats`, `lands`, `groups` — and `ResourceTemplate`s for
  `collection`, `records`, `record`, `media`, `document`, `attachment`, `group`
  and `config`. Every payload is the core's own JSON, pretty-printed, so a
  resource and the equivalent tool call return the same bytes.

- **Prompts.** Seven task-shaped prompts, each a single user turn.

- **Generated per-collection tools.** `MCP_DYNAMIC_TOOLS` turns the core's own
  definitions into `list_posts` / `get_post` / `create_post` / `update_post` /
  `delete_post`, with schemas built from the definition's real fields rather than
  a hand-written guess. Off by default; `MCP_DYNAMIC_MAX` caps it.

- **Tool groups.** `MCP_TOOL_GROUPS` (default `records,media,meta`) selects which
  groups register; `admin` is opt-in via `all`.

- **Scope overrides per call.** Every tool accepts `land` / `colony`.

- `CoreClient` gained query-string building, `patch()`, `postForm()` and multipart
  upload.

### Added — `@hamolus/types`

- `CollectionDefinition.mcp` with a strict `read | write | hide` enum, plus
  `collectionMcpMode()` and `toMcpMode()`.

### Fixed — `@hamolus/cli`

- `hamolus add plugin` no longer writes a range for a version the plugin was
  never published at. The fallback was a single constant shared by every
  `@hamolus/*` package, which is only correct while all of them share a version;
  the moment a release leaves a plugin behind, the generated project gets
  `^0.2.0` for a package that exists at `0.1.0`, and `pnpm install` fails on a
  name the user never typed. The fallback is now a per-package table.

### Added — `@hamolus/core`

- The `mcp` column on `_meta_collections`, backfilled as `NULL` (which reads as
  `read`).

- **A new `MCP exposure` section in the console's collection editor** — *Read
  only* / *Read + write* / *Hidden*, labelled by effect rather than by name.

- `scripts/bootstrap.sql` now matches the schema the runtime creates, including
  the composite `(land, colony, name)` primary key. A database bootstrapped from
  it no longer needs the runtime to widen the table at boot.

### Added — repository

- `CHANGELOG.md`, this file, as the public release record.
- `pnpm check:package-versions`, which refuses a release where the six package
  versions disagree, where a template or example pins a range that does not match
  the version it names, where the CLI's fallback table has drifted, where
  `CLI_VERSION` or `SERVER_VERSION` reports a version that is not the release,
  or where this changelog has no entry for the version being shipped.

### Upgrading

The `_meta_collections.mcp` column is added automatically on the first request
after upgrade. Nothing to run.

Generated projects created by `hamolus create` before this release pin
`@hamolus/*` at `^0.1.0`; bump them to `^0.2.0` to pick these changes up:

```bash
pnpm up "@hamolus/*@^0.2.0"
```

After that, review your collections' `mcp` mode — any collection an agent was
writing to needs `mcp: 'write'`.

[Unreleased]: https://github.com/hamolus-labs/hamolus/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/hamolus-labs/hamolus/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/hamolus-labs/hamolus/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hamolus-labs/hamolus/releases/tag/v0.1.0

## Releases

**The six core packages are versioned together.** `@hamolus/core`, `@hamolus/mcp`,
`@hamolus/console`, `@hamolus/panel`, `@hamolus/types` and `@hamolus/cli` always
carry the same version number and are published in one pass, because a generated
project depends on several of them at once and a `^0.2.0` console against a
`^0.1.0` core is a shape mismatch waiting to happen.

**The console plugins are not part of that set.** `@hamolus/plugin-console-*`
version independently; a plugin that did not change does not get republished
under a version it did not ship.

**Pre-1.0 versioning is strict, and the minor bump is the breaking one.** A
release that changes behaviour a current user depends on goes out as a minor
bump; a release that only adds goes out as a patch.

**A change is breaking when it alters an existing shape**, not merely when it
adds a required key. A definition is a row in a database and does not migrate
itself, so an added key is breaking for every stored row even when the code
change looks additive — see the compatibility notes in
[CONTRIBUTING.md](CONTRIBUTING.md#compatibility).
