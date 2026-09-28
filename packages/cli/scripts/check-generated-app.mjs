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
 * Generated-app gate: a project generated from the templates must actually build.
 *
 * Why this exists separately from `check-markers.mjs`: the marker checker proves the
 * *copy* is faithful (no leftover `{{TOKEN}}`, every token supplied, the theme script
 * matches the console's). It says nothing about whether the copied files form a
 * working app. The console is the part where that question is sharpest, because the
 * generated project no longer vendors the UI — it installs `@hamolus/console` as a
 * pre-built library and calls `mount()` from plain TypeScript. Every one of those
 * links is a chance to ship a console that only fails after `pnpm install` in someone
 * else's project:
 *
 *   - the manifest not listing the runtime, or listing it with a range the
 *     registry cannot serve,
 *   - the library's `exports` map missing the subpath the entry imports
 *     (`@hamolus/console/style.css`),
 *   - `types` pointing at a declaration the build never emitted,
 *   - a `tsconfig` whose `include` misses `console.config.ts`,
 *   - a Vite config that still assumes a Solid plugin.
 *
 * So this gate generates a real project, links the local checkout, installs, and
 * typechecks + builds it — the same three commands a user's CI would run.
 *
 * Both halves of a generated project are covered, because `create` emits a core and
 * `add console` adds the UI:
 *
 *   core/     the Worker seam (`src/index.ts`) over `@hamolus/core`, plus the
 *             build-time `core.config.ts`. Its failure mode is invisible in this repo
 *             — every file here *is* the source — so the only place a broken link
 *             between the config file, the `setCoreConfig` call and the published
 *             package's exports can surface is a project generated from the template.
 *   console/  the UI mounted from plain TypeScript over the prebuilt library.
 *
 * The core has two templates, and both are generated here: `basic` (the default, no
 * schema) is the one that gets the console and the full build, while `predefined` is
 * checked for the code-definition seam and for typecheck/bundle on its own. Only
 * checking the default would let the `predefined` tree rot into something that no
 * longer compiles — it is the only place those files are ever built.
 *
 *   node packages/cli/scripts/check-generated-app.mjs
 *
 * Offline-first but not offline: the install resolves devDependencies (vite,
 * typescript, wrangler) from the pnpm store or the registry. It self-cleans: the
 * throwaway project lives in a temp directory that is removed afterwards.
 *
 * Note: the CLI is exercised through its real entrypoint, which prefers
 * `packages/cli/dist/cli.js` when it exists. Run `pnpm -F @hamolus/cli build` after
 * editing the CLI sources, or this exercises the previous build.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const CLI = resolve(HERE, '..', 'bin', 'hamolus.mjs')
const CONSOLE_LIB = join(REPO, 'packages', 'console', 'dist-lib', 'index.js')

let pass = 0
const failures = []
const ok = (name, condition, detail = '') => {
  if (condition) {
    pass += 1
    console.log(`PASS  ${name}`)
  } else {
    failures.push(name)
    console.log(`FAIL  ${name}${detail ? `\n      ${String(detail).replace(/\n/g, '\n      ')}` : ''}`)
  }
}

const hamolus = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })
const pnpm = (cwd, args) => spawnSync('pnpm', args, { cwd, encoding: 'utf8' })

/**
 * A source file's code with its comments removed.
 *
 * The assertions below ask whether a call is *made*, and both core entries name
 * `setCodeDefinitions` in their doc comment — the `basic` one to explain how to add the
 * seam, the `predefined` one to explain what it registers. Testing the raw text would
 * read that prose as the call, so a missing import or a dropped call could pass. Line
 * comments are stripped first, then block comments, which is enough here: the risk is a
 * false match, and over-stripping a string literal cannot produce one.
 */
const withoutComments = (source) => source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

if (!existsSync(CONSOLE_LIB)) {
  console.log(
    'FAIL  the console library is not built\n' +
      `      ${CONSOLE_LIB} is missing — a generated console consumes the built bundle,\n` +
      '      so run `pnpm -F @hamolus/console build:lib` first.',
  )
  console.log('\n0 passed, 1 failed')
  process.exit(1)
}

const root = mkdtempSync(join(tmpdir(), 'hamolus-generated-'))
const project = join(root, 'app')
/** A second project, generated from the `predefined` core template. */
const predefined = join(root, 'predefined')

try {
  // 1. Generate a project linked to this checkout, then add the console.
  const created = hamolus(root, ['create', 'acme', '--link', REPO, '-o', project, '-y'])
  ok('create succeeds', created.status === 0, `${created.stdout}\n${created.stderr}`)
  if (created.status !== 0) throw new Error('create failed')

  const added = hamolus(project, ['add', 'console'])
  ok('add console succeeds', added.status === 0, `${added.stdout}\n${added.stderr}`)
  if (added.status !== 0) throw new Error('add console failed')

  const manifest = JSON.parse(readFileSync(join(project, 'console', 'package.json'), 'utf8'))
  const coreManifest = JSON.parse(readFileSync(join(project, 'core', 'package.json'), 'utf8'))

  // 2. The manifest must depend on the runtime by name, and on *this* checkout when
  //    linked — a `workspace:` protocol spec is what a generated project cannot install.
  ok('the console manifest depends on @hamolus/console', manifest.dependencies?.['@hamolus/console'] != null)
  ok(
    'the linked runtime is a link: spec, not a workspace: protocol',
    String(manifest.dependencies['@hamolus/console']).startsWith('link:'),
    manifest.dependencies['@hamolus/console'],
  )
  ok('the shared types are linked too', String(manifest.dependencies['@hamolus/types']).startsWith('link:'))
  ok(
    'the core manifest depends on @hamolus/core and the shared types',
    coreManifest.dependencies?.['@hamolus/core'] != null && coreManifest.dependencies['@hamolus/types'] != null,
    JSON.stringify(coreManifest.dependencies),
  )
  ok(
    'the linked core runtime is a link: spec',
    String(coreManifest.dependencies['@hamolus/core']).startsWith('link:'),
    coreManifest.dependencies['@hamolus/core'],
  )
  ok('the generated console is recorded in hamolus.json', /"kind":\s*"console"/.test(readFileSync(join(project, 'hamolus.json'), 'utf8')))
  ok('the generated core is recorded in hamolus.json', /"kind":\s*"core"/.test(readFileSync(join(project, 'hamolus.json'), 'utf8')))

  // 3. The core's config seam. `setCoreConfig` is the one export a generated project
  //    cannot do without, and the config file is the thing operators are told to edit,
  //    so both are asserted rather than assumed.
  const coreConfig = readFileSync(join(project, 'core', 'core.config.ts'), 'utf8')
  const coreEntry = readFileSync(join(project, 'core', 'src', 'index.ts'), 'utf8')
  ok('the core config file was generated', existsSync(join(project, 'core', 'core.config.ts')))
  ok('the core config is typed with defineCoreConfig', /defineCoreConfig\(/.test(coreConfig))
  ok('the core config declares a localization floor', /localization:/.test(coreConfig) && /locales:/.test(coreConfig))
  // Compared for real rather than by co-existence: a defaultLocale that is not among
  // the declared locales silently falls back to the first, so a generated project that
  // preselects the wrong language would pass a co-existence check and be wrong for
  // every operator.
  const declaredCodes = [...coreConfig.matchAll(/code: '([a-z-]+)'/g)].map((match) => match[1])
  const declaredDefault = /defaultLocale: '([a-z-]+)'/.exec(coreConfig)?.[1]
  ok(
    'the core config preselects a locale it actually declares',
    declaredCodes.length > 0 && declaredCodes.includes(declaredDefault),
    `defaultLocale=${declaredDefault} declared=[${declaredCodes.join(', ')}]`,
  )
  ok('the core config left no template token behind', !/\{\{[A-Z0-9_]+\}\}/.test(coreConfig))
  const basicCode = withoutComments(coreEntry)
  ok('the core entry hands the config to the runtime', /setCoreConfig\(config\)/.test(basicCode))
  ok('the core entry imports the config from its own root', /from '\.\.\/core\.config'/.test(basicCode))
  ok(
    'the core tsconfig includes the config file (tsconfig.base.json is not shipped)',
    /core\.config\.ts/.test(readFileSync(join(project, 'core', 'tsconfig.json'), 'utf8')),
    readFileSync(join(project, 'core', 'tsconfig.json'), 'utf8'),
  )

  // 3b. The `basic` core declares no schema. Asserted as an absence, because the
  //     default is what most projects are generated from and a template that quietly
  //     started shipping a frozen `posts` collection would change every generated
  //     project's API behaviour: `PUT /_meta/collections/posts` would start
  //     answering 403 CODE_DEFINED_COLLECTION.
  ok('the basic core ships no src/collections directory', !existsSync(join(project, 'core', 'src', 'collections')))
  ok('the basic core ships no src/panels directory', !existsSync(join(project, 'core', 'src', 'panels')))
  ok(
    'the basic core entry registers no code definitions',
    !/setCodeDefinitions/.test(basicCode) && !/from '\.\/(collections|panels)'/.test(basicCode),
    coreEntry,
  )
  ok(
    'the core part records the basic template as its source',
    /"source":\s*"templates\/cores\/basic"/.test(readFileSync(join(project, 'hamolus.json'), 'utf8')),
    readFileSync(join(project, 'hamolus.json'), 'utf8'),
  )

  // 3c. The `predefined` core ships the code-definition seam. Each half of it can
  //     break silently — a barrel that forgets to export its array typechecks fine as
  //     `never[]`, and an entry that drops the call still builds, it just quietly
  //     leaves every definition editable in the console.
  const predefinedCreated = hamolus(root, [
    'create', 'defs', '--core', 'predefined', '--link', REPO, '-o', predefined, '-y',
  ])
  ok('create --core predefined succeeds', predefinedCreated.status === 0, `${predefinedCreated.stdout}\n${predefinedCreated.stderr}`)
  if (predefinedCreated.status !== 0) throw new Error('create --core predefined failed')

  const collectionsDir = join(predefined, 'core', 'src', 'collections')
  const panelsDir = join(predefined, 'core', 'src', 'panels')
  ok('the predefined core ships a src/collections directory', existsSync(collectionsDir))
  ok('the predefined core ships a src/panels directory', existsSync(panelsDir))

  const collectionsIndex = readFileSync(join(collectionsDir, 'index.ts'), 'utf8')
  const panelsIndex = readFileSync(join(panelsDir, 'index.ts'), 'utf8')
  const collectionsCode = withoutComments(collectionsIndex)
  const panelsCode = withoutComments(panelsIndex)
  const predefinedEntry = withoutComments(readFileSync(join(predefined, 'core', 'src', 'index.ts'), 'utf8'))
  // The `satisfies` half is the load-bearing part: it keeps a mistyped field from
  // widening to `any` and only failing when a request hits the collection.
  ok(
    'the collections barrel type-checks its array against CodeDefinitions',
    /satisfies\s+NonNullable<CodeDefinitions\['collections'\]>/.test(collectionsCode),
    collectionsIndex,
  )
  ok(
    'the panels barrel type-checks its array against CodeDefinitions',
    /satisfies\s+NonNullable<CodeDefinitions\['panels'\]>/.test(panelsCode),
    panelsIndex,
  )
  ok(
    'the collections barrel re-exports every collection file',
    /import\s*\{\s*POSTS\s*\}\s*from\s*'\.\/posts'/.test(collectionsCode) &&
      /export const collections = \[POSTS\]/.test(collectionsCode),
    collectionsIndex,
  )
  ok(
    'the panels barrel re-exports every panel file',
    /import\s*\{\s*CONTENT\s*\}\s*from\s*'\.\/content'/.test(panelsCode) &&
      /export const panels = \[CONTENT\]/.test(panelsCode),
    panelsIndex,
  )
  ok(
    'the predefined core entry hands its definitions to the runtime',
    /setCodeDefinitions\(\{\s*collections,\s*panels\s*\}\)/.test(predefinedEntry),
    readFileSync(join(predefined, 'core', 'src', 'index.ts'), 'utf8'),
  )
  ok('the predefined core entry imports the collections barrel', /from '\.\/collections'/.test(predefinedEntry))
  ok('the predefined core entry imports the panels barrel', /from '\.\/panels'/.test(predefinedEntry))
  ok(
    'the core part records the predefined template as its source',
    /"source":\s*"templates\/cores\/predefined"/.test(readFileSync(join(predefined, 'hamolus.json'), 'utf8')),
    readFileSync(join(predefined, 'hamolus.json'), 'utf8'),
  )
  // A stray token in either barrel survives the copy and only fails when the Worker
  // bundles, so it is checked the same way the config file is.
  for (const [label, source] of [
    ['collections', collectionsIndex],
    ['panels', panelsIndex],
  ]) {
    ok(`the ${label} barrel left no template token behind`, !/\{\{[A-Z0-9_]+\}\}/.test(source), source)
  }

  // 3d. An unknown template name is a typo, not a silent fallback to `basic`.
  const unknownCore = hamolus(root, ['create', 'nope', '--core', 'nope', '-o', join(root, 'nope'), '-y'])
  ok(
    'an unknown --core name is reported, not replaced by the default',
    unknownCore.status !== 0 && /No core template found/.test(unknownCore.stderr),
    `${unknownCore.stdout}\n${unknownCore.stderr}`,
  )

  // 4. The three commands a user's CI runs.
  const installed = pnpm(project, ['install'])
  ok('pnpm install succeeds', installed.status === 0, `${installed.stdout}\n${installed.stderr}`)

  const coreTypechecked = pnpm(project, ['-F', './core', 'typecheck'])
  ok('the generated core typechecks', coreTypechecked.status === 0, `${coreTypechecked.stdout}\n${coreTypechecked.stderr}`)

  // A dry-run deploy is the only thing that proves the Worker actually bundles: the
  // config seam imports `@hamolus/types` for its schema, so a broken `exports` map
  // compiles fine and fails only here.
  const coreBuilt = pnpm(project, ['-F', './core', 'build'])
  ok('the generated core builds (wrangler dry-run)', coreBuilt.status === 0, `${coreBuilt.stdout}\n${coreBuilt.stderr}`)

  // 4b. The same two commands for the `predefined` core. Its definition files are the
  //     only place `setCodeDefinitions` and its two barrels are ever compiled or
  //     bundled, so without this the template could hold anything that typechecks in
  //     isolation here and fails in a generated project.
  const predefinedInstalled = pnpm(predefined, ['install'])
  ok(
    'pnpm install succeeds (predefined core)',
    predefinedInstalled.status === 0,
    `${predefinedInstalled.stdout}\n${predefinedInstalled.stderr}`,
  )

  const predefinedTypechecked = pnpm(predefined, ['-F', './core', 'typecheck'])
  ok(
    'the predefined core typechecks',
    predefinedTypechecked.status === 0,
    `${predefinedTypechecked.stdout}\n${predefinedTypechecked.stderr}`,
  )

  const predefinedBuilt = pnpm(predefined, ['-F', './core', 'build'])
  ok(
    'the predefined core builds (wrangler dry-run)',
    predefinedBuilt.status === 0,
    `${predefinedBuilt.stdout}\n${predefinedBuilt.stderr}`,
  )

  const typechecked = pnpm(project, ['-F', './console', 'typecheck'])
  ok('the generated console typechecks', typechecked.status === 0, `${typechecked.stdout}\n${typechecked.stderr}`)

  const built = pnpm(project, ['-F', './console', 'build'])
  ok('the generated console builds', built.status === 0, `${built.stdout}\n${built.stderr}`)

  // 5. The build output is a servable single-page app, not an empty dist.
  const distIndex = join(project, 'console', 'dist', 'index.html')
  ok('the build emitted dist/index.html', existsSync(distIndex))
  if (existsSync(distIndex)) {
    const html = readFileSync(distIndex, 'utf8')
    ok('the built html mounts the app', /id="root"/.test(html) && /\/assets\/index-.*\.js/.test(html), html.slice(0, 400))
    // The pre-paint theme script is what stops a reload flashing the default palette;
    // it is the one piece of the template a bundler could silently drop.
    ok('the built html keeps the pre-paint theme script', /documentElement\.dataset\.theme/.test(html))
  }
  ok('the stylesheet was emitted', existsSync(join(project, 'console', 'dist', 'assets')) && /assets\/index-.*\.css/.test(readFileSync(distIndex, 'utf8')))
  ok('no template token survived into the build', !/\{\{[A-Z0-9_]+\}\}/.test(readFileSync(distIndex, 'utf8')))

  // 6. A recorded link is what makes the next `hamolus add` inherit the checkout.
  ok(
    'the link is recorded for later commands',
    /"link"/.test(readFileSync(join(project, 'hamolus.json'), 'utf8')),
    readFileSync(join(project, 'hamolus.json'), 'utf8'),
  )

  // 6b. One part per flag, in both spellings. `--console` must produce a console and
  //     nothing else; `--with-console` must produce a core and a console and nothing else.
  //     The point of a flag is that it says exactly what you want, so either way a flag
  //     that dragged in a site and an MCP server would be one nobody could use.
  //
  //     Both spellings are checked because they are separate code paths, not one flag with
  //     a switch: a change that fixed `--console` while breaking `--with-console` would
  //     pass a gate that only tested one of them. That is not hypothetical — the two were
  //     once the same code with a boolean, and the boolean was set from the wrong side.
  const PART_FLAGS = [
    { part: 'console', bare: ['--console'], with: ['--with-console'] },
    { part: 'mcp', bare: ['--mcp'], with: ['--with-mcp'] },
    { part: 'site', bare: ['--site', 'astro'], with: ['--with-site', 'astro'] },
    // `--panel` takes a name, so it is spelled with one. A bare `--panel` would have to
    // invent a name, and a flag that silently generates a page nobody asked for is the
    // same failure as one that adds three parts nobody asked for.
    { part: 'panel', bare: ['--panel', 'admin'], with: ['--with-panel', 'admin'] },
  ]
  const ALL_PARTS = ['console', 'mcp', 'site', 'panel']

  for (const { part, bare, with: withFlag } of PART_FLAGS) {
    for (const [spelling, flag, expected] of [
      ['bare', bare, [part]],
      ['with', withFlag, ['core', part]],
    ]) {
      const label = flag.join(' ')
      const out = join(root, `${spelling}-${part}`)
      const created = hamolus(root, [
        'create', part, '--link', REPO, '-o', out, '-y', ...flag,
      ])
      ok(
        `create ${label} succeeds on its own`,
        created.status === 0,
        `${created.stdout}\n${created.stderr}`,
      )
      if (created.status !== 0) continue

      const project = JSON.parse(readFileSync(join(out, 'hamolus.json'), 'utf8'))
      const kinds = (project.parts ?? []).map((entry) => entry.kind)
      ok(
        `create ${label} adds exactly ${expected.join(' + ')}`,
        expected.every((kind) => kinds.includes(kind)) && kinds.length === expected.length,
        kinds.join(', ') || 'no parts',
      )
      ok(
        `create ${label} adds none of ${
          ALL_PARTS.filter((kind) => !expected.includes(kind)).join(', ')
        }`,
        ALL_PARTS.filter((kind) => !expected.includes(kind)).every((kind) => !kinds.includes(kind)),
        kinds.join(', '),
      )

      // The part flag decides whether a core exists, and a core is a lot of things at
      // once — a directory, a mode, two secrets and the deploy script. Reading the mode
      // and the secrets rather than the directory alone is deliberate: a project could
      // keep an empty `core/` and still record a mode, and a user would find out at
      // `pnpm deploy`, not here.
      const scripts = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')).scripts ?? {}
      const hasCore = expected.includes('core')
      ok(
        `create ${label} ${hasCore ? 'records a core mode' : 'records no core mode'}`,
        hasCore ? typeof project.mode === 'string' : project.mode === undefined,
        String(project.mode),
      )
      ok(
        `create ${label} ${hasCore ? 'has' : 'has no'} core/.dev.vars`,
        existsSync(join(out, 'core', '.dev.vars')) === hasCore,
      )
      ok(
        `create ${label} ${hasCore ? 'has' : 'has no'} a deploy script`,
        Boolean(scripts.deploy) === hasCore,
        Object.keys(scripts).join(', '),
      )
      // Only the `packages:` block counts. A substring search finds `- core-js-pure` in
      // `onlyBuiltDependencies` — which is a dependency name, not a workspace — so it
      // reports a core in a project that has none.
      const workspace = readFileSync(join(out, 'pnpm-workspace.yaml'), 'utf8')
      const globs = (workspace.match(/^packages:\n((?:[ \t]+-[^\n]*\n)+)/m)?.[1] ?? '')
        .split('\n')
        .map((line) => line.trim().replace(/^-\s*/, '').replace(/^['"]|['"]$/g, ''))
      ok(
        `create ${label} ${hasCore ? 'registers' : 'does not register'} core as a workspace`,
        globs.includes('core') === hasCore,
        globs.join(', '),
      )

      // A core-less project still has to start its own parts, so its `dev` cannot be the
      // core's. And it must not name a `core/` filter that does not exist, which is the
      // failure mode `--parallel` reports as a hard error on the first run.
      const dev = scripts.dev ?? ''
      ok(
        `create ${label} runs a dev script that ${hasCore ? 'starts the core' : 'does not name a core'}`,
        hasCore ? dev.includes('core') : !dev.includes('core'),
        dev,
      )
    }
  }

  // The two spellings cannot be combined: `--console` says there is no core and
  // `--with-mcp` says there is one, and a project that answered both is a project whose
  // manifest and README would disagree with each other. The check is that it is refused
  // with a reason, not merely refused — a bare "unknown option" would be a bug report.
  {
    const mixed = join(root, 'mixed')
    const created = hamolus(root, [
      'create', 'mixed', '--link', REPO, '-o', mixed, '-y', '--console', '--with-mcp',
    ])
    ok(
      'a bare flag mixed with a --with- flag is refused',
      created.status !== 0,
      `${created.stdout}\n${created.stderr}`,
    )
    ok(
      'the refusal explains the conflict rather than saying "unknown option"',
      /--console/.test(created.stderr) && /--with-mcp/.test(created.stderr),
      created.stderr,
    )
    ok('the refused mix writes nothing', !existsSync(mixed))
  }

  // 6c. A seed. It is the one part that writes to a core, so it is the one part with no
  //     bare/`--with-` pair, and the rules that follow from that are all about refusal
  //     rather than scaffolding: a seed in a project with no core is a script that fails on
  //     its first fetch, so it has to be an error the person wrote rather than a directory
  //     nobody opens until a site renders empty.
  {
    const withSeed = join(root, 'with-seed')
    const created = hamolus(root, [
      'create', 'withseed', '--link', REPO, '-o', withSeed, '-y', '--with-site', 'astro', '--seed', 'basic',
    ])
    ok(
      'create --seed basic succeeds',
      created.status === 0,
      `${created.stdout}\n${created.stderr}`,
    )
    if (created.status === 0) {
      const recorded = (JSON.parse(readFileSync(join(withSeed, 'hamolus.json'), 'utf8')).parts ?? [])
        .map((part) => part.kind)
      ok(
        'the seed is recorded as a part',
        recorded.includes('seed') && recorded.includes('site') && recorded.includes('core'),
        recorded.join(', '),
      )
      ok(
        'the seed script is generated',
        existsSync(join(withSeed, 'seeds', 'basic', 'index.mjs')),
      )

      // A seed is a one-shot script with a `seed` entry and no `dev` entry, so joining the
      // root `dev` would make pnpm fail the whole parallel run on a missing script.
      const dev = JSON.parse(readFileSync(join(withSeed, 'package.json'), 'utf8')).scripts?.dev ?? ''
      ok('a seed is left out of pnpm dev', !dev.includes('seed'), dev)

      // The key the seed needs is the one the wizard generated. The pre-generation default
      // is printed in neither the hint nor the script, because a project that generates a
      // random key and then tells you to use a literal one fails with a 401 that points at
      // the core rather than at the README.
      const hint = readFileSync(join(withSeed, 'seeds', 'basic', 'index.mjs'), 'utf8')
      ok(
        'the seed does not tell you to use a hard-coded admin key',
        !hint.includes('dev-admin-key-change-me'),
        'the script still names the pre-generation default',
      )
    }

    // `--no-seed` has to be a real answer, not the absence of one. A script that wants a
    // core and no seed cannot express that by simply not passing `--seed`.
    const noSeed = join(root, 'no-seed')
    const declined = hamolus(root, [
      'create', 'noseed', '--link', REPO, '-o', noSeed, '-y', '--with-site', 'astro', '--no-seed',
    ])
    ok('create --no-seed succeeds', declined.status === 0, `${declined.stdout}\n${declined.stderr}`)
    ok(
      'create --no-seed writes no seed',
      !existsSync(join(noSeed, 'seeds')),
    )

    // Both refusals. Without these, `--seed` on a core-less project is one refactor away
    // from being accepted again, and nothing else in the suite would notice.
    for (const [label, args] of [
      ['--no-core', ['--no-core', '--seed', 'basic']],
      ['a bare part flag', ['--console', '--seed', 'basic']],
    ]) {
      const out = join(root, `refuse-seed-${label.replace(/\W/g, '')}`)
      const refused = hamolus(root, [
        'create', 'refuse', '--link', REPO, '-o', out, '-y', ...args,
      ])
      ok(
        `a seed is refused alongside ${label}`,
        refused.status !== 0,
        `${refused.stdout}\n${refused.stderr}`,
      )
      ok(
        `the ${label} refusal names the seed`,
        /--seed/.test(refused.stderr),
        refused.stderr,
      )
      ok(`the ${label} refusal writes nothing`, !existsSync(out))
    }
  }

  // A seed that fills a collection nobody reads is decoration: the site would be exactly
  // as empty as it was before the seed ran, and the only symptom is a project that looks
  // seeded and renders blank. The two site templates declare what they read in a local
  // `Article` interface, so that interface is the contract, and the seed's collection is
  // checked against it rather than against a hand-copied list that would drift quietly.
  {
    const seedSource = readFileSync(join(REPO, 'templates', 'seeds', 'basic', 'index.mjs'), 'utf8')

    // The collection has to be called `articles` exactly. The templates hard-code the name
    // in `listRecords<Article>('articles', ...)`, so a `{{SEED_ID}}_articles` would leave
    // the site reading a collection that does not exist.
    ok(
      'the basic seed creates a collection named exactly "articles"',
      /name:\s*'articles',/.test(seedSource) && !/name:\s*'\{\{SEED_ID\}\}_articles'/.test(seedSource),
      'the site templates request "articles" by that exact name',
    )

    for (const framework of ['astro', 'nextjs']) {
      const articlesFile = join(REPO, 'templates', 'sites', framework, 'basic', 'src', 'lib', 'articles.ts')
      const source = readFileSync(articlesFile, 'utf8')
      const body = source.slice(source.indexOf('export interface Article'))
      const expected = [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).filter((n) => n !== 'id')
      ok(`the ${framework} Article interface declares fields`, expected.length >= 8, expected.join(', '))

      // Every field the site reads must exist on the seeded collection, or the value comes
      // back `undefined` and the template renders an empty tag or a broken date.
      const seeded = [...seedSource.matchAll(/\{\s*name:\s*'(\w+)'[^}]*type:/g)].map((m) => m[1])
      const missing = expected.filter((name) => !seeded.includes(name))
      ok(
        `the basic seed covers every field the ${framework} site reads`,
        missing.length === 0,
        missing.length === 0 ? expected.join(', ') : `missing from the seed: ${missing.join(', ')}`,
      )

      // `title` and `cover` are read as plain strings, and the site requests records
      // without a `locale`. A localized field comes back as its whole `{ id, en }` object
      // in that case, which renders as `[object Object]`, and a `media` field comes back as
      // a snapshot object rather than a URL for `<img src>`. Both are easy to "improve" the
      // field definition into a broken site, so the reason is asserted, not the style.
      ok(
        `the seeded title is not localized, so the ${framework} site can read it as a string`,
        !/name:\s*'title'[^}]*localized:\s*true/.test(seedSource),
        'a localized field returns an object when the request carries no locale',
      )
      ok(
        `the seeded cover is a url, so the ${framework} site can put it in src=`,
        /name:\s*'cover'[^}]*type:\s*'url'/.test(seedSource) &&
          !/name:\s*'cover'[^}]*type:\s*'media'/.test(seedSource),
        'a media field reads back as { id, url, alt, ... }, not a string',
      )
    }

    // Both templates have to read the same collection, or a project built with the other
    // framework silently gets the empty version.
    const astro = readFileSync(join(REPO, 'templates', 'sites', 'astro', 'basic', 'src', 'lib', 'articles.ts'), 'utf8')
    const nextjs = readFileSync(join(REPO, 'templates', 'sites', 'nextjs', 'basic', 'src', 'lib', 'articles.ts'), 'utf8')
    ok(
      'both site templates request the same collection',
      /listRecords<Article>\(\s*'articles'/.test(astro) && /listRecords<Article>\(\s*'articles'/.test(nextjs),
    )
  }

  // A panel is not a process, so it must not appear in the root `dev`. A `--filter` for a
  // path with no `dev` script fails the whole parallel run, which would make asking for
  // a panel the fastest way to break `pnpm dev`.
  {
    const panelOnly = join(root, 'panel-dev')
    hamolus(root, ['create', 'panels', '--link', REPO, '-o', panelOnly, '-y', '--with-panel', 'admin'])
    const dev = JSON.parse(readFileSync(join(panelOnly, 'package.json'), 'utf8')).scripts?.dev ?? ''
    ok(
      'a panel is left out of pnpm dev',
      existsSync(join(panelOnly, 'panels', 'admin', 'package.json')) && !dev.includes('panel'),
      dev,
    )
  }

  // Dev ports come from the environment so a second checkout on one machine is a variable
  // rather than a source edit. Deploys have no port, so this is a `wrangler dev` setting
  // and nothing more — which is why it is safe to put in the template at all.
  {
    const portProject = join(root, 'ports')
    hamolus(root, [
      'create', 'ports', '--link', REPO, '-o', portProject, '-y', '--core', 'predefined', '--with-mcp',
    ])
    const core = JSON.parse(readFileSync(join(portProject, 'core', 'package.json'), 'utf8'))
    const mcp = JSON.parse(readFileSync(join(portProject, 'mcp', 'package.json'), 'utf8'))
    ok(
      'the core dev script reads HAMOLUS_CORE_PORT',
      core.scripts.dev.includes('${HAMOLUS_CORE_PORT:-8787}'),
      core.scripts.dev,
    )
    ok(
      'the MCP dev script reads HAMOLUS_MCP_PORT',
      mcp.scripts.dev.includes('${HAMOLUS_MCP_PORT:-8788}'),
      mcp.scripts.dev,
    )
    ok(
      'the two dev servers still default to different ports',
      !core.scripts.dev.includes('8788') && !mcp.scripts.dev.includes('8787'),
      `${core.scripts.dev}\n${mcp.scripts.dev}`,
    )
  }

  // 7. One `create` with every part asked for on the command line.
  //
  // This is the command a person actually types, and it is the one that had nothing
  // testing it. Every other gate here builds a project and then adds a part with a
  // *second* `hamolus` invocation, which is why two bugs survived a green suite:
  //
  //   - `create --with-console --with-mcp --with-site` was accepted, documented, and
  //     because `runCreate` never implemented the wizard's flags. The project came out
  //     with a core and a "hamolus add console" suggestion, and exit 0.
  //   - once that was routed through the wizard, `--output` was forwarded to the `add`
  //     commands too, where it means "put this part here" rather than "this is the
  //     project root". The first optional part was aimed at the project root, on top of
  //     the core, and stopped by a guard with a technically true and completely
  //     misleading message.
  //
  // Both are invisible unless the parts are requested at create time, so that is what
  // this runs: one command, every part, and an assertion per part about where it landed.
  const oneShot = join(root, 'oneshot')
  const oneShotCreated = hamolus(root, [
    'create', 'oneshot', '--link', REPO, '-o', oneShot, '-y',
    '--core', 'predefined', '--with-console', '--with-mcp', '--with-site', 'astro',
  ])
  ok(
    'create with --with-console --with-mcp --with-site succeeds in one command',
    oneShotCreated.status === 0,
    `${oneShotCreated.stdout}\n${oneShotCreated.stderr}`,
  )

  if (oneShotCreated.status === 0) {
    for (const part of ['core', 'console', 'mcp', 'site']) {
      ok(
        `create put the ${part} at ./${part}`,
        existsSync(join(oneShot, part, 'package.json')),
        readdirSync(oneShot).join(', '),
      )
    }

    const recorded = JSON.parse(readFileSync(join(oneShot, 'hamolus.json'), 'utf8'))
    ok(
      'create recorded all four parts',
      ['core', 'console', 'mcp', 'site'].every((kind) =>
        (recorded.parts ?? []).some((part) => part.kind === kind && part.path === kind),
      ),
      JSON.stringify(recorded.parts),
    )

    // The whole point of the feature: one command starts the lot. Asserted here as a
    // string rather than by running it, because the `pnpm dev` smoke needs ports and a
    // second gate has the better view of those.
    const dev = JSON.parse(readFileSync(join(oneShot, 'package.json'), 'utf8')).scripts?.dev ?? ''
    ok(
      'pnpm dev starts every part, in parallel',
      dev.startsWith('pnpm --parallel') &&
        ['./core', './console', './mcp', './site'].every((f) => dev.includes(`--filter ${f}`)),
      dev,
    )

    // The next-step hint is the only thing a new user reads. "pnpm -F ./core dev" here
    // would tell them to start a fifth terminal instead of the one command they have.
    ok(
      'the next-step hint says pnpm dev',
      /pnpm dev\b/.test(oneShotCreated.stdout) && !/pnpm -F \.\/core dev/.test(oneShotCreated.stdout),
      oneShotCreated.stdout.slice(-600),
    )
  }

  // 7. Both site templates, one project each.
  //
  // A site is the only part that ships no `@hamolus/*` dependency: it reads the core
  // over plain REST with a hand-written client. That removes the link problems the
  // console has and replaces them with its own. Both templates fetch the article list
  // *during the build* — Astro's `getStaticPaths`, Next's `generateStaticParams` — and
  // neither of those files is ever run by anything else in this repository, so nothing
  // else in the suite can see what they do when the core is not there.
  //
  // The pinned behaviour is the loud one: a build that cannot reach the core must **stop
  // and say so**. The alternative — degrade to an empty site and exit 0 — is the
  // failure mode worth being afraid of here, because it deploys: CI is green, the blog
  // is empty, and nothing in the output says why. So this gate runs both builds with no
  // core running and requires a non-zero exit carrying a message that names the fix.
  //
  // One project per template because a project holds one site. The path is the fixed
  // `site/`, so a second `add site` has nowhere to go — and the second add is checked
  // below to be refused *by name*, since a refusal that only says "already exists" is
  // what a person hits after an afternoon of wondering which of their two sites the CLI
  // meant.
  const frameworks = [
    { id: 'astro_blog', template: 'astro', project: join(root, 'site-astro') },
    { id: 'next_blog', template: 'nextjs', project: join(root, 'site-next') },
  ]

  for (const { id, template, project: siteProject } of frameworks) {
    const siteCreated = hamolus(root, [
      'create', 'blogco', '--link', REPO, '-o', siteProject, '-y', '--core', 'predefined',
    ])
    ok(`create succeeds for the ${template} site project`, siteCreated.status === 0, `${siteCreated.stdout}\n${siteCreated.stderr}`)

    const siteAdded = hamolus(siteProject, ['add', 'site', id, '--template', template])
    ok(`add site (${template}) succeeds`, siteAdded.status === 0, `${siteAdded.stdout}\n${siteAdded.stderr}`)

    if (siteCreated.status !== 0 || siteAdded.status !== 0) continue

    // A second site has nowhere to live, and the error has to name the site that already
    // owns the directory. A refusal that only says "already exists" is what a person hits
    // after an afternoon of wondering which of their two sites the CLI just overwrote.
    const second = hamolus(siteProject, ['add', 'site', 'another', '--template', template])
    const refusal = `${second.stdout}\n${second.stderr}`
    ok(
      `a project refuses a second site (${template})`,
      second.status !== 0,
      'a second add site succeeded — it must not, the project holds one site',
    )
    ok(
      `the refusal names the site that owns the directory (${template})`,
      refusal.includes(`"${id}"`) && /--force/.test(refusal),
      refusal,
    )

    const siteManifest = JSON.parse(readFileSync(join(siteProject, 'hamolus.json'), 'utf8'))
    const siteKinds = (siteManifest.parts ?? []).filter((part) => part.kind === 'site')
    ok(`the ${template} site is recorded in hamolus.json`, siteKinds.length === 1 && siteKinds[0].id === id, JSON.stringify(siteKinds))
    ok(`the ${template} site is recorded at site/`, siteKinds[0]?.path === 'site', JSON.stringify(siteKinds[0]?.path))

    const workspace = readFileSync(join(siteProject, 'pnpm-workspace.yaml'), 'utf8')
    ok(
      `the site glob is inside the packages block (${template})`,
      /^\s*-\s*'?site'?\s*$/m.test(workspace) && !/packages:[\s\S]*\n\S[\s\S]*\nsite/.test(workspace),
      workspace,
    )

    const dir = join(siteProject, 'site')
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    ok(
      `the ${id} site is named after the project scope`,
      manifest.name === `@blogco/site-${id}`,
      manifest.name,
    )
    // A site must not acquire a Hamolus runtime dependency: the whole point of the
    // hand-written client is that a public bundle carries no admin SDK.
    ok(
      `the ${id} site depends on no @hamolus/* runtime`,
      !Object.keys(manifest.dependencies ?? {}).some((name) => name.startsWith('@hamolus/')),
      JSON.stringify(manifest.dependencies),
    )
    ok(
      `the ${id} site's origin is not a template token`,
      !/\{\{[A-Z0-9_]+\}\}/.test(readFileSync(join(dir, 'src', 'lib', 'hamolus.ts'), 'utf8')),
    )

    // Adding a part rewrites the root `dev` script, so a project that grew a site has to
    // start it without being told to. This is the whole point of deriving that script.
    const devScript = JSON.parse(readFileSync(join(siteProject, 'package.json'), 'utf8')).scripts?.dev ?? ''
    ok(
      `pnpm dev starts the ${template} site (${template})`,
      devScript.includes('--filter ./site') && devScript.includes('--filter ./core'),
      devScript,
    )

    const siteInstalled = pnpm(siteProject, ['install'])
    ok(
      `pnpm install succeeds (${template} site)`,
      siteInstalled.status === 0,
      `${siteInstalled.stdout}\n${siteInstalled.stderr}`,
    )

    const checked = pnpm(siteProject, ['-F', './site', template === 'astro' ? 'check' : 'typecheck'])
    ok(
      `the ${template} site typechecks`,
      checked.status === 0,
      `${checked.stdout}\n${checked.stderr}`,
    )

    const built = pnpm(siteProject, ['-F', './site', 'build'])
    const output = `${built.stdout}\n${built.stderr}`
    ok(
      `${id} refuses to build with no core running`,
      built.status !== 0,
      'the build succeeded with an unreachable core — that deploys an empty site',
    )
    ok(
      `${id} names the cause and the fix`,
      output.includes('Could not read the article list') &&
        output.includes(template === 'astro' ? 'PUBLIC_HAMOLUS_ORIGIN' : 'HAMOLUS_API_ORIGIN'),
      output.slice(-1200),
    )
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
