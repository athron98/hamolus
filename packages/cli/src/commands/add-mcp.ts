/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
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
 */

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { resolveSource } from '../sources.js'
import { formatLabel } from '../templates.js'
import { readTsconfig, tsconfigJson } from '../tsconfig.js'
import {
  addFromSource,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
  warn,
} from './shared.js'

const MCP_PACKAGE = '@hamolus/mcp'

async function readCoreVersion(projectRoot: string): Promise<string | undefined> {
  const manifestPath = join(projectRoot, 'core', 'package.json')
  if (!existsSync(manifestPath)) return undefined
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { version?: string }
    return manifest.version
  } catch {
    return undefined
  }
}

function mcpManifest(scope: string, projectName: string): string {
  return `${JSON.stringify(
    {
      name: `${scope}/mcp`,
      version: '0.1.0',
      private: true,
      type: 'module',
      description: `MCP server for ${formatLabel(projectName)}`,
      scripts: {
        dev: 'wrangler dev',
        build: 'wrangler deploy --dry-run --outdir=dist',
        typecheck: 'tsc --noEmit',
        deploy: 'wrangler deploy',
      },
      dependencies: {
        '@modelcontextprotocol/server': '^2.1.0',
        agents: '^0.24.0',
        zod: '^4.6.5',
      },
      devDependencies: {
        '@cloudflare/workers-types': '^5.20260920.0',
        typescript: '~5.9.0',
        wrangler: '^4.135.0',
      },
    },
    null,
    2,
  )}\n`
}

const MCP_ENV_EXAMPLE = `# Core the MCP server talks to. The server is a separate
# deployment, so it points at your deployed core, not localhost.
CORE_API_URL=https://<core-host>/api

# Auth for the core. Prefer a scoped user token; fall back to ADMIN_KEY.
CORE_API_TOKEN=
CORE_ADMIN_KEY=

# Optional land / colony scoping.
CORE_LAND=default
CORE_COLONY=

# Require this bearer token on POST /mcp. Strongly recommended when public.
MCP_BEARER_TOKEN=

# Set to "true" to refuse every write tool.
MCP_READONLY=false
`

const MCP_README = (projectName: string, coreVersion?: string): string => `# MCP server

Model Context Protocol server for **${formatLabel(projectName)}** — exposes the core
API as tools so an AI agent can drive the data directly.

${
  coreVersion
    ? `Generated against core \`@hamolus/core@${coreVersion}\`. Tools are resolved from the\ncore at runtime, so only the tool surface needs to match.`
    : 'No core version was detected; tools are resolved from the core at runtime.'
}

## Run locally

\`\`\`bash
pnpm install
cp .env.example .dev.vars     # fill in CORE_API_URL + auth
pnpm dev                      # http://localhost:8789/mcp
\`\`\`

## Connect an agent

The endpoint is \`POST /mcp\` (Streamable HTTP, stateless). Your client must accept
both \`application/json\` and \`text/event-stream\`.

For opencode, add to \`~/.config/opencode/opencode.jsonc\`:

\`\`\`jsonc
{
  "mcp": {
    "my-project": { "type": "remote", "url": "http://localhost:8789/mcp", "enabled": true }
  }
}
\`\`\`

## Safety

- \`MCP_READONLY=true\` disables every write tool.
- \`MCP_BEARER_TOKEN\` gates the endpoint. Without it, anyone who knows the URL can call it.
- Use a scoped user token rather than the admin key where possible.
`

export async function runAddMcp(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const destination = destinationFor(context, 'mcp')
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'mcp', 'mcp', destination)

  if (context.dryRun) {
    info(`Dry run — planned MCP server at ${destination}`)
    return
  }

  const source = await resolveSource({
    defaultPackage: MCP_PACKAGE,
    projectRoot: context.projectRoot,
    explicitSource: args.options.source,
    explicitPackage: args.options.package,
  linkRoot: context.link?.root,
  })
  const coreVersion = await readCoreVersion(context.projectRoot)

  const files = await addFromSource({ context, sourceDirectory: source.directory, destination })

  await writeFile(join(destination, 'package.json'), mcpManifest(context.project.scope, context.project.name), 'utf8')
  await writeFile(join(destination, '.env.example'), MCP_ENV_EXAMPLE, 'utf8')

  // The source MCP package extends the monorepo's root tsconfig, which does not
  // exist in a generated project, so its tsconfig is rewritten as a standalone
  // config with the base options inlined.
  const copiedTsconfig = join(destination, 'tsconfig.json')
  if (existsSync(copiedTsconfig)) {
    await writeFile(
      copiedTsconfig,
      tsconfigJson('mcp', {
        include: ['src'],
        local: readTsconfig(await readFile(copiedTsconfig, 'utf8')),
      }),
      'utf8',
    )
  }

  await writeFile(
    join(destination, 'README.md'),
    MCP_README(context.project.name, coreVersion),
    'utf8',
  )

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
      origin: `${source.package} ${source.version ?? ''} (${source.origin})`.trim(),
      sourcePackage: source.package,
      sourceVersion: source.version,
      hints: ['pnpm install', 'cp mcp/.env.example mcp/.dev.vars', 'pnpm -F ./mcp dev'],
    },
  )
}
