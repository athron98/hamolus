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
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  // 7. Both site templates, generated into the same project and built from one install.
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
  const siteProject = join(root, 'sites')
  const siteCreated = hamolus(root, [
    'create', 'blogco', '--link', REPO, '-o', siteProject, '-y', '--core', 'predefined',
  ])
  ok('create succeeds for the site project', siteCreated.status === 0, `${siteCreated.stdout}\n${siteCreated.stderr}`)

  const siteAdded = hamolus(siteProject, ['add', 'site', 'astro_blog', '--template', 'astro'])
  ok('add site (astro) succeeds', siteAdded.status === 0, `${siteAdded.stdout}\n${siteAdded.stderr}`)

  const nextAdded = hamolus(siteProject, ['add', 'site', 'next_blog', '--template', 'nextjs'])
  ok('add site (nextjs) succeeds', nextAdded.status === 0, `${nextAdded.stdout}\n${nextAdded.stderr}`)

  if (siteCreated.status === 0 && siteAdded.status === 0 && nextAdded.status === 0) {
    const siteManifest = JSON.parse(readFileSync(join(siteProject, 'hamolus.json'), 'utf8'))
    const siteKinds = (siteManifest.parts ?? []).filter((part) => part.kind === 'site')
    ok('both sites are recorded in hamolus.json', siteKinds.length === 2, JSON.stringify(siteKinds))

    const workspace = readFileSync(join(siteProject, 'pnpm-workspace.yaml'), 'utf8')
    ok(
      'the sites glob is inside the packages block',
      /^\s*-\s*'?sites\/\*'?\s*$/m.test(workspace) && !/packages:[\s\S]*\n\S[\s\S]*sites\/\*/.test(workspace),
      workspace,
    )

    for (const id of ['astro_blog', 'next_blog']) {
      const dir = join(siteProject, 'sites', id)
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
    }

    const siteInstalled = pnpm(siteProject, ['install'])
    ok(
      'pnpm install succeeds (two sites)',
      siteInstalled.status === 0,
      `${siteInstalled.stdout}\n${siteInstalled.stderr}`,
    )

    const astroChecked = pnpm(siteProject, ['-F', './sites/astro_blog', 'check'])
    ok(
      'the astro site typechecks',
      astroChecked.status === 0,
      `${astroChecked.stdout}\n${astroChecked.stderr}`,
    )

    const nextTypechecked = pnpm(siteProject, ['-F', './sites/next_blog', 'typecheck'])
    ok(
      'the next site typechecks',
      nextTypechecked.status === 0,
      `${nextTypechecked.stdout}\n${nextTypechecked.stderr}`,
    )

    for (const [id, message, envVar] of [
      ['astro_blog', 'Could not read the article list', 'PUBLIC_HAMOLUS_ORIGIN'],
      ['next_blog', 'Could not read the article list', 'HAMOLUS_API_ORIGIN'],
    ]) {
      const built = pnpm(siteProject, ['-F', `./sites/${id}`, 'build'])
      const output = `${built.stdout}\n${built.stderr}`
      ok(
        `${id} refuses to build with no core running`,
        built.status !== 0,
        'the build succeeded with an unreachable core — that deploys an empty site',
      )
      ok(
        `${id} names the cause and the fix`,
        output.includes(message) && output.includes(envVar),
        output.slice(-1200),
      )
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
