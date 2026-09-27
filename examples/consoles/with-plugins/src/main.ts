// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Mount the Hamolus console.
 *
 * That is the whole application: `@hamolus/console` brings its own UI, router, and
 * stylesheet, so this file stays plain TypeScript — no JSX, no Solid plugin, no component
 * tree to maintain here. The only thing left to decide is configuration:
 *
 *   console.config.ts       host-level preferences, including the plugin list
 *   Config → Users          credentials, in the console at runtime
 *   Config → Lands          which land the session uses
 *
 * The plugin list is in `console.config.ts`, so mounting is the only wiring there is:
 * `mount({ config })` registers whatever the config lists. There is no second registry
 * file to keep in sync, which is what makes the console work as a bundle — a registry
 * inside `@hamolus/console` is not a file this project could edit. The two plugin
 * stylesheets are imported nowhere either: each plugin package ships compiled and its
 * entry pulls in its own CSS, so listing a plugin here is genuinely all it takes.
 *
 * The core URL is not compiled into the bundle. The console is told where its API lives
 * through the endpoint menu in the navbar and remembers it per browser — so one build can
 * point at a preview, staging, or production core.
 */

import '@hamolus/console/style.css'
import { mount } from '@hamolus/console'
import { config } from '../console.config'

const instance = mount({ config })

// Vite HMR: swap the already-mounted app, do not stack a second instance on the same node.
if (import.meta.hot) {
  import.meta.hot.dispose(() => instance.unmount())
}
