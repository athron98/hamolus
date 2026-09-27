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
 * Stable binary entrypoint.
 *
 * This shim exists so the published package works whether the user installed it
 * globally, ran it from a project, or is executing it straight out of a git
 * checkout. It prefers the built bundle and falls back to running the TypeScript
 * sources directly on Node 22+, so a contributor can try a change without a build
 * step.
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')
const bundle = join(packageRoot, 'dist', 'cli.js')

async function main() {
  if (existsSync(bundle)) {
    const { run } = await import(pathToFileURL(bundle).href)
    process.exitCode = await run(process.argv.slice(2))
    return
  }

  // Not built: run the sources directly when the runtime can strip types.
  const source = join(packageRoot, 'src', 'cli.ts')
  if (existsSync(source)) {
    const [major] = process.versions.node.split('.').map(Number)
    if ((major ?? 0) >= 22) {
      const { run } = await import(pathToFileURL(source).href)
      process.exitCode = await run(process.argv.slice(2))
      return
    }
    console.error(
      'hamolus: dist/ is missing and this Node version cannot run TypeScript directly.\n' +
        '  Node 22+ : run `pnpm -F @hamolus/cli build` in the repo, or use the published package.\n' +
        `  Found: Node ${process.versions.node}`,
    )
    process.exitCode = 1
    return
  }

  console.error('hamolus: could not locate dist/cli.js or src/cli.ts — the package looks incomplete.')
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`hamolus: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
