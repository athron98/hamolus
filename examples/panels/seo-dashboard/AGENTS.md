# `examples/panels/seo-dashboard` — a dashboard panel

A **dashboard** panel: metric cards computed by the core, then a table of records below.
It is the example for the read-heavy case, and the one that shows the difference between
`getDashboardMetrics()` and `listRecords()`.

## Not a workspace member

`examples/` is not in `pnpm-workspace.yaml`; this project installs on its own and
resolves `@hamolus/panel` from npm. In a checkout, link the local package first.

```bash
pnpm install
pnpm link @hamolus/panel
cp .env.example .env.local     # then fill it in; never commit .env.local
pnpm dev                       # vite
pnpm build                     # tsc --noEmit && vite build
pnpm preview
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/panel.ts` | the panel's identity: `id: 'seo'`, its name, and `createPanelRuntimeConfig(import.meta.env, …)` |
| `src/App.tsx` | the metric cards, the article table, the search box |
| `src/main.tsx` | `render()` into `#root` |
| `src/panel.css` | the panel's own styles |
| `.env.example` | the six `VITE_PANEL_*` variables, including `VITE_PANEL_LOCALE` |

## The core it expects

An `articles` collection, and a manifest with `id: 'seo'` holding two views: a
`dashboard` view (`overview`) with `metrics`, and a `table` view (`articles`) over the
collection. The `editor` role gets `read` on both.

**Match `metrics` and `fields` to the collection that actually exists in your core.** A
field name in the manifest has to be exactly a field name in the collection definition —
a typo is not a zero, it is a metric that quietly does not appear.

## Invariants

- **A metric is computed by the core, not by the panel.** `getDashboardMetrics(panelId,
  viewId)` returns the numbers the manifest defined. If a panel aggregates rows itself it
  is re-implementing the API, and it will disagree with the console.
- **The two view kinds are different calls.** `dashboard` → `getDashboardMetrics()`;
  `table` → `listRecords(panelId, viewId, query)`, which is also where `search` goes. Do
  not call `listRecords` on a dashboard view.
- **The list query is strict.** Only `page`, `pageSize`, `search`, `locale`, `sortBy`,
  `sortDir` and `filter` are accepted; an unknown key is rejected with `INVALID_QUERY`
  rather than ignored, so a typo fails loudly. That is intended.
- **`bootstrap(panelId)` is the source of truth** for the views, the readable fields and
  the allowed operations — never a hardcoded view list in the panel.
- **`id` must match the manifest on the core exactly.** A mismatch produces a panel with
  nothing to render, not an error message.
- **The token is required**; `PanelClient` throws a `PanelError` when it is empty and
  `missingTokenMessage()` is what the screen shows. An empty dashboard on a missing token
  is indistinguishable from an empty database, so the error must be visible.
- **`VITE_PANEL_LOCALE` picks the first request's language only.** The real list comes
  from `GET /_meta/localization`, and that list wins.
- Scope set in `VITE_PANEL_LAND` / `VITE_PANEL_COLONY` must match the token's account, or
  the core answers `SCOPE_MISMATCH`.
- `VITE_PANEL_DEFAULT_VIEW=overview` is a preference; an unknown or empty value falls back
  to the first menu entry.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`.
- Comments are English and explain which call belongs to which view kind.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
