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
 * Config-only console plugin check.
 *
 * The promise a host is given is narrow and easy to break by accident: registering a
 * console plugin means editing `console.config.ts` and nothing else. No registry file, no
 * plugin folder to create, no `vite-plugin-solid`, no StyleX compiler, no extra
 * stylesheet to link in `src/main.ts`. Each of those used to be true of some revision of
 * this code, and each failure mode is silent — the plugin list still parses, the console
 * still mounts, and the result is a blank sidebar or unstyled page.
 *
 * So the property is pinned here from both ends:
 *
 *  1. The runtime path: `defineConsoleConfig` accepts a plugin list, the registry
 *     registers it (sorted, deduplicated by throwing, idempotent across a remount), and
 *     each shipped plugin package really does load as a finished descriptor.
 *  2. The packaging path: a plugin ships `dist/index.js` + `dist/index.css`, imports its
 *     own stylesheet so the host never has to, and leaves `solid-js` external so it runs
 *     on the console's Solid instance instead of a second copy that would silently
 *     detach every `createMemo` from the console's reactive graph.
 *  3. The host path: the example console — the thing a user copies — declares no build
 *     plugins, depends on no framework, and has no plugin folder.
 *
 *   node packages/cli/scripts/check-plugin-config.mjs
 *
 * Needs `pnpm -F @hamolus/types build` and the plugin packages built (`pnpm -F
 * '@hamolus/plugin-console-*' build`), because it loads the *shipped* artifacts rather
 * than the sources: the whole point is that a host consumes built packages.
 *
 * Offline and self-cleaning — the only thing it writes is a temp directory it removes.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

/**
 * Re-run under the `browser` export condition, once.
 *
 * Plugin pages are browser artifacts: a built plugin calls `delegateEvents` as it loads,
 * which throws in the server build of `solid-js/web`. Node resolves the `node` condition
 * by default and would hand back that server build, so without this the check would
 * report a product bug that only exists in the environment it runs in. Vite always builds
 * a console for the browser, so the browser condition is the faithful one.
 */
if (!process.env.HAMOLUS_BROWSER_CONDITIONS) {
  const rerun = spawnSync(
    process.execPath,
    ['--conditions=browser', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, HAMOLUS_BROWSER_CONDITIONS: '1' } },
  )
  process.exit(rerun.status ?? 1)
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const EXAMPLE = join(REPO, 'examples', 'consoles', 'with-plugins')

/**
 * Plugin packages, with the identity each one is expected to publish.
 *
 * The id is not cosmetic: it is also a KV prefix segment (`plugin:{land}:{id}:*`), so a
 * package whose built descriptor disagrees with its own name is a data bug, not a typo.
 */
const PLUGIN_PACKAGES = [
  {
    dir: join(REPO, 'packages', 'plugins', 'console', 'todo'),
    name: '@hamolus/plugin-console-todo',
    id: 'todo',
    descriptor: 'todoPlugin',
  },
  {
    dir: join(REPO, 'packages', 'plugins', 'console', 'kanban'),
    name: '@hamolus/plugin-console-kanban',
    id: 'kanban',
    descriptor: 'kanbanPlugin',
  },
]

/**
 * What a host must not need.
 *
 * A host is plain TypeScript: it configures and mounts. Everything in this list exists to
 * compile plugin *source*, and a host that compiles plugin source has lost the property
 * being checked here — the plugin packages ship compiled precisely so it never has to.
 */
const HOST_MUST_NOT_DEPEND_ON = [
  'solid-js',
  '@stylexjs/stylex',
  '@stylexjs/unplugin',
  'vite-plugin-solid',
  '@stylexjs/babel-plugin',
]

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

const root = mkdtempSync(join(tmpdir(), 'hamolus-plugin-config-'))

/**
 * Teach Node to skip `.css` imports.
 *
 * A built plugin's entry starts with `import './index.css'`, which is the mechanism that
 * gets a host to include the plugin's styles without being told to. Vite resolves that;
 * plain Node does not, and refuses to load the module. Stubbing the stylesheet lets this
 * check load the real descriptor from the real artifact instead of reading it as text.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export default {}', shortCircuit: true, format: 'module' }
    }
    return nextResolve(specifier, context)
  },
})

/**
 * The one browser global a plugin touches while loading.
 *
 * Solid's compiled output calls `delegateEvents([...])` at module scope, which reads
 * `window.document` to attach its listeners. That is the only DOM access on the way in;
 * nothing here renders, so a document stub is enough to let the real built descriptor be
 * evaluated. Anything more would be pretending to test rendering, which needs a browser.
 */
globalThis.window ??= { document: { addEventListener() {} } }

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readText = (path) => readFileSync(path, 'utf8')

/**
 * Whether a package's `sideEffects` field keeps `file` alive.
 *
 * `sideEffects: false` is a promise that importing the package can be deleted if nothing
 * uses its exports — which is exactly the stylesheet import, and exactly the plugin CSS
 * would go missing. So the field has to cover the built stylesheet by path, not by
 * intention. `**` spans directories and `*` does not, which is the usual glob meaning and
 * good enough to check a manifest against.
 */
function sideEffectsCovers(manifest, file) {
  const declared = manifest.sideEffects
  if (declared === true) return true
  if (!Array.isArray(declared)) return false
  return declared.some((pattern) => {
    const source = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?')
      .replace(/\*/g, '[^/]*')
    return new RegExp(`^${source}$`).test(file)
  })
}

try {
  // 1. The config schema — the one thing a host edits.
  const { defineConsoleConfig } = await import(
    pathToFileURL(join(REPO, 'packages', 'types', 'dist', 'index.js')).href
  )
  const { registerPlugins, plugins, pluginById } = await import(
    pathToFileURL(join(REPO, 'packages', 'console', 'src', 'plugins', 'registry.ts')).href
  )

  ok('an empty config means "no plugins"', defineConsoleConfig({}).plugins.length === 0)

  // Built descriptors, loaded the way a host's bundler loads them.
  const descriptors = []
  for (const pkg of PLUGIN_PACKAGES) {
    const built = join(pkg.dir, 'dist', 'index.js')
    if (!existsSync(built)) {
      ok(`${pkg.name}: ships a built entry`, false, `missing ${built} — run its build first`)
      descriptors.push(null)
      continue
    }
    const mod = await import(pathToFileURL(built).href)
    descriptors.push(mod[pkg.descriptor] ?? null)
  }

  const loaded = descriptors.filter(Boolean)
  const parsed = defineConsoleConfig({ plugins: loaded })

  ok(
    'a config listing every shipped plugin validates',
    parsed.plugins.length === loaded.length && loaded.length > 0,
    `parsed ${parsed.plugins.length} of ${loaded.length}`,
  )

  for (const [index, pkg] of PLUGIN_PACKAGES.entries()) {
    const descriptor = descriptors[index]
    if (!descriptor) continue
    ok(
      `${pkg.name}: exports \`${pkg.descriptor}\` with id "${pkg.id}"`,
      descriptor.id === pkg.id && typeof descriptor.component === 'function',
      `got id=${JSON.stringify(descriptor.id)}, component=${typeof descriptor.component}`,
    )
  }

  // A descriptor the console cannot render is a config error, reported where the host
  // wrote it rather than as an empty sidebar.
  const throwsWith = (input, pattern) => {
    try {
      defineConsoleConfig(input)
      return false
    } catch (error) {
      return pattern.test(String(error.message ?? error))
    }
  }
  ok(
    'a descriptor without a component is rejected by the schema',
    throwsWith({ plugins: [{ id: 'broken', name: 'Broken', description: 'x' }] }, /component/),
  )
  ok(
    'a non-callable component is rejected by the schema',
    throwsWith({ plugins: [{ id: 'broken', name: 'Broken', description: 'x', component: 'nope' }] }, /component/),
  )

  // 2. The registry: what `mount()` does with the validated list.
  registerPlugins(parsed.plugins)
  ok(
    'registerPlugins sorts by id so every view agrees on order',
    JSON.stringify(plugins().map((p) => p.id)) === JSON.stringify([...loaded.map((p) => p.id)].sort()),
    `got ${JSON.stringify(plugins().map((p) => p.id))}`,
  )
  for (const pkg of PLUGIN_PACKAGES) {
    ok(
      `pluginById('${pkg.id}') finds the registered plugin`,
      pluginById(pkg.id)?.component instanceof Function,
    )
  }

  const before = plugins().length
  let duplicateThrew = false
  try {
    registerPlugins([...parsed.plugins, ...parsed.plugins])
  } catch (error) {
    // Two plugins on one id would share a KV prefix, so this must not be tolerated.
    duplicateThrew = /todo|kanban/.test(String(error.message ?? error))
  }
  ok('a duplicate plugin id is rejected', duplicateThrew)
  ok('a rejected registration leaves the registry untouched', plugins().length === before)

  registerPlugins(parsed.plugins)
  registerPlugins(parsed.plugins)
  ok(
    'registering twice is idempotent (Vite HMR remount)',
    plugins().length === before,
    `got ${plugins().length}`,
  )

  registerPlugins(defineConsoleConfig({}).plugins)
  ok('an empty config clears the registry', plugins().length === 0)

  // 3. The packaging that makes config-only possible.
  for (const pkg of PLUGIN_PACKAGES) {
    const js = join(pkg.dir, 'dist', 'index.js')
    const css = join(pkg.dir, 'dist', 'index.css')
    const types = join(pkg.dir, 'dist', 'index.d.ts')
    if (!existsSync(js)) continue

    ok(`${pkg.name}: ships dist/index.js, dist/index.css and types`, existsSync(css) && existsSync(types))

    const source = readText(js)
    ok(
      `${pkg.name}: its entry imports its own stylesheet`,
      /^\s*import\s+['"]\.\/index\.css['"]/m.test(source),
      'without this the host build drops the plugin CSS, because a host never imports it',
    )
    ok(
      `${pkg.name}: solid-js stays external so one Solid runtime is shared`,
      /from\s*["']solid-js["']/.test(source) && /from\s*["']solid-js\/web["']/.test(source),
      'inlined Solid would put the plugin outside the console reactive graph',
    )
    ok(
      `${pkg.name}: its stylesheet maps tokens onto the console's CSS variables`,
      /var\(--bg\)/.test(readText(css)) && /@layer/.test(readText(css)),
    )
    ok(
      `${pkg.name}: declares its CSS as a side effect`,
      sideEffectsCovers(readJson(join(pkg.dir, 'package.json')), 'dist/index.css'),
      'sideEffects must not let a bundler drop the stylesheet import',
    )
  }

  // The console must externalise Solid for the same reason: two copies, split state.
  const consoleLib = readText(join(REPO, 'packages', 'console', 'dist-lib', 'index.js'))
  ok(
    '@hamolus/console: its built entry imports solid-js instead of inlining it',
    /from\s*["']solid-js["']/.test(consoleLib) && /from\s*["']solid-js\/web["']/.test(consoleLib),
    'a bundled Solid copy would break every plugin that shares the console runtime',
  )

  // 4. The host: what a user actually copies must need nothing.
  const examplePkg = readJson(join(EXAMPLE, 'package.json'))
  const declared = { ...examplePkg.dependencies, ...examplePkg.devDependencies }
  const intruders = HOST_MUST_NOT_DEPEND_ON.filter((name) => name in declared)
  ok(
    'the example console depends on no framework and no build plugin',
    intruders.length === 0,
    `remove: ${intruders.join(', ')}`,
  )

  const viteConfig = readText(join(EXAMPLE, 'vite.config.ts'))
  ok(
    'the example console adds no Vite plugin of its own',
    !/plugins\s*:/.test(viteConfig),
    'a host needs no solid/stylex plugin to load a plugin package',
  )

  const hostConfig = readText(join(EXAMPLE, 'console.config.ts'))
  ok(
    'the example registers plugins by importing the packages',
    PLUGIN_PACKAGES.every((pkg) => hostConfig.includes(`from '${pkg.name}'`)),
  )
  ok(
    'the example has no plugin folder to maintain',
    !existsSync(join(EXAMPLE, 'src', 'plugins')),
    'src/plugins/ reappeared — a host should never vendor plugin source',
  )
  const leftover = existsSync(join(EXAMPLE, 'src'))
    ? readdirSync(join(EXAMPLE, 'src'), { withFileTypes: true }).filter((e) => e.isDirectory())
    : []
  ok(
    'the example keeps no directories under src/',
    leftover.length === 0,
    leftover.map((e) => `src/${e.name}`).join(', '),
  )
  ok('the example console was built at least once', statSync(join(EXAMPLE, 'dist')).isDirectory())

  // 5. The command a user actually runs, on a project it actually generates.
  //
  // The marker contract is only worth anything if the file it produces compiles. A
  // marker parked inside the `defineConsoleConfig({ … })` call — which is where the
  // imports marker briefly lived — yields a config that reads perfectly well and cannot
  // be parsed, and eyeballing the output misses it. So the generated config is handed to
  // the TypeScript parser here, and the same command is run twice to prove the second run
  // changes nothing.
  const CLI = join(REPO, 'packages', 'cli', 'bin', 'hamolus.mjs')
  const project = join(root, 'acme')
  mkdirSync(project, { recursive: true })
  writeFileSync(join(project, 'hamolus.json'), `${JSON.stringify({ version: 1, name: 'acme' }, null, 2)}\n`, 'utf8')
  const cli = (...argv) => spawnSync(process.execPath, [CLI, ...argv], { cwd: project, encoding: 'utf8' })

  const added = cli('add', 'console')
  ok('`hamolus add console` succeeds', added.status === 0, `${added.stdout}\n${added.stderr}`)

  const first = cli('add', 'plugin', 'todo')
  ok('`hamolus add plugin todo` succeeds', first.status === 0, `${first.stdout}\n${first.stderr}`)

  const configPath = join(project, 'console', 'console.config.ts')
  const generated = existsSync(configPath) ? readText(configPath) : ''
  const parsedSource = ts.createSourceFile(
    configPath,
    generated,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  )
  ok(
    'the generated console.config.ts parses',
    parsedSource.parseDiagnostics.length === 0,
    parsedSource.parseDiagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
      .join('\n'),
  )
  ok(
    'the generated config imports the plugin package',
    generated.includes("from '@hamolus/plugin-console-todo'"),
  )
  ok(
    'the generated config lists the descriptor in the plugins array',
    /plugins:\s*\[[^\]]*todoPlugin/s.test(generated),
  )
  ok(
    'the generated console has no plugin folder',
    !existsSync(join(project, 'console', 'src', 'plugins')),
  )
  ok(
    'the plugin package is a dependency of the generated console',
    '@hamolus/plugin-console-todo' in (readJson(join(project, 'console', 'package.json')).dependencies ?? {}),
  )
  ok(
    'an undiscoverable version falls back to ^0.1.0, never to *',
    readJson(join(project, 'console', 'package.json')).dependencies?.[
      '@hamolus/plugin-console-todo'
    ] === '^0.1.0',
    'a generated project outside the monorepo has no linked checkout to read a version from',
  )

  const second = cli('add', 'plugin', 'todo')
  ok(
    'a repeated `hamolus add plugin todo` leaves the config byte-identical',
    second.status === 0 && readText(configPath) === generated,
    `${second.stdout}\n${second.stderr}`,
  )
  ok(
    'a repeated run does not add the dependency twice',
    Object.keys(readJson(join(project, 'console', 'package.json')).dependencies ?? {}).filter(
      (name) => name === '@hamolus/plugin-console-todo',
    ).length === 1,
  )
  ok(
    'the retired --source flag is refused rather than silently ignored',
    /--source no longer applies/.test(cli('add', 'plugin', 'blog', '--source', root).stderr),
  )
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
