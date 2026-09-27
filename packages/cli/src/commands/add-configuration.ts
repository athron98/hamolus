/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add configuration <name>` — generate a wrangler + KV configuration preset.
 *
 * A configuration is the deployment surface of a core: which D1, KV and R2
 * resources it binds to, and which lands/colonies exist. It is generated as a
 * separate file so a project can hold several (staging, production, per-land)
 * without duplicating the core's source.
 */

import { writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ParsedArgs } from '../args.js'
import { formatLabel, resolveTemplateDirectory } from '../templates.js'
import {
  addFromTemplate,
  commit,
  destinationFor,
  ensureWorkspaceGlob,
  guardExisting,
  info,
  openContext,
  requirePartName,
} from './shared.js'

function configurationTokens(name: string, scope: string): Record<string, string> {
  return {
    CONFIG_ID: name,
    CONFIG_NAME: formatLabel(name),
    CONFIG_SLUG: name.replace(/_/g, '-'),
    PACKAGE_NAME: `${scope}/config-${name}`,
  }
}

const CONFIG_MANIFEST = (scope: string, name: string): string =>
  `${JSON.stringify(
    {
      name: `${scope}/config-${name}`,
      version: '0.1.0',
      private: true,
      type: 'module',
      description: `${formatLabel(name)} deployment configuration`,
      scripts: {
        deploy: 'wrangler deploy --config wrangler.jsonc',
        typecheck: 'node --check ./verify.mjs',
      },
      devDependencies: {
        wrangler: '^4.135.0',
      },
    },
    null,
    2,
  )}\n`

const CONFIG_README = (name: string, projectName: string): string => `# ${formatLabel(name)} configuration

Deployment configuration for **${formatLabel(projectName)}**.

## Deploy

\`\`\`bash
pnpm -F ./configs/${name} deploy
\`\`\`

## Create the resources

The \`wrangler.jsonc\` in this directory references resources by name. Create them
once, then replace the placeholder ids:

\`\`\`bash
wrangler d1 create ${projectName}-db
wrangler kv namespace create SETTINGS
wrangler r2 bucket create ${projectName}-media
\`\`\`

## Secrets

Never put real secrets in \`wrangler.jsonc\`. Set them per environment:

\`\`\`bash
wrangler secret put JWT_SECRET --config wrangler.jsonc
wrangler secret put ADMIN_KEY --config wrangler.jsonc
wrangler secret put PANEL_ASSET_SECRET --config wrangler.jsonc
\`\`\`
`

export async function runAddConfiguration(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const name = requirePartName(args, 'configuration')
  const destination = destinationFor(context, join('configs', name))
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'configuration', name, destination)

  if (context.dryRun) {
    info(`Dry run — planned configuration "${name}" at ${destination}`)
    return
  }

  const template = await resolveTemplateDirectory(
    args.options.template,
    process.cwd(),
    join('configurations', 'basic'),
  )

  if (!template) {
    throw new Error(
      'No configuration template found (looked for templates/configurations/basic).\n' +
        'Pass --template <dir> to point at a configuration template.',
    )
  }

  const files = await addFromTemplate({
    context,
    template,
    destination,
    tokens: configurationTokens(name, context.project.scope),
  })

  await writeFile(
    join(destination, 'package.json'),
    CONFIG_MANIFEST(context.project.scope, name),
    'utf8',
  )
  await writeFile(join(destination, 'README.md'), CONFIG_README(name, context.project.name), 'utf8')

  if (await ensureWorkspaceGlob(context.projectRoot, 'configs/*')) {
    info('added `configs/*` to pnpm-workspace.yaml')
  }

  await commit(
    context,
    { kind: 'configuration', id: name, label: `${formatLabel(name)} configuration`, path: relativePath },
    {
      relativePath,
      files,
      origin: `configuration template (${template.origin})`,
      hints: [
        'pnpm install',
        `node configs/${name}/verify.mjs`,
        `pnpm -F ./configs/${name} deploy`,
        'wrangler secret put JWT_SECRET --config configs/' + name + '/wrangler.jsonc',
      ],
    },
  )
}
