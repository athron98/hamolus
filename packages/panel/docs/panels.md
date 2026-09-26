# Panels

A **Panel** is a declarative, per-land app surface defined as data instead of
code. A manifest describes views bound to collections — with their own
operations, field ACLs, filters, sort and metrics — plus a menu, roles and
members. The Core enforces the manifest; the browser just renders whatever
`GET /api/_panels/{id}/bootstrap` returns for the signed-in user.

Panels are the multi-tenant, least-privilege way to ship an internal tool: a
`panel_user` role is seeded with **no** global permissions, so a Panel user can
only ever see the views and fields a manifest grants them.

## Where the pieces live

| Piece | Location |
| ----- | -------- |
| Manifest schema | `packages/types/src/panel.ts` (`panelDefinitionSchema`) |
| Manifest store | `packages/core/src/meta/panels.ts` (`_meta_panels`) |
| Core routes | `packages/core/src/routes/panels.ts` (mounted at `/api/_panels`) |
| Private assets | `packages/core/src/media/panel-assets.ts` (`_meta_panel_assets` + R2) |
| Browser client | `packages/panel` (`@hamolus/panel` — `PanelClient`) |
| App scaffolder | `packages/cli` (`hamolus add panel <name>`) |
| Manifest editor | `packages/console/src/components/PanelEditor.tsx`, page `/panels` |

## The manifest

```jsonc
{
  "id": "ops",                       // snake_case, stable
  "name": "Operations",
  "theme": { "mode": "dark", "palette": "blue" },
  "views": [
    {
      "kind": "table",                // table | dashboard | form
      "id": "tickets",
      "label": "Tickets",
      "path": "/tickets",
      "collection": "tickets",
      "operations": ["read", "create", "update"],   // no "delete" here
      "searchable": true,
      "pageSize": 25,
      "fields": { "read": ["id", "title", "assignee_id"], "write": ["title"] },
      "filters": [{ "field": "status", "op": "eq", "value": "open" }],
      "defaultSort": { "field": "updated_at", "direction": "desc" }
    }
  ],
  "menu": [{ "id": "tickets", "label": "Tickets", "path": "/tickets", "viewId": "tickets" }],
  "roles": [
    {
      "id": "agent",
      "label": "Agent",
      "views": [
        { "viewId": "tickets", "operations": ["read", "create"],
          "readFields": ["id", "title"], "writeFields": ["title"] }
      ]
    }
  ],
  "members": [{ "userId": "u_1", "roleId": "agent", "attributes": { "team": "support" } }],
  "defaultRoleId": "agent"
}
```

Two permission models meet here:

- **Manifest routes** (`GET/POST/PUT/PATCH/DELETE /api/_panels…`) use the global
  `panels.read` / `panels.write` permissions — held by the seeded `admin` and
  `manager` roles. These are for *defining* Panels.
- **Runtime routes** (`bootstrap`, view records/relations/dashboard/assets)
  require only a valid session. Access comes from the manifest: the caller's
  Panel role, their member `attributes`, and each view's operations/field ACLs.

`bootstrap` returns the manifest **re-filtered to that user** — unauthorized
views are dropped, `menu` is pruned to the views you may see, `fields` are
replaced with the effective ACLs, and a single effective `role` is returned. A
client should treat the bootstrap payload as the source of truth, not the
original manifest.

A filter has `{ field, op, value }`, or — to scope rows by who is asking —
`{ field, op, source: "member.attributes.<name>" }`. A rule may not set both
`value` and `source`, nor neither. Operators are `eq`, `neq`, `gt`, `gte`, `lt`,
`lte`, `like`, `in`, `contains`. A missing attribute is
`400 PANEL_ATTRIBUTE_MISSING` and a malformed rule is `400 PANEL_FILTER_MISMATCH`.
`search` on a view with `searchable: false` is `403 PANEL_SEARCH_FORBIDDEN`.
See [docs/api.md](../../core/docs/api.md#panels-_panels) for the full route and error-code
reference.

## Creating and editing Panels

In the console, `/panels` lists manifests as cards and opens a full-width sheet
to edit them. The editor has two modes that stay in sync:

- **Form** — structured controls for panel metadata, theme, and every view,
  operation, field ACL, metric, menu item, role, role-view access, and member.
  Related references are rewritten as you edit (renaming a view id updates the
  menu and role access; renaming a role id updates members and
  `defaultRoleId`).
- **JSON** — the raw `PanelDefinition`, for copy/paste and diffing.

Both modes validate through `panelDefinitionSchema` before saving, and the
sheet warns before discarding unsaved changes or navigating away. Writing needs
`panels.write`; the page itself needs `panels.read`.

### Panel detail pages

Each manifest also has its own console page at **`/panels/:id`**, reachable from the
manager cards, from the sidebar **Panels** group, and from a pinned navbar shortcut.

- The header shows the panel icon, name and an `id · views · roles · members` summary,
  with **Pin**, **Edit** and **Delete** actions.
- `PanelDefinitionView` renders the manifest read-only — Properties, then **Views**
  (kind, path, source collection or dashboard metrics, access flags + filter rules,
  default sort), **Menu**, **Roles** (per-view operations plus read/write field
  projections, default role marked) and **Members**.
- **Edit** reuses the same `PanelEditor` sheet (with the same unsaved-changes guard) and
  **Delete** confirms, purges the manifest and returns to `/panels`. An unknown id
  renders a not-found state.

The page reads from the shared `['panels']` query cache, so it does not issue a
per-id request; edit and delete invalidate that cache.

## Scaffolding a Panel app

`packages/cli` generates a runnable SolidJS + Vite app wired to
`@hamolus/panel`:

```bash
pnpm panel:new create my_panel            # → packages/panels/my_panel (default)
pnpm panel:new create my_panel ./my-panel # explicit output directory
cd packages/panels/my_panel && pnpm install
```

The panel **name** is the snake_case id (`my_panel`); the display name is derived from
it (`My Panel`) and the generated package is named `@hamolus/panel-my_panel`.

Generate the app **inside the repository** (the default output is). The template
depends on `@hamolus/panel` via `workspace:*`, so `pnpm install` in a directory outside
the workspace cannot resolve it — the CLI prints a note when the output path is
outside the repo.

Configure it with Vite env vars (see `template/README.md`):

| Variable | Purpose |
| -------- | ------- |
| `VITE_PANEL_API_URL` | Core API base, e.g. `http://localhost:8787/api` |
| `VITE_PANEL_API_TOKEN` | Bearer token for the session |
| `VITE_PANEL_LAND` | Optional land, sent as `x-land` |
| `VITE_PANEL_COLONY` | Optional colony, sent as `x-colony` |
| `VITE_PANEL_DEFAULT_VIEW` | View to open first |
| `VITE_PANEL_LOCALE` | Locale for localized fields |

`VITE_PANEL_API_TOKEN` is a **browser-visible** credential. Mint one for a real
`panel_user` rather than reusing an admin token — a Panel user's permissions are
already scoped by the manifest, and an admin token would bypass the scoping you
configured.

The template is typechecked as part of the repo:

```bash
pnpm -F @hamolus/cli typecheck
```

`packages/cli/tsconfig.json` checks `template/src` and
`template/vite.config.ts` against the template's own compiler options plus the
real `@hamolus/panel` types, so template drift fails the workspace typecheck.

## Runtime access control

Panel routes authenticate the session, then apply the **manifest** as the ACL — the
global `panels.*` permissions only govern the configuration API, never the runtime.
A `panel_user` needs no global permission at all.

- **Views** filter listing by the view's `filters`; a record that does not match is
  invisible, and a value the member can supply themselves is never used to widen
  access (`op: 'member'` reads the attribute from the session).
- **Fields** are projected through `read` — only granted fields come back.
- **Records** outside the filters are refused for direct read, update and delete
  (`403 RECORD_FORBIDDEN`).
- **Scoped update**: an update re-evaluates the view's filters against the *incoming*
  values, so a record cannot be patched out of the caller's scope ("drifting" is
  refused) even though its id was readable.
- **Writes** additionally require the field in `write`; the CLI validates this at
  manifest-save time, so a `create`-capable role must list every required field.

A live regression suite covers all of the above (13 checks, self-cleaning):

```bash
BASE=http://127.0.0.1:8787 ADMIN_KEY=dev-admin-key-change-me \
  pnpm -F @hamolus/core check:panel-acl
```

It derives its fixtures from a live collection, creates an in-scope control record, an
out-of-scope record and a `panel_user`, then asserts listing, field allowlisting, the
four refusal paths, filter drift, and that a refused write leaves the stored record
untouched.

## Sample panels and demo users

`seed-panels.mjs` creates four sample manifests (`shop_ops`, `inbox_desk`,
`events_desk`, `showcase`) against live collections, plus a demo `panel_user` for
each — the fastest way to exercise the runtime with real data:

```bash
# PANEL_PASSWORD only applies to the script, not to a Worker binding
BASE=http://127.0.0.1:8787 ADMIN_KEY=dev-admin-key-change-me \
  PANEL_PASSWORD=panel-demo-123 pnpm -F @hamolus/core seed:panels
```

The generated users are ordinary `_auth_users` rows holding the `panel_user`
privilege (whose permission list is intentionally empty — Panel authorization comes
from the manifest, see [Runtime access control](#runtime-access-control)), so they can
sign in through `/api/_auth/login` but can only reach the collections and fields a view
grants them.

## The browser client

`@hamolus/panel` is a framework-neutral `PanelClient` (a thin `fetch` wrapper —
no Solid or React dependency):

```ts
import { createPanelClient } from '@hamolus/panel'

const client = createPanelClient({ apiBase: 'http://localhost:8787/api', token, land, colony })
const { panel, role, user, attributes } = await client.bootstrap('ops')
const page = await client.listRecords('ops', 'tickets', { page: 1, pageSize: 25 })
page.data   // PanelRecord[] — only the fields the manifest grants
page.meta   // { page, pageSize, total, totalPages, … }
```

It covers the full surface: `listPanels`, `getPanel`, `createPanel`,
`updatePanel`, `deletePanel`, `bootstrap`, `listRecords`, `getRecord`,
`createRecord`, `updateRecord`, `deleteRecord`, `listRelationOptions`,
`getDashboardMetrics`, `listAssets`, `uploadAsset`, `deleteAsset`, plus
`getPanelAssetUrl` / `isPanelAssetExpired` for signed URLs. `normalizePanelError`
turns transport and API failures into a single `PanelError` shape.

## Private assets

Panel uploads are **not** part of the public media or file libraries. They live
in `_meta_panel_assets` with bytes in the `MEDIA` R2 bucket under
`panels/{land}/{panelId}/`, and are served by signed `GET /panel-assets/{id}`
URLs that expire after 15 minutes (`PANEL_ASSET_SECRET`, falling back to
`JWT_SECRET`). They are not reachable through `/media`, `/documents` or
`/attachments`, and `DELETE /api/_panels/{id}` cascades both the metadata rows
and the R2 objects.

## Generated app theming

A generated app ships the Console design language rather than a bare shell:

- `src/panel.css` starts with the Console **token layer copied verbatim** from
  `packages/console/src/index.css`, then adds a component layer that only ever
  references `var(--token)`. All 16 palettes and both modes therefore re-theme
  the whole app live, exactly as the admin UI does.
- The shell mirrors the Console: a 232px **sidebar** (panel brand, the manifest's
  menu as a link list, and the signed-in user + role in the footer) beside a
  sticky topbar carrying the active view title, Refresh, and Appearance. The active
  link gets the same accent bar as the console's nav. At ≤900px the sidebar becomes
  an off-canvas drawer (280px / 85vw) behind a scrim, opened by the topbar
  hamburger and closed by the scrim, the ✕, or **Escape**; the body scroll is
  locked while it is open.
- The **Appearance** menu (top right) switches dark/light mode, palette, and UI
  font. The choice is persisted under the `panel-theme` localStorage key, and
  `index.html` applies it pre-hydration so the first paint is already themed.
- Defaults are Inter, palette `blue` in dark mode and `amber` in light mode.

Because the token block is a **copy** rather than a build-time import, console
token changes do not reach generated apps automatically: re-copy the same range
from `packages/console/src/index.css` into
`packages/cli/template/src/panel.css`.

## Current gaps

- Seed export/restore (`packages/core/src/meta/seed.ts`) does not include Panel
  manifests, roles, members, or assets, so `scope: 'all'` is not truly
  full-state. Back up Panels with the manifest CRUD endpoints for now.
- The generated app renders dashboard metrics, searchable paginated tables, and
  form-view record cards. It does not yet upload private assets, edit records
  through `create`/`update`, or resolve relation option pickers.
- MCP exposes no Panel tools.
