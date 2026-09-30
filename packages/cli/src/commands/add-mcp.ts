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
 * is a *deployment decision*: teams often run it, some never do.
 *
 * What it authenticates with is the part worth knowing. It used to hold the core's
 * `ADMIN_KEY` — platform-wide, every land and colony, with "read only" a promise the
 * worker made rather than a rule the core enforced. Now it holds an *instance id*:
 * a handle to one configured instance whose scope, write access and tool groups live
 * in the core, and whose callers present per-user tokens the console issued. The
 * generated server therefore ships two variables and no secrets, and a deployment
 * that wants a different scope, a different tool set, or a different set of callers
 * changes that in the console instead of redeploying.
 *
 * Generated from `templates/mcps/basic`, exactly like a core: the part is a small
 * seam that depends on `@hamolus/mcp` rather than a vendored copy of its source, so
 * upgrading the package upgrades the tool surface of every generated server.
 */

import { writeFileSync } from 'node:fs'
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

/** The port `wrangler dev` serves a core on. */
const CORE_DEV_PORT = 8787

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
 * Write `mcp/.dev.vars`, so `pnpm dev` boots with a reachable core and a clear next step.
 *
 * There is no longer a secret to wire. The server authenticates to the core with an
 * *instance id*, not a key, and every decision that key used to imply — which land and
 * colony, read-only or not, which tool groups, who may call it — now lives in the core
 * and is edited from the console. So the file written here is deliberately boring:
 *
 *   CORE_API_URL     where the core is
 *   MCP_INSTANCE_ID  blank, because only a person who has opened the console can know it
 *
 * The blank id is the honest state, not a placeholder to fill in blindly. With it unset
 * the server still boots and still answers `GET /` with 200, so it looks healthy — and
 * then `POST /mcp` refuses every call with "this MCP server is console-managed, send a
 * token". That message names the fix, which is why there is nothing else to write.
 *
 * @param coreUrl the core's `/api` base, when the project has a core of its own.
 * @returns true when a core URL was written, false for a core-less project.
 */
export function wireMcpDevVars(projectRoot: string, coreUrl: string | undefined): boolean {
  if (!coreUrl) return false
  const destination = join(projectRoot, 'mcp', '.dev.vars')
  writeFileSync(
    destination,
    [
      '# Local development settings for the MCP server.',
      '#',
      '# Written by `hamolus` when the MCP server was added. Git-ignored.',
      '',
      `CORE_API_URL=${coreUrl}`,
      '',
      '# Create the instance in the console (Environment -> MCP) and paste its id here.',
      '# Nothing else needs configuring: the console owns the scope, the read-only',
      '# switch, the tool groups and the tokens, and the server picks up changes to',
      '# them without a redeploy.',
      'MCP_INSTANCE_ID=',
      '',
    ].join('\n'),
    'utf8',
  )
  return true
}

/**
 * The core URL a generated MCP server reads in development.
 *
 * `0.0.0.0` is a bind address, not a destination: handed to a `fetch`, it is rejected
 * on some systems and the failure looks like the core being down. The wildcard becomes
 * `localhost` — the same substitution the generated site makes, and for the same reason.
 */
export function coreApiUrl(devHost: string | undefined): string {
  const host = devHost && devHost !== '0.0.0.0' && devHost !== '::' ? devHost : 'localhost'
  return `http://${host}:${CORE_DEV_PORT}/api`
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

  // A project that already has a core shares its development URL; one that does not is
  // told exactly which two lines to write, because inventing a core's address for it
  // would be worse than saying so. `mode` is the signal that there is no local core to
  // point at — a core-less project uses somebody else's.
  const wired = context.project.mode
    ? wireMcpDevVars(context.projectRoot, coreApiUrl(context.project.devHost))
    : false

  warn('The MCP server takes its whole configuration from the console. There is no key to set here.')

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
          ? [
              'pnpm dev                     # the MCP server and the core, on :8788 and :8787',
              '',
              'Then, in the console: Environment -> MCP -> create an instance, and copy its id',
              'into MCP_INSTANCE_ID in mcp/.dev.vars. Issue a token there and send it to the',
              'agent as `Authorization: Bearer <token>`.',
            ]
          : [
              'pnpm dev                     # the MCP server and the core, on :8788 and :8787',
              '',
              'This project has no core of its own, so mcp/.dev.vars was not written.',
              'Point the server at your core in two lines:',
              `  echo "CORE_API_URL=https://<your-core>/api" > mcp/.dev.vars`,
              `  echo "MCP_INSTANCE_ID=<id from the console>"     >> mcp/.dev.vars`,
            ]),
      ],
    },
  )
}
