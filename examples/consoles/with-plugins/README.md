# consoles/with-plugins

A Hamolus console that **mounts plugins**: a todo list and a drag-and-drop kanban board,
both stored in the core's KV.

## What it demonstrates

- The console as a **library**: this project only mounts `@hamolus/console`, imports its
  stylesheet, and calls `mount()`. There is no JSX, no Solid plugin, and no component tree
  in the host.
- **`console.config.ts` is the whole plugin registration.** The config lists the two
  plugins, `mount({ config })` hands the list to the console, and the console registers it
  before the first render — so they appear under `/plugins` and as rows in the sidebar's
  Plugins group. No registry file, no marker contract, and nothing inside the console
  bundle to rewrite.
- **No plugin folder, and no build plugin either.** `package.json` here has no `solid-js`,
  no `@stylexjs/stylex`, no `vite-plugin-solid`, and `vite.config.ts` declares no plugins
  at all. The plugin packages ship compiled, so a host only has to name them.
- The **plugin contracts** come from `@hamolus/plugin-console-contracts`, not from
  `@hamolus/console`. The console does not export the plugin shape so it does not have to
  carry the whole plugin chain; it is the other direction (plugin → contracts) that uses
  that package.
- Plugins do **not** store their data in collections, but in KV. There is no schema
  migration, and the data does not appear on the Collections screen.

## The one file that matters

```ts
// console.config.ts
import { defineConsoleConfig } from '@hamolus/types'
import { kanbanPlugin } from '@hamolus/plugin-console-kanban'
import { todoPlugin } from '@hamolus/plugin-console-todo'

export const config = defineConsoleConfig({
  plugins: [todoPlugin, kanbanPlugin],
})
```

Drop a plugin from that array and its row disappears; add one and it shows up. A plugin
package exports the finished descriptor — `id`, `name`, `description`, `component` — so
the id and the wording cannot drift from the plugin's own package, and the KV prefix the
plugin reads always matches the id the console registers.

`hamolus add plugin <name>` does exactly two things: declares the plugin package in
`package.json`, and appends one import plus one array element here. It never copies plugin
source into the project — vendored `.tsx` and `styles.stylex.ts` would only build if this
project added a Solid plugin and a StyleX compiler, which is the cost the compiled packages
exist to remove.

Each plugin's stylesheet rides along with its JavaScript, so nothing links it by hand and
`src/main.ts` still imports only the console's own CSS. The compiled rules point at the
console's `--bg`, `--surface`, `--text`, … variables, so overriding those still restyles
the plugins.

## Running it

```bash
cd examples/consoles/with-plugins
pnpm install
pnpm dev                       # http://localhost:5176
```

Then open the console, set the **API endpoint** in the navbar menu to `http://localhost:8787`,
and sign in. The core URL is deliberately not compiled into the bundle: one build can point
at a preview, staging, or production core, and that choice is remembered per browser.

## How these files were produced

```bash
pnpm hamolus create acme
cd acme
pnpm hamolus add console
pnpm hamolus add plugin todo
pnpm hamolus add plugin kanban
```

The result needed no trimming: the generated console lists both plugins in
`console.config.ts` and has nothing else to maintain. `src/` holds `main.ts` and nothing
else.

## Other notes

- Localization is deliberately **not** in `console.config.ts`: the language is configured in
  the core, the console reads it from `GET /_meta/localization`, and copying its list into
  the host only creates two places that can disagree with what the core validates.
- `console.config.ts` is strictly validated. An unknown key — including a leftover
  `localization` from an older template — fails at build time instead of being silently
  ignored, and a plugin entry missing `name`/`description`/`component` fails the same way.
- Two plugins cannot claim the same `id`. The console throws at mount, because a shared id
  would also mean a shared KV prefix and silently interleaved data.
- `packages/cli/scripts/check-plugin-config.mjs` pins all of the above: it loads the built
  plugin descriptors, checks the packaging that keeps the host dependency-free, and runs
  `hamolus add plugin` twice to prove the config it writes parses and stays byte-identical.
