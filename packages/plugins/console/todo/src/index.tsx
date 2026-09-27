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
import { TodoPage } from './TodoPage'

/**
 * The page component, for anyone who wants to render it directly.
 *
 * Prefer {@link todoPlugin} when registering: it is the whole descriptor, so the id
 * and the wording cannot drift from this package.
 */
export const TodoPlugin: Component<PluginPageProps> = TodoPage

/**
 * The plugin, ready to drop into `console.config.ts`.
 *
 * ```ts
 * import { todoPlugin } from '@hamolus/plugin-console-todo'
 * export const config = defineConsoleConfig({ plugins: [todoPlugin] })
 * ```
 *
 * Identity lives here rather than in the console, because the console is a bundle:
 * a host cannot edit a registry inside it, and a host that retyped the id in its own
 * config could disagree with the KV prefix this package writes to. The descriptor
 * also means `hamolus add plugin` only has to add one import and one array element.
 */
export const todoPlugin: ConsolePlugin = {
  id: 'todo',
  name: 'Todo list',
  description: 'Per-land todo list stored in KV, with priorities and filters.',
  component: TodoPlugin,
}

export default todoPlugin
