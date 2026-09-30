/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `@hamolus/console` — the admin console, packaged as a library.
 *
 * The console is mounted rather than self-mounting so a host application owns the
 * DOM: `mount()` renders the whole app (router, query client, theming) into a
 * target element, and `unmount()` disposes of it. Solid and the editor runtimes
 * are bundled here on purpose — a host that pulls its own `solid-js` would get a
 * second copy and lose reactivity across the boundary.
 *
 * The host supplies nothing but a container and a stylesheet link; every other
 * concern (core URL, auth, locale, theme) is resolved at runtime from the core
 * that the host points it at.
 */

import { render } from 'solid-js/web'
import type { JSX } from 'solid-js'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Route, Router } from '@solidjs/router'
import { App } from './App'
import { DashboardPage } from './pages/Dashboard'
import { CollectionsPage } from './pages/Collections'
import { CollectionPage } from './pages/CollectionPage'
import { MediaPage } from './pages/Media'
import { DocumentsPage } from './pages/Documents'
import AttachmentsPage from './pages/AttachmentsPage'
import { UsersPage } from './pages/Users'
import { ConfigPage } from './pages/Config'
import { UniversePage } from './pages/Universe'
import { McpPage } from './pages/Mcp'
import { SeedPage } from './pages/Seed'
import { PluginsPage } from './pages/Plugins'
import { PluginPage } from './pages/PluginPage'
import { PanelsPage } from './pages/Panels'
import { PanelDetailPage } from './pages/PanelDetail'
import type { ConsoleConfigOptions } from '@hamolus/types'
import { getConsoleConfig, setConsoleConfig } from './config'
import { registerPlugins } from './plugins/registry'
import './index.css'

export interface MountOptions {
  /**
   * Element the console renders into. Defaults to the `#root` element the shipped
   * `index.html` provides, so a host that uses the stock shell needs no argument.
   */
  target?: HTMLElement | null
  /**
   * Values layered over the bundled defaults — the same shape as `console.config.ts`.
   * `plugins` is the only key today, and the schema is `strict()`, so an unknown key
   * such as `defaultLocale` is a thrown error rather than a silently ignored extra.
   * Locale comes from the core at runtime instead; see `useLocalization()`.
   *
   * This is also how plugins arrive. A host that wants the todo plugin lists it in
   * `console.config.ts` and nothing else changes: there is no second registry file to
   * edit, because the console ships as a bundle and a file inside it is not the
   * host's to modify.
   */
  config?: ConsoleConfigOptions
}

export interface Console {
  unmount(): void
}

function routes(): JSX.Element {
  return (
    <>
      <Route path="/" component={DashboardPage} />
      <Route path="/collections" component={CollectionsPage} />
      <Route path="/media" component={MediaPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/attachments" component={AttachmentsPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/config" component={ConfigPage} />
      <Route path="/universe" component={UniversePage} />
      <Route path="/mcp" component={McpPage} />
      <Route path="/seed" component={SeedPage} />
      <Route path="/plugins" component={PluginsPage} />
      <Route path="/plugins/:name" component={PluginPage} />
      <Route path="/panels" component={PanelsPage} />
      <Route path="/panels/:id" component={PanelDetailPage} />
      <Route path="/collections/:collection" component={CollectionPage} />
    </>
  )
}

/**
 * Render the console and return a handle to tear it down again.
 *
 * Mounting twice into the same element is a no-op-ish mistake, so the second call
 * returns the existing instance rather than stacking two routers on one node.
 */
let mounted: { target: HTMLElement; console: Console } | null = null

export function mount(options: MountOptions = {}): Console {
  const target = options.target ?? document.getElementById('root')
  if (!target) {
    throw new Error(
      '@hamolus/console: mount() found no target element. ' +
        'Add <div id="root"></div> to the page, or pass { target } explicitly.',
    )
  }
  if (mounted?.target === target) return mounted.console

  if (options.config) setConsoleConfig(options.config)

  // Registration happens before the tree is built, so the sidebar, the `/plugins`
  // screen, and any pinned shortcut all read a registry that is already populated on
  // their first render. The list comes from the effective config rather than from
  // `options.config` directly, so a host that called `setConsoleConfig()` before
  // `mount()` is honoured too.
  registerPlugins(getConsoleConfig().plugins)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })

  const dispose = render(
    () => (
      <QueryClientProvider client={queryClient}>
        <Router root={(props) => <App>{props.children}</App>}>{routes()}</Router>
      </QueryClientProvider>
    ),
    target,
  )

  const handle: Console = {
    unmount() {
      dispose()
      queryClient.clear()
      if (mounted?.target === target) mounted = null
    },
  }

  mounted = { target, console: handle }
  return handle
}

export default { mount }
