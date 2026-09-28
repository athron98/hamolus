/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
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
  site: 'Sites',
}

const KIND_ORDER: PartKind[] = [
  'core',
  'console',
  'panel',
  'mcp',
  'plugin',
  'seed',
  'configuration',
  'site',
]

export async function runList(_args: ParsedArgs): Promise<void> {
  const projectRoot = await requireProjectRoot(process.cwd())
  const project = await readProject(projectRoot)
  if (!project) {
    warn(`No ${projectRoot} project file found.`)
    return
  }

  // A project with no core has no mode to report. Printing `undefined` — or, worse,
  // `independent` — would claim a tenancy for a core that was never generated, so the
  // header says what the project *is* instead.
  const hasCore = project.parts.some((part) => part.kind === 'core')
  heading(hasCore ? `${project.name}  ${dim(`(${project.mode})`)}` : `${project.name}  ${dim('(no core)')}`)
  info(`scope ${project.scope} · created ${project.createdAt.slice(0, 10)}`)
  // The two answers a generated part has to inherit rather than guess: which address
  // the dev servers answer on, and which scope a bare request lands in. They are
  // optional because a project created before they existed simply has no such key.
  const facts = [`dev ${project.devHost ?? '127.0.0.1'}`]
  // Only for a core. A project whose `mode` is absent has nothing routing bare requests,
  // and reporting a land for it would be the one line on this screen that is not true.
  if (hasCore && project.mode !== 'independent') {
    facts.push(`land ${project.land ?? 'default'}`, `colony ${project.colony ?? 'default'}`)
  }
  if (!hasCore) facts.push('core lives elsewhere — each part is told where at runtime')
  info(facts.join(' · '))

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
