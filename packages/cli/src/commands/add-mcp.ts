/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add mcp` — generate an MCP server for an existing project.
 *
 * The MCP server is a thin, stateless Cloudflare Worker that proxies the core API
 * as Model Context Protocol tools, so an agent (opencode, Claude, …) can read and
 * write a project's data. Generated separately from the core because an MCP server
 * is a *deployment decision*: teams often run it, some never do, and it holds its
 * own token.
 *
 * Generated from `templates/mcps/basic`, exactly like a core: the part is a small
 * seam that depends on `@hamolus/mcp` rather than a vendored copy of its source, so
 * upgrading the package upgrades the tool surface of every generated server.
 */

import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { formatLabel, resolveTemplateDirectory } from '../templates.js'
import { BASIC_TEMPLATE } from './create.js'
import {
  addFromTemplate,
  assertTemplateNotSource,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
  warn,
} from './shared.js'

/**
 * Tokens for `templates/mcps/basic`.
 *
 * Cloudflare Worker names only allow lowercase letters, digits and hyphens, so the
 * worker name comes from the kebab-case slug — never from the snake_case project name.
 */
function mcpTokens(project: { name: string; scope: string }): Record<string, string> {
  return {
    PROJECT_NAME: project.name,
    PROJECT_LABEL: formatLabel(project.name),
    PROJECT_SCOPE: project.scope,
    PROJECT_SLUG: project.name.replace(/_/g, '-'),
    PACKAGE_NAME: `${project.scope}/mcp`,
  }
}

export async function runAddMcp(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const destination = destinationFor(context, 'mcp')
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'mcp', 'mcp', destination)

  if (context.dryRun) {
    info(`Dry run — planned MCP server at ${destination}`)
    return
  }

  assertTemplateNotSource(args, 'mcp')

  const template = await resolveTemplateDirectory(
    args.options.template,
    process.cwd(),
    join('mcps', BASIC_TEMPLATE),
  )

  if (!template) {
    throw new Error(
      `No MCP template found (looked for templates/mcps/${BASIC_TEMPLATE}).\n` +
        'Pass --template <dir> to point at an MCP template.',
    )
  }

  const files = await addFromTemplate({
    context,
    template,
    destination,
    tokens: mcpTokens(context.project),
  })

  if (await ensureWorkspaceGlob(context.projectRoot, 'mcp')) {
    info('added `mcp` to pnpm-workspace.yaml')
  }

  warn('Keep MCP_BEARER_TOKEN set and prefer a scoped user token over the admin key.')

  await commit(
    context,
    { kind: 'mcp', id: 'mcp', label: 'MCP server', path: relativePath },
    {
      relativePath,
      files,
      origin: `mcp template (${template.origin})`,
      hints: [
        'pnpm install',
        'cp mcp/.env.example mcp/.dev.vars   # fill in CORE_API_URL + auth',
        'pnpm -F ./mcp dev',
      ],
    },
  )
}
