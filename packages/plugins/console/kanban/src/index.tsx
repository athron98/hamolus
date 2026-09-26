import type { Component } from 'solid-js'
import type { PluginPageProps } from '@hamolus/plugin-console-contracts'
import { KanbanPage } from './KanbanPage'

/** See the note in the todo plugin: identity lives in the console registry. */
export const KanbanPlugin: Component<PluginPageProps> = KanbanPage

export default KanbanPlugin
