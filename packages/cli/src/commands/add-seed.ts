/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus add seed <name>` — generate a self-cleaning seed script.
 *
 * Seeds are plain Node scripts (no build step, no dependencies) that talk to a
 * running core over HTTP. Making them generated rather than hand-written means a
 * new project starts from a script that already knows the authentication flow, the
 * error handling and — importantly — how to clean up after itself.
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
  writeGenerated,
} from './shared.js'

function seedTokens(name: string, scope: string): Record<string, string> {
  return {
    SEED_ID: name,
    SEED_NAME: formatLabel(name),
    SEED_SLUG: name.replace(/_/g, '-'),
    PACKAGE_NAME: `${scope}/seed-${name}`,
  }
}

const SEED_MANIFEST = (scope: string, name: string): string =>
  `${JSON.stringify(
    {
      name: `${scope}/seed-${name}`,
      version: '0.1.0',
      private: true,
      type: 'module',
      description: `${formatLabel(name)} seed script`,
      scripts: {
        seed: 'node ./index.mjs',
        typecheck: 'node --check ./index.mjs',
      },
    },
    null,
    2,
  )}\n`

const SEED_README = (name: string): string => `# ${formatLabel(name)} — seed

A self-cleaning seed script. It talks to a running core over HTTP; no build step and
no dependencies.

## Run

\`\`\`bash
# the admin key is in core/.dev.vars — the wizard generated it
ADMIN_KEY=$(grep '^ADMIN_KEY=' core/.dev.vars | cut -d= -f2-)

# against the local core
BASE=http://localhost:8787 pnpm seed

# against a deployed core
BASE=https://<core-host> ADMIN_KEY=<key> pnpm seed
\`\`\`

\`ADMIN_KEY\` has no default because there is none to have: the wizard generated one
into \`core/.dev.vars\`, and that is the key the core is actually expecting.

## What "self-cleaning" means

The script drops the collections (and media) it manages before recreating them, so
re-running it is safe and never duplicates records. It uses
\`DELETE /api/_meta/collections/{name}\` and \`DELETE /api/_media/{id}\` rather than
truncating tables, because those endpoints also drop the physical D1 tables and R2
objects they own.

## Options

| Variable   | Default                     | Meaning                       |
| ---------- | --------------------------- | ----------------------------- |
| \`BASE\`     | \`http://localhost:8787\`    | Core origin (the script adds \`/api\`) |
| \`ADMIN_KEY\` | —                         | Admin key for the token       |
| \`DRY_RUN\`  | \`false\`                    | Print the plan, write nothing |
`

export async function runAddSeed(args: ParsedArgs): Promise<void> {
  const context = await openContext(args)
  const name = requirePartName(args, 'seed')
  const destination = destinationFor(context, join('seeds', name))
  const relativePath = relative(context.projectRoot, destination)

  guardExisting(context, 'seed', name, destination)

  if (context.dryRun) {
    info(`Dry run — planned seed "${name}" at ${destination}`)
    return
  }

  const template = await resolveTemplateDirectory(
    args.options.template,
    process.cwd(),
    join('seeds', 'basic'),
  )

  if (!template) {
    throw new Error(
      'No seed template found (looked for templates/seeds/basic).\n' +
        'Pass --template <dir> to point at a seed template.',
    )
  }

  const files = await addFromTemplate({
    context,
    template,
    destination,
    tokens: seedTokens(name, context.project.scope),
  })

  await writeFile(
    join(destination, 'package.json'),
    SEED_MANIFEST(context.project.scope, name),
    'utf8',
  )
  await writeFile(join(destination, 'README.md'), SEED_README(name), 'utf8')
  await writeGenerated(context, join(destination, '.gitignore'), 'node_modules/\n')

  if (await ensureWorkspaceGlob(context.projectRoot, 'seeds/*')) {
    info('added `seeds/*` to pnpm-workspace.yaml')
  }

  await commit(
    context,
    { kind: 'seed', id: name, label: `${formatLabel(name)} seed`, path: relativePath },
    {
      relativePath,
      files,
      origin: `seed template (${template.origin})`,
      // The hint has to survive a generated key. `ADMIN_KEY=dev-admin-key-change-me` is
      // the pre-generation default, and printing it next to a core that now holds a
      // random one is a 401 waiting to happen — so the hint reads the real key instead.
      hints: [
        'pnpm install',
        'ADMIN_KEY=$(grep "^ADMIN_KEY=" core/.dev.vars | cut -d= -f2-) ' +
          `pnpm -F ./seeds/${name} seed`,
      ],
    },
  )
}
