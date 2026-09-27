// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Host-level configuration for this console.
 *
 * This file is deliberately **small** and deliberately **not** where localization lives.
 *
 * Localization is configured once, in the core — `core.config.ts`, or the Configuration
 * screen at runtime — and the console follows the core on its own: it asks
 * `GET /_meta/localization` (public, so it still answers before login) and builds its
 * language picker from that reply. Copying the language list here as well would mean
 * adding a language means editing the core *and* rebuilding the console, and the two
 * could disagree — while the core validates every localized record against its own list,
 * so a stale copy would offer a locale that fails on save.
 *
 * What legitimately belongs in this file is what only the host knows: which plugins ship
 * with it, which endpoint it offers first. A leftover `localization` key from an older
 * template fails validation here instead of being silently ignored.
 *
 * **The plugin list is the whole plugin system.** `mount({ config })` reads
 * `plugins` and hands it to the console, which registers them before the first render:
 * they appear under `/plugins` and as rows in the sidebar's Plugins group. There is no
 * second file to edit, and nothing inside the console bundle for anything to rewrite —
 * the console is a Vite bundle, so a registry file inside it is not the host's to change.
 *
 * Adding a plugin is one import and one array element, and that is the entire
 * installation. The packages ship compiled — JavaScript plus their own stylesheet — so
 * there is no plugin folder to create, no JSX to compile, no StyleX compiler to add to
 * `vite.config.ts`, and no extra stylesheet to link in `src/main.ts`. Each plugin's CSS
 * rides along with its JavaScript, and a host that themes the console by overriding the
 * `--bg`, `--surface`, `--text`, … variables restyles the plugins too, because that is
 * what the compiled rules point at.
 *
 * `hamolus add plugin <name>` appends to exactly this array. Add one by hand just as
 * well: import a plugin package's descriptor and list it. A plugin exports the finished
 * descriptor (`id`, `name`, `description`, `component`), so the id and the wording can
 * never drift from the plugin's own package.
 */

import { defineConsoleConfig } from '@hamolus/types'
import { kanbanPlugin } from '@hamolus/plugin-console-kanban'
import { todoPlugin } from '@hamolus/plugin-console-todo'

export const config = defineConsoleConfig({
  plugins: [
    todoPlugin,
    kanbanPlugin,
  ],
})

export default config
