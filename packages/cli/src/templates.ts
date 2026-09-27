/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Template resolution and copying.
 *
 * A "template" is an ordinary directory of files with `{{TOKEN}}` placeholders.
 * The CLI resolves a template directory (see {@link resolveTemplateDirectory}),
 * substitutes tokens, and copies the result into place.
 *
 * Resolution order for templates:
 *   1. an explicit `--template <path>`
 *   2. `<cwd>/templates` (running inside the Hamolus repo)
 *   3. the nearest ancestor directory containing `templates/`
 *   4. the copy bundled inside the installed `@hamolus/cli` package
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Directory names never copied from a template. */
const SKIPPED_ENTRIES = new Set([
  'node_modules',
  'dist',
  'build',
  '.turbo',
  '.vite',
  '.next',
  '.astro',
  '.wrangler',
  '.git',
  '.DS_Store',
  'tsconfig.tsbuildinfo',
])

const cliDirectory = dirname(fileURLToPath(import.meta.url))
const cliPackageDirectory = resolve(cliDirectory, '..')

export function repositoryRootFromCli(): string {
  // <repo>/packages/cli/dist -> <repo>
  return resolve(cliPackageDirectory, '..', '..')
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Find the nearest ancestor of `start` that contains a `templates` directory. */
export function findTemplatesUpwards(start: string): string | null {
  let current = resolve(start)
  for (;;) {
    const candidate = join(current, 'templates')
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

export interface ResolvedTemplate {
  /** Directory the template files are read from. */
  directory: string
  /** Human description of where it came from, for the CLI output. */
  origin: string
}

export async function resolveTemplateDirectory(
  explicit: string | undefined,
  cwd: string,
  /** Sub-path inside `templates/`, e.g. `cores/independent`. */
  relative: string,
): Promise<ResolvedTemplate | null> {
  const suffix = relative ? join(relative) : ''

  if (explicit) {
    // An explicit template *is* the template. Appending the kind sub-path would
    // turn `--template ./my-core` into `./my-core/cores/independent`, which is
    // never what the user meant. Pass the full path to override one kind only.
    const directory = resolve(cwd, explicit)
    if (!(await isDirectory(directory))) {
      throw new Error(`Template directory not found: ${directory}`)
    }
    return { directory, origin: `--template ${explicit}` }
  }

  const candidates: Array<{ directory: string; origin: string }> = [
    { directory: join(cwd, 'templates', suffix), origin: 'the current directory' },
  ]

  const upwards = findTemplatesUpwards(cwd)
  if (upwards) {
    candidates.push({ directory: join(upwards, suffix), origin: 'the surrounding Hamolus repository' })
  }

  const repositoryRoot = repositoryRootFromCli()
  candidates.push({
    directory: join(repositoryRoot, 'templates', suffix),
    origin: 'the Hamolus repository',
  })

  candidates.push({
    directory: join(cliPackageDirectory, 'templates', suffix),
    origin: 'the installed @hamolus/cli package',
  })

  for (const candidate of candidates) {
    if (suffix ? await isDirectory(candidate.directory) : existsSync(candidate.directory)) {
      if (suffix) return candidate
    }
  }

  return null
}

/** Replace every `{{TOKEN}}` occurrence in `value`. */
export function applyTokens(value: string, tokens: Record<string, string>): string {
  return value.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name: string) => tokens[name] ?? match)
}

/**
 * Token names still present in `value` after substitution.
 *
 * `applyTokens` leaves an unknown name untouched, so a template that spells a token
 * the command does not supply would otherwise be copied verbatim — the generated
 * project would carry a literal `{{TOKEN}}` and fail much later, somewhere far from
 * the template that caused it. Callers use this to fail at the copy site instead,
 * naming the file and the token.
 */
export function unresolvedTokens(value: string): string[] {
  const names = [...value.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
  return [...new Set(names)]
}

/** Files whose names also get token substitution. */
const NAME_TOKENS = /\.(ts|tsx|json|jsonc|md|css|html|mjs|js|yml|yaml)$/

function substituteName(name: string, tokens: Record<string, string>): string {
  if (!NAME_TOKENS.test(name)) return name
  return applyTokens(name, tokens)
}

export interface CopyResult {
  /** Number of files written. */
  files: number
  /** Paths (relative to the destination) that were created or overwritten. */
  written: string[]
}

/**
 * Copy a template directory into `destination`, substituting tokens.
 *
 * On any failure the partially written destination is removed so a failed run
 * never leaves a half-generated app behind.
 */
export async function copyTemplate(
  source: string,
  destination: string,
  tokens: Record<string, string>,
  options: { force?: boolean; dryRun?: boolean } = {},
): Promise<CopyResult> {
  const result: CopyResult = { files: 0, written: [] }

  if (!options.dryRun) {
    if (existsSync(destination)) {
      if (!options.force) {
        throw new Error(`Refusing to overwrite existing path: ${destination} (use --force)`)
      }
      await rm(destination, { recursive: true, force: true })
    }
    await mkdir(destination, { recursive: true })
  }

  const walk = async (from: string, to: string): Promise<void> => {
    const entries = await readdir(from, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIPPED_ENTRIES.has(entry.name)) continue
      const fromPath = join(from, entry.name)
      const toPath = join(to, substituteName(entry.name, tokens))
      if (entry.isDirectory()) {
        if (!options.dryRun) await mkdir(toPath, { recursive: true })
        await walk(fromPath, toPath)
        continue
      }
      if (!entry.isFile()) continue
      const contents = await readFile(fromPath, 'utf8')
      const rendered = applyTokens(contents, tokens)
      const unresolved = unresolvedTokens(rendered)
      if (unresolved.length > 0) {
        const names = unresolved.map((name) => `{{${name}}}`).join(', ')
        throw new Error(
          `Unresolved template token${unresolved.length > 1 ? 's' : ''} in ${fromPath}: ${names}. ` +
            'The template uses a token this command does not supply.',
        )
      }
      if (!options.dryRun) {
        await mkdir(dirname(toPath), { recursive: true })
        await writeFile(toPath, rendered, 'utf8')
      }
      result.files += 1
      result.written.push(toPath)
    }
  }

  try {
    await walk(source, destination)
  } catch (error) {
    if (!options.dryRun) await rm(destination, { recursive: true, force: true })
    throw error
  }

  return result
}

/**
 * Copy a directory verbatim (no token substitution).
 *
 * Used when the source is a published package such as `@hamolus/console`, whose
 * files are real code rather than a template.
 *
 * `entries` restricts the copy to specific top-level files and directories; a
 * package can declare what a consumer needs through a `hamolus.copy` list in its
 * manifest, so a generated app never inherits the publisher's own build scripts.
 */
export async function copySource(
  source: string,
  destination: string,
  options: { force?: boolean; dryRun?: boolean; entries?: string[] } = {},
): Promise<CopyResult> {
  const { entries } = options
  const result: CopyResult = { files: 0, written: [] }

  if (!options.dryRun) {
    if (existsSync(destination)) {
      if (!options.force) {
        throw new Error(`Refusing to overwrite existing path: ${destination} (use --force)`)
      }
      await rm(destination, { recursive: true, force: true })
    }
    await mkdir(destination, { recursive: true })

    if (!entries) {
      await cp(source, destination, {
        recursive: true,
        filter: (path) => !SKIPPED_ENTRIES.has(path.split('/').pop() ?? ''),
      })
    } else {
      for (const entry of entries) {
        if (SKIPPED_ENTRIES.has(entry)) continue
        const from = join(source, entry)
        if (!existsSync(from)) continue
        const to = join(destination, entry)
        await cp(from, to, {
          recursive: true,
          filter: (path) => !SKIPPED_ENTRIES.has(path.split('/').pop() ?? ''),
        })
      }
    }
  }

  const listed = entries ?? (await readdir(source, { withFileTypes: true })).map((entry) => entry.name)
  for (const entry of listed) {
    if (SKIPPED_ENTRIES.has(entry)) continue
    result.files += 1
    result.written.push(join(destination, entry))
  }
  return result
}

/** Turn `shop_ops` into `Shop Ops`. */
export function formatLabel(snakeCase: string): string {
  return snakeCase
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
