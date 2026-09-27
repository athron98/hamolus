# `examples/panels/booking-kalendar` — an agenda panel with a signed file

A panel with a **date-shaped** table view and an attachment field, so the interesting
part is not the table: it is the signed, expiring asset URL behind each row, and a
`locale` that comes from the core rather than from a hardcoded list.

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
| `src/panel.ts` | the panel's identity: `id: 'booking'`, its name, and `createPanelRuntimeConfig(import.meta.env, …)` |
| `src/App.tsx` | the agenda table, the attachment cell, the locale switcher |
| `src/main.tsx` | `render()` into `#root` |
| `src/panel.css` | the panel's own styles |
| `.env.example` | the six `VITE_PANEL_*` variables, including `VITE_PANEL_LOCALE` |

## The core it expects

A `bookings` collection with `booked_at`, `booked_date`, `customer_name`, `status` and
`attachment`, plus a manifest with `id: 'booking'`, one table view (`agenda`) bound to
that collection, and a `reception` role whose only operation is `read`.

## Invariants

- **`id` must match the manifest on the core exactly** (`booking` here, in a directory
  called `booking-kalendar` — the directory name is free, the id is not). A mismatch is a
  panel the core refuses to describe.
- **A file field is a signed URL, and it expires.** `getPanelAssetUrl()` takes the value
  stored in the field, and `isPanelAssetExpired()` is what the panel polls to refresh. Do
  not cache the URL in a module variable and do not treat a 403 as a missing file.
- **List the assets once for the whole view, not per record.** A per-row
  `listAssets()` call is an N+1 against the core; the view already returns the field
  values, and the panel only resolves the URLs it actually renders. This is called out
  in the README because it is the mistake a panel author makes first.
- **The manifest's `fields.read` is the ceiling.** An attachment the view does not expose
  is not downloadable, no matter what the underlying file URL allows.
- **`VITE_PANEL_LOCALE` only picks the language for the first request.** The full list
  comes from `GET /_meta/localization`, and that list wins. A local language array here
  would offer a locale the core then refuses on save.
- **Scope must be consistent**: a `VITE_PANEL_LAND` / `VITE_PANEL_COLONY` that disagrees
  with the token's account gives `SCOPE_MISMATCH`.
- `VITE_PANEL_DEFAULT_VIEW=agenda` is a preference only; an unknown view falls back to the
  first menu entry.
- The reception role is read-only, so the UI must not offer an edit affordance. That is
  the manifest talking, not a hardcoded `readonly`.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`.
- Comments are English and explain the access and expiry model.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
