/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

/**
 * Argument parsing for the `hamolus` CLI.
 *
 * Built on `node:util`'s `parseArgs` so the CLI stays dependency-free while still
 * supporting `--flag value`, `--flag=value`, short options and `--` terminators.
 */

import { parseArgs } from 'node:util'
import { CORE_MODES, type CoreMode } from './help.js'

export interface ParsedArgs {
  /**
   * Positional words *after* the command, e.g. `['panel', 'shop_ops']` for
   * `hamolus add panel shop_ops`. The command word itself is not included — the
   * caller already consumed it from `argv[0]`.
   */
  positionals: string[]
  /** Boolean flags. */
  flags: {
    help: boolean
    yes: boolean
    force: boolean
    dryRun: boolean
    clear: boolean
  }
  /** Value options. */
  options: {
    output?: string
    mode?: CoreMode
    template?: string
    source?: string
    package?: string
    /** Hamolus checkout to link `@hamolus/*` dependencies into. */
    link?: string
  }
}

const OPTIONS = {
  output: { type: 'string', short: 'o' },
  mode: { type: 'string' },
  template: { type: 'string' },
  source: { type: 'string' },
  package: { type: 'string' },
  link: { type: 'string' },
  force: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  clear: { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  help: { type: 'boolean', short: 'h' },
} as const

export function isCoreMode(value: string): value is CoreMode {
  return (CORE_MODES as readonly string[]).includes(value)
}

/**
 * Parse the arguments *after* the command word.
 *
 * Callers pass `argv.slice(1)` so `positionals` holds only the words the user
 * typed after the command — `hamolus add panel shop_ops` yields
 * `positionals === ['panel', 'shop_ops']`. The command word is `argv[0]`, which
 * the caller already read, and keeping it here twice is an easy off-by-one.
 */
export function parse(argv: string[]): ParsedArgs {
  const parsed = parseArgs({
    args: argv,
    options: OPTIONS,
    allowPositionals: true,
    strict: true,
  })

  if (parsed.values.mode !== undefined && !isCoreMode(parsed.values.mode)) {
    throw new Error(
      `Unknown core mode "${parsed.values.mode}". Expected one of: ${CORE_MODES.join(', ')}.`,
    )
  }

  return {
    positionals: [...parsed.positionals],
    flags: {
      help: Boolean(parsed.values.help),
      yes: Boolean(parsed.values.yes),
      force: Boolean(parsed.values.force),
      dryRun: Boolean(parsed.values['dry-run']),
      clear: Boolean(parsed.values.clear),
    },
    options: {
      output: parsed.values.output,
      mode: parsed.values.mode,
      template: parsed.values.template,
      source: parsed.values.source,
      package: parsed.values.package,
      link: parsed.values.link,
    },
  }
}
