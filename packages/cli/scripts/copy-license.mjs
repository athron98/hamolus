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
 * Copy the repository's `LICENSE` into every package that gets published.
 *
 * Every published manifest already lists `LICENSE` in `package.json#files`, but
 * no package directory contains one: the only `LICENSE` in the repository sits at
 * the root, and a published tarball never sees the repository. The entry was
 * therefore a promise nothing kept — `npm pack` silently shipped a package whose
 * `license` field said MIT while the license text itself was missing, which is
 * exactly what the MIT terms ask to be preserved with every copy.
 *
 * Same approach as `copy-templates.mjs`: run from `prepack`, copy on the way
 * out, and never commit the copy. `LICENSE` is therefore listed in `.gitignore`
 * — a committed per-package copy would be nine files that have to be kept in
 * step with the root by hand, and a forgotten one would ship a stale year or
 * holder name.
 */
import { copyFile, readFile, rm } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES = resolve(HERE, '..', '..')

/**
 * Walk up to the directory that owns the canonical `LICENSE`.
 *
 * `packages/cli` sits two levels below the repository root, so the walk starts
 * at the CLI package itself — unlike `copy-templates.mjs`, which starts one level
 * up because `packages/cli/templates` is its own destination and must not be
 * mistaken for the source.
 */
async function findRepositoryRoot(start) {
  let current = start
  for (;;) {
    try {
      if (existsSync(join(current, 'LICENSE')) && existsSync(join(current, 'pnpm-workspace.yaml'))) {
        return current
      }
    } catch {
      // keep walking
    }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const repositoryRoot = await findRepositoryRoot(HERE)
if (!repositoryRoot) {
  throw new Error(`No repository root (LICENSE + pnpm-workspace.yaml) found at or above ${HERE}`)
}

const source = join(repositoryRoot, 'LICENSE')

/** Every workspace package, at any depth (one or two levels under `packages`). */
function manifests(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    if (existsSync(join(full, 'package.json'))) out.push(full)
    else manifests(full, out)
  }
  return out
}

let copied = 0
for (const dir of manifests(join(repositoryRoot, 'packages'))) {
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  if (manifest.private === true) continue
  // Only packages that declare it in `files` should gain the file; a package that
  // does not ship the license has opted out, and writing the file anyway would
  // put an unlisted file in the tarball.
  if (!Array.isArray(manifest.files) || !manifest.files.includes('LICENSE')) {
    console.warn(`skip  ${manifest.name} — "files" does not list LICENSE`)
    continue
  }
  await rm(join(dir, 'LICENSE'), { force: true })
  await copyFile(source, join(dir, 'LICENSE'))
  copied += 1
  console.log(`copied LICENSE -> ${relative(repositoryRoot, join(dir, 'LICENSE'))} (${manifest.name})`)
}

console.log(`\n${copied} package(s) licensed`)
