# `@hamolus/console` — the admin console

SolidJS admin UI, shipped as a **library**. A host writes a `console.config.ts`, one
`mount()` call, and nothing else — no `src/plugins/` folder, no registry file, no CSS
import in its own entry.

## Ships two builds

| Command | Output | Used by |
| ------- | ------ | ------- |
| `pnpm -F @hamolus/console dev` | Vite dev server | work on the console itself |
| `pnpm -F @hamolus/console build` | `dist/` | `wrangler deploy` of the console Worker |
| `pnpm -F @hamolus/console build:lib` | `dist-lib/` (`index.js` + `.css` + `.d.ts`) | generated consoles, which consume the package as a pre-built library |

`build:lib` is a separate script on purpose: `check:generated-app` and
`hamolus add console` need the library, and a plain `build` must not be able to
satisfy that by accident.

## Two entry points

- `src/lib.tsx` is the real entry. It exports `mount(options)`, which mounts into
  `#root` (or `options.target`) and returns a handle with `unmount()`.
- `src/main.tsx` is the development entry for this package alone. Do not copy its
  shape into a host.

`mount({ config })` reads `plugins` from the config and registers them **before** the
first render, so the sidebar, the `/plugins` screen and pinned shortcuts all read one
reactive registry on their first paint.

## Layout

| Path | Holds |
| ---- | ----- |
| `src/App.tsx` | routes and the shell |
| `src/pages/` | one file per screen: Dashboard, Collections, CollectionPage, Documents, Media, Files, Panels, PanelEditor, Users, Groups, Lands, Config, Plugins, Seed, Login, Universe |
| `src/components/` | shared UI: `Table`, `FormInput`, `RecordForm`, editors, pickers, dialogs |
| `src/lib/` | `api.ts` (the HTTP client), `session.ts`, `cache.ts`, `store.ts` (signals), `theme.ts`, `pluginKv.ts`, `version.ts` (build-injected `CONSOLE_VERSION`), … |
| `src/plugins/` | the console's own plugin *types*, not host plugins |
| `src/index.css` | **the single source of truth for every StyleX token** |
| `src/theme.stylex.ts` | StyleX tokens, each a `var(--x)` reference into `index.css` |
| `index.html` | the pre-paint theme script (see below) |

## Invariants

- **The pre-paint theme script in `index.html` is load-bearing and byte-pinned.**
  It reads the stored mode/palette/font and sets `data-mode` / `data-theme` /
  `data-font` on `<html>` before the bundle runs, which is what stops a white flash on
  reload. `templates/consoles/basic/index.html` carries a copy for generated apps, and
  `pnpm check:markers` fails if the two differ. Edit one, copy to the other.
- **StyleX is compile-time.** A token is a `var(--x)` reference, and the actual value
  lives in `index.css`. Changing a palette means editing both. A plugin's CSS may
  override the CSS variables — that is the supported way to restyle one.
- **Two plugin ids may not collide.** The id is also the KV prefix
  (`plugin:{land}:{id}:*`), so a duplicate is a shared prefix, and the console throws
  at mount rather than merging them.
- **HMR must not duplicate rows.** Re-mounting the same target returns the existing
  instance instead of registering twice.
- The API endpoint is chosen at runtime in the navbar and remembered per browser —
  there is no env var to fill in for a generated console.
- **The version shown in the footer must come from the build, not the manifest at
  runtime.** `CONSOLE_VERSION` is inlined by both Vite configs, so `build:lib` resolves
  it while the manifest is still reachable; afterwards the bundle is opaque to its host.
  Do not move the read into component code.

## Gates

```bash
pnpm -F @hamolus/console typecheck
pnpm -F @hamolus/console build:lib     # needed before check:generated-app
pnpm check:markers                    # token + theme-script drift, offline
pnpm -F @hamolus/cli check:plugin-config   # host contract for plugins
pnpm check:generated-app              # slow: installs and builds a generated console
```

`check:plugin-config` has no root pass-through — it lives in `@hamolus/cli`, so it
needs the `-F`.

## Conventions

- Copyright/author/SPDX header verbatim at the top of every file (`pnpm check:copyright`).
- UI copy is plain and specific. Say what the screen is for in the file header, and
  comment decisions (why a memo exists, why a request is aborted) rather than restating
  the code.
- New plugin UI goes in a **plugin package** under `packages/plugins/console/`, not in
  `src/components/`. If a host needs it, it ships as a package the host adds with
  `hamolus add plugin`.
