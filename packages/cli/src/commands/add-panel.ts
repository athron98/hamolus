/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add panel <name>` — generate a panel app inside an existing project.
 *
 * A panel is a small SolidJS app whose entire UI is derived from a **panel
 * manifest** in the core: which collection to show, which fields to read or write,
 * which view, and which role may see it. There is no per-panel coding — the CLI
 * generates one app and the manifest decides what it does.
 *
 * The generated app is built from the `@hamolus/panel` runtime plus a template, so
 * regenerating a panel is safe: only the name-specific substitutions change.
 */

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { linkManifestFile } from '../link.js'
import { fallbackRange, resolveSource, resolveWorkspaceDependencyVersion } from '../sources.js'
import { formatLabel, resolveTemplateDirectory } from '../templates.js'
import {
  addFromSource,
  addFromTemplate,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
  requirePartName,
  warn,
  type AddContext,
} from './shared.js'

const PANEL_RUNTIME_PACKAGE = '@hamolus/panel'
const TYPES_PACKAGE = '@hamolus/types'

/**
 * Build a semver range from a concrete version, dropping any pre-release/build
 * suffix so `1.0.0-rc.1` becomes `^1.0.0` rather than an unsatisfiable pin.
 */
function rangeFromVersion(version: string | undefined): string | undefined {
  if (!version) return undefined
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  if (!match) return undefined
  return `^${match[1]}.${match[2]}.${match[3]}`
}

/** Template tokens understood by the panel template. */
export function panelTokens(name: string, scope: string): Record<string, string> {
  return {
    PANEL_ID: name,
    PANEL_NAME: formatLabel(name),
    PANEL_SLUG: name.replace(/_/g, '-'),
    PACKAGE_NAME: `${scope}/panel-${name}`,
    PROJECT_SCOPE: scope,
  }
}

function panelManifest(
  name: string,
  scope: string,
  projectName: string,
  runtimeRange: string,
  typesRange: string,
): string {
  return `${JSON.stringify(
    {
      name: `${scope}/panel-${name}`,
      version: '0.1.0',
      private: true,
      type: 'module',
      description: `${formatLabel(name)} panel for ${formatLabel(projectName)}`,
      scripts: {
        dev: 'vite',
        build: 'tsc --noEmit && vite build',
        typecheck: 'tsc --noEmit',
        deploy: 'pnpm build && wrangler deploy',
      },
      // A generated panel is self-contained: its Solid app is copied in, and the
      // Hamolus panel runtime is a real published package. There is no
      // `@hamolus/panel-<name>` package to depend on, so nothing is put in
      // `dependencies` — a `workspace:*` spec there would fail `pnpm install`.
      dependencies: {},
      devDependencies: {
        [PANEL_RUNTIME_PACKAGE]: runtimeRange,
        // The copied Solid app imports DTO types directly, and a generated app lives
        // outside this monorepo, so an undeclared import would not resolve at all.
        [TYPES_PACKAGE]: typesRange,
        'solid-js': '^1.9.15',
        typescript: '~5.9.0',
        vite: '^8.3.0',
        'vite-plugin-solid': '^2.11.14',
        wrangler: '^4.135.0',
      },
    },
    null,
    2,
  )}\n`
}

const PANEL_README = (name: string, projectName: string): string => `# ${formatLabel(name)} — panel

A generated panel app for **${formatLabel(projectName)}**. Everything this app
shows is defined by a panel manifest in the core, not by code.

## 1. Create the manifest

\`\`\`bash
hamolus add panel ${name}          # this app
\`\`\`

Then, in the core, \`PUT /api/_panels\` with a manifest that names the collection,
view, fields and roles you want. The console has a manifest editor under
**Panels** if you prefer a form.

## 2. Configure

\`\`\`bash
VITE_PANEL_API_URL=http://localhost:8787/api \\
VITE_PANEL_API_TOKEN=<a panel_user token> \\
VITE_PANEL_LAND=default \\
pnpm dev
\`\`\`

The token is visible in the browser bundle. Mint it for a real \`panel_user\`, never
for an admin.

## 3. Access control

Panel runtime routes require a panel session, and the **manifest** is the ACL: the
field's \`read\`/\`write\` lists and the role's view access decide what is visible.
A Panel user needs no global permission.
`

export async function runAddPanel(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const name = requirePartName(args, 'panel')
  const destination = destinationFor(context, join('panels', name))
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'panel', name, destination)

  // A panel is a page *inside* the console, so a project with no console has nowhere to
  // show it: the app builds, `pnpm dev` serves it, and nobody ever loads it. `hamolus add
  // panel` has always allowed this — a panel is genuinely a separate app that a console
  // can be told to load — so it is a warning here rather than a refusal, which would break
  // the legitimate order of "generate the panel app first, add the console next".
  //
  // The bare `--panel` flag is where it bites hardest, since it promises a project that
  // is a panel and nothing else, and that project cannot display itself.
  const hasConsole = context.project.parts.some((part) => part.kind === 'console')
  if (!hasConsole && !context.dryRun) {
    warn(
      'This project has no console, and a panel is a page inside the console — nothing ' +
        'will load it until there is one.\n' +
        'Add the console with `hamolus add console`, and point both at the same core.',
    )
  }

  const tokens = panelTokens(name, context.project.scope)

  // A panel template (if the repo ships one) is the better source: it already knows
  // about the current runtime shape. Fall back to the published runtime package.
  const template = await resolveTemplateDirectory(
    args.options.template,
    process.cwd(),
    join('panels', 'basic'),
  )

  if (context.dryRun) {
    info(`Dry run — planned panel "${name}" at ${destination}`)
    info(
      template
        ? `  source: template ${template.directory} (${template.origin})`
        : `  source: ${PANEL_RUNTIME_PACKAGE} (runtime package)`,
    )
    return
  }

  let files: number
  let origin: string
  // The generated app imports the panel runtime for its client + types, so the
  // version is pinned to a range instead of `latest`: a future breaking publish
  // must not silently change a generated project's build.
  // Per package rather than one shared constant: these two are lockstep today, but
  // the fallback table is the single place that knows a version, and a second copy
  // of it in this file is a second thing to forget.
  let runtimeRange = fallbackRange(PANEL_RUNTIME_PACKAGE)
  let typesRange = fallbackRange(TYPES_PACKAGE)

  if (template) {
    files = await addFromTemplate({ context, template, destination, tokens })
    origin = `panel template (${template.origin})`
  } else {
    const source = await resolveSource({
      defaultPackage: PANEL_RUNTIME_PACKAGE,
      projectRoot: context.projectRoot,
      explicitSource: args.options.source,
      explicitPackage: args.options.package,
    linkRoot: context.link?.root,
    })
    files = await addFromSource({ context, sourceDirectory: source.directory, destination })
    origin = `${source.package} ${source.version ?? ''} (${source.origin})`.trim()
    runtimeRange = rangeFromVersion(source.version) ?? fallbackRange(PANEL_RUNTIME_PACKAGE)
    const typesVersion = await resolveWorkspaceDependencyVersion(source.directory, TYPES_PACKAGE)
    typesRange = rangeFromVersion(typesVersion) ?? fallbackRange(TYPES_PACKAGE)
    warn('No panel template found; generated a bare app from the runtime package.')
  }

  await writeFile(
    join(destination, 'package.json'),
    panelManifest(name, context.project.scope, context.project.name, runtimeRange, typesRange),
    'utf8',
  )
  await writeFile(join(destination, 'README.md'), PANEL_README(name, context.project.name), 'utf8')

  if (await ensureWorkspaceGlob(context.projectRoot, 'panels/*')) {
    info('added `panels/*` to pnpm-workspace.yaml')
  }

  // The runtime package is required for types; make sure the project can resolve it.
  await ensureRuntimeDependency(context, PANEL_RUNTIME_PACKAGE, runtimeRange)

  await commit(
    context,
    {
      kind: 'panel',
      id: name,
      label: `${formatLabel(name)} panel`,
      path: relativePath,
    },
    {
      relativePath,
      files,
      origin,
      hints: [
        'pnpm install',
        `VITE_PANEL_API_URL=http://localhost:8787/api pnpm -F ${context.project.scope}/panel-${name} dev`,
        // The runtime package is added as a root devDependency, so an unlinked project
        // resolves it from the registry and `pnpm install` fails with a bare 404 when
        // it is not published yet. Mirrors the guidance `hamolus create` prints.
        ...(context.link ? [] : ['# not published yet? re-link the checkout:', 'hamolus link <path-to-hamolus>']),
      ],
    },
  )
}

/** Add a devDependency to the project root manifest when it is missing. */
/**
 * Record the panel runtime in the project's root manifest.
 *
 * The runtime is a root devDependency rather than a per-panel one so that a project with
 * many panels installs it once. That makes the root manifest a link target too: leaving the
 * registry range there would make `pnpm install` fail for a package that is not published
 * yet, so the project's link is applied to the manifest right after it is written.
 */
async function ensureRuntimeDependency(
  context: AddContext,
  packageName: string,
  version: string,
): Promise<void> {
  const manifestPath = join(context.projectRoot, 'package.json')
  if (!existsSync(manifestPath)) return
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    devDependencies?: Record<string, string>
  }
  if (!manifest.devDependencies?.[packageName]) {
    manifest.devDependencies = { ...(manifest.devDependencies ?? {}), [packageName]: version }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
  // Applied unconditionally: the dependency may already be present from an earlier
  // `hamolus add panel` run made before the project was linked.
  const applied = await linkManifestFile(manifestPath, context.link)
  for (const spec of applied) info(`link  ${spec}`)
}
