# Panel definition

A **panel definition** is a manifest that describes an app surface as data: which
collections it reads and writes, which fields each role may touch, how rows are
filtered, and what the navigation looks like. A generated browser app renders
whatever the core hands it. The core enforces the manifest; the client renders it.

That makes a panel the multi-tenant, least-privilege way to ship an internal
tool. A `panel_user` role is seeded with **no** global permissions, so a panel
user can only ever reach the views and fields a manifest grants them.

| | |
| --- | --- |
| Schema | `panelDefinitionSchema` — `packages/types/src/panel.ts` |
| Types | `PanelDefinition`, `PanelDefinitionInput` |
| Reference validation | `validatePanelReferences()` — `packages/core/src/meta/panels.ts` |
| Store | `putPanel` / `deletePanel` / `listPanels` |
| API | `/_panels` — see [api.md](../../packages/core/docs/api.md#panels-_panels) |
| Client | `@hamolus/panel` (`PanelClient`) |
| Console editor | `/panels` and `/panels/:id` |

## A complete manifest

```ts
// core/src/panels/content.ts
import type { PanelDefinitionInput } from '@hamolus/types'

export const CONTENT = {
  id: 'content',
  name: 'Content',
  description: 'Editorial queue, defined in code.',
  icon: 'file',
  views: [
    {
      id: 'posts',
      kind: 'table',
      label: 'Posts',
      path: '/content/posts',
      collection: 'posts',
      operations: ['read'],
      searchable: true,
      pageSize: 20,
      fields: {
        read: ['id', 'title', 'slug', 'excerpt', 'published', 'published_at'],
        write: [],
      },
      defaultSort: { field: 'published_at', direction: 'desc' },
    },
  ],
  menu: [{ id: 'posts', label: 'Posts', path: '/content/posts', viewId: 'posts' }],
  roles: [
    {
      id: 'reader',
      label: 'Reader',
      description: 'May list posts, nothing else.',
      views: [{ viewId: 'posts', operations: ['read'] }],
    },
  ],
} satisfies PanelDefinitionInput
```

The identical manifest over HTTP is the body of `POST /api/_panels` or
`PUT /api/_panels/{id}` — both wrap it: `{ "definition": { … } }`.

## Root properties

`.strict()` at the root and on every nested object except the view variants.

| Property | Type | Required | Default | Notes |
| -------- | ---- | -------- | ------- | ----- |
| `id` | `string` | ✅ | — | `^[a-z][a-z0-9_]{0,63}$` — 1–64 chars, lowercase and underscores. Stable: it is the URL segment and the asset prefix. |
| `name` | `string` | ✅ | — | `trim()`, 1–120. The display name (note: `name`, not `label`). |
| `description` | `string` | | — | `trim()`, max 500. |
| `icon` | `string` | | — | `trim()`, 1–40. |
| `theme` | `PanelTheme` | | — | See [theme](#theme). |
| `views` | `PanelViewDefinition[]` | ✅ | — | 1–100. See [views](#views). |
| `menu` | `PanelMenuItem[]` | | `[]` | Max 200. See [menu](#menu). |
| `roles` | `PanelRoleDefinition[]` | ✅ | — | **1–50.** At least one role is required. |
| `members` | `PanelMember[]` | | `[]` | Max 2000. See [members](#members). |
| `defaultRoleId` | `string` | | — | Must be a registered role id. |

### Referential integrity

`panelDefinitionSchema.superRefine` enforces eight rules, so a bad manifest is
rejected at save time rather than at request time:

1. every `menu[].viewId` exists in `views[].id`;
2. no duplicate `menu[].id`;
3. no duplicate `menu[].path`;
4. no duplicate `roles[].id`;
5. every `roles[].views[].viewId` exists in `views[].id`;
6. `defaultRoleId` is a registered role;
7. every `members[].roleId` is a registered role;
8. no `members[].userId` appears twice.

Duplicate `views[].id` is *not* checked here — the core catches it during
reference validation (see [Reference validation](#reference-validation)).

## Views

Every view shares a base set of properties, then adds its own by `kind`. The
three view schemas are **not** `.strict()` — an unknown key on a view is silently
dropped, so a typo in a view is worth watching for.

| Base property | Type | Required | Default / limits |
| ------------- | ---- | -------- | ---------------- |
| `id` | `string` | ✅ | Panel id pattern. |
| `label` | `string` | ✅ | `trim()`, 1–120. |
| `path` | `string` | ✅ | `^\/[a-z0-9/_-]*$`, no `//`, no `..` segment. |
| `icon` | `string` | | `trim()`, 1–40. |
| `description` | `string` | | `trim()`, max 500. |
| `searchable` | `boolean` | | `false` |
| `pageSize` | `number` | | `int`, 1–100, **`20`** |
| `fields` | `{ read, write }` | ✅ | Max 200 names each, both default `[]`. |
| `operations` | `('read'\|'create'\|'update'\|'delete')[]` | ✅ | 1–4 entries. |
| `filters` | `PanelFilterRule[]` | | Max 20, default `[]`. |
| `defaultSort` | `{ field, direction }` | | `direction` is `asc` or `desc`. |

`fields` is an explicit allowlist — there is **no** `all` shorthand. A role that
may `create` must list every required field of the collection under `write`, or
the manifest is rejected.

### `kind: 'table'`

| Extra property | Type | Default | Notes |
| -------------- | ---- | ------- | ----- |
| `collection` | `string` | — | snake_case. Must be a registered collection. |
| `form` | `boolean` | `true` | Whether the table view also exposes the create/edit form. |

### `kind: 'form'`

| Extra property | Type | Default | Notes |
| -------------- | ---- | ------- | ----- |
| `collection` | `string` | — | snake_case, must be registered. |
| `submitLabel` | `string` | `'Save'` | `trim()`, 1–80. |

### `kind: 'dashboard'`

| Extra property | Type | Limits |
| -------------- | ---- | ------ |
| `metrics` | `PanelMetric[]` | 1–40. No `collection` on the view itself — each metric names its own. |

A `PanelMetric`:

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `id` | `string` | ✅ | Panel id pattern. Unique within the panel. |
| `label` | `string` | ✅ | `trim()`, 1–120. |
| `collection` | `string` | ✅ | snake_case, must be registered. |
| `operation` | `'count' \| 'sum' \| 'avg' \| 'min' \| 'max'` | ✅ | |
| `field` | `string` | unless `operation: 'count'` | Must be `number`, `currency` or `custom_currency` for a non-count metric. |
| `groupBy` | `string` | | Breaks the metric down by this field. |
| `format` | `'number' \| 'compact' \| 'currency'` | | Display hint for the result. |

## Filters

```ts
filters: [
  { field: 'status', op: 'eq', value: 'open' },
  { field: 'team',   op: 'eq', source: 'member.attributes.team' },
]
```

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `field` | `string` | ✅ | snake_case, must exist on the collection and not be hidden. |
| `op` | `'eq' \| 'neq' \| 'gt' \| 'gte' \| 'lt' \| 'lte' \| 'like' \| 'in' \| 'contains'` | ✅ | |
| `value` | `unknown` | exactly one of | A literal value. `op: 'in'` requires a static array. |
| `source` | `string` | exactly one of | Must match `^member\.attributes\.[a-z][a-z0-9_]*$`. |

A rule must set **either** `value` **or** `source` — both is an error, neither is
an error. `source` is how a manifest scopes rows to who is asking, using the
signed-in member's attributes; a missing attribute is
`400 PANEL_ATTRIBUTE_MISSING`.

A value the member can supply themselves is never used to *widen* access: a
filter either matches or the row is invisible.

## Menu

```ts
menu: [{ id: 'posts', label: 'Posts', path: '/content/posts', viewId: 'posts' }]
```

| Property | Type | Notes |
| -------- | ---- | ----- |
| `id` | `string` | Panel id pattern, unique in the menu. |
| `label` | `string` | `trim()`, 1–120. |
| `path` | `string` | Absolute route, unique in the menu, no `//` or `..`. |
| `viewId` | `string` | Must be a registered view. |
| `icon` | `string` | `trim()`, 1–40. |

The menu is pruned to the views a member may see, so a client should render the
menu it receives from `bootstrap`, not the one it shipped with.

## Roles

Panel roles are **manifest-local** and separate from the global `privileges`
roles. A role grants per-view operations and, optionally, narrows the field
allowlist further.

```ts
roles: [
  {
    id: 'agent',
    label: 'Agent',
    description: 'Works tickets, cannot delete them.',
    views: [
      { viewId: 'tickets', operations: ['read', 'create', 'update'],
        readFields: ['id', 'title', 'status'], writeFields: ['title', 'status'] },
    ],
  },
]
```

| Role property | Type | Required | Default / limits |
| ------------- | ---- | -------- | ---------------- |
| `id` | `string` | ✅ | Panel id pattern, unique. |
| `label` | `string` | ✅ | `trim()`, 1–120. |
| `description` | `string` | | `trim()`, max 500. |
| `views` | `PanelRoleViewAccess[]` | | Max 200, default `[]`. |

| Role-view property | Type | Notes |
| ------------------- | ---- | ----- |
| `viewId` | `string` | Must be a registered view. |
| `operations` | `PanelOperation[]` | 1–4, and a **subset** of the view's `operations`. |
| `readFields` | `string[]` | Max 200. When present it **overrides** `view.fields.read` — and must be a subset of it. |
| `writeFields` | `string[]` | Max 200. Overrides `view.fields.write`, and must be a subset. |

## Members

```ts
members: [
  { userId: 'u_1', roleId: 'agent', attributes: { team: 'support', tier: 'gold' } },
]
```

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `userId` | `string` | ✅ | `trim()`, 1–80. A **user id**, not a role or a username. Each user appears at most once. |
| `roleId` | `string` | ✅ | Must be a registered role. |
| `attributes` | `Record<string, string \| number \| boolean \| null>` | | Default `{}`. Keys are snake_case (`^[a-z][a-z0-9_]*$`); strings max 500. These are what `source: 'member.attributes.x'` filters read. |

Members are usually assigned in the console's **Users** page once the users
exist, so a hand-written manifest normally ships with `members` omitted.

## Theme

```ts
theme: { mode: 'dark', palette: 'blue', font: 'Inter' }
```

| Property | Type | Notes |
| -------- | ---- | ----- |
| `mode` | `'dark' \| 'light'` | |
| `palette` | `string` | `trim()`, 1–40. One of the 16 console palettes. |
| `font` | `string` | `trim()`, 1–40. |

A generated panel app copies the console's token layer, so all palettes and both
modes re-theme it live. The local choice is persisted under the `panel-theme`
localStorage key and applied pre-hydration, so the first paint is already
themed.

## Reference validation

The schema can only check the manifest against itself. `validatePanelReferences()`
in the core additionally checks it against the **database**, and every failure is
`400 PANEL_REFERENCE_INVALID`:

- duplicate `view.id` inside one panel, and duplicate `metric.id` inside one
  dashboard;
- every `view.collection` / `metric.collection` is a registered collection;
- every referenced field exists on that collection, and is not `hidden`;
- `metric.field` is `number`, `currency` or `custom_currency` when
  `operation !== 'count'`;
- an `op: 'in'` filter has a **static array** value — a `source` or a
  non-array `value` is rejected;
- role `readFields` ⊆ `view.fields.read`, `writeFields` ⊆ `view.fields.write`,
  and role `operations` ⊆ `view.operations`;
- a view that allows `create` has every `required`-without-`default` field of the
  collection covered by the role's effective `writeFields`;
- `view.defaultSort.field` is in the role's readable fields;
- `searchable: true` has at least one readable field of type `string`, `text`,
  `email`, `url`, `slug` or `richtext`.

This is why a code-defined panel is written **after** the collections it
references — the writer refuses a manifest pointing at an unregistered
collection.

## Two permission models

They meet here and it is worth keeping them apart:

| Surface | Authorised by | Used for |
| ------- | -------------- | -------- |
| Manifest routes — `GET/POST/PUT/PATCH/DELETE /api/_panels…` | the global `panels.read` / `panels.write` permissions | *defining* panels |
| Runtime routes — `bootstrap`, view records, relations, dashboard, assets | a valid session, then **the manifest** | *using* a panel |

A `panel_user` needs no global permission at all. Every runtime decision comes
from the caller's panel role, their member attributes, and each view's operations
and field ACLs. `GET /_panels/{id}/bootstrap` returns the manifest
**re-filtered to that user**: unauthorized views dropped, `menu` pruned, `fields`
replaced with the effective ACLs, and one effective `role`. A client should treat
the bootstrap payload as the source of truth, not the manifest it shipped with.

## Code-defined panels

```ts
// core/src/index.ts
import app, { setCodeDefinitions, setCoreConfig } from '@hamolus/core'
import { config } from '../core.config'
import { collections } from './collections'
import { panels } from './panels'

setCoreConfig(config)
setCodeDefinitions({ collections, panels })

export default app
```

```ts
// core/src/panels/index.ts
import type { CodeDefinitions } from '@hamolus/core'
import { CONTENT } from './content'

export const panels = [CONTENT] satisfies NonNullable<CodeDefinitions['panels']>

export default panels
```

The properties are the same as a code-defined collection's, plus two specific to
panels:

- **The manifest is read-only.** `POST`, `PUT`/`PATCH` and `DELETE` on that panel
  id return `403 CODE_DEFINED_PANEL`. Change the file and redeploy.
- **The panel's behaviour is untouched.** Its views keep reading and writing
  records, and panel-owned assets stay uploadable — the freeze is on the
  *manifest*, not on its data.

Removing a panel from the file does not delete it: it stops being re-applied and
stops being frozen, and becomes console-managed state.

## Endpoints

| Method | Endpoint | Permission | Behaviour |
| ------ | -------- | ---------- | --------- |
| `GET` | `/_panels` | `panels.read` | All manifests for the scope. |
| `GET` | `/_panels/{id}` | `panels.read` | One manifest. |
| `POST` | `/_panels` | `panels.write` | Create → `201`. `409 PANEL_EXISTS`; `403 CODE_DEFINED_PANEL`. |
| `PUT` | `/_panels/{id}` | `panels.write` | Replace. `403 CODE_DEFINED_PANEL`. |
| `PATCH` | `/_panels/{id}` | `panels.write` | Replace, but `404` when absent. |
| `DELETE` | `/_panels/{id}` | `panels.write` | Delete manifest + assets → `204`. |
| `GET` | `/_panels/{id}/bootstrap` | session | The manifest, filtered to the caller. |

```bash
curl -X POST http://localhost:8787/api/_panels \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{ "definition": { "id": "content", "name": "Content", "views": [ … ], "roles": [ … ] } }'
```

## Errors

| Code | Status | Cause |
| ---- | ------ | ----- |
| `PANEL_REFERENCE_INVALID` | 400 | Reference validation failed — see [above](#reference-validation). |
| `PANEL_EXISTS` | 409 | A panel with that id is already registered. |
| `CODE_DEFINED_PANEL` | 403 | The panel is declared in code. |
| `PANEL_FIELD_FORBIDDEN` | 400 | A field outside the view's `read` allowlist, or a hidden one. |
| `RECORD_FORBIDDEN` | 403 | A record outside the view's filters. |
| `PANEL_SEARCH_FORBIDDEN` | 403 | `search` on a view with `searchable: false`. |
| `PANEL_ATTRIBUTE_MISSING` | 400 | A `source` filter whose member attribute is absent. |
| `PANEL_FILTER_MISMATCH` | 400 | A malformed filter rule at runtime. |
| `INVALID_PANEL` | 400 | The stored definition no longer parses. |

## Current gaps

- Seed export/restore does not include panel manifests, roles, members or assets,
  so `scope: 'all'` is not truly full state. Back panels up with the manifest
  CRUD endpoints.
- The generated app renders dashboard metrics, searchable paginated tables and
  form-view record cards. It does not yet upload private assets, edit records
  through `create`/`update`, or resolve relation option pickers.
- MCP exposes no panel tools.
- View schemas are not `.strict()`, so a mistyped view key is dropped instead of
  reported.

## See also

- [Collection definition](./collection-definition.md) — the collections and
  fields a manifest references.
- [Panels](../../packages/panel/docs/panels.md) — the runtime ACL, the browser
  client, generated apps, private assets.
- [Core API reference](../../packages/core/docs/api.md#panels-_panels) — every
  panel route and error code.
- [Console guide](../../packages/console/docs/console.md) — the manifest editor.
