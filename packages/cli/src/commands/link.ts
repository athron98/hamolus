/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus link <path> | --clear` — point a project's `@hamolus/*` dependencies at a
 * local Hamolus checkout.
 *
 * Generated projects normally install the published packages. This command switches every
 * workspace member's manifest between that and a pnpm `link:` spec, which is what you want
 * while the packages are still in development — including when generating this monorepo's
 * own `examples/`, where the examples must exercise the working tree.
 *
 * It walks the project's known parts rather than the whole directory tree: the manifests it
 * can legitimately touch are the ones the CLI generated, and globbing the tree would happily
 * rewrite a dependency inside `node_modules`.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import {
  LINKABLE_PACKAGES,
  linkManifestFile,
  packageDirectoryInCheckout,
  packageName,
  resolveLinkRoot,
} from '../link.js'
import { readProject, requireProjectRoot, writeProject, type Project } from '../project.js'
import { dim, info, next, step, success } from '../util/log.js'

interface ManifestShape {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * Put a previously-linked manifest back on registry ranges.
 *
 * The link spec is the only thing this knows how to undo, and the version it restores is
 * the package's own version in the checkout — which is exactly the range a published install
 * would have asked for, so this is a faithful inverse rather than a guess.
 */
function unlink(manifest: ManifestShape, versions: Map<string, string>): string[] {
  const changed: string[] = []

  for (const field of ['dependencies', 'devDependencies'] as const) {
    const current = manifest[field]
    if (!current) continue

    for (const name of Object.keys(current)) {
      const spec = current[name]
      if (!spec?.startsWith('link:')) continue
      const version = versions.get(name)
      if (!version) continue
      current[name] = `^${version.replace(/^[\^~]/, '')}`
      changed.push(`${name}@^${version}`)
    }

    if (changed.length) manifest[field] = current
  }

  return changed
}

/**
 * Read `version` out of every linkable package in the checkout.
 *
 * The list and the directory layout both come from `link.ts` rather than being repeated
 * here. That duplication is what left `--clear` half-done: the console plugins are nested
 * two levels deep, so a flat `packages/<name>` guess found no manifest for them, the
 * version map had no entry, and `unlink` skipped the dependency it was asked to restore —
 * the project kept a `link:` spec pointing at a checkout after the link was supposedly
 * cleared.
 */
async function readCheckoutVersions(packages: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>()
  for (const short of LINKABLE_PACKAGES) {
    try {
      const raw = await readFile(
        join(packageDirectoryInCheckout(packages, short), 'package.json'),
        'utf8',
      )
      const version = (JSON.parse(raw) as { version?: string }).version
      if (version) versions.set(packageName(short), version)
    } catch {
      // A checkout missing an optional package is fine: only the deps actually
      // referenced by the project get a range back, and those are the ones present.
    }
  }
  return versions
}

/**
 * Every manifest that may hold a `@hamolus/*` dependency, project root first.
 *
 * Parts alone are not enough: `hamolus add panel` records the panel runtime in the *root*
 * devDependencies, so linking or clearing only the parts would leave the root pointing at
 * the registry (breaking an install for unpublished packages) or at a checkout (breaking
 * `--clear`).
 */
function manifestPaths(projectRoot: string, project: Project): string[] {
  const paths = [join(projectRoot, 'package.json')]
  for (const part of project.parts) paths.push(join(projectRoot, part.path, 'package.json'))
  return paths
}

/** Human label for a manifest in CLI output: `.` for the root, else the part path. */
function labelFor(projectRoot: string, manifestPath: string): string {
  return manifestPath === join(projectRoot, 'package.json') ? '(root)' : relative(projectRoot, dirname(manifestPath))
}

export async function runLink(args: ParsedArgs): Promise<void> {
  const projectRoot = await requireProjectRoot(process.cwd())
  const project = await readProject(projectRoot)
  if (!project) throw new Error(`Could not read the project file in ${projectRoot}.`)

  const clearing = Boolean(args.flags.clear)
  const target = args.positionals[0] ?? args.options.link

  if (clearing) {
    const link = project.link ? await resolveLinkRoot(project.link) : undefined
    if (!link) {
      info('This project is not linked.')
      next(['pnpm install'])
      return
    }

    const versions = await readCheckoutVersions(link.packages)
    let total = 0
    // The project root is not a recorded part, but `hamolus add panel` puts the panel
    // runtime in the root's devDependencies, so a root manifest left holding a `link:`
    // spec would keep the project half-unlinked after `--clear`.
    for (const manifestPath of manifestPaths(projectRoot, project)) {
      let manifest: ManifestShape
      try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestShape
      } catch {
        continue
      }
      const changed = unlink(manifest, versions)
      if (!changed.length) continue
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      total += changed.length
      step(`${dim(labelFor(projectRoot, manifestPath))} ${changed.length} restored`)
    }

    delete project.link
    await writeProject(projectRoot, project)
    success(`Unlinked ${total} dependenc${total === 1 ? 'y' : 'ies'} back to the registry`)
    next(['pnpm install'])
    return
  }

  if (!target) {
    throw new Error(
      'Missing checkout path. Usage: hamolus link <path-to-hamolus>\n' +
        '       or: hamolus link --clear',
    )
  }

  const link = await resolveLinkRoot(target)
  if (!link) throw new Error('No link target given.')

  let total = 0
  for (const manifestPath of manifestPaths(projectRoot, project)) {
    const applied = await linkManifestFile(manifestPath, link)
    if (!applied.length) continue
    total += applied.length
    step(`${dim(labelFor(projectRoot, manifestPath))} ${applied.length} linked`)
    for (const spec of applied) info(`  ${spec}`)
  }

  project.link = link.root
  await writeProject(projectRoot, project)

  if (total === 0) {
    info('No manifests referenced @hamolus/* — nothing to change.')
  }
  success(`Linked ${total} dependenc${total === 1 ? 'y' : 'ies'} to ${link.packages}`)
  next(['pnpm install'])
}
