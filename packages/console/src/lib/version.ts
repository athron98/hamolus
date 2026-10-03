/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

/**
 * The console's own version, for display only.
 *
 * It is stamped in at build time by both `vite.config.ts` and `vite.lib.config.ts`,
 * which read it off this package's manifest. That is the reason it lives here as a
 * literal rather than only in the Vite config: the library build inlines the value, so
 * a console consumed as `dist-lib/` cannot read its own `package.json` at runtime — the
 * host's bundler is what runs, and it never sees the manifest.
 *
 * The literal is therefore a *fallback*, checked by
 * `packages/cli/scripts/check-package-versions.mjs` against the lockstep version on
 * purpose. If the release bump misses either side, the check fails here instead of
 * shipping a footer that says one number while the injected one says another.
 *
 * A generated console does not edit this file; the published library is what it gets.
 */
export const FALLBACK_CONSOLE_VERSION = '0.2.15'

/**
 * Injected by Vite as `__CONSOLE_VERSION__`. Declared rather than reached for through
 * `import.meta.env` so a missing injection is a *type* error at build time instead of
 * `undefined` rendered in the sidebar.
 */
declare const __CONSOLE_VERSION__: string | undefined

/**
 * What the footer and the account popover show.
 *
 * The injected value wins, and the fallback only answers when it is absent — which
 * happens if a host compiles the console with its own Vite config that has no
 * `define`. Showing the fallback there is honest; showing nothing leaves an operator
 * with a blank cell they cannot tell apart from a bug.
 */
export const CONSOLE_VERSION: string = typeof __CONSOLE_VERSION__ === 'string'
  ? __CONSOLE_VERSION__
  : FALLBACK_CONSOLE_VERSION
