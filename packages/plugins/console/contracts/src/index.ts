import type { Component } from 'solid-js'

/**
 * One entry read from a plugin's KV namespace (a `plugin:{land}:{plugin}:{key}`
 * value). `key` is the part past the plugin's prefix, so plugins work with
 * bare keys like `item:a1b2c3` or `board`.
 */
export interface PluginKvEntry {
  key: string
  value: unknown
}

/** The thin KV surface the console hands to every plugin page. */
export interface KvClient {
  /** List every stored entry under the plugin's prefix. */
  list(): Promise<PluginKvEntry[]>
  /** Read one entry; returns `null` when no such key exists. */
  get<T = unknown>(key: string): Promise<T | null>
  /** Write one entry. Values are persisted as JSON. */
  set(key: string, value: unknown): Promise<void>
  /** Delete one entry. */
  del(key: string): Promise<void>
}

/** Permission bits derived for the signed-in user. */
export interface PluginPermissions {
  /** `settings.write` — plugin data may be created/updated/deleted. */
  canWrite: boolean
}

/** A self-contained console plugin shipped from a separate workspace package. */
export interface ConsolePlugin {
  /** snake_case plugin id, also the KV prefix segment. */
  id: string
  name: string
  description: string
  icon?: string
  component: Component<PluginPageProps>
}

/** Props every plugin page receives. */
export interface PluginPageProps {
  plugin: ConsolePlugin
  kv: KvClient
  permissions: PluginPermissions
}

/**
 * Design tokens mirrored from the console (`index.css` custom properties).
 * Plugins reference these instead of importing console internals, so a plugin
 * package can never create a circular dependency with the host app.
 */
