/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add console` — generate a console inside an existing project.
 *
 * A console is a *generated* app, not a vendored copy of ours: the CLI resolves
 * the published `@hamolus/console` package (or a local checkout), copies its
 * source in, and rewrites the manifest so the generated app depends on the core
 * and the shared types by published version rather than by workspace protocol.
 */

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import {
  readSourceManifest,
  resolveDependencyRange,
  resolveSource,
  resolveWorkspaceDependencyVersion,
  type SourceManifest,
} from '../sources.js'
import { readTsconfig, tsconfigJson } from '../tsconfig.js'
import { formatLabel } from '../templates.js'
import {
  addFromSource,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
  type AddContext,
} from './shared.js'

const DEFAULT_SOURCE_PACKAGE = '@hamolus/console'

/**
 * Dependency ranges written into the generated console manifest.
 *
 * The generated console is a standalone app: it reaches the core over HTTP, so it
 * does *not* depend on the core package. Every range that arrived as a
 * `workspace:` protocol spec is rewritten onto a published version, because the
 * generated project sits outside this monorepo and `pnpm install` would reject
 * `workspace:*` there.
 */
function dependencyRanges(manifest: SourceManifest, typesVersion: string): {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
} {
  const dependencies: Record<string, string> = {}
  for (const [name, requested] of Object.entries(manifest.dependencies ?? {})) {
    dependencies[name] =
      name === '@hamolus/types' ? typesVersion : resolveDependencyRange(requested, requested)
  }

  const devDependencies: Record<string, string> = {}
  for (const [name, requested] of Object.entries(manifest.devDependencies ?? {})) {
    devDependencies[name] = resolveDependencyRange(requested, requested)
  }

  return { dependencies, devDependencies }
}

function consoleManifest(options: {
  projectName: string
  scope: string
  source: SourceManifest
  typesVersion: string
}): string {
  const { projectName, scope, source, typesVersion } = options
  const { dependencies, devDependencies } = dependencyRanges(source, typesVersion)
  return `${JSON.stringify(
    {
      name: `${scope}/console`,
      version: '0.1.0',
      private: true,
      type: 'module',
      description: `${formatLabel(projectName)} console`,
      scripts: {
        dev: 'vite',
        build: 'tsc --noEmit && vite build',
        typecheck: 'tsc --noEmit',
        deploy: 'pnpm build && wrangler deploy',
      },
      dependencies,
      devDependencies,
    },
    null,
    2,
  )}\n`
}

const CONSOLE_README = (projectName: string): string => `# Console

The admin console for **${formatLabel(projectName)}**: collections, records, media,
files, panels, users and land scope.

## Run it

\`\`\`bash
pnpm install
CORE_API_URL=http://localhost:8787 pnpm dev
\`\`\`

\`CORE_API_URL\` is the Vite dev proxy target. It must point at your core — the
default \`8787\` is only correct if the core is running there.

## Pointing at a deployed core

\`\`\`bash
VITE_API_BASE=https://<core-host>/api pnpm build
\`\`\`

## Notes

- Login uses the core's \`ADMIN_KEY\` (or a user account created in the core).
- The console is per-land: set the land when signing in, and switch from the navbar.
- Plugins are **not** included. Add them with \`hamolus add plugin <name>\`.
`

/**
 * The published `@hamolus/types` range for the generated console.
 *
 * The source declares it as `workspace:*`, so the real version is read from the
 * source package's own `node_modules` and pinned as a caret range.
 */
async function typesRange(
  source: { directory: string; version?: string },
  manifest: SourceManifest,
): Promise<string> {
  const requested = manifest.dependencies?.['@hamolus/types'] ?? 'workspace:*'
  const discovered = await resolveWorkspaceDependencyVersion(source.directory, '@hamolus/types')
  return resolveDependencyRange(requested, requested, discovered ?? source.version)
}

export async function runAddConsole(args: ParsedArgs): Promise<void> {
  const context: AddContext = await openContext(args)
  const destination = destinationFor(context, 'console')
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'console', 'console', destination)

  const source = await resolveSource({
    defaultPackage: DEFAULT_SOURCE_PACKAGE,
    projectRoot: context.projectRoot,
    explicitSource: args.options.source,
    explicitPackage: args.options.package,
  linkRoot: context.link?.root,
  })

  const sourceManifest = await readSourceManifest(source.directory)

  if (context.dryRun) {
    info(`Dry run — planned console at ${destination}`)
    info(`  source: ${source.package} ${source.version ?? 'unknown'} (${source.origin})`)
    return
  }

  const files = await addFromSource({
    context,
    sourceDirectory: source.directory,
    destination,
    entries: sourceManifest.hamolus?.copy,
  })

  // The published manifest is replaced with a project-scoped one.
  await writeFile(
    join(destination, 'package.json'),
    consoleManifest({
      projectName: context.project.name,
      scope: context.project.scope,
      source: sourceManifest,
      typesVersion: await typesRange(source, sourceManifest),
    }),
    'utf8',
  )

  await writeFile(join(destination, 'README.md'), CONSOLE_README(context.project.name), 'utf8')

  // The source console extends the monorepo's root tsconfig, which does not exist
  // in a generated project, so its tsconfig is rewritten as a standalone config.
  const copiedTsconfig = join(destination, 'tsconfig.json')
  if (existsSync(copiedTsconfig)) {
    await writeFile(
      copiedTsconfig,
      tsconfigJson('console', {
        include: ['src', 'vite.config.ts'],
        local: readTsconfig(await readFile(copiedTsconfig, 'utf8')),
      }),
      'utf8',
    )
  }

  if (await ensureWorkspaceGlob(context.projectRoot, 'console')) {
    info('added `console` to pnpm-workspace.yaml')
  }

  await commit(
    context,
    {
      kind: 'console',
      id: 'console',
      label: 'Console',
      path: relativePath,
    },
    {
      relativePath,
      files,
      origin: `${source.package} ${source.version ?? ''} (${source.origin})`.trim(),
      sourcePackage: source.package,
      sourceVersion: source.version,
      hints: [
        'pnpm install',
        'CORE_API_URL=http://localhost:8787 pnpm -F ./console dev',
        `hamolus add plugin todo    # optional: KV-backed to-do list`,
      ],
    },
  )
}
