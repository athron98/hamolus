/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Resolution of *source packages*.
 *
 * A generated console is not a hand-written app: it is the published
 * `@hamolus/console` package copied into the user's project and re-scoped. This
 * module finds that package, preferring what the user's project actually depends
 * on, and falling back to the Hamolus repository when the CLI runs from a
 * checkout.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { packageDirectoryInCheckout as packageDirectoryInCheckoutBase } from './link.js'
import { repositoryRootFromCli } from './templates.js'

export interface ResolvedSource {
  /** Directory containing the package's files. */
  directory: string
  /** Package name that was resolved, e.g. `@hamolus/console`. */
  package: string
  /** Version declared by the resolved package, when discoverable. */
  version?: string
  /** Human description of how it was found, for the CLI output. */
  origin: string
}

async function readVersion(directory: string): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      version?: string
    }
    return manifest.version
  } catch {
    return undefined
  }
}

/** Resolve an installed package directory from a project root, if present. */
function resolveFromProject(projectRoot: string, packageName: string): string | null {
  try {
    const require = createRequire(join(projectRoot, 'package.json'))
    const manifestPath = require.resolve(`${packageName}/package.json`)
    return dirname(manifestPath)
  } catch {
    return null
  }
}

/** Resolve an installed package directory from the CLI's own location. */
function resolveFromCli(packageName: string): string | null {
  try {
    const require = createRequire(import.meta.url)
    const manifestPath = require.resolve(`${packageName}/package.json`)
    return dirname(manifestPath)
  } catch {
    return null
  }
}

/**
 * Map a package's directory inside a Hamolus checkout.
 *
 * Delegates to {@link packageDirectoryInCheckout} so that a `link:` spec written into a
 * manifest and the directory the source is copied from can never disagree.
 */
function packageDirectoryInCheckout(checkoutRoot: string, packageName: string): string {
  return packageDirectoryInCheckoutBase(join(checkoutRoot, 'packages'), packageName)
}

/**
 * Find the source package for a generated part.
 *
 * Order:
 *   1. explicit `--source <path>`
 *   2. `--package <name>` resolved from the project, then from the CLI
 *   3. the default package (`@hamolus/console`) resolved from the project,
 *      then from the CLI
 *   4. the linked checkout (`hamolus.json`'s `link`), when the project is linked
 *   5. the Hamolus repository the CLI itself runs from
 *
 * Step 4 deliberately comes before step 5. When a project is linked, its dependencies point
 * into that checkout, so the copied source must come from the *same* tree — otherwise the
 * generated part would mix sources from one checkout with dependencies linked to another,
 * which produces baffling behaviour when the two differ.
 */
export async function resolveSource(options: {
  defaultPackage: string
  projectRoot: string
  explicitSource?: string
  explicitPackage?: string
  /** Checkout recorded in `hamolus.json`, if the project is linked. */
  linkRoot?: string
}): Promise<ResolvedSource> {
  const { defaultPackage, projectRoot, explicitSource, explicitPackage, linkRoot } = options
  const packageName = explicitPackage ?? defaultPackage

  if (explicitSource) {
    const directory = resolve(projectRoot, explicitSource)
    if (!existsSync(directory)) throw new Error(`Source directory not found: ${directory}`)
    return {
      directory,
      package: packageName,
      version: await readVersion(directory),
      origin: `--source ${explicitSource}`,
    }
  }

  const fromProject = resolveFromProject(projectRoot, packageName)
  if (fromProject) {
    return {
      directory: fromProject,
      package: packageName,
      version: await readVersion(fromProject),
      origin: `the ${packageName} installed in this project`,
    }
  }

  const fromCli = resolveFromCli(packageName)
  if (fromCli) {
    return {
      directory: fromCli,
      package: packageName,
      version: await readVersion(fromCli),
      origin: `the ${packageName} installed alongside the CLI`,
    }
  }

  if (linkRoot) {
    const linked = packageDirectoryInCheckout(linkRoot, packageName)
    if (existsSync(linked)) {
      return {
        directory: linked,
        package: packageName,
        version: await readVersion(linked),
        origin: `the checkout this project links (${linkRoot})`,
      }
    }
  }

  const local = packageDirectoryInCheckout(repositoryRootFromCli(), packageName)
  if (existsSync(local)) {
    return {
      directory: local,
      package: packageName,
      version: await readVersion(local),
      origin: 'the Hamolus repository',
    }
  }

  throw new Error(
    `Could not find the source package "${packageName}".\n` +
      `Install it in your project (pnpm add -D ${packageName}) or pass --source <path> ` +
      'with a directory that contains the console source.',
  )
}

/** A source package's own manifest, as far as the CLI cares about it. */
export interface SourceManifest {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  hamolus?: { copy?: string[]; exclude?: string[] }
  [key: string]: unknown
}

export async function readSourceManifest(directory: string): Promise<SourceManifest> {
  const manifestPath = join(directory, 'package.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Source directory has no package.json: ${directory}`)
  }
  return JSON.parse(await readFile(manifestPath, 'utf8')) as SourceManifest
}

/**
 * Resolve the published version of a package that a source package depends on
 * with the `workspace:` protocol.
 *
 * Inside this monorepo those dependencies are symlinks, so their real version is
 * readable from the source package's own `node_modules`. That version is what a
 * generated project should ask the registry for.
 */
export async function resolveWorkspaceDependencyVersion(
  sourceDirectory: string,
  packageName: string,
): Promise<string | undefined> {
  try {
    const require = createRequire(join(sourceDirectory, 'package.json'))
    const manifestPath = require.resolve(`${packageName}/package.json`)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { version?: string }
    return manifest.version
  } catch {
    return undefined
  }
}

/**
 * The fallback range for an `@hamolus/*` package whose real version cannot be discovered.
 *
 * The monorepo is still pre-release, so a generated project can ask for a version the
 * registry does not have yet. A caret range on the release that last shipped keeps such a
 * project installable, whereas `*` would silently accept any future major of an
 * unreleased package.
 *
 * **This is a map and not one constant** because the packages do not all version together:
 * the six core packages ship in lockstep, while the console plugins under
 * `packages/plugins/**` version independently. A single constant is a landmine the first
 * time a release leaves a plugin behind — every plugin would be handed a range for a
 * version it was never published at, and `pnpm install` would fail on a name the user
 * never typed. `pnpm check:package-versions` refuses to let this map drift from the
 * manifests, so the cost of keeping it honest is one command.
 *
 * A name that is missing here falls back to {@link DEFAULT_VERSION_RANGE}, which is the
 * right guess for a package added to this repository later but not yet to this table.
 */
export const FALLBACK_RANGES: Readonly<Record<string, string>> = {
  '@hamolus/cli': '^0.2.4',
  '@hamolus/console': '^0.2.4',
  '@hamolus/core': '^0.2.4',
  '@hamolus/mcp': '^0.2.4',
  '@hamolus/panel': '^0.2.4',
  '@hamolus/types': '^0.2.4',
  '@hamolus/plugin-console-contracts': '^0.1.0',
  '@hamolus/plugin-console-kanban': '^0.1.0',
  '@hamolus/plugin-console-todo': '^0.1.0',
}

/** What a package absent from {@link FALLBACK_RANGES} falls back to. */
export const DEFAULT_VERSION_RANGE = '^0.2.4'

/** Resolve the fallback range for one package name. */
export function fallbackRange(packageName: string): string {
  return FALLBACK_RANGES[packageName] ?? DEFAULT_VERSION_RANGE
}

/**
 * Rewrite a `workspace:` dependency onto a published version range.
 *
 * Generated projects live outside this monorepo, so a workspace protocol range
 * would break `pnpm install`. The `workspace:` suffix is a pnpm operator, not a
 * version, so `workspace:*` must become a concrete range — a bare caret on the
 * current release would be wrong, and appending the operator to nothing (`^*`) is
 * not even a valid range.
 *
 * `fallbackVersion` is the version discovered from the source package (see
 * {@link resolveWorkspaceDependencyVersion}); when it is missing,
 * {@link fallbackRange} keeps the generated project installable against a
 * package that has not been published yet.
 */
export function resolveDependencyRange(
  version: string | undefined,
  requested: string,
  fallbackVersion?: string,
  packageName?: string,
): string {
  if (!version || !version.startsWith('workspace:')) return requested

  const operator = version.slice('workspace:'.length).trim()
  const exact = operator === '*' || operator === '^' || operator === '~' ? '' : operator
  const resolved = exact || fallbackVersion || fallbackRange(packageName ?? '').replace(/^[\^~]/, '')

  // `workspace:1.2.3` means "exactly this version".
  return exact ? exact : `^${resolved.replace(/^[\^~]/, '')}`
}

