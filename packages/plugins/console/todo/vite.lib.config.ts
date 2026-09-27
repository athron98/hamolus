/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'
import stylex from '@stylexjs/unplugin'

/**
 * Makes a host pick up this plugin's stylesheet without being told to.
 *
 * Vite only bundles CSS that something imports. A host that registers this plugin does
 * nothing but list it in `console.config.ts` — it never writes `import '...style.css'`
 * anywhere — so the stylesheet would be built here and then silently dropped on the
 * floor. Rewriting the entry chunk to import the emitted file is what closes that gap:
 * the host's own build then follows the import and includes the CSS, exactly as it
 * would for any other dependency.
 *
 * The path is relative to the chunk, and the chunk is emitted next to the CSS, so it
 * resolves the same whether the host consumes this package from `node_modules` or from
 * a `file:` link.
 */
function importOwnStylesheet(fileName: string): Plugin {
  return {
    name: 'hamolus-import-own-stylesheet',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.isEntry) {
          output.code = `import './${fileName}';\n${output.code}`
          return
        }
      }
      throw new Error(`hamolus-import-own-stylesheet: no entry chunk found in ${fileName}`)
    },
  }
}

/**
 * Library build for `@hamolus/plugin-console-todo`.
 *
 * A console plugin is consumed as a *built package*, not as copied source. That is what
 * lets a host register a plugin from nothing but `console.config.ts`: it installs the
 * package, names the descriptor, and is done. No folder to create, no JSX to compile, no
 * StyleX compiler in the host, and no second stylesheet to remember to link.
 *
 * The trade-off is that StyleX and SolidJS are compiled *here* rather than in each host.
 * That is safe for both:
 *
 * - StyleX tokens resolve to CSS custom properties (`var(--bg)`) that `@hamolus/console`
 *   already declares in its own stylesheet, so a host that themes the console by
 *   overriding those variables still restyles this plugin.
 * - `solid-js` stays external so the plugin runs on the exact same Solid instance the
 *   console renders with. A second copy would put every `createMemo` in the plugin
 *   outside the console's reactive graph, where it would never be tracked.
 */
export default defineConfig({
  plugins: [
    // Order matters: StyleX must compile before the framework plugin transforms JSX.
    stylex.vite({
      useCSSLayers: true,
    }),
    solid(),
    importOwnStylesheet('index.css'),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'index',
    },
    rollupOptions: {
      // The contracts package root is type-only, so leaving it external costs a host
      // nothing. Its `styles.stylex.ts` subpath is a different specifier and is
      // deliberately *not* matched here: that file has to be compiled into this bundle
      // so the plugin ships finished CSS instead of pushing StyleX onto the host.
      external: ['solid-js', 'solid-js/web', '@hamolus/types', '@hamolus/plugin-console-contracts'],
    },
  },
})
