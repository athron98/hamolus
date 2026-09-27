/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add console` — generate a console inside an existing project.
 *
 * The console is no longer vendored. `@hamolus/console` is published as a *library*
 * — a pre-built Vite bundle plus a stylesheet — so a generated console is a thin
 * static app that installs the package and calls `mount()` from plain TypeScript.
 * Copying the package's source in (which is what this command used to do) would
 * fork the UI at a file level: every console fix would have to be re-generated.
 *
 * What actually changes per project is the shell, and that is what the template
 * holds: the entry module, the `console.config.ts` preferences, the Vite/wrangler
 * config and the static index.html.
 */

import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { formatLabel, resolveTemplateDirectory } from '../templates.js'
import {
  addFromTemplate,
  assertTemplateNotSource,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
} from './shared.js'

const BASIC_TEMPLATE = 'basic'

/** Template tokens understood by the console template. */
export function consoleTokens(
  project: { name: string; scope: string },
): Record<string, string> {
  return {
    PROJECT_NAME: project.name,
    PROJECT_LABEL: formatLabel(project.name),
    PROJECT_SCOPE: project.scope,
    PROJECT_SLUG: project.name.replace(/_/g, '-'),
    PACKAGE_NAME: `${project.scope}/console`,
  }
}

export async function runAddConsole(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const destination = destinationFor(context, 'console')
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'console', 'console', destination)

  const template = await resolveTemplateDirectory(
    args.options.template,
    process.cwd(),
    join('consoles', BASIC_TEMPLATE),
  )

  if (context.dryRun) {
    info(`Dry run — planned console at ${destination}`)
    info(`  source: ${template ? `template ${template.directory} (${template.origin})` : 'none found'}`)
    return
  }

  assertTemplateNotSource(args, 'console')

  if (!template) {
    throw new Error(
      `No console template found (looked for templates/consoles/${BASIC_TEMPLATE}).\n` +
        'The console package is a library, not an app skeleton, so there is nothing to ' +
        'copy from it — pass --template <dir> to point at a console template.',
    )
  }

  const files = await addFromTemplate({
    context,
    template,
    destination,
    tokens: consoleTokens(context.project),
  })

  // A linked checkout (`hamolus create --link .`) cannot fetch the runtime from npm
  // yet, so `commit` rewrites the generated manifest's `@hamolus/*` deps to `link:`.
  if (await ensureWorkspaceGlob(context.projectRoot, 'console')) {
    info('added `console` to pnpm-workspace.yaml')
  }

  await commit(
    context,
    { kind: 'console', id: 'console', label: 'Console', path: relativePath },
    {
      relativePath,
      files,
      origin: `console template (${template.origin})`,
      hints: [
        'pnpm install',
        'pnpm -F ./console dev',
        // The runtime lives in the generated manifest, so an unlinked project fails to
        // install with a bare 404 until it is published. Mirrors add panel.
        ...(context.link ? [] : ['# not published yet? re-link the checkout:', 'hamolus link <path-to-hamolus>']),
        'hamolus add plugin todo    # optional: KV-backed to-do list',
      ],
    },
  )
}
