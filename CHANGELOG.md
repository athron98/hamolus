# Changelog

All notable changes to Hamolus are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
while pre-1.0. Versioning is described under [Releases](#releases) below.

## [Unreleased]

## [0.2.10] — 2026-09-30

### Added

- **Console-managed MCP servers.** A deployed MCP server now needs a core URL and an
  instance id and nothing else. Scope, enabled/read-only state, dynamic tools, the tool
  surface and the caller policy all live in the core and change without a redeploy, from
  **Environment → MCP**.

  Previously a server needed `CORE_ADMIN_KEY`, which is platform-wide: an instance serving
  one colony could reach all of them, and `MCP_READONLY` only narrowed what the worker
  *offered*, not what the core *accepted*. Read-only is now a rule the core applies, via
  the `MCP_GROUP_PERMISSIONS` mapping from an operator's declared tool groups to the
  permission list the core itself checks.

- **Per-user MCP tokens, issued from the console and revocable individually.** The
  plaintext token is returned exactly once, at creation, and only its hash is stored. A
  token can *narrow* its instance's permissions and can never widen them. A token is
  scoped to one colony and belongs to one instance, and the instance id in the request
  header is held against it.

- **New permissions `mcp.read` and `mcp.write`,** separating who may see MCP
  configuration from who may change it. A land admin must name a colony for a
  single-instance read, the same as everywhere else.

- **`GET /api/_mcp/config` and `POST /api/_mcp/session`,** mounted before the JWT and
  scope middleware so a worker can call them using only its instance id. An unknown id
  answers 401 rather than 404, so an agent re-authenticates instead of reporting a bug
  in its own request; a revoked token and a wrong secret share a code and differ only in
  the console-facing reason.

- **`check:mcp-instance-acl`,** a 69-assertion gate that provisions two lands, three
  colonies and four roles, then exercises the real HTTP surface: cross-colony refusal,
  id collisions, token narrow/widen, read-only enforcement, revocation, disabled
  instances, and that an MCP token is not a console session. It cleans up after itself.

### Changed

- **The MCP template and `hamolus add mcp` emit two variables,** `CORE_API_URL` and
  `MCP_INSTANCE_ID`, and the instance id is left visibly empty rather than filled with a
  guessable placeholder. The deprecated `CORE_ADMIN_KEY` / `MCP_BEARER_TOKEN` path still
  works, and `GET /` on the worker reports `mode: "legacy"` and warns.

### Fixed

- **A token could be redeemed through the wrong instance.** `verifyMcpToken` resolved the
  token to its own instance without checking that against the instance id in the request
  header, so any worker in any colony could present a valid instance id and exchange
  another deployment's token — receiving a session scoped to a colony it has no business
  reaching, with its own id looking legitimate in every log along the way. The header id
  is now an assertion the core holds against the token.

- **MCP instance and token ids are unique globally.** They are high-entropy and are used
  as the lookup key, so a per-colony primary key let `WHERE id = ?` resolve to an
  arbitrary match and hand one colony's session to another's worker.

- **Missing, unknown and revoked MCP credentials answer 401, and a disabled instance
  answers 403** with a code the console can act on, instead of a 400 that reads as a bug
  in the caller's request.

- **A read-only MCP instance no longer advertises write tools.** `tools/list` returned
  `create_record`, `update_record`, `delete_record` and friends on a read-only instance;
  the core refused them on call, so nothing was writable — but an agent reads the tool
  list to decide what it can do, and a list of tools that all fail wastes the turn and
  teaches the model to retry refusals. It was also inconsistent inside the package: the
  per-collection dynamic tools already disappeared when read-only, so the same
  instance hid `create_record` for a dynamic collection while advertising the static
  one. Write tools are now not registered at all, detected by the same `runWrite` wrapper
  that enforces the refusal, so the two cannot drift. The core remains the boundary.

- **A disabled or revoked instance now says so over MCP.** `createMcpHandler` catches
  whatever its factory throws and reports a generic JSON-RPC `-32603 Internal server
  error`, so the `catch` written to pass the core's wording through never ran. A
  switched-off instance, a revoked token and a stale instance id all reached the client
  as the same nameless failure. The config and token exchange now resolve before the SDK
  handler is involved, and the caller gets `FORBIDDEN` — "This MCP instance is disabled".

- **A disabled MCP instance is no longer drawn in the same neutral as a `Read/write`
  one.** Both used the dim pill, so a server that refuses every request looked ordinary
  in the table and the word had to be read to notice. "Not serving" is the one fact this
  table exists to show, so it now gets the danger tone plus a strike-through — a
  structural difference that survives a colour-blind reader and a greyscale screenshot.

- **`packages/mcp/wrangler.jsonc` no longer advertises the old secret arrangement.**
  It still documented `CORE_ADMIN_KEY` and `MCP_BEARER_TOKEN` and carried no
  `MCP_INSTANCE_ID`, so the "Deploy to Cloudflare" copies exported from it shipped a
  setup that could not reach the managed path at all. Its vars are now the same two the
  template emits.

- **The console's copy-paste block quotes the core URL it is actually talking to.**
  It said `https://your-core.example.com/api`, whose failure surfaces as a 404 from the
  new worker minutes later. An empty `apiBase()` — console served from the core — now
  resolves to the current origin plus `/api`.

- **The instance create body no longer accepts `land`/`colony`.** The route resolved the
  instance's colony from the query and the session's privilege; the schema also accepted
  the same two fields in the body, so one fact had two sources and a caller sending both
  got whichever the route happened to read. They remain in the response, because the
  console has to show which colony a row belongs to.

## [0.2.9] — 2026-09-29

### Changed

- **`_configs` loses its `scope` column; a row now belongs to a colony.** `scope` was
  doing two incompatible jobs at once — partitioning the table *and* describing who the
  value was for — and the partition won every time. A row now carries `land` and `colony`
  and the key is unique per `(land, colony, key)`. A land-level user sees their own land
  plus all of its colonies, a colony-level user sees only their colony, and the scope
  filter is hidden unless the user holds `lands.read` / `colonies.read`. Existing rows are
  replaced by sample data rather than migrated: the old shape had no correct destination.

### Fixed

- **Authorization read the role name, not the scope.** `isPlatformAdmin()` tested
  `role === 'admin'`, and the default colony-level privilege is *named* `admin` — so
  every colony administrator had platform-wide reach. Reach is now read from the `scope`
  claim. A gate (`check:config-scope-acl`) exists so the next reader does not have to
  re-derive this from a name that reads like authority.
- **A land and a colony could be requested together without being checked.** For a
  platform admin the list path read `?colony` and dropped `?land`, so a request for a
  land-B row returned land-A data — a wrong answer that looked right. It is now
  `400 SCOPE_MISMATCH` when the registry says the colony belongs to another land.
- **Re-seeding `_configs` could fail outright on the most affected database.** The old
  primary key `(scope, key)` let `('core','theme.mode')` and `('site','theme.mode')`
  coexist, which was routine once `scope` became a UI filter. Remapped to
  `(land, colony, key)` they collide, and an ordinary `INSERT` cancelled the entire
  migration, leaving every config read a 500. The seed is now `INSERT OR IGNORE` +
  upsert.
- **The console's Cloudflare deploy failed on a file that held nothing but comments.**
  The generated `pnpm-workspace.yaml` carried `allowBuilds` but no `packages` key, and
  pnpm reads the *existence* of that file as "this is a workspace root" — so it saw zero
  members and refused to run any command, deploy included. Older pnpm (what the Cloudflare
  build image pins) still enforces this. The exported file now declares its one package.
- **An exported deploy repo named a package manager it does not control.** Cloudflare
  picks the manager from whichever lockfile it finds, and the exported repo ships none,
  so `deploy` running `pnpm build` worked only when the guess matched. Exports now rewrite
  `pnpm <script>` to `npm run <script>`, the one spelling that works under every manager.

## [0.2.8] — 2026-09-28

### Added

- **The MCP server arrives wired.** `hamolus create --with-mcp` now writes `mcp/.dev.vars`
  holding the same `ADMIN_KEY` as the `core/.dev.vars` it generated a moment earlier, so
  `pnpm dev` authenticates with nothing to copy and nothing to paste. Before this the server
  had `CORE_API_URL` and no way to authenticate: it started cleanly, answered `GET /` with
  200, and then failed *every tool call* with "No CORE_API_TOKEN or CORE_ADMIN_KEY configured
  for the MCP server." The key goes in `.dev.vars` rather than `wrangler.jsonc` `vars`
  because `vars` is committed, and a secret and a var can never share a name. A core-less
  project gets nothing written and is told what to fill in, since its core runs elsewhere.

### Fixed

- **The hint no longer tells you to copy `mcp/.env.example` over `mcp/.dev.vars`.** That
  instruction replaced a working `CORE_API_URL` with a placeholder for a *deployed* core, and
  then asked for a key on top of the damage.
- **Three places named the wrong token.** `MCP_BEARER_TOKEN` authenticates callers *to*
  `/mcp`; it is not how the server authenticates to the core. That is `CORE_API_TOKEN`, or
  `CORE_ADMIN_KEY` to have one minted. The core-less project notes, the part descriptions
  and the generated `.env.example` all now name the variable the code actually reads, and
  say `.dev.vars` rather than `.env`, since that is where secrets belong next to a
  `wrangler.jsonc`.

## [0.2.7] — 2026-09-28

### Fixed

- **A brand-new project no longer shows an error on its home page.** With no `articles`
  collection in a fresh core, the site got a 404 and treated it as a failure, so the page
  read `Could not load articles: NOT_FOUND — Collection 'articles' is not registered`. The
  "no articles yet" message could not be reached: the only way to get an empty list was
  for the collection to already exist and hold nothing, which is the one case that needs no
  explanation. A missing collection is now a third state, separate from a failure, and it
  names the next action instead of apologising for the data. The Next list was rendering an
  empty `<ul>` under its error message for the same reason; it is guarded now too.

## [0.2.6] — 2026-09-28

### Added

- **The `basic` seed now fills the `articles` collection the site templates read.** It
  seeded a `basic_notes` collection that no template asked for, so a seeded project had one
  more collection in the console and exactly the same empty home page — the symptom being a
  project that looks seeded and renders blank. The collection is deliberately *not* prefixed
  with the seed id, unlike every other one, because the templates request `articles` by that
  exact name. Four articles come with it, one of them a draft, so the site's
  `status = published` filter is exercised rather than assumed.

### Fixed

- **The seeded `title` is a plain string, and `cover` is a `url` field.** Both are the
  field types the templates can actually read. The site requests records without a `locale`
  parameter, and a localized field comes back as its whole `{ id, en }` object in that case,
  which `title: string` would render as `[object Object]`; `cover` goes straight into
  `<img src={cover}>`, where a `media` field would arrive as an `{ id, url, alt }` snapshot
  rather than a string. `check:generated-app` now derives the field list from the templates'
  own `Article` interface instead of a hand-copied one, and asserts both of these, so the
  definition cannot be "improved" into a site that builds and renders nothing.

### Fixed


### Note

`v0.2.5` is tagged but was never published. The seed question and the three flag fixes
landed there, and this release was cut before the OTP publish went through, because the
seed turned out not to feed the generated site at all — which is the whole reason the
question exists. The registry skips 0.2.5.

## [0.2.5] — 2026-09-28

### Added

- **The wizard asks whether to seed example content (question 12).** A new project has an
  empty database, so a new site renders an empty page — which is indistinguishable from a
  broken one. A seed is a self-cleaning Node script that fills the core with a few records,
  and it is now one question instead of a separate `hamolus add seed basic` to remember.
  The default follows the site: yes when there is a site to fill, no when there is not, since
  an empty console is merely empty. `--seed <name>` and `--no-seed` answer it from the
  command line, and the closing hint says to run it *after* `pnpm dev`, because a seed POSTs
  to a core that has to be listening first.

### Fixed

- **`hamolus create <name> --seed basic` no longer throws the flag away.** `seed` was
  missing from the list of options that route a `create` through the wizard, so the command
  took the plain path, wrote a bare core, and exited 0 having dropped the seed. The same
  bug 0.2.3 fixed for `--console --mcp --site`, in a flag added after that fix.
- **`--no-core` was ignored whenever a part flag was also present.** The flag was read only
  by `runCreate`, so `--no-core --seed basic` reached the wizard, found no part flag,
  defaulted to having a core, and built one — the command line said "no core" and got a
  core. The core-flag guard now runs on both paths, before any question is asked, so
  `--no-core --mode bridge --with-console` is an error instead of a workspace whose every
  core setting describes a Worker that is never generated.
- **A seed in a project with no core is refused.** It used to be scaffolded into
  `seeds/basic/` and fail on its first fetch, which is the failure mode the part-level
  `--no-core` guard was written to prevent; it had simply not been listed there.
- **A seed no longer tells you to use `ADMIN_KEY=dev-admin-key-change-me`.** The wizard
  generates a random admin key into `core/.dev.vars`, so the literal was a 401, and the
  error it produced pointed at the core rather than at the instruction. The seed script, its
  README, the per-part hint and the wizard's closing hint all read the real key now.

## [0.2.4] — 2026-09-28

### Added

- **Part flags come in two spellings: `--console` and `--with-console`.** The bare
  flag is `hamolus add <part>` applied to a new project, so it makes *only* that part and
  no core. `--with-<part>` is the whole project — a core, its mode, its land and colony,
  `core/.dev.vars` and a `deploy` script. Before this, `--console` meant "core and
  console", which left no way to scaffold a part that belongs to a core somebody else runs:
  a second checkout, a shared staging core, or a console for a client's core. Same for
  `--mcp`, `--site` and `--panel`.
- **A project can be created with no core at all.** `--no-core` runs the wizard without
  the five core questions, so the project has no `core/`, no `mode`, no land or colony, no
  `.dev.vars` and no `deploy` script, and its `pnpm-workspace.yaml` does not list a `core`
  glob. `Project['mode']` became optional to match, and `hamolus list` labels such a
  project `(no core)` rather than pretending otherwise.
- **Core-less parts find their core at runtime instead of at build time.** The console
  asks for the endpoint in its navbar, an MCP server reads `CORE_API_URL`, a site reads
  `PUBLIC_HAMOLUS_ORIGIN` (`HAMOLUS_API_ORIGIN` on Next.js), and a panel is loaded by a
  console that already knows. So one build works against a preview, staging or production
  core with no rebuild, which is the whole reason not to bake the address in.
- **`hamolus add panel` warns when the project has no console.** A panel is a page inside
  the console, so it builds, serves, and is never loaded. It is a warning and not a
  refusal, because "generate the panel app, add the console next" is a legitimate order.

### Changed

- **Mixing a bare part flag with a `--with-` one is refused**, with a message naming both
  flags, rather than accepted and silently resolved one way.
- `hamolus init --help` and the root README document both spellings, and say that
  questions 2 to 6 are skipped when there is no core.

### Fixed

- **`--console` was briefly read as `--with-console`.** The flag lookup capitalised the
  first letter unconditionally, so with an empty prefix it asked for a `Console` key that
  does not exist, read nothing, and fell through to "no flags given" — the default, which
  is a core. Every bare flag was therefore a `--with-` flag, and the two bugs in that one
  function were invisible to `tsc` because the key lookup is cast. Both spellings are now
  generated separately in `check:generated-app`, because a gate that tested only one of
  them would have passed this.

## [0.2.3] — 2026-09-28

- **`hamolus create <name> --console --mcp --site` no longer throws the flags away.**
  The three optional parts are the wizard's questions, and `runCreate` never implemented
  them — so the command accepted them, wrote a core, suggested `hamolus add console` as
  the next step, and exited 0. The flags are documented, so a script passing them got a
  project missing three parts and a success code. A named `create` that describes more
  than a core now goes through the same wizard `init` uses.
- **The first optional part is no longer aimed at the project root.** `--output` names
  the root of the project `create` writes, but the wizard passed it to the `add`
  commands too, where it means "put this part at this path". The console was aimed at
  the root, on top of the core, and stopped by a guard with a technically true and
  completely misleading message: `already exists and is not recorded in hamolus.json`.
- **A second `hamolus add site` names the site that owns the directory.** It used to
  report the directory as unrecorded, which is false — it is recorded, under the other
  id — and sent the reader looking for a missing entry instead of at the site they had.
- **Two parts of one project no longer fight over the same port.** The core and the MCP
  server both defaulted to 8787, so `pnpm dev` could only ever start one of them. The MCP
  server takes 8788, and both wranglers pass `--inspector-port 0` so two instances can
  start at the same moment without racing for a fixed inspector port.

### Changed

- **`pnpm dev` starts every part.** The root script is derived from `hamolus.json` and
  refreshed whenever a part is added, so a project no longer needs a terminal per part
  to get going:

  ```sh
  pnpm --parallel --filter ./core --filter ./console --filter ./mcp --filter ./site dev
  ```

  Panels are deliberately absent: a panel is a console page with its own dev server and
  no standalone process, and its own `pnpm -F <scope>/panel-<name> dev` stays the way to
  run one.
- **A site is always at `site/`.** It was `sites/<name>/`, which made the path depend on
  the name, the directory a poor name for the one public site a project has, and
  `pnpm dev` unable to refer to it. The site id is still derived from the project name
  and still drives the package name and the `.env` variables; only the directory is
  fixed. A project holds one site, and asking for a second is refused by name.

## [0.2.2] — 2026-09-28

Two halves of one complaint: starting a project asked for ten answers that had to
be found somewhere, and getting a collection definition wrong said nothing about
what was wrong with it. A wizard asks the questions; a schema states the answer.

### Added

- **`npm create hamolus@latest`** — a new package, `create-hamolus`, answering the ten
  questions that used to have to be answered by hand. It is the initializer npm looks
  for by name, and it is a front door rather than a second door: it picks a command and
  hands everything to `@hamolus/cli`, so `npm create hamolus@latest` and
  `npx hamolus init` cannot drift apart.
- **`hamolus init [name]`** — the same wizard, reachable from an installed CLI. It asks
  for a project name, a core name, a core mode, predefined collections, a JWT secret, an
  admin key, whether to expose the dev servers on the LAN, and whether to add a console,
  an MCP server and a site. Every question has a flag, and a question whose flag is
  present is not asked. With no terminal, or with `--yes`, nothing is asked and the
  defaults are used — and the run says so, so a `--yes` in CI is never mistaken for a
  question that went unanswered. A bare `hamolus create` opens it too, since a name is
  the one thing it cannot invent.
- **`hamolus add site <name>`** — a public site that reads the core over REST, with two
  templates: `astro` (static, fetched at build time) and `nextjs` (App Router, cached
  with `revalidateTag`). Neither depends on a `@hamolus/*` runtime — a public bundle
  carries no admin SDK. A site is registered as a workspace glob, so
  `pnpm -F ./sites/<name> dev` works like every other part.
- **Local secrets in `core/.dev.vars`** — `--jwt` and `--key` write a working
  `JWT_SECRET` and `ADMIN_KEY`, and `hamolus init` generates both when you leave them
  blank. Passing either one completes the pair; passing neither writes no file at all.
  The file is git-ignored; a deploy wants `wrangler secret put`.
- **`--core-name <name>`** — the core's package and Worker name, separate from the
  project's. Previously both came from the directory name.
- **`--host <address>`** — the address the generated dev servers bind to, written into
  each part's `dev` script rather than left implicit: `wrangler dev --ip`,
  `vite --host`, `astro dev --host`, `next dev --hostname`. One flag covers the core, the
  console, the MCP server and a site, so a project is reachable over the LAN as a whole
  or not at all.
- **`--land <name>` and `--colony <name>`** on `hamolus create`, so a multi-tenant core
  is created pointed at its own land and colony instead of `default`.
- **`--console`, `--mcp` and `--site <framework>`** on `hamolus create`, for the parts a
  project usually wants at the same time as its core.
- **`hamolus://spec/collection-definition`** — a new resource carrying the JSON
  Schema a collection definition must satisfy: every key, which are required, and
  all 19 field types. Read it before `put_collection` instead of guessing a field
  type. It is rendered from `@hamolus/types` at request time, not written out, so
  a field type added there reaches this document in the same deploy.

### Fixed

- **A generated project containing a site could not be installed.** The generated
  `pnpm-workspace.yaml` listed `sharp` under `onlyBuiltDependencies` but not under
  `allowBuilds`, and pnpm 11 treats the map as authoritative. Nothing but Astro pulls
  `sharp` in, so the gap stayed invisible until a site existed, and then `pnpm install`
  failed with `ERR_PNPM_IGNORED_BUILDS`. Both settings are now written from one list.
- **`next build` failed with a bare `fetch failed` when the core was unreachable.**
  `generateStaticParams` fetches the article list during the build and its failure was
  left unhandled. It now fails with the same message the Astro template gives, naming
  the cause and the fix. Deliberately a failure and not an empty site: CI is green, the
  blog is empty, and nothing says why.
- **`--template .` was read as a framework named `.`** by `hamolus add site`, and the
  error then named a typo the user did not make.
- **`put_collection` now says which field is wrong.** The tool declared its
  `definition` argument as an opaque record, so any bad shape was caught by the
  core as a blanket `400` and the model received `Invalid option: expected one
  of …` once per offending field with no indication of *which* — two fields
  could be wrong and the caller's only move was to count. The argument is now
  typed with the core's own `collectionDefinitionSchema`, so `tools/list`
  advertises the 19 field types up front and a rejection names its own path
  (`definition.fields.2.type`) before the call leaves the server.

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

[Unreleased]: https://github.com/hamolus-labs/hamolus/compare/v0.2.8...HEAD
[0.2.8]: https://github.com/hamolus-labs/hamolus/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/hamolus-labs/hamolus/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/hamolus-labs/hamolus/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/hamolus-labs/hamolus/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/hamolus-labs/hamolus/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/hamolus-labs/hamolus/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/hamolus-labs/hamolus/compare/v0.2.1...v0.2.2
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
