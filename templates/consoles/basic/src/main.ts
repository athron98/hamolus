// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Mount the Hamolus console.
 *
 * This is the whole application: `@hamolus/console` ships the UI, the router and
 * the stylesheet, so the file stays plain TypeScript — no JSX, no Solid plugin, no
 * component tree to maintain here. Everything you can change is a config decision:
 *
 *   console.config.ts        build-time preferences (locale fallback)
 *   Config → Users           credentials, in the console at runtime
 *   Config → Lands/Colonies  which land a session works in
 *
 * The core URL is not compiled in. The console is told where the API is from the
 * navbar (API endpoint menu) and remembers it per browser, so one build can point
 * at a preview, staging or production core.
 */

import '@hamolus/console/style.css'
import { mount } from '@hamolus/console'
import { config } from '../console.config'

const instance = mount({ config })

// Vite HMR: replace the mounted app instead of stacking a second one on the node.
if (import.meta.hot) {
  import.meta.hot.dispose(() => instance.unmount())
}
