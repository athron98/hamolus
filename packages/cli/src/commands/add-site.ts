/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add site <name>` — generate a public site that reads the core over REST.
 *
 * A site is the one part that never authenticates. It calls `GET /api/{collection}`
 * with no token, which is why the core has to have `PUBLIC_GETS` on (the default for an
 * `independent` core) and why a multi-tenant core has to be given a land first. The
 * templates therefore ship a hand-written REST client rather than `@hamolus/panel`:
 * that package is pinned to the panel endpoints and *requires* a token, and pulling an
 * admin SDK into a public bundle would add attack surface without adding capability.
 *
 * Generated into `sites/<name>/` and registered in `pnpm-workspace.yaml`, so
 * `pnpm -F ./sites/<name> dev` works the same way as every other part.
 */

import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { formatLabel, resolveTemplateDirectory } from '../templates.js'
import { DEFAULT_DEV_HOST } from './create.js'
import {
  addFromTemplate,
  assertTemplateNotSource,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
  requirePartName,
  warn,
} from './shared.js'

/** Site templates ship as `sites/<framework>/basic`, so the framework is the name. */
export const DEFAULT_SITE_FRAMEWORK = 'astro'

/** Every site template has a name inside its framework directory. */
const TEMPLATE_NAME = 'basic'

/** The port `wrangler dev` serves a core on; a site has to be pointed at it. */
const CORE_PORT = 8787

/**
 * The core URL a generated site reads.
 *
 * `0.0.0.0` is a bind address, not a destination: a browser or a fetch that is handed
 * `http://0.0.0.0:8787` reaches the host on most systems but is rejected outright on
 * others, and the failure looks like the core being down. The wildcard therefore becomes
 * `localhost`, which is what the person who asked to expose the core on the LAN is
 * actually running it on.
 */
export function coreOrigin(devHost: string | undefined): string {
  const host = devHost && devHost !== '0.0.0.0' && devHost !== '::' ? devHost : 'localhost'
  return `http://${host}:${CORE_PORT}`
}

/**
 * Tokens for a site template.
 *
 * `SITE_ID` is the part name and `SITE_SLUG` its kebab-case form, the same split the
 * core templates use for a project: the id is what the directory and `hamolus.json`
 * call it, the slug is what a domain or a Worker name can hold.
 */
export function siteTokens(
  project: { name: string; scope: string; devHost?: string },
  name: string,
): Record<string, string> {
  return {
    PROJECT_NAME: project.name,
    PROJECT_LABEL: formatLabel(project.name),
    PROJECT_SCOPE: project.scope,
    PROJECT_SLUG: project.name.replace(/_/g, '-'),
    SITE_ID: name,
    SITE_NAME: formatLabel(name),
    SITE_SLUG: name.replace(/_/g, '-'),
    SITE_LABEL: formatLabel(name),
    PACKAGE_NAME: `${project.scope}/site-${name}`,
    CORE_ORIGIN: coreOrigin(project.devHost),
    DEV_HOST: project.devHost ?? DEFAULT_DEV_HOST,
  }
}

/**
 * Where a site's files come from.
 *
 * `--template` names a framework (`astro`, `nextjs`) or a directory of your own. A bare
 * name is looked up under `templates/sites/<name>/basic`, matching how `--core` picks a
 * named core template; anything carrying a separator or a leading dot is a path, because
 * a framework name is a single segment by definition and a path is not.
 *
 * The leading dot is the case worth spelling out: `--template .` and `--template ..`
 * are the two shortest ways of pointing at a template, and treating them as a framework
 * name sends the lookup to `templates/sites/./basic` and reports that no framework by
 * that name exists — an error that names a typo the user did not make.
 */
async function resolveSiteTemplate(explicit: string | undefined) {
  const framework = explicit ?? DEFAULT_SITE_FRAMEWORK
  const isPath = explicit !== undefined && (/[/\\]/.test(explicit) || explicit.startsWith('.'))
  return resolveTemplateDirectory(
    isPath ? explicit : undefined,
    process.cwd(),
    join('sites', isPath ? TEMPLATE_NAME : framework, TEMPLATE_NAME),
  )
}

export async function runAddSite(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const name = requirePartName(args, 'site')
  const destination = destinationFor(context, join('sites', name))
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'site', name, destination)

  const template = await resolveSiteTemplate(args.options.template)

  if (context.dryRun) {
    info(`Dry run — planned site "${name}" at ${destination}`)
    info(`  source: ${template ? `template ${template.directory} (${template.origin})` : 'none found'}`)
    return
  }

  assertTemplateNotSource(args, 'site')

  if (!template) {
    throw new Error(
      `No site template found (looked for templates/sites/${args.options.template ?? DEFAULT_SITE_FRAMEWORK}/basic).\n` +
        'Pass --template <framework> for another one shipped with the CLI, or --template <dir> to point at your own.',
    )
  }

  const files = await addFromTemplate({
    context,
    template,
    destination,
    tokens: siteTokens(context.project, name),
  })

  if (await ensureWorkspaceGlob(context.projectRoot, 'sites/*')) {
    info('added `sites/*` to pnpm-workspace.yaml')
  }

  // A site is the one part that talks to a core over plain unauthenticated GETs, so
  // these two are the reasons a freshly added site can build perfectly and then return
  // 403 for every record. Both are deliberate defaults of a multi-tenant core — it
  // refuses unauthenticated reads, and it resolves a bare request to its default land —
  // so neither is a bug to fix in the site. They are called out here because the first
  // symptom the site author meets is an empty page, and nothing in the generated code
  // points at the cause.
  if (context.project.mode !== 'independent') {
    if (!context.project.land) {
      warn(
        'A multi-tenant core resolves bare requests to its default land. A site reads ' +
          'unprefixed URLs, so check the land in core/wrangler.jsonc before the first build.',
      )
    }
    warn(
      'This core has PUBLIC_GETS=false, so the core will reject a site\'s unauthenticated ' +
        'requests with 403. Either sign the requests, or set PUBLIC_GETS=true in ' +
        'core/wrangler.jsonc for a core whose records are meant to be public.',
    )
  }

  await commit(
    context,
    { kind: 'site', id: name, label: `${formatLabel(name)} site`, path: relativePath },
    {
      relativePath,
      files,
      origin: `site template (${template.origin})`,
      hints: [
        'pnpm install',
        'pnpm -F ./core dev          # the site reads the core over REST — start it first',
        `pnpm -F ./${relativePath} dev`,
        `cp ${relativePath}/.env.example ${relativePath}/.env`,
      ],
    },
  )
}
