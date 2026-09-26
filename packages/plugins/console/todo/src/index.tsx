import type { Component } from 'solid-js'
import type { PluginPageProps } from '@hamolus/plugin-console-contracts'
import { TodoPage } from './TodoPage'

/**
 * The console renders this component directly. Plugin identity (`id`, `name`,
 * `description`, `icon`) lives in the console's own registry entry, which
 * `hamolus add plugin` writes — so the package ships only the page, and the host
 * hands the finished descriptor back through `props.plugin`.
 */
export const TodoPlugin: Component<PluginPageProps> = TodoPage

export default TodoPlugin
