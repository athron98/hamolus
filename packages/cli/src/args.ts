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

/**
 * The parts that can be requested by a flag, bare or `--with-`.
 *
 * A list rather than a union of one, because `--console --mcp` asks for two of them in a
 * project that has no core, and the generated README has to describe both.
 */
export type PartFlag = 'console' | 'mcp' | 'site' | 'panel'

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
    /** `init` only: this project is a console, and nothing else. No core. */
    console?: boolean
    /** `init` only: this project is an MCP server, and nothing else. No core. */
    mcp?: boolean
    /** `init` only: this project is a site from this template, and nothing else. */
    site?: string
    /** `init` only: this project is a panel of this name, and nothing else. */
    panel?: string
    /** `init` only: a core, plus a console. */
    withConsole?: boolean
    /** `init` only: a core, plus an MCP server. */
    withMcp?: boolean
    /** `init` only: a core, plus a site from this template (`astro`, `nextjs`, a path). */
    withSite?: string
    /** `init` only: a core, plus a panel of this name. */
    withPanel?: string
    /**
     * `create` only: write the project workspace and nothing else — no core, and so no
     * core secrets, no core template and no `deploy` script.
     *
     * This is the primitive the bare part flags are built on. `hamolus create acme
     * --console` goes through the wizard, which runs this and then `hamolus add console`,
     * so the core-less project is assembled by the same commands a person would type by
     * hand rather than by a second copy of the scaffolding.
     */
    noCore?: boolean
    /**
     * What a core-less project is for, e.g. `['console']` — the parts `--no-core` is being
     * used to make room for.
     *
     * Internal: not a flag, and not in {@link OPTIONS}. The wizard is the only caller,
     * and it already knows the answer because it is the thing that read `--console`. It
     * exists so the generated README can say which parts this project is rather than
     * describing a project that is nothing yet — a README is written once, by `create`,
     * while the parts are added after it.
     */
    partHint?: PartFlag[]
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
  // Two spellings of the same four parts, and the difference between them is whether the
  // project gets a core:
  //
  //   --console          this project *is* a console
  //   --with-console     this project is a core *and* a console
  //
  // The bare flag is the narrower promise, so it is the one that reads as the fact. Asking
  // for a console with `--console` and getting a core you did not ask for is the same class
  // of bug as a flag that is accepted and then ignored: the command answers a different
  // question than the one that was asked. `--with-` is there for the case where the core is
  // wanted, and it says so out loud rather than leaving the reader to infer it from an
  // absence.
  //
  // The two spellings cannot be mixed. `--console --with-mcp` asks for a project with no
  // core and a project with one; see `resolveParts` in commands/init.ts.
  console: { type: 'boolean' },
  mcp: { type: 'boolean' },
  site: { type: 'string' },
  panel: { type: 'string' },
  'with-console': { type: 'boolean' },
  'with-mcp': { type: 'boolean' },
  'with-site': { type: 'string' },
  'with-panel': { type: 'string' },
  'no-core': { type: 'boolean' },
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
      panel: parsed.values.panel,
      withConsole: parsed.values['with-console'],
      withMcp: parsed.values['with-mcp'],
      withSite: parsed.values['with-site'],
      withPanel: parsed.values['with-panel'],
      noCore: parsed.values['no-core'],
    },
  }
}
