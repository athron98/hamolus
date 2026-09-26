/**
 * Console plugin registry.
 *
 * Plugins are opt-in: a console ships with an empty registry, so it carries no
 * plugin dependency until one is asked for. `hamolus add plugin <name>` adds the
 * dependency to package.json, writes an import above the array, and appends an
 * entry inside the array — both between the marker pairs below.
 *
 * The marker comments are part of the CLI contract — `hamolus add plugin` replaces
 * only the text between each pair, so keep their text byte-identical and keep the
 * entry markers *inside* the array literal.
 */

import type { ConsolePlugin } from './types'

export type { ConsolePlugin } from './types'

/* hamolus:plugins:imports:start */
/* hamolus:plugins:imports:end */

export const PLUGINS: ConsolePlugin[] = [
  /* hamolus:plugins:start */
  /* hamolus:plugins:end */
]

const byId = new Map<string, ConsolePlugin>(PLUGINS.map((plugin) => [plugin.id, plugin]))

export function pluginById(id: string): ConsolePlugin | undefined {
  return byId.get(id)
}
