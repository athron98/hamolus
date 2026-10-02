/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import stylex from '@stylexjs/unplugin'

/** Read this package's own version off its manifest — one source, never restated. */
const manifestVersion = (): string =>
  (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

/**
 * Library build for `@hamolus/console`.
 *
 * The console is consumed as a *library* rather than as copied source: a generated
 * project installs the package, imports `mount()` from plain TypeScript and links
 * the stylesheet. That is what keeps `solid-js`, `lexical` and the StyleX compiler
 * from being duplicated — the host has no JSX and no `vite-plugin-solid` at all,
 * so there is exactly one Solid runtime and one compiled stylesheet.
 *
 * `vite.config.ts` builds the same code as a stock SPA for `pnpm dev` and the
 * monorepo's own deployment. The two builds share plugins deliberately: a library
 * built with different StyleX settings would ship styles the dev server never shows.
 *
 * Console plugin packages are built the same way, and that is the whole reason a host
 * can register a plugin from nothing but its `console.config.ts`: the plugin ships as
 * compiled JavaScript and CSS, so the host neither compiles JSX nor runs the StyleX
 * compiler, and never has to create a folder to vendor plugin source into.
 */
export default defineConfig({
  // Same injection as the SPA build, and it is *required* here rather than optional:
  // a generated console imports `dist-lib/index.js`, so this config is the last place
  // the version can be resolved from the manifest. Without it the host would render
  // the fallback literal for every console it ever installs.
  define: { __CONSOLE_VERSION__: JSON.stringify(manifestVersion()) },
  plugins: [
    // Order matters: StyleX must compile before the framework plugin transforms JSX.
    stylex.vite({
      useCSSLayers: true,
    }),
    solid(),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist-lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/lib.tsx',
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'index',
    },
    rollupOptions: {
      // Lexical and the TanStack query client are bundled: the host must not have to
      // resolve them. Solid is the deliberate exception — it has to stay shared.
      //
      // A plugin page is Solid code that runs inside *this* console's render tree, so
      // `createMemo`, `createSignal` and the JSX compiler all read module-level state
      // (the current Owner, the hydration context) from the Solid instance that is
      // executing. If the bundle carried its own copy of Solid, a plugin compiled
      // against the host's copy would run outside this console's reactive graph and
      // every `createMemo` inside it would be silently untracked. Leaving `solid-js`
      // external makes pnpm/Vite resolve one physical copy for the console and for
      // every plugin, which is what lets a plugin be plain prebuilt JavaScript.
      //
      // `solid-js` is a real `dependency` of this package, so it is installed for the
      // host automatically — a host still never imports it or names it in any file.
      // `solid-js/web` (the DOM renderer) holds the shared hydration/render state that
      // `solid-js` core reads, so it has to come from the same instance as core —
      // externalising core while inlining the renderer would split that state in two.
      external: ['@hamolus/types', 'solid-js', 'solid-js/web'],
    },
  },
})
