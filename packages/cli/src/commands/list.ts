/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus list` — report what a project contains.
 *
 * Reads only `hamolus.json`, so it works without the project being installed and
 * doubles as a quick sanity check after a series of `add` commands.
 */

import type { ParsedArgs } from '../args.js'
import { readProject, requireProjectRoot, type PartKind } from '../project.js'
import { dim, heading, info, warn } from '../util/log.js'

const KIND_TITLES: Record<PartKind, string> = {
  core: 'Core',
  console: 'Console',
  panel: 'Panels',
  mcp: 'MCP',
  plugin: 'Plugins',
  seed: 'Seeds',
  configuration: 'Configurations',
}

const KIND_ORDER: PartKind[] = [
  'core',
  'console',
  'panel',
  'mcp',
  'plugin',
  'seed',
  'configuration',
]

export async function runList(_args: ParsedArgs): Promise<void> {
  const projectRoot = await requireProjectRoot(process.cwd())
  const project = await readProject(projectRoot)
  if (!project) {
    warn(`No ${projectRoot} project file found.`)
    return
  }

  heading(`${project.name}  ${dim(`(${project.mode})`)}`)
  info(`scope ${project.scope} · created ${project.createdAt.slice(0, 10)}`)

  for (const kind of KIND_ORDER) {
    const parts = project.parts.filter((part) => part.kind === kind)
    if (parts.length === 0) continue
    heading(KIND_TITLES[kind])
    for (const part of parts) {
      const source = part.sourceVersion ? `${part.source}@${part.sourceVersion}` : part.source
      console.log(`  ${part.id.padEnd(20)} ${dim(part.path)}${source ? dim(`  ·  ${source}`) : ''}`)
    }
  }

  if (project.parts.length === 0) {
    warn('This project has no generated parts yet.')
  }

  console.log(`\n${dim(`project file: ${projectRoot}/hamolus.json`)}`)
}
