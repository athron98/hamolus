/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus` — command dispatch.
 *
 * Commands are intentionally thin: they validate input, do the work, and print a
 * short report. Anything reusable lives in a sibling module so a new `add` target
 * is a small file rather than a new code path through this one.
 *
 * `create` with no name is the one exception, and it is a courtesy rather than a
 * second entry point: a bare `hamolus create` cannot mean anything without a name, so
 * it opens the wizard instead of printing a usage error. `init` is the real command
 * and the one `npm create hamolus@latest` runs.
 */

import { parse, type ParsedArgs } from './args.js'
import { CLI_VERSION, commandHelp, usage } from './help.js'
import { runAddConfiguration } from './commands/add-configuration.js'
import { runAddConsole } from './commands/add-console.js'
import { runAddMcp } from './commands/add-mcp.js'
import { runAddPanel } from './commands/add-panel.js'
import { runAddPlugin } from './commands/add-plugin.js'
import { runAddSeed } from './commands/add-seed.js'
import { runAddSite } from './commands/add-site.js'
import { runCreate } from './commands/create.js'
import { runInit } from './commands/init.js'
import { runLink } from './commands/link.js'
import { runList } from './commands/list.js'
import { canPrompt } from './prompt.js'
import { failure } from './util/log.js'

const ADD_TARGETS = [
  'console',
  'panel',
  'mcp',
  'plugin',
  'seed',
  'configuration',
  'site',
] as const

type AddTarget = (typeof ADD_TARGETS)[number]

function isAddTarget(value: string): value is AddTarget {
  return (ADD_TARGETS as readonly string[]).includes(value)
}

/**
 * Options that describe a whole project rather than a core.
 *
 * `runCreate` owns a core and its secrets. Everything here is a question `init` asks and
 * then acts on, by calling `runCreate` with the answer and following it with the `add`
 * targets — so a `create` carrying any of them is a wizard run that happens to have its
 * answers supplied already.
 */
const WIZARD_OPTIONS = [
  'coreName',
  'land',
  'colony',
  'jwt',
  'key',
  'host',
  'console',
  'mcp',
  'site',
  'panel',
  'withConsole',
  'withMcp',
  'withSite',
  'withPanel',
] as const

function wizardFlags(args: ParsedArgs): boolean {
  return WIZARD_OPTIONS.some((option) => args.options[option] !== undefined)
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
    else if (command === 'init') console.log(commandHelp('init'))
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
      case 'init':
        await runInit(args)
        return 0
      case 'create':
        // A bare `hamolus create` has no name and cannot invent one; the wizard can.
        // So the wizard answers instead — but only when it can actually answer: with a
        // terminal, or under `--yes`, which is a request for defaults and needs no
        // terminal to supply them. A nameless, prompt-less, non-`-y` run is a genuine
        // usage error, because there is nothing to answer with and nothing to default
        // from, and falling through to `create` is what reports it.
        //
        // A *named* `create` still goes to the wizard when the command line already
        // describes more than a core. `--console`, `--mcp` and `--site` are the wizard's
        // questions, and `runCreate` does not implement them: routing a named `create`
        // straight to it made `hamolus create acme --console --site astro` write a core,
        // print "hamolus add console" as the next step, and exit 0. The flags were
        // accepted, documented and silently discarded — the worst of the three. Anything
        // the wizard answers for goes through `init`, which calls `create` and then adds
        // the parts, so there is one path rather than two that can disagree.
        //
        // `--dry-run` stays on `create`, because `init` has nothing to preview: the
        // answers are the plan, and it runs them.
        if (!args.flags.dryRun) {
          const nameless = args.positionals.length === 0
          if (nameless && (canPrompt(false) || args.flags.yes)) {
            await runInit(args)
            return 0
          }
          if (!nameless && wizardFlags(args)) {
            await runInit(args)
            return 0
          }
        }
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
          case 'site':
            await runAddSite(args)
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
