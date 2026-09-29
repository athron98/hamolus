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
 * Terminal output for the `hamolus` CLI.
 *
 * Kept free of Side Effects so the file can also be imported by tests without
 * printing anything.
 */

export const CLI_NAME = 'hamolus'
export const CLI_VERSION = '0.2.9'

export const CORE_MODES = ['independent', 'centralized', 'proxy', 'bridge'] as const
export type CoreMode = (typeof CORE_MODES)[number]

export function usage(): string {
  return [
    `${CLI_NAME} — scaffold Hamolus projects, consoles, panels and MCP servers.`,
    '',
    `Equivalent to: npm create hamolus@latest`,
    '',
    'Usage:',
    `  ${CLI_NAME} init [name] [options]       Guided setup — asks, then creates the project`,
    `  ${CLI_NAME} create <name> [options]      Create a new Hamolus project (with a core)`,
    `  ${CLI_NAME} add console [options]        Add a console to the current project`,
    `  ${CLI_NAME} add panel <name> [options]   Add a panel app to the current project`,
    `  ${CLI_NAME} add mcp [options]            Add an MCP server to the current project`,
    `  ${CLI_NAME} add site <name> [options]    Add a public site (Astro or Next.js)`,
    `  ${CLI_NAME} add plugin <name> [options]  Add a console plugin to the current project`,
    `  ${CLI_NAME} add seed <name> [options]    Add a seed script to the current project`,
    `  ${CLI_NAME} add configuration <name>     Add a wrangler/KV configuration preset`,
    `  ${CLI_NAME} link <path>                  Point @hamolus/* deps at a local checkout`,
    `  ${CLI_NAME} link --clear                 Put @hamolus/* deps back on the registry`,
    `  ${CLI_NAME} list                         List what the current project contains`,
    `  ${CLI_NAME} help                         Show this help`,
    '',
    'Common options:',
    '  -o, --output <path>     Write to an explicit path instead of the project default',
    '      --mode <mode>      Core mode: independent | centralized | proxy | bridge',
    '      --core <name>      Core template: basic (no schema) | predefined',
    '      --core-name <name> Name of the core itself — its package and Worker name',
    '      --host <address>   Interface the dev servers bind to (default 127.0.0.1)',
    '      --jwt <secret>     JWT_SECRET for local dev; omit and one is generated',
    '      --key <secret>     ADMIN_KEY for local dev; omit and one is generated',
    '      --land <name>      Land bare requests resolve to (multi-tenant modes)',
    '      --colony <name>    Colony bare requests resolve to (multi-tenant modes)',
    '      --template <path>  Use an explicit template directory (skips resolution)',
    '      --source <path>    Use an explicit source directory (skips package resolution)',
    '      --package <name>   Use a specific published package version as the source',
    '      --link <path>      Link @hamolus/* deps into a local Hamolus checkout',
    '      --clear            `link` only: undo the link (back to registry ranges)',
    '      --force            Overwrite the target directory if it already exists',
    '      --dry-run          Print the plan without writing anything',
    '  -y, --yes              Assume "yes" for every prompt',
    '  -h, --help             Show this help',
    '',
    'Examples:',
    `  ${CLI_NAME} init                            # the wizard — same as npm create hamolus@latest`,
    `  ${CLI_NAME} init acme --mode centralized --land acme --mcp`,
    `  ${CLI_NAME} create acme`,
    `  ${CLI_NAME} create acme --mode centralized`,
    `  ${CLI_NAME} create acme --core predefined   # a collection + panel in source control`,
    `  ${CLI_NAME} add console`,
    `  ${CLI_NAME} add panel shop_ops`,
    `  ${CLI_NAME} add mcp`,
    `  ${CLI_NAME} add site blog`,
    `  ${CLI_NAME} add plugin todo`,
    `  ${CLI_NAME} create acme --link ../hamolus   develop against a local checkout`,
  ].join('\n')
}

export function commandHelp(command: 'init' | 'create' | 'add' | 'link'): string {
  if (command === 'link') return linkHelp()
  if (command === 'init') return initHelp()
  if (command === 'create') {
  return [
      `Usage: ${CLI_NAME} create <name> [options]`,
      '',
      'Creates a new Hamolus project directory containing a core (the API Worker),',
      'a workspace manifest and a `hamolus.json` project file. Additional parts are',
      'added afterwards with `hamolus add`.',
      '',
      'The core comes from a named template. `basic` ships no schema — collections',
      'and panels are created in the console or the API and stay editable there.',
      '`predefined` ships one of each under `core/src/`, defined in source control',
      'and therefore frozen against API edits (its records stay editable).',
      '',
      'Options:',
      '      --mode <mode>      Core mode (default: independent)',
      `                          ${CORE_MODES.join(' | ')}`,
      '      --core <name>      Core template (default: the mode\'s, then basic)',
      '                          basic     no collections or panels',
      '                          predefined a posts collection + content panel in src/',
      '      --core-name <name> Core package and Worker name (default: <name>-core)',
      '      --host <address>   Interface `pnpm dev` binds to (default: 127.0.0.1)',
      '                          Use 0.0.0.0 to open a dev server on the LAN',
      '      --jwt <secret>     JWT_SECRET written to core/.dev.vars (16+ characters)',
      '      --key <secret>     ADMIN_KEY written to core/.dev.vars (16+ characters)',
      '                          Passing either one writes a working pair; passing',
      '                          neither writes no .dev.vars at all.',
      '      --land <name>      Land bare requests resolve to (default: default)',
      '      --colony <name>    Colony bare requests resolve to (default: default)',
      '  -o, --output <path>     Output directory (default: ./<name>)',
      '      --link <path>      Link @hamolus/* into a local checkout (skips the registry)',
      '      --force            Overwrite an existing directory',
      '      --dry-run          Print the plan without writing anything',
      '  -y, --yes               Assume "yes" for every prompt',
      '  -h, --help              Show this help',
    ].join('\n')
  }
  return [
    `Usage: ${CLI_NAME} add <target> [name] [options]`,
    '',
    'Targets:',
    '  console        A SolidJS admin console (collections, records, media, panels)',
    '  panel <name>   A generated SolidJS panel app driven by a core panel manifest',
    '  mcp            A Model Context Protocol server exposing the core API',
    '  site <name>    A public site reading the core over REST (astro | nextjs)',
    '  plugin <name>  A console plugin (todo, kanban) wired into an existing console',
    '  seed <name>    A self-cleaning seed script for the core',
    '  configuration  A wrangler + KV configuration preset',
    '',
    'Options:',
    '  -o, --output <path>     Write to an explicit path',
    '      --template <path>  Use an explicit template directory',
    '      --source <path>    Use an explicit source directory',
    '      --package <name>   Use a specific published package version as the source',
    '      --link <path>      Link @hamolus/* deps into a local Hamolus checkout',
    '      --force            Overwrite the target directory',
    '      --dry-run          Print the plan without writing anything',
    '  -y, --yes               Assume "yes" for every prompt',
    '  -h, --help              Show this help',
  ].join('\n')
}

/**
 * `hamolus init` — the guided path, and what `npm create hamolus@latest` runs.
 *
 * The questions are documented as a list because that is the only part of the CLI a
 * newcomer cannot infer from a flag. The guarantee worth stating is the other half: a
 * question whose flag is already on the command line is not asked, so this is a set of
 * defaults rather than a form.
 */
function initHelp(): string {
  return [
    `Usage: ${CLI_NAME} init [name] [options]`,
    '',
    'Asks twelve questions and then creates the project, its core and any parts you',
    'asked for. Every question has a flag, and a question whose flag is present is',
    'not asked — so this is a scriptable set of defaults, not a form to fill in.',
    '',
    'With no terminal, or with --yes, every question takes its default and says so.',
    '',
    'The questions:',
    '  1. Project name — the directory it goes in',
    '  2. Core name — its package and Worker name',
    `  3. Core mode — ${CORE_MODES.join(' | ')}`,
    '     a multi-tenant mode also asks for a land and a colony',
    '  4. Predefined collections in core/src/? — y, n, or a template name',
    '  5. JWT secret — typed, or generated when left empty',
    '  6. Admin key — typed, or generated when left empty',
    '  7. Expose the dev servers on the LAN? — y = 0.0.0.0, n = 127.0.0.1,',
    '     or type an address such as mac.lan',
    '  8. Add an admin console?',
    '  9. Add an MCP server?',
    ' 10. Add a public site? — y = astro, n = none, or type a framework or a path',
    ' 11. Add a panel? — y = admin, n = none, or type a name (a page in the console)',
    ' 12. Add a seed with example content? — a self-cleaning script that fills the core',
    '     with a few records, so a new site has something to show. Defaults to yes when',
    '     there is a site and no otherwise. Skipped when the project has no core.',
    '',
    'Questions 2 to 6 are about the core. A project with no core — a bare part flag, or',
    '`--no-core` — skips all five, and so has no land, no colony and no `core/.dev.vars`.',
    '',
    'Options:',
    '      --core-name <name> Skip question 2',
    '      --mode <mode>      Skip question 3',
    '      --land <name>      Skip the land question',
    '      --colony <name>    Skip the colony question',
    '      --core <name>      Skip question 4',
    '      --jwt <secret>     Skip question 5',
    '      --key <secret>     Skip question 6',
    '      --host <address>   Skip question 7',
    '',
    'Parts — two spellings, and the difference is whether you get a core:',
    '      --console            just the console, no core',
    '      --mcp                just the MCP server, no core',
    '      --site <name>        just the site, no core',
    '      --panel <name>       just the panel, no core',
    '      --with-console       a core, and the console',
    '      --with-mcp           a core, and the MCP server',
    '      --with-site <name>   a core, and the site',
    '      --with-panel <name>  a core, and the panel',
    '      --no-core            an empty workspace: no core, and no part named',
    '',
    '  A seed writes to a core over HTTP, so it has no bare/`--with-` pair: `--seed`',
    '  means "a core, and a seed". `--no-seed` answers question 12 with no.',
    '      --seed <name>       a core, and a seed named this',
    '      --no-seed           Answer question 12 with no',
    '',
    '  A bare part flag is `hamolus add <part>` applied to a new project, so the part',
    '  finds a core that already runs somewhere else. `--with-` is the full project.',
    '  Both may be combined; mixing the two spellings is an error, because it would',
    '  need a core and no core at the same time. A panel is a page inside the console,',
    '  so a panel with no console has nothing to load it — `hamolus add panel` warns.',
    '',
    'Other options:',
    '  -o, --output <path>     Write the project somewhere else',
    '      --link <path>      Link @hamolus/* into a local checkout',
    '      --force            Overwrite an existing directory',
    '  -y, --yes               Ask nothing; take every default',
    '  -h, --help              Show this help',
    '',
    'Examples:',
    `  ${CLI_NAME} init`,
    `  ${CLI_NAME} init acme --mode centralized --land acme --mcp --console`,
    `  ${CLI_NAME} init acme --yes --host 0.0.0.0 --site nextjs`,
    '',
    '  # a core plus a console and a site',
    `  ${CLI_NAME} create shop --with-console --with-site nextjs`,
    '  # a console on its own, pointed at a core that already runs',
    `  ${CLI_NAME} create shop-console --console`,
    '',
    '  # a core, a site, and a seed so the site has something to show',
    `  ${CLI_NAME} create shop --with-site nextjs --seed basic`,
  ].join('\n')
}

function linkHelp(): string {
  return [
    `Usage: ${CLI_NAME} link <path>`,
    `       ${CLI_NAME} link --clear`,
    '',
    'Points every generated workspace member at a local Hamolus checkout instead of',
    'the npm registry. Use it while the packages are still in development — including',
    'when generating this repo\'s own examples/, which must exercise the working tree.',
    '',
    'The checkout is recorded in hamolus.json, so later `hamolus add` calls inherit it.',
    '',
    'Options:',
    '      --clear            Undo the link, restoring registry version ranges',
    '  -h, --help              Show this help',
    '',
    'Examples:',
    `  ${CLI_NAME} link ../hamolus`,
    `  ${CLI_NAME} link ~/code/hamolus`,
    `  ${CLI_NAME} link --clear`,
  ].join('\n')
}
