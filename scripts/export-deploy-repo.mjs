#!/usr/bin/env node
/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Export the deployable packages to standalone GitHub repositories.
 *
 * ## Why this exists
 *
 * Cloudflare's "Deploy to Cloudflare" button does not upload anything. It opens a
 * screen where the reader forks a public GitHub repository into their own account,
 * names the Worker, and Cloudflare provisions the KV namespace / D1 database / R2
 * bucket and builds it through Workers Builds. The button is therefore a property
 * of *a public repository*, not of a package on npm, and it cannot be bolted onto
 * a project generated locally by `hamolus create` — there is no repository URL to
 * hand the button.
 *
 * So the deploy targets have to exist as real repositories. The trap is that a
 * copied repository silently rots: `athron98/hamolus-core` is exactly that — a
 * snapshot of `packages/core` from before the field types, land/colony DTOs and
 * `formatCurrency` -> `formatCurrencyDisplay` rename landed. It cannot typecheck
 * against the current `@hamolus/types`, and nothing in the release process noticed.
 *
 * This script is the answer to that. These repositories are *generated*, never
 * hand-edited: `packages/*` stays the single source of truth, and every release
 * regenerates them. `--check` exports into a scratch directory and diffs, so drift
 * is a failing gate rather than a stale deploy nobody notices.
 *
 * ## What the export changes, and why each is required
 *
 *  - `workspace:*` becomes a real semver range. A standalone clone has no
 *    `pnpm-workspace.yaml` to resolve `workspace:*` against, so `pnpm install`
 *    fails outright — and Cloudflare's build runs that install, so the button
 *    would deploy a repository that cannot even install.
 *  - Placeholder resource ids are dropped from `wrangler.jsonc`. A placeholder is
 *    an *invalid* id, not an absent one, and Wrangler only auto-provisions when the
 *    id is absent. The placeholder id in `packages/core/wrangler.jsonc` is
 *    deliberate for a local project (see `hamolus add configuration`), but there is
 *    nobody standing in front of a first deploy to paste a real one.
 *  - A `pnpm-workspace.yaml` with `allowBuilds` is written. pnpm >= 10 refuses
 *    dependency lifecycle scripts by default, and `workerd` — the Workers runtime
 *    itself — is one of them. Blocked, wrangler cannot start. It also carries a
 *    `packages` key, because a settings-only workspace file reads as a workspace with
 *    no members and pnpm then refuses to run anything at all.
 *  - Scripts that shell out to `pnpm` are rewritten to `npm run`. An exported repo
 *    ships no lockfile, so which package manager builds it is Cloudflare's choice, not
 *    ours — a script that names pnpm only works if it guessed the same one.
 *  - `prepack` is dropped. It shells out to `../cli/scripts/copy-license.mjs`, a
 *    path that only exists inside the monorepo.
 *
 * Usage:
 *
 *   node scripts/export-deploy-repo.mjs                 # write to --dest
 *   node scripts/export-deploy-repo.mjs --check         # fail if --dest has drifted
 *   node scripts/export-deploy-repo.mjs --dest <dir>
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const ORG = 'hamolus-labs'

/**
 * The packages that are themselves deployable Workers, and the repository each one
 * is published to. `console` is here because it ships an `index.html` and a
 * `wrangler.jsonc` alongside its library build — it is an app that also happens to
 * publish a lib, not a lib alone.
 */
const TARGETS = [
  { pkg: 'core', repo: 'core', kind: 'worker' },
  { pkg: 'console', repo: 'console', kind: 'app' },
  { pkg: 'mcp', repo: 'mcp', kind: 'worker' },
]

/**
 * Build output, dependency trees, and anything machine-local that must never be copied.
 *
 * `.dev.vars` is the important one: the monorepo checkout has one holding a live
 * ADMIN_KEY and JWT_SECRET. It is git-ignored, so it would not be *committed* — but
 * copying a real admin key into a scratch directory is exposure the git-ignore is
 * not there to prevent, and the exported repo generates its own. `.env.example` is
 * deliberately not in this list: the example is meant to be published.
 */
const SKIP = new Set([
  'node_modules',
  'dist',
  'dist-lib',
  '.turbo',
  '.wrangler',
  '.next',
  'coverage',
  '.dev.vars',
  '.env',
  '.DS_Store',
])

/** The placeholder ids used across the templates, which Wrangler cannot accept. */
const PLACEHOLDER_ID = /^\s*"(?:database_id|id)"\s*:\s*"(?:0{32}|0{8}-0{4}-0{4}-0{4}-0{12})"/
const IS_DASH = (p) => p === '--check' || p === '--dest'

function parseArgs(argv) {
  const args = { check: false, dest: resolve(REPO, '..', 'hamolus-deploy-repos') }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') args.check = true
    else if (argv[i] === '--dest') args.dest = resolve(argv[++i])
  }
  return args
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`)

/** Version of a lockstep package, so `workspace:*` can become a real range. */
function versionOf(shortName) {
  return readJson(join(REPO, 'packages', shortName, 'package.json')).version
}

/**
 * Copy a package directory, dropping everything that is build output.
 *
 * `dist`/`dist-lib` matter most: a stale bundle from the monorepo would shadow
 * whatever Cloudflare builds from source, which is a deploy that looks successful
 * and runs old code.
 */
function copyPackage(pkg, into) {
  rmSync(into, { recursive: true, force: true })
  cpSync(join(REPO, 'packages', pkg), into, {
    recursive: true,
    filter: (src) => !SKIP.has(src.split('/').pop()) && !src.endsWith('.tsbuildinfo'),
  })
}

/**
 * Make a package installable on its own.
 *
 * `workspace:*` is a pnpm-internal protocol with no meaning outside a workspace, so
 * a standalone clone cannot resolve it. `@hamolus/types` is published in lockstep
 * with everything else, so the sibling's own version is the correct range.
 */
function fixPackageJson(pkg, into) {
  const path = join(into, 'package.json')
  const json = readJson(path)

  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const block = json[field]
    if (!block) continue
    for (const [name, range] of Object.entries(block)) {
      if (range !== 'workspace:*') continue
      const short = name.replace(/^@hamolus\//, '')
      if (!existsSync(join(REPO, 'packages', short, 'package.json'))) {
        throw new Error(`${pkg}: ${name} is a workspace package with no local source to version from`)
      }
      block[name] = `^${versionOf(short)}`
    }
  }

  if (json.scripts) {
    // Only meaningful inside the monorepo, and it points at a path that is not exported.
    delete json.scripts.prepack

    // A script that shells out to `pnpm` names a package manager this repository does
    // not control. Cloudflare picks the manager from whatever lockfile it finds, and an
    // exported repo ships none — so the same fork can install under bun and then fail on
    // the first command that assumed pnpm. `npm run` is the one spelling that works
    // under every manager, because each of them puts `node_modules/.bin` on PATH before
    // running a script. The monorepo keeps pnpm; only the copy is rewritten.
    //
    // The argument must be a bare script name. `pnpm -F <pkg> <script>` is a different
    // shape with no `npm run` equivalent, and rewriting it would produce a command that
    // is not merely wrong but unparseable, so anything filtered here is left alone.
    for (const [name, body] of Object.entries(json.scripts)) {
      if (typeof body !== 'string') continue
      json.scripts[name] = body.replace(/(^|&& |\|\| )pnpm (?!-)([a-z][\w:]*)(?=\s|$)/g, '$1npm run $2')
    }
  }

  writeJson(path, json)
}

/**
 * Drop placeholder resource ids so Wrangler provisions the resources on deploy.
 *
 * A placeholder is worse than nothing: Wrangler auto-provisions only when the id is
 * *absent*, and an id of all zeros is present but invalid, so deploy fails on the
 * resource lookup instead of creating it.
 *
 * Removing the line can leave a dangling comma, so the previous content line has its
 * trailing comma stripped too. JSONC parsers usually tolerate it, but a config that
 * only parses because the parser is lenient is a config that will surprise someone
 * later.
 */
function dropPlaceholderIds(into) {
  const path = join(into, 'wrangler.jsonc')
  if (!existsSync(path)) return
  const lines = readFileSync(path, 'utf8').split('\n')
  const kept = []
  for (const line of lines) {
    if (PLACEHOLDER_ID.test(line)) {
      for (let i = kept.length - 1; i >= 0; i -= 1) {
        if (kept[i].trim() === '') continue
        kept[i] = kept[i].replace(/,(\s*)$/, '$1')
        break
      }
      continue
    }
    kept.push(line)
  }
  writeFileSync(path, kept.join('\n'))
}

/**
 * pnpm >= 10 blocks dependency lifecycle scripts unless they are allowlisted, and
 * `workerd` is the Workers runtime. Without this, `wrangler` cannot start, so the
 * Cloudflare build fails on a policy rather than on the code.
 *
 * The `packages` key is not optional. This file exists only to carry settings, and a
 * pnpm-workspace.yaml without `packages` is read as a workspace root with no members —
 * pnpm then refuses to run *any* command, with `ERROR packages field missing or empty`
 * before it has looked at a single script. Newer pnpm relaxed this; the Cloudflare
 * build image pins an older one, and the failure it produced was the deploy command
 * dying on a file that carries nothing but comments. One package, this one: `['.']`.
 */
function writePnpmWorkspace(into, hamolusDeps) {
  const excludes = hamolusDeps.map((d) => `  - '${d.name}@${d.version}'`)
  writeFileSync(
    join(into, 'pnpm-workspace.yaml'),
    [
      '# Written by scripts/export-deploy-repo.mjs — do not edit by hand.',
      '',
      "# The only package in this repository is the one at the root. This key is not",
      '# optional: a pnpm-workspace.yaml without `packages` reads as a workspace with no',
      "# members, and pnpm then refuses every command with 'packages field missing or",
      "# empty' — including the deploy build, which is what a Cloudflare image running an",
      '# older pnpm did. Dropping this line breaks the deploy, not the install.',
      'packages:',
      "  - '.'",
      '',
      '# pnpm >= 10 blocks dependency lifecycle scripts unless they are allowlisted here,',
      '# and `workerd` IS the Workers runtime: block it and wrangler cannot start, so the',
      '# Cloudflare build fails on policy rather than on code. This list mirrors the',
      '# monorepo root pnpm-workspace.yaml; pnpm adds a placeholder here for any package',
      '# it sees a build script for, and an unresolved placeholder fails the install.',
      'allowBuilds:',
      '  core-js-pure: true',
      '  esbuild: true',
      '  workerd: true',
      '',
      '# Published from the same release as this repository, so necessarily newer than',
      '# any minimum-release-age window.',
      'minimumReleaseAgeExclude:',
      ...excludes,
      '',
    ].join('\n'),
  )
}

/** Keep the same ignore rules the monorepo uses, so exports are safe to commit. */
function writeGitignore(into) {
  writeFileSync(
    join(into, '.gitignore'),
    [
      'node_modules/',
      'dist/',
      'dist-lib/',
      '*.tsbuildinfo',
      '.turbo/',
      '',
      '# Cloudflare local state',
      '.wrangler/',
      '.dev.vars',
      '',
      '# env & secrets — never commit',
      '.env',
      '.env.*',
      '!.env.example',
      '',
      '*.log',
      '.DS_Store',
      '',
      '# No lockfile on purpose: an exported repo is built by whoever forked it, with',
      '# whichever package manager Cloudflare picks. Committing ours would pin a',
      '# resolution that nothing chose — and a stray `pnpm install` before a push would',
      '# otherwise add it silently.',
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      '',
    ].join('\n'),
  )
}

/**
 * Put the deploy button at the top of the README, where a reader looks first.
 *
 * The block is fenced by markers and rewritten in place, so re-running the export is
 * idempotent instead of stacking a second button on top of the first.
 */
function injectDeployReadme(into, repo, extra = []) {
  const path = join(into, 'README.md')
  if (!existsSync(path)) return
  const original = readFileSync(path, 'utf8')
  const begin = '<!-- deploy:begin -->'
  const end = '<!-- deploy:end -->'

  const block = [
    begin,
    '<!-- Written by scripts/export-deploy-repo.mjs — do not edit by hand. -->',
    '',
    '## Deploy to Cloudflare',
    '',
    '[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/' +
      `${ORG}/${repo})`,
    '',
    'That button forks this repository into your own GitHub account, names the Worker,',
    'provisions the KV namespace, D1 database and R2 bucket on your account, and wires',
    'up Workers Builds so later pushes deploy themselves.',
    '',
    ...extra,
    end,
  ].join('\n')

  const from = original.indexOf(begin)
  const to = original.indexOf(end)
  if (from !== -1 && to !== -1) {
    writeFileSync(path, original.slice(0, from) + block + original.slice(to + end.length))
    return
  }

  // After the H1 and its subtitle, before the first section that is not the title.
  const heading = original.match(/^# .+$/m)
  const at = heading ? heading.index + heading[0].length : 0
  const rest = original.slice(at).replace(/^\n+/, '')
  // The blank line after the block matters: the marker is an HTML comment, and running
  // the closing marker straight into the next paragraph leaves the two as one block.
  writeFileSync(path, `${original.slice(0, at)}\n\n${block}\n\n${rest}`)
}

/** Notes that only make sense in the standalone repo, appended to the deploy block. */
function deployNotes(pkg) {
  if (pkg === 'core') {
    return [
      '**Secrets are not part of the deploy.** The button uploads code and provisions',
      'resources, but it cannot set secrets — and a core that comes up without them',
      'rejects every login. Set these immediately after the first deploy:',
      '',
      '```bash',
      'wrangler secret put JWT_SECRET',
      'wrangler secret put ADMIN_KEY',
      '```',
      '',
      'or paste them into Settings → Variables and Secrets in the dashboard. Use',
      'different values than the ones in a local `.dev.vars`.',
      '',
      '**`PUBLIC_GETS` ships as `true`, which means every unauthenticated `GET` on this',
      'worker answers** — all collections, records, settings and media, with no token. That',
      'is what an SSG site needs and what a private install does not. Set it to `false` in',
      'Settings → Variables and Secrets unless you are serving a public read-only site.',
      '`CORE_MODE`, `DEFAULT_LAND` and `DEFAULT_COLONY` are declared too, so you can see and',
      'change the scope without editing the config; `default` there is the reserved sentinel',
      'for the unnamed scope (`root_lnd` / `root_cny`), not a land by that name.',
    ]
  }
  if (pkg === 'mcp') {
    return [
      '**Register it before anything works.** A fresh deploy has an empty `MCP_INSTANCE_ID`,',
      'so it runs on the deprecated path with no credential and answers every tool call with',
      'a configuration error. Create the instance in the core console under',
      '**Environment → MCP**, then set its id as a var:',
      '',
      '```bash',
      '# Settings → Variables and Secrets, or:',
      '# wrangler deploy --var MCP_INSTANCE_ID:<id> --var CORE_API_URL:https://<core>/api',
      '```',
      '',
      'Callers then present a per-user token from the console as `Authorization: Bearer …`.',
      '`CORE_API_URL` ships as `http://localhost:8787/api`, so an online deploy has to be',
      'pointed at your core.',
      '',
      '**If every call fails with `CORE_UNAVAILABLE` and a `404`,** your account cannot reach',
      '`workers.dev` from inside the Workers runtime — the URL is correct and editing it will',
      'not help. Add a service binding to the core instead:',
      '',
      '```jsonc',
      '"services": [{ "binding": "CORE", "service": "<your-core-worker-name>" }]',
      '```',
      '',
      'It is in `wrangler.jsonc` commented out: leave it out for `wrangler dev`, where the',
      'local core is a separate process on `http://localhost:8787`.',
    ]
  }
  return [
    'The console is static assets only, so it needs no secrets. It reads whatever core',
    'you give it at runtime — point it at the Worker you just deployed.',
  ]
}

/**
 * Ship the base tsconfig and repoint `extends` at it.
 *
 * Every package tsconfig extends `../../tsconfig.base.json`, which lives at the
 * monorepo root and is not part of the package. A standalone copy resolves that path
 * to nothing, and `tsc` then silently falls back to its own defaults — target ES5 —
 * which fails the build with `TS2802: 'Set<string>' can only be iterated through when
 * using the '--downlevelIteration' flag`. The error names a Set, not a config, so it
 * reads like a source bug rather than a missing file.
 *
 * Copying the base is preferred over inlining it: one canonical file, and the exported
 * config still reads the way the monorepo's does.
 */
function writeTsconfigBase(into) {
  writeFileSync(join(into, 'tsconfig.base.json'), readFileSync(join(REPO, 'tsconfig.base.json'), 'utf8'))
  const path = join(into, 'tsconfig.json')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  if (!text.includes('../../tsconfig.base.json')) return
  writeFileSync(path, text.replaceAll('"../../tsconfig.base.json"', '"./tsconfig.base.json"'))
}

function exportOne({ pkg, repo, kind }, destRoot) {
  const into = join(destRoot, repo)
  copyPackage(pkg, into)
  fixPackageJson(pkg, into)
  dropPlaceholderIds(into)
  writeTsconfigBase(into)

  const exported = readJson(join(into, 'package.json'))
  const hamolusDeps = Object.entries(exported.dependencies ?? {})
    .filter(([n]) => n.startsWith('@hamolus/'))
    .map(([n, r]) => ({ name: n, version: r.replace(/^\^/, '') }))

  writePnpmWorkspace(into, hamolusDeps)
  writeGitignore(into)
  injectDeployReadme(into, repo, deployNotes(pkg))

  return { into, kind, name: exported.name, version: exported.version }
}

/**
 * Report differences between two trees, ignoring the noise that is not ours.
 *
 * Comparing raw directory contents would flag every lockfile and `node_modules` the
 * export does not write, so this is a per-file text comparison over the files the
 * export is responsible for.
 */
/**
 * Every file under `root`, as a path relative to `root`.
 *
 * `readdirSync(..., { recursive: true, withFileTypes: true })` also yields
 * directories, and the relative path it hands back for a nested file is not
 * something you can rejoin onto `root` without knowing what it is relative to. A
 * plain walk is unambiguous about both.
 */
function filesUnder(root) {
  const out = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(full).map((rel) => join(entry.name, rel)))
    else if (entry.isFile()) out.push(entry.name)
  }
  return out
}

function drift(destRoot, scratchRoot) {
  const problems = []
  for (const target of TARGETS) {
    const have = join(destRoot, target.repo)
    if (!existsSync(have)) {
      problems.push(`${target.repo}: not exported yet (missing at ${have})`)
      continue
    }
    const want = join(scratchRoot, target.repo)
    for (const rel of filesUnder(want)) {
      if (SKIP.has(rel.split('/').pop())) continue
      const a = join(want, rel)
      const b = join(have, rel)
      if (!existsSync(b)) {
        problems.push(`${target.repo}/${rel}: missing`)
        continue
      }
      if (readFileSync(a, 'utf8') !== readFileSync(b, 'utf8')) {
        problems.push(`${target.repo}/${rel}: differs from packages/${target.pkg}`)
      }
    }
  }
  return problems
}

const args = parseArgs(process.argv.slice(2))

if (args.check) {
  const scratch = join(REPO, 'node_modules', '.cache', 'export-deploy-repo')
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(scratch, { recursive: true })
  for (const t of TARGETS) exportOne(t, scratch)
  const problems = drift(args.dest, scratch)
  rmSync(scratch, { recursive: true, force: true })
  if (problems.length) {
    console.error('deploy repositories have drifted from packages/ — re-run without --check:\n')
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }
  console.log('deploy repositories match packages/')
} else {
  mkdirSync(args.dest, { recursive: true })
  for (const t of TARGETS) {
    const r = exportOne(t, args.dest)
    console.log(`${r.name}@${r.version} -> ${ORG}/${t.repo}  (${r.into})`)
  }
  console.log(`\nnext: cd ${args.dest}/<repo> && pnpm install && pnpm build`)
}
