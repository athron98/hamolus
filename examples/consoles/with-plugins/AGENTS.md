# `examples/consoles/with-plugins` — a console with two plugins

The smallest complete host for `@hamolus/console`: three source files, no `src/plugins/`
folder, no registry file, no CSS import of its own. It exists to show that **the plugin
list in `console.config.ts` is the whole plugin system**.

## Not a workspace member

`examples/` is not in `pnpm-workspace.yaml`, so this project installs on its own. It
resolves the `@hamolus/*` packages from npm; in a checkout you want the local ones:

```bash
pnpm install
pnpm link @hamolus/console @hamolus/types \
  @hamolus/plugin-console-todo @hamolus/plugin-console-kanban
pnpm dev          # vite
pnpm build        # tsc --noEmit && vite build
```

Run the core first at `http://localhost:8787` — the console asks the user for the
endpoint in its navbar at runtime, so there is no env var to set.

## Layout

| Path | Holds |
| ---- | ----- |
| `console.config.ts` | **the plugin list.** Imports the two descriptors and passes them to `defineConsoleConfig` |
| `src/main.ts` | `mount({ config })` and nothing else |
| `index.html` | the pre-paint theme script, copied from `packages/console/index.html` |
| `vite.config.ts` | Solid plugin + `@hamolus/console` wired as a library build |

## Invariants

- **Add a plugin by editing exactly two things:** one import and one array element in
  `console.config.ts`. That is the entire installation — the packages ship compiled
  (JavaScript plus their own stylesheet), so there is no plugin folder to create, no JSX
  to compile, no StyleX compiler to add to `vite.config.ts`, and no stylesheet to link
  in `src/main.ts`. `hamolus add plugin <name>` does exactly this, between the
  `hamolus:plugins:start` / `:end` markers.
- **Do not add a `localization` key to `console.config.ts`.** Localization is configured
  once, in the core, and the console follows it: it asks `GET /_meta/localization` (public,
  so it answers before login) and builds its language picker from that reply. A local
  copy means adding a language means editing the core *and* rebuilding this console, and
  a stale copy would offer a locale that the core then refuses on save. The schema is
  strict, so a leftover key fails here instead of being silently ignored.
- **Two plugin ids may not collide.** The id is also the KV namespace
  (`/_plugins/<id>/…`), so a duplicate is a shared namespace. The console throws at mount
  rather than merging them.
- **`index.html` is a copy of `packages/console/index.html`.** The pre-paint theme script
  in it is byte-pinned by `pnpm check:markers` at the repository root, and it is what
  prevents a white flash on reload. Edit the package copy, then copy it over.
- **Theming works through CSS variables.** A host that overrides `--bg`, `--surface`,
  `--text`, … restyles the plugins too, because the plugins' compiled rules point at
  those variables. Do not reach into a plugin's markup to restyle it.
- Plugins register before the first render, so the sidebar's Plugins group and
  `/plugins` are correct on the first paint. Nothing in the console bundle needs to
  change when a plugin is added.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`.
- Comments are English. `console.config.ts` is documentation-first on purpose: it is the
  first file a host author opens, and it explains why the plugin list is the plugin
  system.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
