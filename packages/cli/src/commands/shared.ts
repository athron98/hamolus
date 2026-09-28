/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Shared plumbing for the `hamolus add …` commands.
 *
 * Every `add` follows the same shape: resolve the project, decide the
 * destination, refuse to clobber an existing part unless asked, copy files, then
 * record the result in `hamolus.json` and update the pnpm workspace globs. Keeping
 * that in one place is what makes the six `add` targets behave consistently.
 */

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { resolveLinkRoot, linkManifestFile, type LinkRoot } from '../link.js'
import {
  findPart,
  recordPart,
  requireProjectRoot,
  readProject,
  writeProject,
  type PartKind,
  type Project,
} from '../project.js'
import { copySource, copyTemplate, formatLabel, type ResolvedTemplate } from '../templates.js'
import { dim, info, next, step, success, warn } from '../util/log.js'

/**
 * A part name, as `hamolus add <target> <name>` takes it.
 *
 * Named for what it accepts rather than what it resembles on purpose: a *project* name is
 * looser (`create` allows hyphens and caps it at 63), so a constant called
 * `PROJECT_NAME_PATTERN` sitting next to the wizard's own hyphen-allowing copy of the
 * project pattern is an easy way to validate the wrong one. Part ids end up in package
 * names, npm filters and directory names, which is why they are `snake_case` and capped
 * at 64.
 */
export const PART_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/

export interface AddContext {
  project: Project
  projectRoot: string
  args: ParsedArgs
  dryRun: boolean
  force: boolean
  /**
   * Checkout to link `@hamolus/*` into, resolved from `--link` or from the
   * project's recorded `link`. `undefined` means "install from the registry".
   */
  link?: LinkRoot
}

export async function openContext(args: ParsedArgs): Promise<AddContext> {
  const projectRoot = await requireProjectRoot(process.cwd())
  const project = await readProject(projectRoot)
  if (!project) throw new Error(`Could not read the project file in ${projectRoot}.`)

  // A per-command `--link` wins over what the project recorded at create time, so a
  // project generated against npm can be pointed at a checkout without being
  // recreated, and the new choice is persisted below.
  const target = args.options.link ?? project.link
  const link = await resolveLinkRoot(target)
  if (link && target !== project.link) {
    project.link = link.root
    await writeProject(projectRoot, project)
  }

  return { project, projectRoot, args, dryRun: args.flags.dryRun, force: args.flags.force, link }
}

/** Validate a `hamolus add <target> <name>` identifier. */
export function requirePartName(args: ParsedArgs, what: string): string {
  const name = args.positionals[1]
  if (!name) throw new Error(`Missing ${what} name. Usage: hamolus add ${args.positionals[0]} <name>`)
  if (!PART_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid ${what} name "${name}". Use snake_case: lowercase letters, digits and ` +
        'underscores, starting with a letter.',
    )
  }
  return name
}

/** Validate a project-root-relative destination for a part. */
export function destinationFor(context: AddContext, defaultPath: string): string {
  if (context.args.options.output) {
    return resolve(context.projectRoot, context.args.options.output)
  }
  return join(context.projectRoot, defaultPath)
}

export interface AddOutcome {
  /** Path relative to the project root, e.g. `panels/shop_ops`. */
  relativePath: string
  /** Files written. */
  files: number
  /** Where the source came from. */
  origin: string
  /** The npm package involved, when a source package was used. */
  sourcePackage?: string
  sourceVersion?: string
  /** Follow-up commands to print. */
  hints: string[]
}

/**
 * Reject the retired source-vendoring flags for a part that is now generated from a
 * template.
 *
 * `--source` / `--package` used to point a generated console or MCP server at a
 * directory or published build whose files were copied verbatim into the project.
 * Both parts are now template-driven and depend on their `@hamolus/*` package
 * instead, so those flags cannot be honoured — and silently ignoring them would
 * generate a project the caller did not ask for. `--template` (point at another
 * template) and `hamolus link` (point at a local checkout) cover the same need.
 */
export function assertTemplateNotSource(args: ParsedArgs, kind: string): void {
  const { source, package: pkg } = args.options
  if (!source && !pkg) return
  const used = [source ? '--source' : null, pkg ? '--package' : null].filter(Boolean).join(' / ')
  throw new Error(
    `${used} no longer applies to \`hamolus add ${kind}\`: it is generated from ` +
      'templates/<kind>/basic and depends on its @hamolus package, so there is no source tree to copy.\n' +
      'To point somewhere else, use --template <dir> for a different template, or ' +
      '`hamolus link <path>` to develop against a local Hamolus checkout.',
  )
}

/**
 * Guard against silently replacing an existing part.
 *
 * `--force` opts in; otherwise the command stops and explains how to redo it.
 */export function guardExisting(
  context: AddContext,
  kind: PartKind,
  id: string,
  destination: string,
): void {
  const recorded = findPart(context.project, kind, id)
  const existsOnDisk = existsSync(destination)

  if (recorded && existsOnDisk && !context.force) {
    throw new Error(
      `This project already has a ${kind} "${id}" at ${relative(context.projectRoot, destination)}.\n` +
        'Re-run with --force to regenerate it, or remove the directory first.',
    )
  }
  if (!recorded && existsOnDisk && !context.force) {
    throw new Error(
      `${relative(context.projectRoot, destination) || destination} already exists and is not ` +
        'recorded in hamolus.json. Re-run with --force to overwrite it.',
    )
  }
}

/** Report, record and finish an `add` operation. */
export async function commit(
  context: AddContext,
  spec: {
    kind: PartKind
    id: string
    label: string
    path: string
    source?: string
    sourceVersion?: string
  },
  outcome: AddOutcome,
): Promise<void> {
  if (!context.dryRun) {
    // Linking happens here, not in the copy helpers, because it must run *after* every
    // `add` target has written its final manifest. Most targets generate `package.json`
    // themselves (a project-scoped name plus registry ranges) rather than copying the
    // source one, so a link applied during the copy is either impossible (no manifest
    // exists yet) or silently overwritten moments later. `commit` is the one place all
    // six targets reach on the way out.
    const applied = await linkManifestFile(
      join(context.projectRoot, outcome.relativePath, 'package.json'),
      context.link,
    )
    for (const spec of applied) info(`link  ${spec}`)

    recordPart(context.project, {
      kind: spec.kind,
      id: spec.id,
      label: spec.label,
      path: outcome.relativePath,
      source: outcome.sourcePackage ?? outcome.origin,
      sourceVersion: outcome.sourceVersion,
    })
    await writeProject(context.projectRoot, context.project)
  }

  success(`Added ${spec.kind} "${spec.id}" → ${join(context.projectRoot, outcome.relativePath)}`)
  info(`${outcome.files} files · ${outcome.origin}`)
  next(outcome.hints)
}

/** Copy a template directory into the project as a new part. */
export async function addFromTemplate(options: {
  context: AddContext
  template: ResolvedTemplate
  destination: string
  tokens: Record<string, string>
}): Promise<number> {
  const { context, template, destination, tokens } = options
  if (context.dryRun) {
    step(`would copy ${dim(template.directory)} → ${destination}`)
    return 0
  }
  const result = await copyTemplate(template.directory, destination, tokens, { force: context.force })
  return result.files
}

/** Copy a source-package directory into the project as a new part. */
export async function addFromSource(options: {
  context: AddContext
  sourceDirectory: string
  destination: string
  /** Restrict the copy to these top-level entries (from `hamolus.copy`). */
  entries?: string[]
}): Promise<number> {
  const { context, sourceDirectory, destination, entries } = options
  if (context.dryRun) {
    step(`would copy ${dim(sourceDirectory)} → ${destination}`)
    return 0
  }
  const result = await copySource(sourceDirectory, destination, {
    force: context.force,
    entries,
  })
  return result.files
}

/**
 * Ensure a pnpm workspace glob covers a part's directory.
 *
 * A generated project is a pnpm workspace, so a new part has to match a glob in
 * `pnpm-workspace.yaml` or `pnpm install` will not see it.
 *
 * The entry has to land *inside* the `packages:` sequence. Appending it to the end of the
 * file instead would append it to whichever mapping happens to come last (`allowBuilds:`
 * in a generated project) and produce a file pnpm cannot even parse — a failure that
 * surfaces far away, as `bad indentation of a mapping entry` from `pnpm install`.
 */
export async function ensureWorkspaceGlob(
  projectRoot: string,
  /** Workspace-relative directory pattern, e.g. `panels/*`. */
  glob: string,
): Promise<boolean> {
  const manifestPath = join(projectRoot, 'pnpm-workspace.yaml')
  if (!existsSync(manifestPath)) return false

  const manifest = await readFile(manifestPath, 'utf8')
  const lines = manifest.split('\n')

  // Matched per line rather than by substring so an unrelated mention of the glob in a
  // comment or a nested key doesn't count as coverage.
  const covered = lines.some((line) => {
    const entry = line.trim().replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '').trim()
    return entry === glob
  })
  if (covered) return false

  const start = lines.findIndex((line) => /^packages:\s*(#.*)?$/.test(line))
  if (start === -1) {
    throw new Error(
      `Cannot add "${glob}" to pnpm-workspace.yaml: it has no top-level "packages:" key. ` +
        `Add it by hand, then re-run.`,
    )
  }

  // Insert straight after the block's last entry. Walking to the next top-level key would
  // put the entry *after* the comment that introduces that key, which reads as if the glob
  // belonged to it.
  let lastEntry = start
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() !== '' && !/^\s/.test(line) && !line.trimStart().startsWith('#')) break
    if (/^\s*-\s/.test(line)) lastEntry = i
  }

  lines.splice(lastEntry + 1, 0, `  - '${glob}'`)
  await writeFile(manifestPath, lines.join('\n'), 'utf8')
  return true
}

/** Write a small generated file, honouring `--dry-run`. */
export async function writeGenerated(
  context: AddContext,
  destination: string,
  contents: string,
): Promise<void> {
  if (context.dryRun) {
    step(`would write ${destination}`)
    return
  }
  await writeFile(destination, contents, 'utf8')
}

/**
 * Re-exported so a command imports its whole toolkit from one place.
 *
 * `formatLabel` and `warn` are shared implementations rather than per-command
 * copies, which keeps label formatting ("my_plugin" -> "My plugin") identical
 * across every part.
 */
export { formatLabel, info, step, next, success, warn }
