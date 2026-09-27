---
name: hamolus-panels
description: Use ONLY when creating or editing Hamolus panel definitions (manifests). Enforces view kinds (table/form/dashboard), field ACLs, role operations subset, filters (value vs source), menu refs, reference validation, and bootstrap ACL. Front-load keywords: panel definition, PanelDefinition, bootstrap, CODE_DEFINED_PANEL, PANEL_REFERENCE_INVALID.
---

# Hamolus — Panels

Create panel manifests per `docs/definitions/panel-definition.md`. Core enforces manifest; client renders it. Runtime uses bootstrap-filtered manifest (per member). Code-defined panels frozen against runtime mutating endpoints.

## When to use

User says: panel definition, create panel, add panel, dashboard panel, table view, form view. NOT for collections/fields/config/seed alone.

## Hard rules

1. `id`: `^[a-z][a-z0-9_]{0,63}$`. Stable (URL/asset prefix). Directory name may differ.
2. Root: `views[]` (>=1), `roles[]` (>=1), `menu[]` optional, `members[]` usually omitted (assign in console/users). `defaultRoleId` must exist.
3. View base: `id,label,path,fields{read,write},operations[]` required. `path` `^\/[a-z0-9/_-]*$`, no `//` or `..`.
4. `fields.read/write` are explicit allowlists (no `all`). Max 200 each.
5. `operations` subset of allowed per view kind; role `operations` ⊆ view `operations`. Role `readFields/writeFields` (if present) ⊆ view fields.
6. Kinds:
   - `table`: needs `collection`. `form` boolean (default true). searchable/pageSize/defaultSort.
   - `form`: needs `collection`, `submitLabel` default 'Save'.
   - `dashboard`: `metrics[]` (>=1), each metric has `id,label,collection,operation,field` (field required unless `count`). Metric field must be `number|currency|custom_currency` if non-count. `groupBy`, `format` optional.
7. Filters: rule has `field,op` and **exactly one** of `value` or `source`. `source` must match `^member\.attributes\.[a-z][a-z0-9_]*$`. `op: 'in'` requires static array `value`.
8. Menu: unique `id,path`, each `viewId` exists. Pruned by bootstrap to member-visible views.
9. Roles: unique ids, each view access subset of view. Create-operation requires role effective writeFields cover every collection field required-without-default.
10. Members: unique `userId`, `roleId` exists, `attributes` keys snake_case.
11. Reference validation (`PANEL_REFERENCE_INVALID`): collections/fields exist and not hidden, metric types correct, subsets, defaultSort in readable, searchable needs indexed-like readable text fields, duplicates checked.
12. Code-defined: in `core/src/panels/*.ts`, barrel `core/src/panels/index.ts`, wired in `setCodeDefinitions`. Runtime mutating endpoints return `403 CODE_DEFINED_PANEL` if frozen; removing file doesn't delete manifest.

## Path conventions

- Example: `templates/cores/predefined/src/panels/content.ts`, barrel `core/src/panels/index.ts`, wire in `core/src/index.ts`.
- Write with `satisfies PanelDefinitionInput` from `@hamolus/types`.

## Minimal example (table)

```ts
import type { PanelDefinitionInput } from '@hamolus/types'

export const CONTENT = {
  id: 'content',
  name: 'Content',
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
      fields: { read: ['id','title','slug','published','published_at'], write: [] },
      defaultSort: { field: 'published_at', direction: 'desc' },
    },
  ],
  menu: [{ id: 'posts', label: 'Posts', path: '/content/posts', viewId: 'posts' }],
  roles: [{ id: 'reader', label: 'Reader', views: [{ viewId: 'posts', operations: ['read'] }] }],
} satisfies PanelDefinitionInput
```

## Dashboard metric example

```ts
{
  id: 'overview',
  kind: 'dashboard',
  label: 'Overview',
  path: '/overview',
  operations: ['read'],
  fields: { read: [], write: [] },
  metrics: [
    { id: 'posts_count', label: 'Posts', collection: 'posts', operation: 'count' },
    { id: 'revenue_sum', label: 'Revenue', collection: 'orders', operation: 'sum', field: 'total' },
  ],
}
```

## Checklist

- [ ] id matches pattern, stable
- [ ] >=1 view, >=1 role
- [ ] every menu.viewId/role.views[].viewId exists
- [ ] operations subsets correct
- [ ] filters: exactly one of value/source; in has array
- [ ] table/form reference existing collection; dashboard metrics valid
- [ ] barrel+wire updated if code-defined
- [ ] bootstrap semantics noted (filtered per member)

## References

- `docs/definitions/panel-definition.md`
- `packages/types/src/panel.ts`, `packages/core/src/meta/panels.ts`
- Example: `templates/cores/predefined/src/panels/content.ts`
