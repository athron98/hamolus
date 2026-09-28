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

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { formatLabel, resolveTemplateDirectory } from '../templates.js'
import { BASIC_TEMPLATE, DEFAULT_DEV_HOST } from './create.js'
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
 * The default port `wrangler dev` serves the MCP server on.
 *
 * `wrangler dev` defaults to 8787, which is also where the core runs, so two parts that
 * both leave the port implicit collide the moment a root `pnpm dev` starts them in
 * parallel — the second one exits on `EADDRINUSE` and the only symptom is an MCP server
 * that is missing for reasons that appear to have nothing to do with the port. Naming
 * the port is what makes the four dev servers coexist.
 *
 * Only a *default*. The generated `dev` script reads `MCP_DEV_PORT` from the
 * environment and falls back to this, so a second checkout of the same project on one
 * machine is `MCP_DEV_PORT=8798 pnpm dev` rather than a source edit.
 */
export const MCP_DEV_PORT = 8788

/**
 * Tokens for `templates/mcps/basic`.
 *
 * Cloudflare Worker names only allow lowercase letters, digits and hyphens, so the
 * worker name comes from the kebab-case slug — never from the snake_case project name.
 * `DEV_HOST` is inherited from the project for the same reason as the console's: a part
 * added after `hamolus create --host 0.0.0.0` has to answer on the same addresses the
 * core does, or the two halves of a project disagree about what "local" means.
 */
function mcpTokens(project: { name: string; scope: string; devHost?: string }): Record<string, string> {
  return {
    PROJECT_NAME: project.name,
    PROJECT_LABEL: formatLabel(project.name),
    PROJECT_SCOPE: project.scope,
    PROJECT_SLUG: project.name.replace(/_/g, '-'),
    PACKAGE_NAME: `${project.scope}/mcp`,
    DEV_HOST: project.devHost ?? DEFAULT_DEV_HOST,
    DEV_PORT: String(MCP_DEV_PORT),
  }
}

/**
 * Give the MCP server a working key, so `pnpm dev` authenticates with no manual step.
 *
 * The MCP server reaches the core over HTTP with a bearer token, and `packages/mcp` mints
 * one from `CORE_ADMIN_KEY` when `CORE_API_TOKEN` is unset. Left unset, the server still
 * boots and still answers `GET /` with 200, so it looks healthy — and then every single tool
 * call fails with "No CORE_API_TOKEN or CORE_ADMIN_KEY configured for the MCP server." That
 * is the worst shape of failure: nothing in the startup output is wrong, and the message
 * blames a configuration the person never knew existed.
 *
 * When the project has its own core, the wizard already generated that core's `ADMIN_KEY`,
 * so handing the same value to the MCP server is not a new secret — it is the one key that
 * was generated a moment earlier. It goes in `mcp/.dev.vars` rather than in `wrangler.jsonc`
 * `vars` for two reasons: `vars` is committed, and a secret and a var can never share a name
 * in one config. `*.dev.vars` is git-ignored by the project's own `.gitignore`, and Wrangler
 * resolves `.dev.vars` relative to the config it sits next to — which is why this is
 * `mcp/.dev.vars` and not a copy of the core's file.
 *
 * A core-less project gets nothing: its core runs somewhere else, and the key for a core
 * this CLI did not generate is not something to invent. The hint says what to fill in.
 *
 * @returns true when a key was wired, false when the project has no core key to share.
 */
export function wireMcpDevVars(projectRoot: string, key: string | undefined): boolean {
  if (!key) return false
  const destination = join(projectRoot, 'mcp', '.dev.vars')
  writeFileSync(
    destination,
    [
      '# Local development secrets for the MCP server.',
      '#',
      '# Written by `hamolus` when the MCP server was added. It holds the same ADMIN_KEY as',
      '# core/.dev.vars, so the server can mint a token on startup and every tool call works',
      '# without anyone copying a file or pasting a key. Both files are git-ignored.',
      '#',
      '# This is a *local* key. A deployed MCP server needs its own, set with',
      '# `wrangler secret put` — see the mcp README.',
      '',
      `CORE_ADMIN_KEY=${key}`,
      '',
    ].join('\n'),
    'utf8',
  )
  return true
}

/** Read one `KEY=value` out of a core `.dev.vars`, ignoring comments and blank lines. */
function readDevVar(path: string, name: string): string | undefined {
  if (!existsSync(path)) return undefined
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    if (!trimmed.startsWith(`${name}=`)) continue
    const value = trimmed.slice(name.length + 1).trim()
    return value === '' ? undefined : value
  }
  return undefined
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

  // A project that already has a core shares its key; one that does not needs its own, and
  // is told so in the hint rather than left to discover it from a failing tool call.
  // `mode` is what a project with no core does not have, so it is the signal that there is
  // no local key to share. A core-less project points at somebody else's core, and inventing
  // a key for it would be worse than saying so.
  const wired = context.project.mode
    ? wireMcpDevVars(
        context.projectRoot,
        readDevVar(join(context.projectRoot, 'core', '.dev.vars'), 'ADMIN_KEY'),
      )
    : false

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
        // Not "cp mcp/.env.example mcp/.dev.vars" any more. `CORE_API_URL` is already a
        // dev default in `wrangler.jsonc`, and the `.env.example` copy of it points at a
        // *deployed* core — so that instruction replaced a working value with a
        // placeholder and then asked for a key on top.
        ...(wired
          ? ['pnpm dev                     # the MCP server and the core, on :8788 and :8787']
          : [
              'pnpm dev                     # the MCP server and the core, on :8788 and :8787',
              '',
              'This project has no core of its own, so mcp/.dev.vars was not written.',
              'Point it at your core and give it a key:',
              '  echo "CORE_API_URL=https://<your-core>/api" > mcp/.dev.vars',
              '  echo "CORE_ADMIN_KEY=<your-core ADMIN_KEY>"        >> mcp/.dev.vars',
            ]),
      ],
    },
  )
}
