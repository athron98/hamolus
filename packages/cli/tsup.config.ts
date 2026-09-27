/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Build the CLI into a single dependency-free ESM file.
 *
 * Zero runtime dependencies is a deliberate constraint, not an accident: the CLI is
 * what a user runs *before* they have a project, so it must install instantly and
 * never drag a dependency tree into someone's first command. Everything it needs
 * is in the standard library.
 */

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  // The CLI resolves templates relative to its own package root, so a few paths
  // are read at runtime and must survive the bundle.
  external: [],
})
