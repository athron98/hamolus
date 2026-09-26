/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus create <name>` — scaffold a new Hamolus project.
 *
 * A project is deliberately thin: it contains a **core** (the API Worker) plus the
 * workspace scaffolding needed to build and deploy it. Consoles, panels, MCP
 * servers, plugins and seeds are added afterwards with `hamolus add`, so a project
 * only pays for the parts it actually uses.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { CORE_MODES, type CoreMode } from '../help.js'
import { linkManifestFile, resolveLinkRoot } from '../link.js'
import { PROJECT_FILE, PROJECT_FILE_VERSION, now, writeProject, type Project } from '../project.js'
import { copyTemplate, formatLabel, resolveTemplateDirectory } from '../templates.js'
import { BASE_COMPILER_OPTIONS } from '../tsconfig.js'
import { dim, info, next, step, success, warn } from '../util/log.js'

const NAME_PATTERN = /^[a-z][a-z0-9_-]{0,62}$/

export interface CreateOptions {
  name: string
  mode: CoreMode
  output: string
  template?: string
  /** Hamolus checkout to `@hamolus/*` link into, from `--link`. */
  link?: string
  force: boolean
  dryRun: boolean
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
  const output = args.options.output
    ? resolve(process.cwd(), args.options.output)
    : resolve(process.cwd(), name)
  return {
    name,
    mode: args.options.mode ?? 'independent',
    output,
    template: args.options.template,
    link: args.options.link,
    force: args.flags.force,
    dryRun: args.flags.dryRun,
  }
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
  return {
    PROJECT_NAME: options.name,
    PROJECT_LABEL: formatLabel(options.name),
    PROJECT_SCOPE: scopeFor(options.name),
    PROJECT_SLUG: slug,
    CORE_MODE: options.mode,
    // A multi-tenant core must not hand out unauthenticated reads, so PUBLIC_GETS is
    // mode-aware in both `wrangler.jsonc` (what deploys use) and `.env.example`.
    PUBLIC_GETS: options.mode === 'independent' ? 'true' : 'false',
    DB_NAME: `${slug}-db`,
    BUCKET_NAME: `${slug}-media`,
    KV_NAMESPACE: `${slug}-settings`,
  }
}

const WORKSPACE_GLOBS = [
  'core',
  'core/scripts',
  'console',
  'configs/*',
  'panels/*',
  'mcp',
  'seeds/*',
].join('\n')

function workspaceManifest(): string {
  const globs = WORKSPACE_GLOBS.split('\n')
    .map((glob) => `  - '${glob}'`)
    .join('\n')

  // pnpm 10+ refuses to run a script when a dependency has an unapproved build
  // script, and Wrangler's own toolchain needs esbuild/workerd to build. Without
  // these entries every `pnpm -F ./core typecheck` in a fresh clone fails with
  // ERR_PNPM_IGNORED_BUILDS, so a generated project has to ship them.
  return `packages:
${globs}

# Build scripts of transitive dependencies, trusted for this project.
onlyBuiltDependencies:
  - esbuild
  - workerd
  - sharp
  - unrs-resolver

allowBuilds:
  core-js-pure: true
  esbuild: true
  workerd: true
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
        dev: 'pnpm -F ./core dev',
        build: 'pnpm -r build',
        typecheck: 'pnpm -r typecheck',
        deploy: 'pnpm -F ./core deploy',
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

function envExample(options: CreateOptions): string {
  return [
    '# Shared secrets for this Hamolus project.',
    '# Put real values in core/.dev.vars (git-ignored) or as Wrangler secrets.',
    '# Wrangler only reads the .dev.vars next to core/wrangler.jsonc.',
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
    '# Land / colony routing.',
    `CORE_MODE=${options.mode}`,
    'DEFAULT_LAND=default',
    'COLONY=',
    '',
  ].join('\n')
}

const PROJECT_README = (options: CreateOptions): string => `# ${formatLabel(options.name)}

A [Hamolus](https://github.com/hamolus-labs/hamolus) project created with
\`hamolus create ${options.name}\`.

- **Core mode**: \`${options.mode}\` (see \`core/README.md\`)

## Layout

\`\`\`
core/       the API Worker — dynamic CRUD on D1, KV settings, R2 libraries
console/    (optional) admin console        \`hamolus add console\`
panels/     (optional) generated panel apps \`hamolus add panel <name>\`
mcp/        (optional) MCP server            \`hamolus add mcp\`
seeds/      (optional) seed scripts         \`hamolus add seed <name>\`
\`\`\`

## Commands

\`\`\`bash
pnpm install
pnpm -F ./core dev      # API on http://localhost:8787
pnpm typecheck
pnpm build
\`\`\`

## Secrets

Copy \`.env.example\` to \`core/.dev.vars\` and fill it in. Never commit real secrets.
Wrangler reads \`.dev.vars\` from the directory holding \`wrangler.jsonc\`, so it has to be
the one in \`core/\` — a copy in the project root is ignored and the core then starts
without an \`ADMIN_KEY\`.
`

export async function runCreate(args: ParsedArgs): Promise<void> {
  const options = parseCreateOptions(args)
  const tokens = projectTokens(options)
  const relativeCore = 'core'

  const template = await resolveCoreTemplate(options)
  const link = await resolveLinkRoot(options.link)

  if (options.dryRun) {
    info(`Dry run — nothing written. Planned output in ${options.output}:`)
    step(`${dim('template')} ${template.origin}: ${template.directory}`)
    step(`${dim('core')}    ${relativeCore}/`)
    step(`${dim('root')}    package.json, pnpm-workspace.yaml, ${PROJECT_FILE}, .gitignore, .env.example, README.md`)
    if (link) step(`${dim('link')}     @hamolus/* → ${link.packages}`)
    return
  }

  await mkdir(options.output, { recursive: true })

  const copied = await copyTemplate(template.directory, join(options.output, relativeCore), tokens, {
    force: options.force,
  })

  const linked = link
    ? await linkManifestFile(join(options.output, relativeCore, 'package.json'), link)
    : []

  const project: Project = {
    version: PROJECT_FILE_VERSION,
    name: options.name,
    scope: scopeFor(options.name),
    mode: options.mode,
    createdAt: now(),
    updatedAt: now(),
    // Recorded so `hamolus add console|mcp|panel` links the same checkout instead of
    // silently going back to the registry half-way through scaffolding a project.
    ...(link ? { link: link.root } : {}),
    parts: [
      {
        kind: 'core',
        id: options.name,
        label: `${formatLabel(options.name)} core`,
        path: relativeCore,
        source: 'templates/cores',
        generatedAt: now(),
      },
    ],
  }

  await writeFile(join(options.output, 'package.json'), ROOT_PACKAGE(options), 'utf8')
  await writeFile(join(options.output, 'pnpm-workspace.yaml'), workspaceManifest(), 'utf8')
  await writeProject(options.output, project)
  await writeFile(join(options.output, '.gitignore'), GITIGNORE, 'utf8')
  await writeFile(join(options.output, '.env.example'), envExample(options), 'utf8')
  await writeFile(join(options.output, 'README.md'), PROJECT_README(options), 'utf8')
  // Packages generated by the CLI ship self-contained tsconfigs, but your own code
  // needs a base to extend, exactly like the Hamolus monorepo has.
  await writeFile(join(options.output, 'tsconfig.base.json'), tsconfigBase(), 'utf8')

  success(`Created ${formatLabel(options.name)} (${options.mode}) in ${options.output}`)
  info(`core: ${copied.files} files from ${template.origin}`)

  if (link) {
    info(`link: ${linked.length} @hamolus/* deps → ${link.packages}`)
    for (const spec of linked) step(`${dim('link')}    ${spec}`)
  }

  if (options.mode !== 'independent') {
    warn(
      `Mode "${options.mode}" needs land/colony setup before it is useful — ` +
        'see core/README.md and `hamolus add configuration <land>`.',
    )
  }

  next([
    `cd ${options.name}`,
    'pnpm install',
    'pnpm -F ./core dev',
    'hamolus add console',
    ...(link ? [] : ['# not published yet? re-link the checkout:', 'hamolus link <path-to-hamolus>']),
  ])
}

async function resolveCoreTemplate(options: CreateOptions) {
  const relative = join('cores', options.mode)
  const resolved = await resolveTemplateDirectory(options.template, process.cwd(), relative)
  if (resolved) return resolved
  const fallback = await resolveTemplateDirectory(options.template, process.cwd(), 'cores')
  if (fallback) return fallback
  throw new Error(
    `No core template found for mode "${options.mode}" (looked for templates/${relative}).\n` +
      `Available modes: ${CORE_MODES.join(', ')}. Pass --template <dir> to point elsewhere.`,
  )
}
