# Admin console guide (`packages/console`)

SolidJS SPA that manages the core API: collections, records, and KV settings.

## Running

```bash
cd packages/console
CORE_API_URL=http://localhost:8787 pnpm dev --host 0.0.0.0   # → :5173
# or
CORE_API_URL=http://localhost:8787 pnpm build && pnpm preview # production build
```

The dev-server proxies `/api/*` to `CORE_API_URL` (`vite.config.ts`), so the console
never calls the core cross-origin locally when using the default `/api` endpoint.
The API base is **user-settable**: the login form has an **Endpoint name**
(optional) + **Endpoint URL** field, and the navbar has an **API endpoint** button
that switches between saved endpoints (renamable, each stored with a name in
`console-endpoints`, active one in `console-active-endpoint`); switching hard-reloads
the page. Absolute endpoints (e.g. `http://core.example.com/api`) bypass the Vite
proxy and hit the core directly via CORS (enabled on `/api/*`). Production
`apiBase()` defaults to `VITE_API_BASE` (build-time) or `/api`.

When the core runs in a multi-scope mode (`CORE_MODE=centralized`), each saved
endpoint can carry an optional **Colony** (`colony` in the endpoint object, labeled
"Colony — optional" in the login form) set at login or in the navbar add-row. It is
sent as the `x-colony` header on every request to that endpoint (blank = the
land's default colony), and the navbar button shows the active endpoint as
`Name · colony`. Signing in to an already-saved endpoint *merges* the typed
name/colony into the stored entry.

Log in with the `ADMIN_KEY` (default `dev-admin-key-change-me`) — the returned JWT
is stored **per endpoint** (`console-token:{url}`), since each core signs its own
token. Switching to an endpoint without a saved token returns to login with that
endpoint pre-selected.

## Using it as a library (generated projects)

`hamolus add console` does **not** copy this source. It writes an eight-file Vite
shell (no JSX, no `vite-plugin-solid`, no StyleX compiler) that imports the console
as a pre-built module:

```ts
// src/main.ts (generated)
import '@hamolus/console/style.css'
import { mount } from '@hamolus/console'
import { config } from '../console.config'

const instance = mount({ config }) // target defaults to <div id="root">

// Vite HMR: replace the mounted app instead of stacking a second one on the node.
if (import.meta.hot) import.meta.hot.dispose(() => instance.unmount())
```

`mount()` takes `{ target?, config? }` and returns `{ unmount() }`; it renders the whole
app (router, query client, theming) and the generated entry calls `unmount()` on Vite
HMR so a hot update swaps the app instead of stacking two copies of the console's
`<div>`. Mounting twice into the same element returns the existing instance.
`config` mirrors the console's own settings (API base, saved endpoints, theme, …);
`defaultLocale` is only a fallback, because the console asks the core for the real
list via `GET /_meta/localization`.

Consequences for this package:

- `src/lib.tsx` is the public entry (`mount`); `src/main.tsx` is the dev/demo entry
  and may change freely.
- `package.json` ships `dist-lib` (one ESM module + `.d.ts`), an explicit
  `"./style.css"` export, and `build:lib` (`vite.lib.config.ts`) next to the dev
  `build`. `pnpm -F @hamolus/console build:lib` is what a generated project consumes.
- Anything a generated app can reach must be reachable from `mount()`'s types — the
  public surface is the `ConsoleConfig` shape plus `mount`, not the internals.
- `check:generated-app` builds a real generated console against `dist-lib`, so a
  change that only typechecks here (e.g. a style export or a renamed prop) fails
  that gate instead of reaching a generated project.

## Screens

### Dashboard (`/`)

- The brand link and the **Dashboard** nav item land here (the app home).
- Four stat cards from the core's `GET /api/_meta/stats`: **Collections**,
  **Total records**, **Media assets**, **Groups**.
- **Collections** breakdown: every collection with its icon, label, snake_case name,
  group pill, record count and a proportional accent bar (sorted by count, desc).
- **Action history**: a localStorage-backed log (capped at 50, `console-activity`
  event keeps it live) of every write you make in the console — collection /
  record / media create-update-delete and settings updates, each with a
  color-coded type tag (create = green, delete = red, update = accent), a label,
  context detail and a relative timestamp. A 🗑 clears the log.

### Collections (`/collections`)

- Card grid of all registered collections (icon, name, type counts, timestamps flag,
  group). Collections are grouped into sections by their registered `group` (from
  `/_meta/groups`), ordered as the tree; collections without a group fall under
  **Other**.
- **Clicking a collection card opens its records page** (`/collections/{name}`).
  Each card's ✎ button edits the definition and 🗑 deletes it (both stop
  propagation).
- **New collection** (＋) opens the editor as a **full-width bottom sheet** that
  rises from below with a grow + brief-bounce animation and **settles at ~1/3 from
  the top** (subtle 6px top radius, grab-handle, backdrop click / ✕ / Esc to close).
- The editor configures `name`, `label`, `group`, **icon**, timestamps, and the
  fields. The **group** select is fed by the registered group tree from
  `/_meta/groups` — nested groups appear indented (`·`-prefixed); typing a group id
  that isn't registered falls back to a free-text input (unregistered groups still
  render in the sidebar as implicit root groups). Fields can be edited two ways via
  a **JSON / Form** toggle: the raw
  `fields` block as JSON (same shape as `packages/core/docs/api.md`), or an **interactive field
  editor** — one card per field with a type selector, name/label, per-type
  constraints (min/max, lengths, enum values, relation target · kind · onDelete),
  toggle chips (required/unique/indexed/localized/hidden), default, console view,
  form group, and up/down move + remove actions. For `enum`, `relation`, and
  `boolean` fields a **Control** picker lets you choose the record-form input
  widget — `combobox` / `search` / `radio` / `toggle` / `checklist` /
  `multichecklist` (the list is scoped to the current field type; switching the
  type or relation kind strips a control that no longer applies). The **Icon** picker shows a
  live preview (accent tile) next to a swatch grid — blank "no icon" button plus one
  swatch per registered collection icon name.
- Deleting a collection confirms first — it drops the physical table.

### Records (`/collections/{collection}`)

- Collection record pages live under **`/collections/{collection}`** (the old
  top-level `/{collection}` route is gone). The sidebar and navbar shortcuts link
  there; collection names are still validated as `snake_case`.
- A **pin (📌) button** beside **New record** pins this collection — pinned
  collections appear as **shortcuts in the navbar**, left of the language switcher
  (persisted `console-pinned`). The button shows an accent fill while pinned.
- Table shows the page of records (default 20, paginated).
- The pagination row has a **Per page** select: presets 5 / 10 / 20 / 50 / 100 plus
  **Custom…** (numeric input clamped to 1–100, the core's cap). The choice is
  persisted per collection (`console-page-size:{name}`); changing it resets to page 1.
- The **Records** table is a collapsible section (uppercase header + count meta +
  chevron); open/closed state persists per section id (`console-collapse:{id}`).
- Click a row (or ✎) to edit; 🗑 deletes; **New record** (＋) opens the create form as
  a **full-width bottom sheet** that rises from below with a grow + brief-bounce
  animation and **settles at ~1/3 from the top** (subtle 6px top radius, grab-handle,
  backdrop click / ✕ / Esc to close).
- The form renders smart inputs per field type: text/textarea, number, date,
  datetime-local, boolean checkbox, enum dropdown, JSON textarea, and — for
  `relation` fields — a **dropdown populated from the target collection's records**.
- **Form layout is field-driven**: a field's `consoleView` places it in the form —
  `normal` (default, main column), `side` (right-hand column with the actions),
  `header` (top of the form), `footer` (bottom). Fields sharing a `group` name render
  inside a **collapsible section** (chevron header; open/close state persists in
  `console-collapse`); `groupOpen: false` starts the section collapsed. See the seed
  (posts: Publishing group + side relations; products: Inventory/Media groups) for
  examples.

### Columns

- Each table has a **Columns** toolbar button (⤢ icon) opening a checkbox panel.
  Toggle columns on/off per collection; **Reset** restores all. Visibility is
  persisted in `localStorage` (`console-cols`).
- **Sortable columns**: click a column header to sort ascending, click again for
  descending, a third time to clear (back to insert order). The active column shows
  an up/down chevron and is tinted with the accent color. The sort is persisted per
  collection (`console-sort`) and drives the core's `sortBy`/`sortDir` query params,
  so it works server-side across all pages of data.
- **Resizable columns**: drag the thin vertical handle on the right edge of any
  header to resize that column (min 48 px; resize starts measured from the actual
  rendered width). Double-click a handle to reset that column to auto. Column widths
  are persisted per collection (`console-colw`).
- **Row grouping**: the filter bar has a **Group by** select (per collection).
  Choosing a field regroups the current page into collapsible sections — each group
  header shows the value (booleans as Yes/No, relations resolved to their target
  label, localized fields to the active locale) plus a mono record count and a
  chevron; clicking a header collapses/expands its members. Groups are sorted by
  value with an "(empty)" bucket last. The choice is persisted per collection
  (`console-groupby`); `json`, `richtext`, `media` and `hasMany` relation fields
  aren't groupable.
- **Column-header grouping**: when any visible field declares a `group`, the table
  draws a nested header row that merges contiguous columns sharing that `group`
  value into a single spanning label (e.g. all relation columns under
  "Relations").
- Cells are type-aware: booleans show Yes/No chips, enums accent chips, relations
  accent chips with a tooltip of the target collection, numbers/dates monospace.

### Config (`/config`)

Everything land-wide that isn't record data, on one screen (the old standalone
`/settings` page was folded in here — `/settings` no longer exists).

The screen holds **two unrelated stores**, and telling them apart is most of the work.
Nothing on this page converts one into the other:

| | Key/value entries | Settings blob |
| --- | --- | --- |
| Storage | D1 table `_configs` in the core | one KV object, `settings:{land}:{colony}:v1` |
| API | `GET /api/_config`, `GET /api/_config/{key}`, `PUT /api/_config/{key}`, `DELETE /api/_config/{key}` | `GET /api/_meta/settings`, `PUT /api/_meta/settings` |
| Shape | rows: `key`, `value` (any JSON), `land`, `colony`, `description`, `updatedAt` | one free-form JSON object, edited as a whole |
| Permissions | `config.read` to see, `config.write` to change | `settings.read` to see, `settings.write` to change |
| Write semantics | `PUT` **upserts** on `(land, colony, key)`; the key is matched case-insensitively | `PUT` is a **shallow top-level merge** |

**Key/value entries.** A row belongs to a **colony**; there is no `scope` column and
nothing to pick on save. The **filter** above the table narrows the view — All, a land
(all of its colonies), or one colony — and the **New entry** form names the colony a row
is written into. Both are built from the universe registry, so a session without
`lands.read`/`colonies.read` gets no filter at all: the table then lists what the core
already decided it can see, and a new entry lands in the session's own colony without
asking.

How far a session reaches follows the **scope** of its privilege, not the filter: a land
admin sees its whole land and must name a colony to write into one; a colony admin sees
only its own colony, and asking for a sibling is a `403` from the core rather than a
silently narrowed list in the UI. Keys must match `^[a-z][a-z0-9._-]*$` (≤ 100 chars) per
`configEntrySchema` in `@hamolus/types`; the form checks it live rather than waiting for
a 400. A failed load shows the error and a **Retry** instead of an endless "Loading".

**Nothing in the core interprets these rows.** There is no endpoint that turns a row into
a page, and the generated site templates (`hamolus add site`) do not read `_configs` at
all — they call `GET /api/{collection}` and take their title from their own layout props.
The rows are a typed key/value store for your own app, agent or MCP server to read over
the API; the land/colony split is the unit of storage, not a category.

**Settings blob.** The conventional place for `site.name`, `site.tagline`,
`site.navigation` — see [the settings reference](../../core/docs/settings.md) for the
recommended shape. The console loads the blob on mount and edits what came back; an empty
blob gets an **Insert an example** button rather than a prefilled editor, because a
prefilled editor is how an unrelated `PUT` overwrites a real project. Save is disabled
until the text differs from what is stored, and it adopts the **merged** response — a
top-level key deleted in the editor comes back, since the core only adds and overwrites
(there is no endpoint for deleting a single key — only for replacing the whole blob, so
removing a key means rewriting it out-of-band or accepting the merge).
Without `settings.write` the editor renders read-only instead of offering a save the core
would reject. `GET /api/_meta/settings` is anonymous-readable while `PUBLIC_GETS=true`
(`requireRead` only checks a session that exists), so a front end can fetch it without a
token; sending a token that lacks `settings.read` is what turns it into a 403.

- **Change password** panel (below the settings editor): self-service password
  update for the signed-in account via `POST /api/_auth/me/password` — current +
  new + confirmation fields, client-side validation (current required, ≥ 8 chars,
  match check), the current session stays active after the change. Replaced by one
  line of explanation for the legacy admin-key session (`id: 'admin'`, privilege
  `admin`), which has no password to change — that session used to render an empty
  card with no heading in it.

### Seed (`/seed`)

A separate screen in the **Environment** group, not part of `/config` (the route is
gated on `settings.write`, so it is hidden entirely without it):

- **Export** (`scope` = all or one collection; media = rows-only or full R2 bytes)
  downloads a `seed-{land}-{date}.json` snapshot of the active land; **Restore** prompts
  and then POSTs it back to the core — `wipe=true` by default (safe because the core
  validates the whole snapshot before touching anything). Activity is logged (media bytes
  export can take a moment on large libraries — the button stays busy until done).
- CLI equivalents in `packages/core/scripts/`: `dump-seed.mjs [scope] [media]` and
  `apply-seed.mjs <snapshot.json> [wipe]` (default `true`), both reading
  `BASE`/`ADMIN_KEY` env (defaults `http://localhost:8787` /
  `dev-admin-key-change-me`).

### Panels (`/panels`)

The Console panel manager is available to sessions with `panels.read`. It uses the Core
`/api/_panels` collection registry and provides:

- A card list with panel name, icon, id, view count, role count, and description. **Clicking
  a card (or pressing Enter / Space on it) opens that panel's detail page**; the pencil and
  trash actions keep working via `stopPropagation`.
- **New panel** and **Edit panel** actions in a full-width `Sheet`; creating is enabled
  only when at least one collection exists so the initial view can be generated.
- A structured editor for panel metadata, views, view operations, field access, menu
  items, roles, role view access, and member assignments.
- **Form / JSON** mode. JSON mode uses `JsonEditor`; both modes validate the manifest
  with `panelDefinitionSchema` before calling the Core API.
- Unsaved changes are guarded when closing the sheet or navigating away. Mutations
  require `panels.write`; create, update, and delete actions are written to the local
  activity history.
- The sidebar entry is hidden without `panels.read`, while create/edit/delete controls
  are hidden without `panels.write`.

#### Panel detail (`/panels/:id`)

Each panel also has its own page, linked from the manager cards and from the sidebar:

- A header with the panel icon, name, and an `id · views · roles · members` summary, with
  **Pin**, **Edit** and **Delete** actions (the last two need `panels.write`).
- A read-only manifest viewer (`PanelDefinitionView`, styled like the Collection
  definition panel): Properties, then tables for **Views** (kind, path, source collection or
  dashboard metrics, access flags + filter rules, default sort), **Menu**, **Roles**
  (per-view operations plus read/write field projections, default role marked) and
  **Members**.
- **Edit** opens the same `PanelEditor` in a `Sheet`, with the same unsaved-changes guard
  (`useBeforeLeave` + `ConfirmDialog`); **Delete** confirms and returns to `/panels`.
  Mutations invalidate the shared `['panels']` query and are activity-logged.
- An unknown panel id renders a "was not found" state with a link back to the manager.
- The page reads from the `['panels']` cache (list query), not a per-id fetch.

Core panel definitions and asset ACLs remain the source of truth; this screen is the
configuration UI for those manifests.

### Plugins (`/plugins`)

Console plugins are SolidJS pages shipped from separate workspace packages under
`packages/plugins/console/`, listed in the host's `console.config.ts`:

- **Contracts** (`@hamolus/plugin-console-contracts`) — the `ConsolePlugin` interface
  (`id`, `name`, `description`, `icon`, `component`), the props handed to every
  plugin page (`plugin`, `kv`, `permissions`, `tools`), a `KvClient` surface
  (`list` / `get` / `set` / `del`, JSON values), and the shared StyleX theme tokens
  + `ps` styles. The theme file must be named `*.stylex.ts` and be imported
  **by relative `.stylex.ts` specifier** — the StyleX compiler only resolves
  theme imports whose literal specifier ends in `.stylex.ts` (a bare package name
  fails with "Could not resolve the path to the imported file"). It is published as
  raw TypeScript and compiled by each *plugin's* build, never by a host. Type-only
  imports can stay on the package name. `allowImportingTsExtensions` is enabled in the
  console tsconfig (base has `noEmit: true`).
- **Todo list** (`/plugins/todo`) and **Kanban board** (`/plugins/kanban`) —
  self-contained demo plugins. Both persist through core `/api/_plugins` routes to
  the shared SETTINGS KV under the per-land prefix `plugin:{land}:{plugin}:`
  (reads need `settings.read`, writes `settings.write`). Read/write traffic goes
  through `lib/pluginKv.ts`, which reads `apiBase()`/`token()`/`land()` at every
  call so an endpoint/tenant switch keeps working. `get` returns `null` for a
  missing key (404), so a fresh land renders an empty board, not an error.
- New plugins: add a workspace package exporting a `ConsolePlugin` **descriptor**,
  then list it in the host's `console.config.ts`:

  ```ts
  import { defineConsoleConfig } from '@hamolus/types'
  import { todoPlugin } from '@hamolus/plugin-console-todo'

  export const config = defineConsoleConfig({ plugins: [todoPlugin] })
  ```

  `mount({ config })` registers the list before the first render, so the plugin
  appears under `/plugins` AND as a row in the sidebar's built-in **Plugins** group
  with its own icon + a pin button. `hamolus add plugin <name>` does exactly two
  things: declares the plugin package in the console's `package.json` and appends one
  import plus one array element here. Config is the only place, because the console
  ships as a Vite bundle: a registry file inside it is not a file the host owns, and
  the host has nothing to regenerate it from.
- **Plugin packages ship built, and a host needs nothing to consume one.** A plugin's
  `dist/index.js` starts with `import './index.css'`, so the host's bundler picks up the
  plugin's compiled stylesheet on its own — no `import '.../style.css'` in `src/main.ts`,
  no `vite-plugin-solid`, no StyleX compiler in the host's `vite.config.ts`, and no
  plugin folder to create. The compiled rules point at the console's own CSS variables
  (`--bg`, `--surface`, `--text`, …), so overriding those still restyles the plugins.
  `solid-js` and `solid-js/web` stay **external** in both the console and plugin builds:
  a plugin is Solid code running inside this console's render tree, so it must share this
  console's Solid instance. A bundled second copy would put every `createMemo` in a
  plugin outside the console's reactive graph, where it would never be tracked.
  `packages/cli/scripts/check-plugin-config.mjs` pins all of it, including that a
  generated console's `console.config.ts` parses and that `hamolus add plugin` is
  idempotent.
- The registry is a **signal**, not a `const` array: registration happens after module
  evaluation, so the sidebar, `/plugins`, and a pinned shortcut all read it inside
  their own tracking scopes. A frozen array would be fixed before the host config was
  ever read. Ids are sorted, and a duplicate id throws at mount — a shared id would
  also mean a shared `plugin:{land}:{id}:*` prefix, so the symptom would be silently
  interleaved data rather than a visible error.
- **Pinning**: each plugin row's pin toggles the plugin's id in the shared
  `console-pinned` list — a pinned plugin then renders as a **navbar shortcut**
  (icon + name, styled like pinned collections). Unpin from that same row button.
- KV verified E2E live: add item → PUT → reload shows it; add column → `board`
  doc persisted.

### Universe (`/universe`)

The scope-registry screen (gated by `lands.read` / `colonies.read`) for managing
lands, colonies and super admins — the console face of the core's universe
(the same powers it serves under `/api/_meta/universe/lands`,
`/api/_meta/universe/colonies`, `/api/_auth/supers`).

Access is tiered and the UI follows the core: a **universe admin** sees every land
and can create/delete lands and super admins; a **land_admin** sees only the land
it owns plus that land's colonies, and gets **New colony** / colony edit+delete but
**no** land or super-admin controls; a colony admin gets neither. The write gates
are separate permissions — `lands.write` (lands + super admins) and
`colonies.write` (colonies).

- **Lands table** — name, label, its `@<name>` super admin, colony count. **New land**
  opens the create sheet (name + label) and persists a fresh `@<name>` super admin.
- **Colonies table** — name, label, owning **Land** (required; created with a land
  select). **New colony** opens the create sheet (name, label, land select).
- **Super admins table** — `@`-less usernames, each bound to its land. **New super
  admin** creates a **new land + its super admin** in one step.
- **Delete ordering (important)**: the core refuses to delete a **land** while it still
  owns a colony (`400 LAND_IN_USE`) — delete in the **colony → land → super admin**
  order. Rows are removed after each delete (row-gone probes are part of the E2E gate).
- **Delete super admin**: the button title is `Delete {username}` with **no `@`**
  (`Delete final_ui_super`) — the `@` is chip decoration only.
- **Land deletion is a full purge.** `DELETE /api/_meta/universe/lands/{id}` removes the land's
  colonies (blocked if any remain), panels **and their private R2 assets**, media /
  document / attachment rows **plus their R2 bytes**, collection metadata **and every
  physical record table**, the privileges bootstrap table, groups, config rows, auth
  users, the land's settings KV document and its `plugin:{land}:*` KV keys, then
  invalidates the in-memory land/collection/privilege caches. Because land ids are part
  of the physical table name, dropping the tables is what makes deletion final: a
  **re-created land id starts empty** and can never resurrect old records, assets or
  roles. Verified by `land_purge_e2e.mjs` (30 checks) and the Panel security suite
  (45 checks), which assert the R2 objects themselves are gone.

## Sidebar

- **Desktop** (static, 232px) vs **mobile** (≤ 900px): on small screens the sidebar
  becomes an off-canvas **drawer** — a top bar (hamburger + brand) toggles it; a scrim
  closes it, navigation auto-closes it, and the body scrolls lock while it is open.
  The drawer paints an opaque `--surface` background (no content shows through).
  The hidden/visible states use one media-scoped transform rule
  (`sidebarHidden` = `translateX(-100%)`), so the drawer slides in deterministically.
- **Brand** (top-left) navigates home — the **Dashboard** (`/`).
- **Dashboard** and **Collections** links sit at the top of the sidebar (above
  Settings); the collections record links follow below.
- **Settings** link is pinned above the collection list.
- **Plugins** renders as a **built-in collapsible group** (below the tool links,
  above the collection groups) listing **All plugins** (the manager at `/plugins`)
  plus one row per registered plugin (icon + name). Each plugin row has a **pin
  button** on the right — pinned plugins appear as shortcut links in the navbar,
  exactly like pinned collections (stored in the same `console-pinned` list, so a
  pin can be toggled from anywhere). The group's collapsed state persists in
  `console-nav-groups` under the reserved id `app-plugins` (a hyphen, so it can
  never collide with a registered snake_case collection group). See
  [Plugins (`/plugins`)](#plugins-plugins).
- **Built-in collapsible groups** — alongside the collection groups the sidebar
  hosts four reserved groups (all expanded by default, each persisting its
  collapsed state in `console-nav-groups` under a hyphenated id that can never
  collide with a snake_case collection group):
  - **Bucket** (`app-bucket`, count 3) — Media (`/media`), Documents
    (`/documents`), Attachments (`/attachments`).
  - **Plugins** (`app-plugins`, count = registered plugins) — All plugins + one
    row per plugin, each pinnable.
  - **Panels** (`app-panels`, count = panels + 1, hidden without `panels.read`) —
    **All panels** (`/panels`) followed by one row per panel linking to
    `/panels/{id}` with its own icon. Each row has a **pin button** on the right;
    pinned panels appear as navbar shortcut links, in the same `console-pinned`
    list as Collections and Plugins (see
    [Panel detail (`/panels/:id`)](#panel-detail-panelsid)).
  - **Environment** (`app-environment`, permission-gated members) — Universe
    (`/universe`, `lands.read`), Config (`/config`, `config.read`), Users
    (`/users`, `users.read`), Seed (`/seed`, `settings.write`). The group hides
    when no member is permitted.
- Collections are grouped by their registered **group tree** (`/_meta/groups`):
  - ungrouped collections render flat at the top,
  - groups render as **recursive, collapsible sections** (chevron,
    `aria-expanded`) — a group node shows its label + count and, when expanded,
    its **nested child groups** (indented) followed by its direct member links;
    collapsed state persists in `localStorage` (`console-nav-groups`). A
    `collection.group` value that isn't a registered group id renders as an
    **implicit root group** (label = the raw value), so pre-registry data still
    works.
- Each collection link shows its `icon` (SVG glyph from the `COLLECTION_ICONS`
  registry — 14 names: box, file, users, tag, mail, folder, grid, list, code,
  database, star, calendar, zap, heart) ahead of the label; unknown/empty names fall
  back to a folder glyph. Icons are chosen in the collection editor. See
  `packages/core/docs/api.md`.
- Every collection link shows its **record count** (mono, right-aligned, fetched
  from `GET /api/_meta/stats`).
- Group headers follow the same accent language as the section collapsibles: an
  **expanded** header gets the `accentSoft` fill + a hairline `accentBold` ring with
  its label, count and chevron tinted in the accent; a **collapsed** header stays
  quiet and transparent (hover = a subtle `surfaceRaised` fill, no borders or focus
  rings). Active collection items highlight with an accent inset bar.
- **Sidebar modes** (set in the **Sidebar** navbar dropdown — a `PanelLeftIcon`
  button, next to Appearance):
  - **Expand** (default) – the full 232px sidebar described above.
  - **Icons** – a 56px desktop rail (labels, badges and record counts are `display:
    none` via a `min-width: 901px` media query, so the mobile drawer keeps its full
    labels). Icons center in the rail, the brand collapses to a small accent "WS"
    tile, and `title` tooltips carry the label/count. Group headers collapse to a
    centered chevron (toggles the group, tooltip = group name).
  - **Auto-hide** (on/off switch) – desktop only (`min-width: 901px`). When on, the
    sidebar collapses to 0 width (width/padding animate) and a 6px accent **gutter**
    strip sits on the left edge; hovering the gutter (or the sidebar itself) reveals
    it (232px or the 56px icon rail per mode), and leaving it hides it again after
    400ms. Navigation collapses it too. Both mode and auto-hide persist
    (`console-nav-mode`, `console-nav-auto`); the mobile drawer is untouched.

## Navbar (top)

- A **persistent top navbar** (all screen sizes): a hamburger on mobile (brand was
  removed from the navbar — the sidebar brand remains the app's home link), controls
  grouped on the right in `navbarActions`.
- **Pinned collection shortcuts** sit left of the language switcher — one icon+label
  button per pinned collection (see Records). Pinned **plugins** and **panels** are
  rendered in the same shortcut row (collections first, then plugins, then panels);
  an id already claimed by a collection or plugin is skipped. Active shortcut gets an
  accent tint.
- **API endpoint** button (DatabaseIcon + active endpoint's name, with a ` · land`
  suffix when the endpoint has a land set) opens a
  drop-down popover: every saved endpoint (check mark on the active one, per-row
  **pencil** to rename inline + ✕ to remove), plus an add-row with **Name + URL +
  Land** inputs (Enter on any, or ＋, adds and connects). Switching (or adding) an
  endpoint **hard-reloads the page** — the new active endpoint is persisted, record
  caches are cleared, and the app boots against that core (no saved token for it →
  back to login with that endpoint pre-selected).
- **Language switch** (globe + current language code) opens a drop-down popover when
  the project has more than one locale. The list comes from the core's
  `GET /_meta/localization` — so a console never has to mirror the core's locales —
  and the switcher is hidden when the core reports none. `console.config.ts` only
  supplies a `defaultLocale` fallback for that case.
- **Sidebar** dropdown (PanelLeftIcon) sets the sidebar **mode** (Expand / Icons)
  and the **Auto-hide** switch (see Sidebar above).
- **Appearance** dropdown (single trigger, sun/moon by mode) holds four sections:
  - **Mode** – dark/light segmented control (persisted `console-theme`, honors
    `prefers-color-scheme`),
  - **Theme** – swatches for the 16 palettes (Sapphire, Sky, Cyan, Lagoon, Emerald,
    Lime, Amber, Gold, Orange, Coral, Crimson, Rose, Pink, Amethyst, Indigo, Slate).
    A theme repaints the whole app (surfaces, text AND accent), and matches the
    selected mode; both are applied to `<html>` pre-hydration so there's no FOUC,
    and the switch cross-fades.
  - **Font** – selectable UI font (`html[data-font]`): Inter (default), System UI,
    Geist, IBM Plex, Roboto. Fonts are loaded from Google Fonts (graceful
    fallback to the system stack when offline) and repaint `--font-sans`
    everywhere (body, pages, editors).
  - **Container** – `Layout width` row toggle: `Boxed` (max-width 1216, centered) vs
    `Full` width.
- **Logout** (danger-styled icon).

## UI preferences stored in `localStorage`

| Key                    | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `console-endpoints`    | JSON array of saved core API endpoints `[{url, label, colony?}]` (login + navbar switcher; `colony` = `x-colony`, optional) |
| `console-active-endpoint` | URL of the active endpoint (navbar shows its label) |
| `console-token:{url}`  | JWT for a specific core endpoint (each core signs its own JWT); the old flat `console_token` key is migrated onto the default endpoint on first load |
| `console-theme`        | JSON theme object: `{ mode: "dark"\|"light", palette: "blue"\|"azure"\|"cyan"\|"teal"\|"green"\|"lime"\|"amber"\|"gold"\|"orange"\|"coral"\|"crimson"\|"rose"\|"pink"\|"violet"\|"indigo"\|"slate", font: "system"\|"inter"\|"geist"\|"plex"\|"roboto" }` (legacy `{mode, accent}`, preset ids and plain `"dark"`/`"light"` strings are migrated) |
| `console-container`    | `on` (boxed) / `off` (full width)        |
| `console-nav-mode`     | `full` \| `icons` — sidebar mode (icon-only rail) |
| `console-nav-auto`     | `on` \| `off` — sidebar auto-hide (desktop, hover the left edge to reveal) |
| `console-pinned`       | JSON array of pinned collection names (navbar shortcuts) |
| `console-nav-groups`   | JSON array of collapsed group names      |
| `console-cols`         | JSON map of `{ collection → visible cols }` |
| `console-sort`         | JSON map of `{ collection → { by, dir } }` (active table sort; `by: null` clears) |
| `console-colw`         | JSON map of `{ collection → { field → width px } }` (resized column widths) |
| `console-groupby`      | JSON map of `{ collection → field \| null }` (active row grouping) |
| `console-collapse`     | JSON map of `{ section-id → open/closed }` (table/form + field groups) |
| `console-page-size`    | JSON map of `{ collection → page size }` |
| `console-locale`       | active language code (e.g. `en`)         |
| `console-activity`     | JSON array (max 50) of the dashboard's action history |

## Record editor & detail

Selecting a row (or "New record") opens the editor in a **full-width bottom sheet**
that rises from below with a grow + brief-bounce animation and **anchors 120px below
the top** (scrollable body, actions column on the right); the offset is themeable via
the `--sheet-top` custom property (`index.css`, default `120px`), laid out as two
columns:

- **left** — the record form (fields driven by the collection definition); `slug`
  inputs auto-normalize to lowercase letters/digits/dashes; relation fields are a
  dropdown of the target records' labels with a status line (loading / target
  collection not registered / no records yet) plus a **＋** button on the right
  that opens a **create popup** for the target collection (a nested bottom sheet
  reusing the record editor) — creating there auto-selects the new record
  (belongsTo/hasOne) or appends it to the array (hasMany), `json`/`text` fields
  are textareas,
  `date`/`datetime` use native pickers, `boolean` is a checkbox, `media` fields
  show a thumbnail preview with **Choose / Replace / Remove** buttons that open the
  media-picker overlay (searchable, paginated grid), and `currency` /
  `custom_currency` fields are a number input (locale-aware readout) storing the
  raw amount. `media` previews apply
  the snapshot's **focus point** (`object-position`) when one was recorded, and
  table media cells do the same.
- **Per-field input widgets** (via the field's `control`, see `packages/core/docs/api.md`):
  `search` renders a **searchable combo** (tag-input style — type to filter the
  dropdown, clear / keyboard-friendly) — ideal for relations with many options;
  `radio` an inline radio group; `toggle` a switch (boolean); `checklist`
  single-select rows with a **Selected:** readout; `multichecklist` checkbox rows
  (value = array of chosen options, stored as JSON for enum fields or target PKs
  for `hasMany` relations). Any of these can back an `enum` or `relation` field;
  boolean gets `toggle`/`radio`. `multichecklist` enum/relation values display in
  the table as multiple accent chips.
- **Localized fields** (`localized: true`): the input shows a language tab strip and
  only the **active language's value**; switching the global locale switcher in the
  navbar (or clicking a tab) re-renders the input and the rich-text editor in that
  language. The edit flow reloads the record **without** `?locale=` so the sheet
  always edits full localized objects (never the resolved string), while the table
  keeps showing the active language's value.
- **right** — an action sidebar (PayloadCMS-style): Create/Save (which submits the
  left form via `form="record-form"`), Cancel, and — for existing records —
  Delete record, plus a **Details** list (primary key, created/updated).

**Rich-text editor** (`richtext` fields, vanilla Lexical): the toolbar offers
bold/italic/underline/strikethrough, H1–H3 headings, bullet/numbered lists, links,
and an **Insert image from media** button — it opens the media-picker overlay, and
picking an asset embeds it as a click-free, non-inline `<img>` node in the document.
Embedded images persist in the Lexical JSON and are kept intact by the editor's
`setDOMUnmanaged` DOM handling.

**Markdown/MDX richtext** (`richtext` fields with `format: "markdown"` or
`"mdx"`): the form renders a plain **Write / Preview** editor
(`components/MarkdownEditor.tsx`) — a textarea plus a live rendered preview tab
(shared `markdownToHtml`, output escaped, safe links). Localized markdown fields
show the same per-language tab strip with the markdown editor in each tab. Table
cells display a markdown **plain-text** excerpt instead of raw source. The
collection editor's interactive field UI includes a **Rich-text format** select
(shown only for `richtext` fields; switching the type strips a stale `format`) and
the definition panel flags `format` as a chip on the field row.

## Media manager (`/media`)

A dedicated page for image assets stored in Cloudflare R2 (`packages/console/src/pages/Media.tsx`):

- **Views** — a segmented toggle (persisted in `console-media-view`) switches between
  **Gallery** (responsive `auto-fill minmax(160px, 1fr)` 1:1 `object-fit: cover`
  thumbnails) and **Dataset** (a full-width table: preview, name + SEO title, type,
  dimensions, size, group, category, tags, focus, actions; wraps in horizontal scroll
  on narrow screens). Thumbnails honor each asset's **focus point** via
  `object-position: {focusX}% {focusY}%` where set, so crops keep the focal area.
  Where a thumbnail exists, views render the lightweight `thumbUrl` (falling back to
  the full `url`).
- **Fullscreen viewer** (`MediaViewer.tsx`) — clicking a **Gallery** card thumbnail
  opens a full-screen lightbox (dark blurred scrim, `z-index 55`) instead of a
  navigation to the endpoint URL. The header shows the asset name + caption on the
  left and, on the right before the **Close** button, three action buttons:
  **Edit** (opens the `MediaEditor` overlay on top), **Copy** (copies the URL of the
  currently viewed asset — default or selected variant) and **Link** (opens that
  URL in a new tab). Below the image, a **variant chip row** lists **Default** plus
  each crop **variant** label (e.g. `2:1`, `1:1`) whenever the record has variants;
  clicking a chip swaps the previewed image and its focus (`object-position`). Esc,
  the backdrop, or **Close** dismisses it.
- **Card actions** — each gallery/dataset card's button row holds **Edit**,
  **Copy URL**, **Open link** (the endpoint URL of the asset, opened in a new tab —
  the same "link" the viewer exposes) and **Delete**.
- **Upload modal** (`UploadModal.tsx`) — the **Upload** button now opens a modal
  instead of a bare file picker:
  - **Drag & drop** zone (click also browses; `image/*`, multiple; more can be added
    while the modal is open), with a per-image card for every file.
  - Per-file **Name, Group, Category, Tags** (chip input with suggestions), **SEO
    title / Alt text / Description**, a **Caption** input (shown by the HTML media
    viewer on the core), and a **clickable thumbnail** — clicking it opens a
    **crop/resize dialog** (`ResizeDialog.tsx`): a live preview with the image
    windowed by an aspect **ratio** preset (`Original, 2:1, 1:1, 4:3, 3:2, 16:9,
    3:4, 2:3, 9:16`, plus **Free** and Custom), an **output size** preset
    (`Original, 320, 640, 1024, 1280, 1600` px on the max edge, never upscales),
    a live `In / Out / Focus` readout, and **variant chips**. The dialog builds
    **multiple crops per image** — each **variant carries its own focus point**
    (drag the crosshair **inside the crop preview**; each new variant defaults to
    the source's focus remapped into its frame) plus its own ratio/size,
    drag-to-move + corner-resize (aspect-locked unless **Free**), removable.
    The **first output** (the original/full crop) is uploaded as the record's
    **default asset**, and every added variant ships as a **crop variant of the
    same record** (separate R2 objects, exposure via `variants`) — one upload in
    the media library, multiple ratios. **Focus is decoupled from the crop**: a
    separate **Focus** button opens `FocusDialog.tsx` (a crosshair picker,
    independent of crop, default 50/50) which sets the **source** focus remapped
    into each variant's frame on upload. Output badges show every output
    (e.g. `2:1 · 614×307`). The file card also shows a remove button.
  - **WebP + thumbnail**: every output is converted to **WebP** (`lib/image.ts`
    `toWebp`, q0.92) and given a small **thumbnail** (`makeThumb`, max 320px, q0.8)
    which is uploaded alongside as the `thumb` multipart field; the core stores it
    under `<id>.thumb.<ext>` and surfaces `thumbUrl` on `MediaObject`.
  - **Upload N images** runs files sequentially (each POSTs one multipart body
    with its metadata + focus + thumbnail + any uploaded `variant` files and the
    `variantMeta` JSON — one upload per source file, not per output), logs to
    activity, invalidates the media/taxonomy/stats caches, removes the card on
    success, and closes the modal when everything is done.
- **Edit dialog** (`MediaEditor.tsx`, modal overlay) — rename the file, set SEO
  fields (title, alt text, **caption**, description), set **taxonomy** (group /
  category inputs with autocomplete from existing values, a freeform **tag** chip
  input with suggestions), optionally **resize to a target width** (px), and
  adjust the **focus point** with a draggable picker (plus "Reset to center").
  The preview respects the focus point (`object-position`). Resizing runs
  client-side (downscale only, keeps aspect ratio, preserves the existing R2
  key/URL), re-encodes to **WebP**, and replaces **both** the main file and its
  thumbnail in one step.
  If the image is already narrower than the requested width, resize is skipped.
  Crop variants are immutable upload-time data — the editor shows their count in
  the metadata line but cannot re-edit them.
- **Manage taxonomy** — a dedicated panel (`TaxonomyPanel.tsx`) listing **Groups,
  Categories and Tags** with per-value asset counts; each value can be **renamed**
  (inline input, applies across every asset via `POST /api/_media/taxonomy`) or
  **deleted** (removed from every asset, not just unlinked). Renames/deletes
  invalidate the media + taxonomy caches and are logged to action history.
- **Search + filters** — `?search=` LIKE filter on name/mime/title, plus **Group /
  Category / Tag** dropdowns (distinct values fetched from `/api/_media/taxonomy`);
  any filter change resets to page 1. Taxonomy chips render on each card.
- **Pagination** — reads `meta.total / totalPages` from the core; prev/next chevrons.
- Media list is cached under the `['media', page, search, group, category, tag]`
  tanstack query key; uploads/deletes/edits/taxonomy changes invalidate it (and the
  taxonomy + stats queries). The media manager is the canonical source of image URLs
  for records — copy the URL and paste into a `url`-type field.
- **Stored media URLs render against the active endpoint**: `media` field snapshots
  and rich-text images store *absolute* URLs baked at write time, so data seeded
  against one host (e.g. loopback) would render broken if the console is signed into
  a different endpoint. `lib/media.ts::resolveMediaUrl` rewrites `/media/` URLs held
  on loopback hosts (localhost/127.0.0.1/::1/0.0.0.0) to the active endpoint origin
  at every render (table cells, media-field previews, rich-text images). Display-only —
  serialized values are never rewritten; only the media **API** `url` fields derive
  from the request origin (7.38).

## Documents & attachments (`/documents`, `/attachments`)

A **file library** for non-image assets, mirroring the media manager. Two adjoining
pages wrap the same `FileLibrary` component with `kind="document"` /
`kind="attachment"` (`pages/Documents.tsx`, `pages/AttachmentsPage.tsx`), served by
the core's `/api/_documents` and `/api/_attachments` endpoints (R2 keys live under
`doc/…` and `att/…`; see `packages/core/docs/api.md` → Files).

- **Page shell** — search input, **Group** / **Category** / **Tag** filter selects
  fed by the `['files-taxonomy', kind]` query, a paginated **dataset-style table**
  (name + type chip, size via `formatBytes`, extension badge, group/category/tags,
  updated date) and per-row actions: **Upload**, **Edit**, **Pick ref**, **Copy URL**,
  **Delete**. Mutations invalidate the files list + taxonomy + stats queries and are
  activity-logged (`document.upload` / `document.update` / `document.delete`, and
  the `attachment.*` twins).
- **Upload modal** (`FileUploadModal.tsx`) — multi-file drop zone (drag & drop +
  click-to-browse, `*/*`), per-card **name** (editable), **Group** / **Category**
  (datalist) and **Tags** (TagInput), sequential upload with inline per-file errors,
  auto-close when everything succeeds.
- **Edit sheet** (`FileEditor.tsx`) — rename + group/category/tags, using taxonomy
  autocomplete.
- **Pick ref** (`FilePicker.tsx`) — a searchable pick grid that returns a
  `FileRefValue` (`{id, url, name}`); used to fill a `document`/`attachment` field
  on a record.
- **Field types** — `document` and `attachment` are full field types
  (`src/components/FileFieldInput.tsx`): the record form renders a tile showing the
  picked file's name/size/ext with **Choose / Replace / Remove** controls; the value
  stored on the record is the `FileRefValue` snapshot. Table cells render a file chip
  (file icon + name + size), localized via the standard localized-field mechanism.
- Files are **not image-restricted** — any MIME type is accepted, and public
  URLs (`/documents/{key}`, `/attachments/{key}`) stream with immutable caching.

## Design system

Styling lives in `src/theme.stylex.ts` + `src/index.css`:

- tokens are StyleX vars that reference CSS custom properties defined in
  `index.css`; the whole look is driven by `html[data-mode]` (dark/light),
  `html[data-theme]` (one of 16 palette ids) and `html[data-font]` (UI font — see the
  Appearance dropdown). Each palette paints a hue-tinted
  full color story (surfaces, text, accent) for both modes, so any theme is
  comfortable in light and dark; there is no StyleX `lightTheme` object anymore —
  `index.html` sets both attributes (plus `data-font`) before hydration, and the
  surface colors are
  registered via `@property` so theme/mode switches cross-fade smoothly. Tints on
  the accent use `accentSoft` (accent ≈16% dark / 13% light) with a stronger
  `accentBold` (`color-mix(…accent 26%, transparent)`) for pills, chip wells and
  data bars. **Text is accent-tinted too**: `--text`/`--text-dim` are computed once
  in the dark and light base blocks as `color-mix(in srgb, var(--accent) X%, …)` —
  roughly 20% (dark) / 32% (light) for text and 14% / 16% for dim — so there is
  never a pure black or white font (e.g. light/amber reads as warm brown ink,
  dark/amber as warm cream). `--sheet-top` (default `120px`) tunes the bottom-sheet
  offset; body, pages and editors all use `--font-sans`.
- shared button classes: `s.btn`, `s.btnGhost`, `s.btnDanger`, `s.btnIcon`,
  `s.btnIconSm`, `s.btnIconDanger` (all with `:focus-visible` rings) — reuse these
  instead of per-file button styles. The system is deliberately quiet: interactive
  controls (buttons, the table Columns toolbar button, the palette segmented
  control, theme swatches) carry **no visible borders** and hover is a dynamic touch —
  a gentle lift (`translateY(-1px)`, springy easing), a soft shadow and a fill that
  responds **with the theme's accent hue**. Text buttons `s.btn` carry the
  **theme-blended accent background** (`accentFill` = `color-mix(accent 48%, surface)`)
  with accent-colored text + a subtle shadow; **icon buttons (`s.btnIcon*`) are ghost**
  — transparent background, a very thin **1px hairline border** (`borderStrong`
  longhand), a `textDim` icon that tints accent/danger on hover. `s.btnGhost` (and
  active segmented toggles `segActive`) swap their neutral surface fill for `accent`
  text on `accentSoft`, so every control picks up the palette's color on interaction.
  Danger actions stay the
  semantic `--danger`/`--danger-soft` red. Cards/popovers separate via spacing, fills
  and shadows (see the border gotcha below), and the sidebar uses spacing instead of
  nav divider rules.
- **StyleX border gotcha**: StyleX 0.19.1 emits **no** CSS for the `border` shorthand
  (`border: 'none'` or `border: 1px solid …` both compile to nothing), so a bare
  `<button>` still draws the browser's UA `2px outset` border. Every button-ish style
  therefore pins the longhand `borderStyle: 'none'` (see `s.btn*`, `menuBtn`,
  `segBtn`, `swatch`, `groupHeader`, `columnsBtn`, `resetBtn`). Since the same issue
  affects `1px solid` surface borders (popovers, inputs, badges, `borderBottom`/
  `borderRight` dividers), the app is currently effectively borderless — surfaces
  are separated by spacing, fills and shadows. If hairline definition is wanted back,
  write border longhands (`borderStyle`/`borderWidth`/`borderColor`) or use
  `outline`-style equivalents instead of the shorthand.
- `JsonEditor` (collection fields + settings JSON) renders syntax-highlighted JSON:
  overlay `<pre>` tokenizer (keys/strings/numbers/bools/punctuation), Tab inserts
  two spaces, live Valid/Invalid status. Colors via `--json-num`/`--json-kw`.
- relation tables chips show the target record's human label; added via the
  `useRelationContext` / `useRelationLabelMaps` hooks in `src/lib/relations.ts`
  (target rows are prefetched at `pageSize: 100` — the core's maximum).
- radius is intentionally "extra small" (`4px` / `2px`) with soft shadows and quiet
  surface fills for a crisp, refined look.
- layouts are responsive below `900px`: page padding shrinks to 16px, the record-editor
  action sidebar goes full width, and record tables scroll horizontally (`min-width: 680`
  inside an `overflow-x: auto` wrapper) instead of crushing columns.
- `s.page` animates content entrance (`fadeUp`); StyleX requires `animationName`
  keyframes defined **in the same module** (the compiler can't resolve a keyframes
  object imported from another file).