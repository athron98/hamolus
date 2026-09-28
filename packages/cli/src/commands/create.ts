/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus create <name>` — scaffold a new Hamolus project.
 *
 * A project is deliberately thin: it contains a **core** (the API Worker) plus the
 * workspace scaffolding needed to build and deploy it. Consoles, panels, MCP
 * servers, sites, plugins and seeds are added afterwards with `hamolus add`, so a
 * project only pays for the parts it actually uses — except when `hamolus init` asks
 * for them up front, which is the same thing with the questions asked first.
 *
 * The command is deliberately non-interactive: every question it needs has a flag, so
 * the wizard in `init.ts` is a caller of this one rather than a second implementation
 * of it. That is what keeps `hamolus create acme --mode bridge` and a generated
 * wizard run byte-identical.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { ParsedArgs, PartFlag } from '../args.js'
import type { CoreMode } from '../help.js'
import { linkManifestFile, resolveLinkRoot } from '../link.js'
import { generateSecret } from '../prompt.js'
import { PROJECT_FILE, PROJECT_FILE_VERSION, now, writeProject, type Project } from '../project.js'
import { copyTemplate, formatLabel, resolveTemplateDirectory, type ResolvedTemplate } from '../templates.js'
import { BASE_COMPILER_OPTIONS } from '../tsconfig.js'
import { dim, info, next, step, success, warn } from '../util/log.js'

const NAME_PATTERN = /^[a-z][a-z0-9_-]{0,62}$/

/**
 * Template name used when a kind (or a core mode) has no template of its own.
 * Every template kind is a directory of named templates — `cores/basic`,
 * `consoles/basic`, `panels/basic`, … — so a kind that ships exactly one template
 * still resolves by name instead of by falling back to its own parent directory.
 */
export const BASIC_TEMPLATE = 'basic'

/**
 * Core templates ship as named directories under `templates/cores/`, and `--core`
 * picks one by name. The set is open — a repository may add `cores/minimal` of its
 * own — so the value is checked for *shape* rather than membership, and the shape is
 * a single path segment: the name is joined onto `cores/`, and anything carrying a
 * separator or `..` would resolve outside the template directory.
 */
const CORE_TEMPLATE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/

/**
 * The core's own name: an npm package name and a Cloudflare Worker name.
 *
 * Underscores are allowed here (a package name may hold one) but the Worker name is
 * derived from the kebab-case slug, because Worker names only take lowercase letters,
 * digits and hyphens. `my_core` is therefore a valid package name and an invalid
 * Worker name, and the same string has to serve both.
 */
const CORE_NAME_PATTERN = /^[a-z][a-z0-9._-]{0,62}$/

/**
 * A secret long enough to be worth writing down.
 *
 * 16 characters is the floor, not a recommendation: `JWT_SECRET` signs sessions and
 * `ADMIN_KEY` is a bearer credential, and a generated project is where those two are
 * most often left at `change-me`. Failing here costs one flag; a weak default costs a
 * rotation later, from memory, on a machine that is not this one.
 */
const MIN_SECRET_LENGTH = 16

/**
 * The address a dev server binds to.
 *
 * Checked for shape only: a hostname, an IPv4 address, an IPv6 address, or the
 * `0.0.0.0` / `::` wildcards. The value goes straight into a `wrangler dev --ip` and a
 * `vite --host` flag, so anything with a space or a quote in it is rejected here
 * rather than becoming a script that does not parse.
 */
const HOST_PATTERN = /^[A-Za-z0-9.:_-]{1,253}$/

/**
 * A land or colony name, mirroring `scopeNameSchema` in `@hamolus/types`.
 *
 * The core owns that schema and this one only exists so the CLI can say *why* an
 * answer was rejected before it writes a `wrangler.jsonc` the Worker will refuse to
 * start with. `root` and `default` are the two reserved names: they are how the core
 * spells "unnamed", and a land that claims to be the root is a land that cannot be
 * told apart from it.
 */
const SCOPE_NAME_PATTERN = /^[a-z][a-z0-9_]{1,39}$/
const RESERVED_SCOPE_NAMES = new Set(['root', 'default'])

/** What an unset `--land` / `--colony` renders as: the core's unnamed scope. */
export const DEFAULT_SCOPE_NAME = 'default'

/** What an unset `--host` renders as — Wrangler's own default, spelled out. */
export const DEFAULT_DEV_HOST = '127.0.0.1'

export interface CreateOptions {
  name: string
  mode: CoreMode
  output: string
  /** Named core template, from `--core`. Defaults to the mode's template, then `basic`. */
  core?: string
  template?: string
  /** Name of the core itself — its package name and its Worker name. */
  coreName: string
  /** Interface the generated dev servers bind to. */
  host: string
  /** Land the bare requests of a multi-tenant core resolve to. */
  land: string
  /** Colony the bare requests of a multi-tenant core resolve to. */
  colony: string
  /** `JWT_SECRET` for local development; omitted means "do not write .dev.vars". */
  jwt?: string
  /** `ADMIN_KEY` for local development. */
  key?: string
  /** Hamolus checkout to `@hamolus/*` link into, from `--link`. */
  link?: string
  /**
   * Write the workspace without a core — the project the bare part flags describe.
   *
   * A core is the default because it is the part everything else talks to, and a project
   * that cannot answer a request is not much of a project. But `hamolus create acme
   * --console` asks for a project that *is* a console, pointed at a core that already runs
   * somewhere else, and answering that with a generated core would be inventing a part the
   * caller did not ask for. So the parts decide, and this is what "no core" means when
   * they do.
   */
  noCore: boolean
  /** What a core-less project is for; see `ParsedArgs['options']['partHint']`. */
  partHint?: PartFlag[]
  force: boolean
  dryRun: boolean
}

/** Reject an answer the generated `wrangler.jsonc` or package manifest could not carry. */
function assertCoreName(name: string): void {
  if (CORE_NAME_PATTERN.test(name)) return
  throw new Error(
    `Invalid core name "${name}". Use lowercase letters, digits, dots, dashes or underscores, ` +
      'starting with a letter.',
  )
}

function assertSecret(label: string, value: string | undefined): void {
  if (value === undefined) return
  if (value.length >= MIN_SECRET_LENGTH) return
  throw new Error(
    `Invalid ${label} "${value}": a secret needs at least ${MIN_SECRET_LENGTH} characters. ` +
      'Pass a longer one, or omit the flag — the wizard generates a random value instead.',
  )
}

function assertHost(host: string): void {
  if (HOST_PATTERN.test(host)) return
  throw new Error(
    `Invalid --host "${host}". Use 0.0.0.0 to expose a dev server on the LAN, 127.0.0.1 to ` +
      'keep it local, or type an address or hostname such as mac.lan.',
  )
}

function assertScopeName(label: string, value: string): void {
  if (value === DEFAULT_SCOPE_NAME) return
  if (SCOPE_NAME_PATTERN.test(value) && !value.includes('__')) return
  if (RESERVED_SCOPE_NAMES.has(value)) {
    throw new Error(
      `Invalid ${label} "${value}": that name is reserved for the unnamed scope the core ` +
        `falls back to. Pick another one, or omit the flag to use "${DEFAULT_SCOPE_NAME}".`,
    )
  }
  throw new Error(
    `Invalid ${label} "${value}". Use 2-40 lowercase letters, digits or underscores, starting ` +
      'with a letter, and no double underscore.',
  )
}

export function parseCreateOptions(args: ParsedArgs): CreateOptions {
  const name = args.positionals[0]
  if (!name) throw new Error('Missing project name. Usage: hamolus create <name>')
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid project name "${name}". Use lowercase letters, digits, dashes or underscores, ` +
        'starting with a letter.',
    )
  }
  if (args.options.core && args.options.template) {
    throw new Error(
      'Pass either --core <name> (a template under templates/cores) or --template <path> ' +
        '(a template directory of your own) — not both, since the second already says which ' +
        'files to copy.',
    )
  }
  if (args.options.core && !CORE_TEMPLATE_NAME_PATTERN.test(args.options.core)) {
    throw new Error(
      `Invalid core template name "${args.options.core}". Use a plain name such as ` +
        `"${BASIC_TEMPLATE}" or "predefined" (lowercase letters, digits, dashes or underscores, ` +
        'starting with a letter). For a template outside templates/cores, pass --template <path>.',
    )
  }
  const coreName = args.options.coreName ?? `${name}-core`
  assertCoreName(coreName)

  const host = args.options.host ?? DEFAULT_DEV_HOST
  assertHost(host)

  const land = args.options.land ?? DEFAULT_SCOPE_NAME
  const colony = args.options.colony ?? DEFAULT_SCOPE_NAME
  assertScopeName('--land', land)
  assertScopeName('--colony', colony)

  assertSecret('--jwt', args.options.jwt)
  assertSecret('--key', args.options.key)

  // The flags that only exist to configure a core are refused rather than ignored here.
  // `--no-core` is a `create` flag, so it is reachable directly, and `hamolus create acme
  // --no-core --mode bridge` would otherwise write a workspace whose every core setting
  // describes a Worker that is not being generated. The wizard never produces this pair —
  // it decides the core before it reaches this point — so the check costs one line and
  // turns a silently-wrong project into an error.
  guardNoCore(args.options)

  const output = args.options.output
    ? resolve(process.cwd(), args.options.output)
    : resolve(process.cwd(), name)
  return {
    name,
    mode: args.options.mode ?? 'independent',
    output,
    core: args.options.core,
    template: args.options.template,
    coreName,
    host,
    land,
    colony,
    jwt: args.options.jwt,
    key: args.options.key,
    link: args.options.link,
    noCore: args.options.noCore ?? false,
    partHint: args.options.partHint,
    force: args.flags.force,
    dryRun: args.flags.dryRun,
  }
}

/**
 * `--no-core` means this project has no core, so every flag that configures one is a
 * contradiction rather than a preference.
 *
 * Exported and called from the wizard as well as from here, because the wizard can reach
 * `runCreate` with a different set of options than the command line had: `argsFor` rebuilds
 * them, so a check that only ran at the edge was skipped for every wizard run. `--no-core
 * --mode bridge` through a part flag wrote a workspace whose every core setting described
 * a Worker that was never generated.
 */
export function guardNoCore(options: ParsedArgs['options']): void {
  if (!options.noCore) return
  const coreOnly = [
    ['--mode', options.mode],
    ['--core', options.core],
    ['--core-name', options.coreName],
    ['--land', options.land],
    ['--colony', options.colony],
    ['--jwt', options.jwt],
    ['--key', options.key],
    // A seed is not a core setting, but it has the same requirement: the script POSTs to
    // a core, so a project with no core could never run it. Listing it here is what makes
    // `--no-core --seed basic` an error instead of a `seeds/` directory that fails on its
    // first fetch.
    ['--seed', options.seed],
  ].filter(([, value]) => value !== undefined)
  if (coreOnly.length === 0) return
  const names = coreOnly.map(([name]) => name).join(', ')
  throw new Error(
    `Cannot combine --no-core with ${names}: ${names.includes('--seed') ? 'a seed needs' : 'those configure'} ` +
      'a core, and --no-core means this project has none.\n' +
      'Drop --no-core to get a core, or drop the core flags to get just the workspace.',
  )
}

function scopeFor(name: string): string {
  return `@${name.replace(/[_\-.]+/g, '-')}`
}

function projectTokens(options: CreateOptions): Record<string, string> {
  // Cloudflare resource names (D1 database, R2 bucket, KV namespace, Worker) only
  // allow lowercase letters, digits and hyphens, so they are derived from the
  // kebab-case slug — never from a snake_case project name, which would produce an
  // invalid `bucket_name` and fail `wrangler deploy`.
  const slug = options.name.replace(/_/g, '-')
  const coreSlug = options.coreName.replace(/_/g, '-')
  return {
    PROJECT_NAME: options.name,
    PROJECT_LABEL: formatLabel(options.name),
    PROJECT_SCOPE: scopeFor(options.name),
    PROJECT_SLUG: slug,
    // The core is a package and a Worker in its own right, so it is named separately
    // from the project: one workspace cannot hold two packages called `acme-core`.
    CORE_NAME: options.coreName,
    CORE_SLUG: coreSlug,
    CORE_LABEL: formatLabel(options.coreName),
    CORE_MODE: options.mode,
    // A multi-tenant core must not hand out unauthenticated reads, so PUBLIC_GETS is
    // mode-aware in both `wrangler.jsonc` (what deploys use) and `.env.example`.
    PUBLIC_GETS: options.mode === 'independent' ? 'true' : 'false',
    // The address `pnpm dev` binds to. Written into the dev script rather than left
    // implicit, so "why can my phone not open this" is answered by the file rather
    // than by remembering which flag the project was created with.
    DEV_HOST: options.host,
    DEFAULT_LAND: options.land,
    DEFAULT_COLONY: options.colony,
    DB_NAME: `${slug}-db`,
    BUCKET_NAME: `${slug}-media`,
    KV_NAMESPACE: `${slug}-settings`,
  }
}

/**
 * Workspace globs, minus the core's when there is no core.
 *
 * A glob that matches no directory is not an error — pnpm ignores it — so listing `core`
 * for a core-less project would be harmless. It is dropped anyway because the file is the
 * first thing anyone reads to see what a project contains, and a `core` entry on a project
 * with no core is a statement about the project that is false.
 */
const CORE_GLOBS = ['core', 'core/scripts']
const PART_GLOBS = ['console', 'configs/*', 'panels/*', 'mcp', 'seeds/*', 'site']

const workspaceGlobs = (noCore: boolean): string =>
  [...(noCore ? [] : CORE_GLOBS), ...PART_GLOBS].join('\n')

/**
 * Transitive dependencies whose install scripts this project trusts.
 *
 * pnpm 10+ refuses to run an install script until the package is approved, and both
 * Wrangler's toolchain and Astro's image pipeline need one. Without approval every
 * `pnpm -F ./core typecheck` in a fresh clone fails with ERR_PNPM_IGNORED_BUILDS, so a
 * generated project has to ship the approval.
 *
 * Declared once and written into **both** settings pnpm reads. That redundancy is not
 * caution, it is what the two settings are for — `onlyBuiltDependencies` is the list form
 * and `allowBuilds` the map form, and pnpm 11 treats the map as authoritative. A project
 * that listed `sharp` in one and not the other installed fine until a site was added,
 * because nothing but Astro pulls `sharp` in: an approval gap that is invisible until the
 * part which needs it exists.
 */
const TRUSTED_BUILD_SCRIPTS = ['esbuild', 'workerd', 'sharp', 'unrs-resolver', 'core-js-pure']

function workspaceManifest(noCore: boolean): string {
  const globs = workspaceGlobs(noCore).split('\n')
    .map((glob) => `  - '${glob}'`)
    .join('\n')
  const allowed = TRUSTED_BUILD_SCRIPTS.map((name) => `  - ${name}`).join('\n')
  const approved = TRUSTED_BUILD_SCRIPTS.map((name) => `  ${name}: true`).join('\n')

  return `packages:
${globs}

# Build scripts of transitive dependencies, trusted for this project.
onlyBuiltDependencies:
${allowed}

allowBuilds:
${approved}
`
}

const ROOT_PACKAGE = (options: CreateOptions): string =>
  `${JSON.stringify(
    {
      name: options.name,
      version: '0.1.0',
      private: true,
      type: 'module',
      license: 'UNLICENSED',
      description: `${formatLabel(options.name)} — a Hamolus project`,
      scripts: {
        // Matches what `devScript()` derives for a project holding only its core, so the
        // first `hamolus add` changes the list rather than the spelling.
        //
        // With no core there is nothing to point at yet, and `--filter ./core` would be a
        // filter matching no package — pnpm exits 0 having started nothing, which reads as
        // a project that works. `-r` is the honest form for a shell that is about to gain
        // its parts: it starts whichever of them define a `dev` script, and `commit`
        // narrows it to an explicit list as soon as the first one lands.
        dev: options.noCore ? 'pnpm -r --parallel dev' : 'pnpm --filter ./core dev',
        build: 'pnpm -r build',
        typecheck: 'pnpm -r typecheck',
        // Deploying *is* deploying the core, so a project without one has nothing to
        // deploy. Leaving the script in would make `pnpm deploy` a no-op that exits 0 —
        // and the generated README points at a core that is not there.
        ...(options.noCore ? {} : { deploy: 'pnpm -F ./core deploy' }),
      },
      devDependencies: {
        typescript: '~5.9.0',
        wrangler: '^4.135.0',
      },
    },
    null,
    2,
  )}\n`

/**
 * Root `tsconfig.base.json` for a generated project.
 *
 * Generated packages carry their own self-contained configs, so this exists for
 * your own packages: `{"extends": "../../tsconfig.base.json"}` then works the same
 * way it does inside the Hamolus monorepo.
 */
function tsconfigBase(): string {
  return `${JSON.stringify({ compilerOptions: BASE_COMPILER_OPTIONS }, null, 2)}\n`
}

const GITIGNORE = `# Dependencies
node_modules/

# Build output
dist/
.wrangler/
*.tsbuildinfo

# Local environment & secrets — never commit
.env
.env.*
!.env.example
.dev.vars
*.dev.vars

# OS
.DS_Store
`

/**
 * `.env.example` for a project that has no core.
 *
 * Every value the full version carries belongs to the core: the two secrets sign sessions
 * the core verifies, `PUBLIC_GETS` and the land/colony triple are read by the core's
 * Worker, and `DEV_HOST` is the address the core binds. None of them are read by a console,
 * an MCP server, a panel or a site — each of those finds its core over HTTP instead, at a
 * URL the person supplies. So the file says where the core lives and stops, rather than
 * shipping nine `change-me` values that no process in the project would ever look at.
 *
 * `ADMIN_KEY` is the exception worth keeping: the console asks for it at sign-in, so
 * knowing which core it belongs to matters even though the project does not store it.
 */
const ENV_EXAMPLE_NO_CORE = `# This project has no core.

A part generated on its own — a console, an MCP server, a panel, a site — talks to a core
that already runs somewhere else, and each one is told where at runtime:

  console   asks for the API endpoint in its navbar, and remembers it per browser
  mcp       reads CORE_API_URL and CORE_ADMIN_KEY from mcp/.dev.vars
  site      reads PUBLIC_HAMOLUS_ORIGIN from site/.env (HAMOLUS_API_ORIGIN on Next.js)
  panel     a page inside the console, which already knows the core

Nothing here is read by Wrangler, because there is no Worker in this project. Copy this
file to .env if a part you add reads one of the names above.

A part that ships a Worker of its own — the MCP server does — keeps its settings in its own
\`.dev.vars\` next to its \`wrangler.jsonc\`, not in this file. Secrets go in \`.dev.vars\`;
plain vars are fine in either.

# Which core the console signs in to.
ADMIN_KEY=
`

function envExample(options: CreateOptions): string {
  if (options.noCore) return ENV_EXAMPLE_NO_CORE
  return [
    '# Shared secrets for this Hamolus project.',
    '# Put real values in core/.dev.vars (git-ignored) or as Wrangler secrets.',
    '# Wrangler only reads the .dev.vars next to core/wrangler.jsonc.',
    options.jwt || options.key
      ? '# core/.dev.vars was generated with working values — `pnpm dev` needs nothing else.'
      : '# Copy this file to core/.dev.vars and fill it in, or let `hamolus init` generate it.',
    '',
    '# Signing secret for console + panel sessions.',
    'JWT_SECRET=change-me',
    '',
    '# Admin login key for the core (used by seeds, the CLI and the console login).',
    'ADMIN_KEY=change-me',
    '',
    '# Optional: HMAC secret for short-lived private panel asset URLs.',
    '# Falls back to JWT_SECRET when unset.',
    'PANEL_ASSET_SECRET=',
    '',
    '# Set to "true" to allow unauthenticated GET requests.',
    `PUBLIC_GETS=${options.mode === 'independent' ? 'true' : 'false'}`,
    '',
    '# Land / colony routing. A bare name is enough — the core appends the _lnd / _cny',
    '# suffix itself, and "default" is the unnamed (root) scope.',
    `CORE_MODE=${options.mode}`,
    `DEFAULT_LAND=${options.land}`,
    `DEFAULT_COLONY=${options.colony}`,
    '',
    '# The interface pnpm dev binds to. 0.0.0.0 exposes the core on the LAN.',
    `DEV_HOST=${options.host}`,
    '',
  ].join('\n')
}

/**
 * `core/.dev.vars` — the local-only secret file Wrangler reads automatically.
 *
 * It has to sit next to `core/wrangler.jsonc`: Wrangler resolves `.dev.vars` relative
 * to the config file, so the same file in the project root is silently ignored and the
 * Worker then starts with no `ADMIN_KEY` (`POST /api/_auth/token` answers
 * `INVALID_KEY`). A generated project that ships a working `pnpm dev` has to write it
 * there, and the file is git-ignored, so the values never reach a commit.
 *
 * A missing half is generated rather than left as `change-me`: the two secrets are
 * always needed together, and half a working pair is a confusing way to start.
 */
function devVars(options: CreateOptions): string {
  const jwt = options.jwt ?? generateSecret()
  const key = options.key ?? generateSecret()
  return [
    `# Local development secrets for the ${formatLabel(options.name)} core.`,
    '#',
    '# Generated by `hamolus create`. This file is git-ignored — the real values belong',
    '# in `wrangler secret put` for anything you deploy.',
    '',
    '# Signing secret for console + panel sessions.',
    `JWT_SECRET=${jwt}`,
    '',
    '# Admin login key: the console login, the CLI and every seed script use it.',
    `ADMIN_KEY=${key}`,
    '',
  ].join('\n')
}

/**
 * The generated project's own README.
 *
 * `core` is reported from what was actually copied rather than from the template's
 * name, so a repository's own template that ships a `src/collections` barrel is
 * described the same way the shipped ones are.
 */
/**
 * README for a project with no core.
 *
 * The full version leads with the core mode, the core template and `core/.dev.vars` —
 * three sections describing a directory that is not here. What a core-less project does
 * have is the part it was created for, and the fact that it needs a core from somewhere
 * else. That is the whole document: where the part points, and what to do next.
 */
const README_NO_CORE = (options: CreateOptions, parts: PartFlag[]): string => {
  // `--console` and `--console --mcp` are both valid, so the sentence and the flag list
  // are both built from the parts rather than from the first one. Reading the first part
  // off a two-part project would produce a README that describes half of it.
  const named_ = parts.map((part) => CORE_LESS_PARTS[part])
  const phrase = listPhrase(named_.map((entry) => entry.phrase))
  const withFlag = named_.map((entry) => entry.withFlag).join(' ')
  return `# ${formatLabel(options.name)}

A [Hamolus](https://github.com/hamolus-labs/hamolus) project created with
\`hamolus create ${options.name}\`.

This project is **${phrase}**, with no core of its own. It talks to a core that already runs
somewhere else, and finds that core at runtime rather than compiling its address in — so
the same build works against a preview, staging or production core without a rebuild.

## Point it at a core

${named_.map((entry) => `- ${entry.addressing}`).join('\n')}

## Want the core in this project as well?

A core is not a part you add afterwards: it is a project in its own right, because it owns
the database, the buckets and the secrets. So it is a second command, either beside this one
or in it:

\`\`\`bash
# beside it — a separate project, which is what this one already assumes
hamolus create ${options.name}-core

# in it — the core, plus the ${phrase} this project already has
hamolus create ${options.name}-full ${withFlag}
\`\`\`

## Dev

\`pnpm dev\` starts whatever this project has that runs. \`hamolus add <part>\` adds
another part.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`
}

/**
 * One entry per part that can be a whole project: how to read it, how it is told where the
 * core is, and the `--with-` flag that would have produced the same project *with* a core.
 *
 * One table rather than three, because the three answers have to agree: a README that says
 * "an MCP server" and then suggests `--with-console` is worse than one that says nothing.
 */
/**
 * How each part is told where its core is, one line per part.
 *
 * Shared with the closing message `init` prints, because that message used to describe
 * every part regardless of which ones the project actually had: a panel-only project was
 * told to set `PUBLIC_HAMOLUS_ORIGIN` for a `site/` that did not exist.
 */
export function partAddressing(parts: PartFlag[]): string[] {
  return parts.map((part) => CORE_LESS_PARTS[part].addressing)
}

/** `a console`, `an MCP server and a site` — the list as a person would say it. */
function listPhrase(entries: string[]): string {
  if (entries.length === 0) return 'a workspace with no parts yet'
  if (entries.length === 1) return entries[0]!
  return `${entries.slice(0, -1).join(', ')} and ${entries.at(-1)}`
}

export const CORE_LESS_PARTS = {
  console: {
    phrase: 'a console',
    addressing: 'The console asks for the API endpoint in its navbar and remembers it per browser.',
    withFlag: '--with-console',
  },
  mcp: {
    phrase: 'an MCP server',
    addressing:
      'Set `CORE_API_URL` in `mcp/.dev.vars` to the core\'s `/api` base, and `CORE_ADMIN_KEY` to that core\'s admin key ' +
      '(or `CORE_API_TOKEN` to a scoped user token). `MCP_BEARER_TOKEN` is a different thing: it authenticates callers ' +
      'to `/mcp`, not the server to the core.',
    withFlag: '--with-mcp',
  },
  site: {
    phrase: 'a site',
    addressing: 'Set `PUBLIC_HAMOLUS_ORIGIN` in `site/.env` (`HAMOLUS_API_ORIGIN` on Next.js) to the core\'s origin.',
    withFlag: '--with-site',
  },
  panel: {
    phrase: 'a panel',
    addressing: 'A panel is a page inside the console, which already knows which core it is talking to.',
    withFlag: '--with-panel',
  },
} as const satisfies Record<PartFlag, { phrase: string; addressing: string; withFlag: string }>

const PROJECT_README = (
  options: CreateOptions,
  core: { template: string; codeDefinitions: boolean },
): string => `# ${formatLabel(options.name)}

A [Hamolus](https://github.com/hamolus-labs/hamolus) project created with
\`hamolus create ${options.name}\`.

- **Core mode**: \`${options.mode}\` (see \`core/README.md\`)
- **Core template**: \`${core.template}\` — ${
    core.codeDefinitions
      ? 'ships a collection and a panel defined in `core/src/` (edit those files, not the API)'
      : 'no collections or panels yet — create them in the console or the API'
  }
- **Dev interface**: \`${options.host}\` — ${
    options.host === DEFAULT_DEV_HOST
      ? 'local only'
      : `reachable from other devices on the network as http://${options.host}:8787`
  }

## Dev ports

\`pnpm dev\` reads these from the environment, so a second checkout on the same machine
is a variable rather than a source edit:

\`\`\`bash
HAMOLUS_CORE_PORT=8797 HAMOLUS_MCP_PORT=8798 pnpm dev
\`\`\`

They are \`wrangler dev\` settings only. A deployed Worker is addressed by its URL and
has no port, so nothing here affects a deploy.

## Layout

\`\`\`
core/       the API Worker — dynamic CRUD on D1, KV settings, R2 libraries
console/    (optional) admin console        \`hamolus add console\`
panels/     (optional) generated panel apps \`hamolus add panel <name>\`
mcp/        (optional) MCP server            \`hamolus add mcp\`
site/       (optional) Astro / Next.js site  \`hamolus add site <name>\`
seeds/      (optional) seed scripts          \`hamolus add seed <name>\`
\`\`\`

## Commands

\`\`\`bash
pnpm install
pnpm dev        # every part, in parallel — the core, plus the console, MCP
                # server and site if you added them
pnpm typecheck
pnpm build
\`\`\`

The core answers on http://localhost:8787 and the MCP server on
http://localhost:8788, so a single \`pnpm dev\` is enough to drive all of them.

## Secrets

${
  options.jwt || options.key
    ? '`core/.dev.vars` was generated with a random `JWT_SECRET` and `ADMIN_KEY`, so ' +
      '`pnpm dev` and the console login work as they are. The file is git-ignored. Never ' +
      'commit it, and rotate both values before deploying anything.'
    : 'Copy `.env.example` to `core/.dev.vars` and fill it in, or run ' +
      '`hamolus init --yes` to have a working pair generated. Never commit real secrets.'
}
Wrangler reads \`.dev.vars\` from the directory holding \`wrangler.jsonc\`, so it has to be
the one in \`core/\` — a copy in the project root is ignored and the core then starts
without an \`ADMIN_KEY\`.
${
  options.mode === 'independent'
    ? ''
    : `
## Scope

Bare (unprefixed) requests resolve to land \`${options.land}\` and colony
\`${options.colony}\`. Both live in \`core/wrangler.jsonc\` as \`DEFAULT_LAND\` and
\`DEFAULT_COLONY\`, and \`hamolus add configuration <land>\` adds a deployment preset
per land.
`
}`

export async function runCreate(args: ParsedArgs): Promise<void> {
  const options = parseCreateOptions(args)
  const tokens = projectTokens(options)
  const relativeCore = 'core'

  // Resolved only when there is a core to resolve a template for. A core-less project
  // never looks at `templates/cores`, which also means it cannot fail on a missing or
  // renamed core template — a console is not interested in which schema a core would have
  // shipped with.
  const template = options.noCore ? undefined : await resolveCoreTemplate(options)
  const link = await resolveLinkRoot(options.link)

  if (options.dryRun) {
    info(`Dry run — nothing written. Planned output in ${options.output}:`)
    if (template) {
      step(`${dim('template')} ${template.origin}: ${template.directory}`)
      step(`${dim('core')}    ${relativeCore}/  (${options.coreName}, ${options.mode})`)
    } else {
      step(`${dim('core')}    none — the workspace only`)
    }
    step(`${dim('root')}    package.json, pnpm-workspace.yaml, ${PROJECT_FILE}, .gitignore, .env.example, README.md`)
    if (options.jwt || options.key) step(`${dim('secrets')}  core/.dev.vars`)
    if (link) step(`${dim('link')}     @hamolus/* → ${link.packages}`)
    return
  }

  await mkdir(options.output, { recursive: true })

  // `template` is only undefined for a core-less project, and a core-less project has no
  // core directory to copy into — the two facts are the same fact, so the narrowing below
  // is the compiler agreeing rather than a second guess.
  const copied = template
    ? await copyTemplate(template.directory, join(options.output, relativeCore), tokens, {
        force: options.force,
      })
    : { files: 0, written: [] as string[] }

  // Written after the core, because it belongs next to the core's `wrangler.jsonc` and
  // has to be replaced rather than merged when `--force` regenerates over it.
  const withSecrets = Boolean(options.jwt || options.key)
  if (withSecrets && template) {
    await writeFile(join(options.output, relativeCore, '.dev.vars'), devVars(options), 'utf8')
  }

  const linked =
    link && template
      ? await linkManifestFile(join(options.output, relativeCore, 'package.json'), link)
      : []

  const project: Project = {
    version: PROJECT_FILE_VERSION,
    name: options.name,
    scope: scopeFor(options.name),
    createdAt: now(),
    updatedAt: now(),
    // Recorded so `hamolus add console|mcp|panel` links the same checkout instead of
    // silently going back to the registry half-way through scaffolding a project.
    ...(link ? { link: link.root } : {}),
    // A part added later inherits the answers `create` already settled, so a project
    // created to be reachable over the LAN does not lose that on its second part.
    devHost: options.host,
    // Tenancy, land and colony are properties of a core. On a project that has none they
    // are left out rather than defaulted: `mode: independent` on a core-less project
    // would be read by `hamolus list` and by `add site` as a core that exists and is
    // single-tenant, and the first thing either would then say is a warning about a land
    // there is nothing to route.
    ...(options.noCore
      ? {}
      : { mode: options.mode, ...(options.mode === 'independent' ? {} : { land: options.land, colony: options.colony }) }),
    parts: template
      ? [
          {
            kind: 'core',
            id: options.name,
            label: `${formatLabel(options.name)} core`,
            path: relativeCore,
            // The template that was actually copied, so `hamolus list` can say where the
            // core came from — `--core predefined` and a mode override are both different
            // directories, and reporting `basic` for either would be a lie.
            source: template.source,
            generatedAt: now(),
          },
        ]
      : [],
  }

  await writeFile(join(options.output, 'package.json'), ROOT_PACKAGE(options), 'utf8')
  await writeFile(join(options.output, 'pnpm-workspace.yaml'), workspaceManifest(options.noCore), 'utf8')
  await writeProject(options.output, project)
  await writeFile(join(options.output, '.gitignore'), GITIGNORE, 'utf8')
  await writeFile(join(options.output, '.env.example'), envExample(options), 'utf8')
  await writeFile(
    join(options.output, 'README.md'),
    options.noCore
      ? README_NO_CORE(options, options.partHint ?? [])
      : PROJECT_README(options, {
          template: template!.source,
          // A `src/collections` barrel is what a code-defined schema looks like on disk,
          // and it is the one file whose presence decides the wording above.
          codeDefinitions: copied.written.some((path) =>
            path.endsWith(join('src', 'collections', 'index.ts')),
          ),
        }),
    'utf8',
  )
  // Packages generated by the CLI ship self-contained tsconfigs, but your own code
  // needs a base to extend, exactly like the Hamolus monorepo has.
  await writeFile(join(options.output, 'tsconfig.base.json'), tsconfigBase(), 'utf8')

  if (options.noCore) {
    success(`Created ${formatLabel(options.name)} — no core in ${options.output}`)
    info(`parts: none yet — this is the workspace ${listPhrase((options.partHint ?? []).map((part) => CORE_LESS_PARTS[part].phrase))} is added into`)
    step(`${dim('dev')}     ${options.host === DEFAULT_DEV_HOST ? 'localhost only' : options.host}`)

    if (link) {
      info(`link: @hamolus/* → ${link.packages} (applied by the parts you add)`)
    }

    next([
      `cd ${options.name}`,
      'pnpm install',
      ...(options.partHint ?? []).map((part) => `hamolus add ${part === 'console' ? 'console' : part}`),
      ...(link ? [] : ['# not published yet? re-link the checkout:', 'hamolus link <path-to-hamolus>']),
    ])
    return
  }

  success(`Created ${formatLabel(options.name)} (${options.mode}) in ${options.output}`)
  info(`core: ${copied.files} files from ${template!.origin}`)
  step(`${dim('dev')}     ${options.host === DEFAULT_DEV_HOST ? 'localhost only' : options.host}`)

  if (withSecrets) {
    info(`secrets: core/.dev.vars (JWT_SECRET + ADMIN_KEY generated, git-ignored)`)
  }

  if (link) {
    info(`link: ${linked.length} @hamolus/* deps → ${link.packages}`)
    for (const spec of linked) step(`${dim('link')}    ${spec}`)
  }

  if (options.mode !== 'independent') {
    warn(
      `Mode "${options.mode}" resolves bare requests to land "${options.land}" / colony ` +
        `"${options.colony}". Change it in core/wrangler.jsonc, or add a preset with ` +
        '`hamolus add configuration <land>`.',
    )
  }

  next([
    `cd ${options.name}`,
    'pnpm install',
    // The root `dev` script starts the core and anything else in the project. Pointing
    // at one part here is what taught people to open a terminal per part.
    'pnpm dev',
    'hamolus add console',
    ...(link ? [] : ['# not published yet? re-link the checkout:', 'hamolus link <path-to-hamolus>']),
  ])
}

/** A core template that has been located, plus the label recorded for it. */
export interface ResolvedCoreTemplate extends ResolvedTemplate {
  /**
   * Where the files came from, as `hamolus list` should show it: a shipped template
   * (`templates/cores/predefined`) or the directory an explicit `--template` named.
   */
  source: string
}

/**
 * Resolve the core template, and the label `hamolus list` reports for it.
 *
 * With `--core <name>` the name *is* the request: only `cores/<name>` is looked for, so
 * a typo fails loudly instead of quietly producing the default template — silently
 * answering a `--core predefined` with a schema-less core is the one outcome worse than
 * an error, because the project looks fine until something is missing from it.
 *
 * Without it, the candidates are tried in order:
 *
 *   1. `cores/<mode>` — a repository may ship a mode-specific override
 *      (`cores/centralized`, …),
 *   2. `cores/basic`.
 *
 * The mode is a tenancy switch (a `CORE_MODE` var in `wrangler.jsonc`, not a different
 * file tree), so a mode with no template of its own falls back to `basic`.
 *
 * Falling back to `templates/cores` is deliberately *not* done: that directory now
 * holds the named templates, so copying it would emit a core containing a stray
 * `basic/` folder.
 */
async function resolveCoreTemplate(options: CreateOptions): Promise<ResolvedCoreTemplate> {
  if (options.template) {
    const explicit = await resolveTemplateDirectory(options.template, process.cwd(), '')
    if (!explicit) throw new Error(`Template directory not found: ${options.template}`)
    return { ...explicit, source: explicit.directory }
  }

  const candidates = options.core ? [options.core] : [options.mode, BASIC_TEMPLATE]

  for (const name of candidates) {
    const resolved = await resolveTemplateDirectory(undefined, process.cwd(), join('cores', name))
    if (resolved) return { ...resolved, source: `templates/cores/${name}` }
  }

  throw new Error(
    `No core template found (looked for ${candidates.map((name) => `templates/cores/${name}`).join(', ')}).\n` +
      'Pass --core <name> for another template shipped with the CLI, or --template <dir> to point elsewhere.',
  )
}
