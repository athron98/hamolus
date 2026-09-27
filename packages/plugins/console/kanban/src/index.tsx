/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import './index.css'
import type { Component } from 'solid-js'
import type { ConsolePlugin, PluginPageProps } from '@hamolus/plugin-console-contracts'
import { KanbanPage } from './KanbanPage'

/**
 * The page component, for anyone who wants to render it directly.
 *
 * Prefer {@link kanbanPlugin} when registering — see the note in the todo plugin.
 */
export const KanbanPlugin: Component<PluginPageProps> = KanbanPage

/**
 * The plugin, ready to drop into `console.config.ts`.
 *
 * ```ts
 * import { kanbanPlugin } from '@hamolus/plugin-console-kanban'
 * export const config = defineConsoleConfig({ plugins: [kanbanPlugin] })
 * ```
 *
 * The board is one KV document per land, so there is no id collision with the todo
 * plugin: the two read `plugin:{land}:board` and `plugin:{land}:todo:*`.
 */
export const kanbanPlugin: ConsolePlugin = {
  id: 'kanban',
  name: 'Kanban board',
  description: 'Drag-and-drop kanban board stored as a single KV document.',
  component: KanbanPlugin,
}

export default kanbanPlugin
