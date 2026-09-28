/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
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
    /**
     * Name of the core template to generate from, e.g. `basic` or `predefined`.
     *
     * Only `create` reads it: a core ships several named templates rather than one
     * file tree, and the name picks between them. The set is open — a repository may
     * add its own — so the value is checked for shape, by the command that uses it,
     * rather than against a list of known names.
     */
    core?: string
    /**
     * Name of the generated core itself — its package name and its Worker name.
     *
     * Distinct from `--core`, which names a *template*. One project may want its core
     * called `acme-api` while still generating from `predefined`.
     */
    coreName?: string
    template?: string
    source?: string
    package?: string
    /** Hamolus checkout to link `@hamolus/*` dependencies into. */
    link?: string
    /** `JWT_SECRET` for the generated project's local development. */
    jwt?: string
    /** `ADMIN_KEY` — the key the console, the CLI and the seeds authenticate with. */
    key?: string
    /**
     * Interface the generated dev servers bind to: `0.0.0.0` (or a LAN address, or
     * `mac.lan`) to reach them from another device, `127.0.0.1` to stay local.
     */
    host?: string
    /** Land the bare, unprefixed requests of a multi-tenant core resolve to. */
    land?: string
    /** Colony the bare requests of a multi-tenant core resolve to. */
    colony?: string
    /** `init` only: add a console, skipping the question. */
    console?: boolean
    /** `init` only: add an MCP server, skipping the question. */
    mcp?: boolean
    /** `init` only: add a site from this template (`astro`, `nextjs`, or a path). */
    site?: string
  }
}

const OPTIONS = {
  output: { type: 'string', short: 'o' },
  mode: { type: 'string' },
  core: { type: 'string' },
  'core-name': { type: 'string' },
  template: { type: 'string' },
  source: { type: 'string' },
  package: { type: 'string' },
  link: { type: 'string' },
  jwt: { type: 'string' },
  key: { type: 'string' },
  host: { type: 'string' },
  land: { type: 'string' },
  colony: { type: 'string' },
  console: { type: 'boolean' },
  mcp: { type: 'boolean' },
  site: { type: 'string' },
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
      core: parsed.values.core,
      coreName: parsed.values['core-name'],
      template: parsed.values.template,
      source: parsed.values.source,
      package: parsed.values.package,
      link: parsed.values.link,
      jwt: parsed.values.jwt,
      key: parsed.values.key,
      host: parsed.values.host,
      land: parsed.values.land,
      colony: parsed.values.colony,
      console: parsed.values.console,
      mcp: parsed.values.mcp,
      site: parsed.values.site,
    },
  }
}
