# `examples/panels/inventory` — a one-field stock panel

The smallest useful panel: one table view, one editable field, one role. It exists to
show that a panel is **a view on a collection, not a UI for a collection** — everything
it may do is decided by the manifest on the core, and the panel grants itself nothing.

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
| `src/panel.ts` | the panel's identity: `id: 'inventory'`, its name, and `createPanelRuntimeConfig(import.meta.env, …)` |
| `src/App.tsx` | the whole UI: the stock table, the quantity editor, the conflict notice |
| `src/main.tsx` | `render()` into `#root` |
| `src/panel.css` | the panel's own styles |
| `.env.example` | the five `VITE_PANEL_*` variables, each commented with what happens if it is wrong |

## The core it expects

A `products` collection with `sku`, `name` and `quantity`, and a panel manifest with
`id: 'inventory'` whose `products` view has `"collection": "products"` and `quantity` in
`fields.write`. The account you put in `VITE_PANEL_API_TOKEN` needs the `update`
operation on that view.

## Invariants

- **`id` must match the manifest on the core exactly.** A mismatch is a panel the core
  refuses to describe, and the symptom is an empty screen rather than an error.
- **A write goes through the view, never the collection.** `updateRecord(panelId,
  viewId, recordId, input)` is the only write path, and the core decides whether it is
  allowed. A field outside `fields.write` is not "hidden by the UI" — it is rejected
  server-side, which is what `pnpm check:panel-acl` asserts against a live core.
- **`bootstrap(panelId)` is the source of truth** for the views, the readable fields and
  the allowed operations. Do not hardcode a field list in the panel; a manifest change
  should be the only change needed.
- **The token is required and the failure is explicit.** `PanelClient` throws a
  `PanelError` when `VITE_PANEL_API_TOKEN` is empty, and `missingTokenMessage()` is what
  the screen shows. A panel that renders an empty list on a missing token teaches the
  user the wrong lesson.
- **Scope must be consistent.** If `VITE_PANEL_LAND` or `VITE_PANEL_COLONY` is set it has
  to match the scope of the token's account, or the core answers `SCOPE_MISMATCH`.
- **A signed asset URL can expire mid-session.** Use `isPanelAssetExpired()` to refresh;
  a 403 on an image is expiry, not a missing file.
- `VITE_PANEL_DEFAULT_VIEW=products` is only a preference — if it is empty or names a view
  the manifest does not have, the panel uses the first menu entry.
- `quantity` is an integer. Send a number, not a formatted string; the manifest's
  `fields.write` is the last line of defence, not input validation.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`.
- Comments are English and explain the access model, because that is the thing a reader
  of a panel must not get wrong.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
