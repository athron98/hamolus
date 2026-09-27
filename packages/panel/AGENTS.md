# `@hamolus/panel` — the panel client SDK

The single dependency a panel's entry point needs: a typed client for the core API, the
error taxonomy, localization fetching, and the helpers for a **signed** panel asset
URL. A generated panel is `src/panel.ts` (the manifest) plus `src/App.tsx` (the UI) and
nothing else — no Vite proxy, no auth code, no fetch wrapper.

## Built bundle

`tsup` → `dist/` as ESM **and** CJS with `.d.ts`, so the SDK works in a Vite app, a
Worker, and a Node test runner. The panel's own `vite.config.ts` dials this package's
peer Vite, so a Vite version mismatch is a panel build error, not a silent fallback.

## Commands

```bash
pnpm -F @hamolus/panel typecheck
pnpm -F @hamolus/panel build
pnpm -F @hamolus/panel dev
pnpm -F @hamolus/panel check:runtime    # node scripts/check-runtime.mjs
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/index.ts` | the public entry; re-exports the client, the error taxonomy, and the types |
| `src/client.ts` | `PanelClient` / `createPanelClient()` — the typed REST calls |
| `src/config.ts` | runtime config resolution (API base, panel id, manifest) |
| `src/errors.ts` | `PanelError`, `ApiError`, `normalizePanelError` |
| `src/localization.ts` | `fetchPanelLocalization()` |
| `src/url.ts` | `normalizeApiBase()`, `getPanelAssetUrl()`, `isPanelAssetExpired()` |
| `src/types.ts` | re-exported DTOs from `@hamolus/types` |

## Invariants

- **The client never keeps a secret.** Token resolution is deliberately async, because
  the token often comes from a parent frame via `postMessage`; a synchronous constructor
  would have to guess and would cache a token that has already expired. The bearer token
  is attached **per request** and never stored beyond the call.
- **A panel asset URL is signed and short-lived.** `getPanelAssetUrl()` takes a
  *complete* URL from a record's field value — the path encodes the asset id — and
  `isPanelAssetExpired()` is what a panel polls to refresh. Do not cache the URL
  yourself and do not treat a 403 as "missing": it is usually expiry.
- **`normalizeApiBase()` is lenient on purpose.** It accepts a host root, a `/api`
  suffix, or a trailing slash and returns one canonical form, so a panel can be pointed
  at `http://localhost:8787` or at a full API URL without a config change.
- **Errors keep the core's status and code.** `PanelError` carries `status`,
  `code`, `details` and a `message` already phrased for a human; a panel shows
  `message` and logs the rest. Wrapping an error in a bare `new Error()` throws away
  the information the UI needs.
- **Collections are fields, not tables.** A panel that hard-codes a table name breaks
  the moment someone renames the collection, which the core cannot do — so it works,
  but only until they do. Read the name from the manifest.

## Gates

`pnpm check:runtime` is the one to run after any change here. It stands up a fake core
and asserts, among other things:

- `getPanelAssetUrl()` derives the same URL the core signs, and expiry is detected.
- `normalizeApiBase()` accepts every accepted spelling and rejects a URL with a path
  that is not an API root.
- The bundle and `templates/panels/basic/` stay in step, and the shipped
  `package.json#files` set keeps the panel's published artifact complete.

## Conventions

- Copyright/author/SPDX header verbatim (`pnpm check:copyright`).
- Document every exported function with what it guarantees, and — for the URL helpers —
  what it does *not* validate, since callers rely on that split.
- Comments are English; commit messages follow Conventional Commits with the package as
  the scope.
