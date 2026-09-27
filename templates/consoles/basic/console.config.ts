// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Host-level configuration for the {{PROJECT_LABEL}} console.
 *
 * Imported by `src/main.ts` and bundled into the page, so a change here needs a
 * deploy. It is deliberately *small* and it is deliberately *not* where
 * localization lives.
 *
 * Localization is configured once, in the core — `core.config.ts`, or the
 * Configuration screen at runtime — and the console follows the core on its own: it
 * asks `GET /_meta/localization` (public, so it works before you sign in) and renders
 * its language switcher from the answer. That is deliberate. If the list also lived
 * here, adding a language would mean shipping a new console build as well as editing
 * the core, and the two could disagree — the core validates every localized record
 * against *its* list, so a stale console copy would offer a locale that then fails to
 * save.
 *
 * So use this file for what only the host knows: which plugins the console ships,
 * anything else that is a property of *this deployment* rather than of the project.
 * Anything genuinely per-core (name, nav, theme copy, locales) belongs in the core's
 * settings.
 *
 * The plugin list below is the whole plugin system. `hamolus add plugin <name>` adds
 * the plugin package to this console's `package.json`, writes an import between the
 * `imports` markers and an element inside the `plugins` array, and stops there. There
 * is no second file to edit, no plugin folder to create, and nothing inside the console
 * bundle for the CLI to reach. Add a plugin by hand just as well:
 *
 *   import { todoPlugin } from '@hamolus/plugin-console-todo'
 *   export const config = defineConsoleConfig({ plugins: [todoPlugin] })
 *
 * That is the entire installation because plugin packages ship compiled — JavaScript
 * and their own stylesheet. A console therefore needs no `vite-plugin-solid`, no StyleX
 * compiler, and no extra `import '...style.css'`: each plugin's stylesheet rides along
 * with its code, and overriding the console's `--bg`, `--surface`, `--text`, …
 * variables restyles the plugins too, because that is what their compiled rules point
 * at. The one thing to keep in mind is that a plugin is Solid code running inside this
 * console, so it is built against the console's own Solid instance.
 *
 * The object is validated strictly, so a typo — or a `localization` key left over
 * from an older template — fails here with a clear message instead of being ignored.
 */

import { defineConsoleConfig } from '@hamolus/types'
/* hamolus:plugins:imports:start */
/* hamolus:plugins:imports:end */

export const config = defineConsoleConfig({
  plugins: [
    /* hamolus:plugins:start */
    /* hamolus:plugins:end */
  ],
})

export default config
