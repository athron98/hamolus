#!/usr/bin/env node
/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Copy the repository's `templates/` tree into the CLI package so a published
 * `@hamolus/cli` can generate cores, panels, configurations and seeds.
 *
 * `resolveTemplateDirectory` probes `<cliPackage>/templates/<suffix>` as its last
 * candidate, and `package.json#files` ships `templates`. Neither works without
 * this copy: the tree only exists at the repository root, so an installed CLI has
 * no `repositoryRootFromCli()` to fall back to and no templates to read. Runs from
 * `prepack`, so it is regenerated for every `pack`/`publish` and never committed.
 */
import { cp, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Walk up from the CLI package to the directory that owns the canonical tree.
 *
 * The walk starts at the CLI's parent, never at the CLI itself: `packages/cli/templates`
 * is this script's own output, so probing it would make the script its own source. The
 * first run copies the canonical tree in, the next run resolves that copy as the source,
 * removes the destination and then fails to copy out of a directory it just deleted —
 * which is why `pnpm pack` succeeded only on alternate runs.
 */
async function findRepositoryRoot(start) {
  let current = start
  for (;;) {
    try {
      if ((await stat(join(current, 'templates'))).isDirectory()) return current
    } catch {
      // keep walking
    }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const repositoryRoot = await findRepositoryRoot(dirname(cliRoot))
if (!repositoryRoot) {
  throw new Error(`No templates/ directory found at or above ${cliRoot}`)
}

const source = join(repositoryRoot, 'templates')
const destination = join(cliRoot, 'templates')

await rm(destination, { recursive: true, force: true })
await cp(source, destination, { recursive: true })

const count = (await readdir(destination, { recursive: true })).filter((entry) =>
  entry.includes('.'),
).length
console.log(
  `copied templates -> ${destination.replace(`${repositoryRoot}/`, '')} (${count} files)`,
)
