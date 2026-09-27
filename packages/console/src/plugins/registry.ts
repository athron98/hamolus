/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Console plugin registry.
 *
 * The registry is empty until a host hands it a list, and the list arrives in
 * `console.config.ts` — the one file the host owns:
 *
 * ```ts
 * export const config = defineConsoleConfig({ plugins: [todoPlugin, kanbanPlugin] })
 * ```
 *
 * That placement is not a preference. The console ships as a Vite bundle, so a
 * separate `src/plugins/registry.ts` inside the console would be a file a host
 * cannot reach: `hamolus add console` copies a shell, not the console sources, and
 * every attempt to hand-edit the bundled registry either gets overwritten on the
 * next `hamolus add` or does nothing at all. Config is the one thing a host is
 * expected to edit, so the plugin list lives there.
 *
 * `hamolus add plugin <name>` appends to that same array, and it writes *descriptors
 * it already has* — a plugin package exports its finished `ConsolePlugin`, so the CLI
 * adds one import plus one array element, and the id, name, and description can never
 * drift from the plugin's own wording.
 *
 * The state is a signal rather than a plain array because registration happens after
 * module evaluation: `mount()` calls {@link registerPlugins} while the component tree
 * below it is being created, and the sidebar, the `/plugins` screen, and a pinned
 * navbar shortcut all read the registry inside their own tracking scopes. A `const`
 * array would be frozen before the host config was ever read.
 */

import { createSignal } from 'solid-js'
import type { ConsoleConfigPlugin } from '@hamolus/types'
import type { ConsolePlugin } from './types'

export type { ConsolePlugin } from './types'

const [registry, setRegistry] = createSignal<ConsolePlugin[]>([])

/**
 * Narrow one validated config entry to the shape the console renders.
 *
 * `@hamolus/types` cannot type `component` as a Solid component — it is also loaded by
 * the core Worker, so it has no business depending on a browser framework — and it
 * validates it as "callable" instead. That check runs when the config is parsed, and
 * this repeats it so the cast below is backed by something at runtime: a host that
 * bypasses `defineConsoleConfig` (a cast, or a hand-built object handed to
 * `setConsoleConfig`) gets a named error here instead of a blank sidebar.
 */
function toConsolePlugin(plugin: ConsoleConfigPlugin): ConsolePlugin {
  if (typeof plugin.component !== 'function') {
    throw new Error(
      `@hamolus/console: plugin "${plugin.id}" has no component. It must be the page ` +
        'component a plugin package exports, reached through console.config.ts.',
    )
  }
  return { ...plugin, component: plugin.component as ConsolePlugin['component'] }
}

/**
 * Why one id can only appear once.
 *
 * Two plugins claiming the same id would share a KV prefix (`plugin:{land}:{id}:*`),
 * so the second page would read the first one's data. Silently keeping the last
 * registration would make the bug visible only as wrong data, so it throws at mount
 * time with the id in the message.
 */
function assertUniqueIds(plugins: readonly ConsoleConfigPlugin[]): void {
  const seen = new Set<string>()
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) {
      throw new Error(
        `@hamolus/console: two plugins claim the id "${plugin.id}". ` +
          'Plugin ids are snake_case and double as a KV prefix segment, so they must be unique.',
      )
    }
    seen.add(plugin.id)
  }
}

/**
 * Replace the registry with `plugins`.
 *
 * Called by `mount()` from the effective `console.config.ts`. Replacing rather than
 * appending is deliberate: a remount (Vite HMR in development) has to produce the
 * same result as the first mount, and an append would double every row in the
 * sidebar.
 */
export function registerPlugins(plugins: readonly ConsoleConfigPlugin[] = []): void {
  assertUniqueIds(plugins)
  // Sorted by id so the sidebar, the `/plugins` grid, and `/plugins/:name` all agree
  // on order without the host having to sort the config itself.
  setRegistry(
    plugins
      .map(toConsolePlugin)
      .sort((a, b) => a.id.localeCompare(b.id)),
  )
}

/** The registered plugins, in id order. Reactive. */
export function plugins(): ConsolePlugin[] {
  return registry()
}

/** Look up one plugin by id. Reactive. */
export function pluginById(id: string): ConsolePlugin | undefined {
  return registry().find((plugin) => plugin.id === id)
}
