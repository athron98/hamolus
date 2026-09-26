/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus` — command dispatch.
 *
 * Commands are intentionally thin: they validate input, do the work, and print a
 * short report. Anything reusable lives in a sibling module so a new `add` target
 * is a small file rather than a new code path through this one.
 */

import { parse } from './args.js'
import { CLI_VERSION, commandHelp, usage } from './help.js'
import { runAddConfiguration } from './commands/add-configuration.js'
import { runAddConsole } from './commands/add-console.js'
import { runAddMcp } from './commands/add-mcp.js'
import { runAddPanel } from './commands/add-panel.js'
import { runAddPlugin } from './commands/add-plugin.js'
import { runAddSeed } from './commands/add-seed.js'
import { runCreate } from './commands/create.js'
import { runLink } from './commands/link.js'
import { runList } from './commands/list.js'
import { failure } from './util/log.js'

const ADD_TARGETS = [
  'console',
  'panel',
  'mcp',
  'plugin',
  'seed',
  'configuration',
] as const

type AddTarget = (typeof ADD_TARGETS)[number]

function isAddTarget(value: string): value is AddTarget {
  return (ADD_TARGETS as readonly string[]).includes(value)
}

export async function run(argv: string[]): Promise<number> {
  const command = argv[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(usage())
    return 0
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(CLI_VERSION)
    return 0
  }

  // `--help` anywhere short-circuits the command.
  if (argv.includes('--help') || argv.includes('-h')) {
    if (command === 'create') console.log(commandHelp('create'))
    else if (command === 'add') console.log(commandHelp('add'))
    else if (command === 'link') console.log(commandHelp('link'))
    else console.log(usage())
    return 0
  }

  let args
  try {
    // argv[0] is the command word, already read above; the parser only needs
    // the words after it.
    args = parse(argv.slice(1))
  } catch (error) {
    failure(error instanceof Error ? error.message : String(error))
    console.error(`\nRun ${'`hamolus help`'} for usage.`)
    return 1
  }

  try {
    switch (command) {
      case 'create':
        await runCreate(args)
        return 0
      case 'list':
        await runList(args)
        return 0
      case 'link':
        await runLink(args)
        return 0
      case 'add': {
        const target = args.positionals[0]
        if (!target || !isAddTarget(target)) {
          failure(
            `Unknown add target${target ? ` "${target}"` : ''}. Expected one of: ${ADD_TARGETS.join(', ')}.`,
          )
          return 1
        }
        switch (target) {
          case 'console':
            await runAddConsole(args)
            return 0
          case 'panel':
            await runAddPanel(args)
            return 0
          case 'mcp':
            await runAddMcp(args)
            return 0
          case 'plugin':
            await runAddPlugin(args)
            return 0
          case 'seed':
            await runAddSeed(args)
            return 0
          case 'configuration':
            await runAddConfiguration(args)
            return 0
        }
        return 1
      }
      default:
        failure(`Unknown command "${command}".`)
        console.error(`\nRun ${'`hamolus help`'} for usage.`)
        return 1
    }
  } catch (error) {
    failure(error instanceof Error ? error.message : String(error))
    return 1
  }
}
