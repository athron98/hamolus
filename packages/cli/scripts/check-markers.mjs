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
 * Template-token regression check.
 *
 * Why this exists: a template is an ordinary directory of files containing
 * `{{TOKEN}}` placeholders, and each `hamolus add`/`create` command substitutes
 * only the names its own token map supplies. `applyTokens` leaves an unknown name
 * untouched on purpose, so a typo in a template (`{{PROJECT_LABEL}}` where the
 * command supplies `PROJECT_LABLE`), or a token added to a template and forgotten
 * in a command, used to be copied straight into the generated project: the user
 * got a literal `{{…}}` in a source file and the build broke somewhere far away
 * from the template at fault. Nothing in the type checker can see this — the
 * placeholders only meet their replacements at copy time.
 *
 * Two halves are pinned here:
 *
 *  1. Every template token is supplied by the command that renders it, and
 *  2. Generating from every template leaves no `{{TOKEN}}` behind — for all four
 *     core modes, which is where the `{{CORE_MODE}}`/`{{PUBLIC_GETS}}` tokens
 *     differ per mode.
 *
 *   node packages/cli/scripts/check-markers.mjs
 *
 * Self-cleaning and offline: it generates into a throwaway project in a temp
 * directory, which is removed afterwards. No install, no network, no shared state.
 *
 * Note: the CLI is exercised through its real entrypoint, which prefers
 * `packages/cli/dist/cli.js` when it exists. Run `pnpm -F @hamolus/cli build` after
 * editing the CLI sources, or this exercises the previous build.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const CLI = resolve(HERE, '..', 'bin', 'hamolus.mjs')
const TEMPLATES = join(REPO, 'templates')

/**
 * Files worth scanning for leftovers: text the project actually consumes. Real
 * source, manifests, env examples, and docs a human will read. Anything not
 * listed here is a lockfile, a binary asset or a cache.
 */
const TEXT_FILES = new Set([
  '.env.example',
  '.gitignore',
  'wrangler.jsonc',
  'tsconfig.json',
  'tsconfig.base.json',
  'package.json',
  'hamolus.json',
])
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.txt',
  '.example',
])

function isTextFile(name) {
  const dot = name.lastIndexOf('.')
  return TEXT_FILES.has(name) || TEXT_EXTENSIONS.has(dot === -1 ? '' : name.slice(dot))
}

/**
 * Token name per the commands that render them (see the `*Tokens()` functions).
 *
 * `DEV_HOST` appears in four lists on purpose: the core, the console, the MCP server
 * and a site are four separate commands, and each one has to bind the same address
 * independently. A project created to be reachable over the LAN only really is, if all
 * four of them agree.
 */
const SUPPLIED_BY = {
  create: ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'CORE_NAME', 'CORE_SLUG', 'CORE_MODE', 'PUBLIC_GETS', 'DEV_HOST', 'DEFAULT_LAND', 'DEFAULT_COLONY', 'DB_NAME', 'BUCKET_NAME', 'KV_NAMESPACE'],
  'add configuration': ['CONFIG_ID', 'CONFIG_NAME', 'CONFIG_SLUG', 'PACKAGE_NAME'],
  'add seed': ['SEED_ID', 'SEED_NAME', 'SEED_SLUG', 'PACKAGE_NAME'],
  'add panel': ['PANEL_ID', 'PANEL_NAME', 'PANEL_SLUG'],
  'add console': ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'PACKAGE_NAME', 'DEV_HOST'],
  'add mcp': ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'PACKAGE_NAME', 'DEV_HOST'],
  'add site': ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'SITE_ID', 'SITE_NAME', 'SITE_SLUG', 'SITE_LABEL', 'PACKAGE_NAME', 'CORE_ORIGIN', 'DEV_HOST'],
}

/**
 * The generated console's pre-paint theme script.
 *
 * `packages/console/index.html` inlines a small JS snippet that reads the stored
 * mode/palette/font and sets `data-mode` / `data-theme` / `data-font` on <html>
 * before the bundle runs — without it, every reload flashes the default palette
 * until hydration. The console template carries a copy so a generated app gets the
 * same behaviour with no extra file to fetch, which means the two snippets are a
 * silent-drift hazard: editing one and not the other is invisible until someone
 * reloads a generated app and gets the wrong palette. The checker extracts both and
 * compares them, so the copy cannot rot.
 */
const THEME_SCRIPT = /<script>\n([\s\S]*?)<\/script>/g
const CANONICAL_INDEX_HTML = join(REPO, 'packages', 'console', 'index.html')
const CONSOLE_INDEX_HTML = join(TEMPLATES, 'consoles', 'basic', 'index.html')

function themeScriptOf(file) {
  const match = [...readFileSync(file, 'utf8').matchAll(THEME_SCRIPT)][0]
  return match ? match[1].trim() : null
}

const MODES = ['independent', 'centralized', 'proxy', 'bridge']
const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g

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

const root = mkdtempSync(join(tmpdir(), 'hamolus-markers-'))

function run(cwd, args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })
}

/** A throwaway project: `hamolus.json` is how the CLI locates a project root. */
function project(name) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'hamolus.json'),
    `${JSON.stringify({ version: 1, name }, null, 2)}\n`,
    'utf8',
  )
  return dir
}

/** Every `{{TOKEN}}` in a template directory, with the file it came from. */
function templateTokens(dir) {
  const found = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile() || !isTextFile(entry.name)) continue
      for (const [, name] of readFileSync(path, 'utf8').matchAll(PLACEHOLDER)) {
        found.push({ name, file: relative(TEMPLATES, path) })
      }
    }
  }
  walk(dir)
  return found
}

/**
 * Every `{{TOKEN}}` left in a generated tree, as `name in path` lines.
 *
 * Shared by the per-mode generation check and the wizard check: both claim that nothing
 * unresolved survives, and a second copy of the walk would be a second place to forget
 * a directory.
 */
function findLeftovers(app) {
  const leftovers = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile() || !isTextFile(entry.name)) continue
      for (const [full, name] of readFileSync(path, 'utf8').matchAll(PLACEHOLDER)) {
        leftovers.push(`${name} in ${relative(app, path)} (${full})`)
      }
    }
  }
  walk(app)
  return leftovers
}

try {
  // 1. Every template token is supplied by the command that renders it.
  const parts = [
    ['cores', 'create'],
    ['configurations/basic', 'add configuration'],
    ['seeds/basic', 'add seed'],
    ['panels/basic', 'add panel'],
    ['consoles/basic', 'add console'],
    ['mcps/basic', 'add mcp'],
    ['sites/astro/basic', 'add site'],
    ['sites/nextjs/basic', 'add site'],
  ]

  for (const [dir, command] of parts) {
    const found = templateTokens(join(TEMPLATES, dir))
    if (found.length === 0) {
      ok(`${dir}: uses at least one token`, false, 'no {{TOKEN}} found — is the template a stub?')
      continue
    }
    const supplied = new Set(SUPPLIED_BY[command])
    const missing = found.filter((hit) => !supplied.has(hit.name))
    ok(
      `${dir}: every token is supplied by \`hamolus ${command}\``,
      missing.length === 0,
      missing.map((hit) => `${hit.name} in ${hit.file}`).join('\n'),
    )
  }

  // A token map that names a token no template uses is dead weight, not a failure:
  // reported so the two sides stay honest about each other.
  for (const [dir, command] of parts) {
    const used = new Set(templateTokens(join(TEMPLATES, dir)).map((hit) => hit.name))
    const unused = SUPPLIED_BY[command].filter((name) => !used.has(name))
    ok(
      `${command}: no unused token names in its map${unused.length ? ` (${unused.join(', ')})` : ''}`,
      true,
    )
    if (unused.length) console.log(`      note: unused ${unused.join(', ')}`)
  }

  // 2. Generation leaves no placeholder behind, in every mode.
  for (const mode of MODES) {
    const dir = project(`mode-${mode}`)
    const created = run(dir, ['create', 'acme', '-o', 'app', '--mode', mode, '-y'])
    if (created.status !== 0) {
      ok(`${mode}: create succeeds`, false, `${created.stdout}\n${created.stderr}`)
      continue
    }

    const app = join(dir, 'app')
    for (const part of [
      ['add', 'configuration', 'basic'],
      ['add', 'seed', 'demo'],
      ['add', 'panel', 'orders'],
      ['add', 'console'],
      ['add', 'mcp'],
    ]) {
      const out = run(app, part)
      ok(`${mode}: \`hamolus ${part.join(' ')}\` succeeds`, out.status === 0, `${out.stdout}\n${out.stderr}`)
    }

    const leftovers = findLeftovers(app)
    ok(`${mode}: generated project has no {{TOKEN}} left`, leftovers.length === 0, leftovers.join('\n'))

    // The mode is rendered, not merely absent: PUBLIC_GETS must flip with it.
    const wrangler = readFileSync(join(app, 'core', 'wrangler.jsonc'), 'utf8')
    const expected = mode === 'independent' ? 'true' : 'false'
    ok(
      `${mode}: core wrangler.jsonc renders PUBLIC_GETS=${expected}`,
      wrangler.includes(`"PUBLIC_GETS": "${expected}"`),
      wrangler,
    )
    ok(
      `${mode}: core wrangler.jsonc renders CORE_MODE=${mode}`,
      wrangler.includes(`"CORE_MODE": "${mode}"`),
      wrangler,
    )
  }

  // 2b. The console template's theme script is the console's own, byte for byte.
  const canonical = themeScriptOf(CANONICAL_INDEX_HTML)
  const copy = themeScriptOf(CONSOLE_INDEX_HTML)
  ok(
    'the generated console carries the canonical pre-paint theme script',
    canonical !== null && canonical === copy,
    canonical === null
      ? `no inline <script> block found in ${relative(REPO, CANONICAL_INDEX_HTML)}`
      : 'the two snippets differ — copy the script from packages/console/index.html into templates/consoles/basic/index.html',
  )

  // 3. A token the command does not supply fails at the copy site, loudly.
  //
  // `--template <dir>` is used verbatim as the core template (no `cores/` suffix),
  // so the broken file is simply dropped in there. `create` mkdir's the output and
  // then copies the core, so a throw inside the copy leaves the core gone and the
  // root files (written after the copy) unwritten.
  const dir = project('unresolved')
  const broken = join(root, 'broken-core-template')
  mkdirSync(broken, { recursive: true })
  writeFileSync(join(broken, 'src.ts'), 'ok = 1\ntypo = {{SEED_LABLE}}\n', 'utf8')
  const out = run(dir, ['create', 'acme', '-o', 'app', '-y', '--template', broken])
  ok(
    'a template with an unsupplied token is reported, not copied verbatim',
    out.status !== 0 && /Unresolved template token/.test(out.stderr) && /SEED_LABLE/.test(out.stderr),
    `${out.stdout}\n${out.stderr}`,
  )
  ok(
    'the failure names the file that carries the token',
    /src\.ts/.test(out.stderr),
    out.stderr,
  )
  ok(
    'the failed core directory is cleaned up',
    !existsSync(join(dir, 'app', 'core')),
  )
  ok(
    'the failed create wrote no project manifest',
    !existsSync(join(dir, 'app', 'package.json')),
  )

  // 4. The wizard produces a project, and produces the same one as the flags.
  //
  // `hamolus init` owns no scaffolding logic — it calls `create` and `add` with the
  // answers it collected — so the only thing that can break here is the wiring between
  // the two. A wizard that answered a question but forgot to pass it on used to be
  // indistinguishable from a wizard that worked: both printed a success line, and only
  // the generated files differed. These assertions read those files.
  {
    const dir = project('wizard')
    const out = run(dir, ['init', 'acme', '--yes', '--console', '--mcp', '--site', 'nextjs'])
    ok('init --yes succeeds with no terminal', out.status === 0, `${out.stdout}\n${out.stderr}`)

    const app = join(dir, 'acme')
    const read = (...parts) => readFileSync(join(app, ...parts), 'utf8')

    ok('the core is generated', existsSync(join(app, 'core', 'wrangler.jsonc')))
    ok('the console is generated', existsSync(join(app, 'console', 'package.json')))
    ok('the MCP server is generated', existsSync(join(app, 'mcp', 'package.json')))
    ok('the site is generated', existsSync(join(app, 'sites', 'acme_site', 'package.json')))

    ok('a generated core gets working local secrets', existsSync(join(app, 'core', '.dev.vars')))
    const devVars = existsSync(join(app, 'core', '.dev.vars')) ? read('core', '.dev.vars') : ''
    const secrets = [...devVars.matchAll(/^(?:JWT_SECRET|ADMIN_KEY)=(.+)$/gm)].map((m) => m[1])
    ok(
      'both secrets are generated and long enough',
      secrets.length === 2 && secrets.every((value) => value.length >= 16),
      devVars,
    )
    ok(
      'the two secrets differ',
      secrets.length === 2 && secrets[0] !== secrets[1],
      'the same value for JWT_SECRET and ADMIN_KEY',
    )

    // The host is the answer a generated part has to inherit rather than guess, and
    // each part renders it in its own flag: wrangler's --ip, Vite's --host, Next's
    // --hostname. Getting one of the three wrong is invisible until a phone cannot
    // open the page, which is exactly the bug this pins.
    const host = read('hamolus.json').includes('"devHost": "127.0.0.1"')
    ok('the project records the dev host it was created with', host, read('hamolus.json'))
    ok(
      'the core binds that host',
      read('core', 'package.json').includes('wrangler dev --ip 127.0.0.1'),
      read('core', 'package.json'),
    )
    ok(
      'the console binds that host',
      read('console', 'package.json').includes('vite --host 127.0.0.1'),
      read('console', 'package.json'),
    )
    ok(
      'the MCP server binds that host',
      read('mcp', 'package.json').includes('wrangler dev --ip 127.0.0.1'),
      read('mcp', 'package.json'),
    )
    ok(
      'the site binds that host',
      read('sites', 'acme_site', 'package.json').includes('next dev --hostname 127.0.0.1'),
      read('sites', 'acme_site', 'package.json'),
    )
    ok(
      'a site is pointed at the core on the address it was created with',
      read('sites', 'acme_site', 'src', 'lib', 'hamolus.ts').includes('http://127.0.0.1:8787'),
      read('sites', 'acme_site', 'src', 'lib', 'hamolus.ts'),
    )

    const kinds = [...read('hamolus.json').matchAll(/"kind": "([a-z]+)"/g)].map((m) => m[1])
    ok(
      'every part the wizard was asked for is recorded',
      ['core', 'console', 'mcp', 'site'].every((kind) => kinds.includes(kind)),
      kinds.join(', '),
    )

    // `--host 0.0.0.0` and a typed land/colony take the other branch of every one of
    // those questions, and nothing else in the suite covers them.
    const lan = project('wizard-lan')
    const lanOut = run(lan, [
      'init', 'wide', '--yes', '--host', '0.0.0.0', '--mode', 'centralized',
      '--land', 'acme', '--colony', 'jakarta', '--core', 'predefined', '--site', 'astro',
    ])
    ok('init with a multi-tenant mode succeeds', lanOut.status === 0, `${lanOut.stdout}\n${lanOut.stderr}`)
    const wide = join(lan, 'wide')
    if (existsSync(join(wide, 'core', 'wrangler.jsonc'))) {
      const wrangler = readFileSync(join(wide, 'core', 'wrangler.jsonc'), 'utf8')
      ok('the chosen land and colony are rendered', /"DEFAULT_LAND": "acme"/.test(wrangler) && /"DEFAULT_COLONY": "jakarta"/.test(wrangler), wrangler)
      ok('a multi-tenant core refuses public GETs', /"PUBLIC_GETS": "false"/.test(wrangler), wrangler)
      ok(
        'the core binds the LAN address that was asked for',
        readFileSync(join(wide, 'core', 'package.json'), 'utf8').includes('wrangler dev --ip 0.0.0.0'),
        readFileSync(join(wide, 'core', 'package.json'), 'utf8'),
      )
      ok(
        'the predefined template really shipped collections',
        existsSync(join(wide, 'core', 'src', 'collections', 'index.ts')),
      )
      // 0.0.0.0 is a bind address, not a destination. A server can be told to listen
      // on it; a fetch handed it is rejected on some systems, and where it is not it
      // points back at the machine running the fetch — which, in a browser on a phone,
      // is the phone. A site generated for a LAN project has to name a reachable origin.
      ok(
        'a site in a LAN project is not handed the bind address as its origin',
        readFileSync(join(wide, 'sites', 'wide_site', 'src', 'lib', 'hamolus.ts'), 'utf8')
          .includes('http://localhost:8787'),
        readFileSync(join(wide, 'sites', 'wide_site', 'src', 'lib', 'hamolus.ts'), 'utf8'),
      )
    }

    // `--yes` is supposed to be the same answers a person would give, not a smaller
    // project: a wizard that quietly skipped a question would hide here.
    ok(
      'no {{TOKEN}} survives the wizard',
      findLeftovers(app).length === 0,
      findLeftovers(app).join('\n'),
    )

    // 5. The derived site id has to be a *part* name, not merely resemble the project
    //    name.
    //
    // A project name and a part name are not the same grammar: `create` allows hyphens
    // and caps the name at 63 characters, `add site` requires `snake_case` and caps it at
    // 64. The wizard derives the default site id from the project name and never asks,
    // so both differences have to be absorbed here — otherwise `hamolus init my-project
    // --site astro` wrote a core, a project manifest and a `.dev.vars`, and *then* failed
    // on a name the user never typed. Both cases below are silent until the last step,
    // which is the worst moment to learn a name is invalid.
    {
      const dir = project('wizard-hyphen')
      const out = run(dir, ['init', 'my-project', '--yes', '--site', 'astro'])
      ok(
        'a hyphenated project name yields a site part that hamolus add site accepts',
        out.status === 0,
        `${out.stdout}\n${out.stderr}`,
      )
      const site = join(dir, 'my-project', 'sites', 'my_project_site', 'package.json')
      ok(
        'the derived site id turns hyphens into underscores',
        existsSync(site),
        [...(existsSync(join(dir, 'my-project', 'sites')) ? readdirSync(join(dir, 'my-project', 'sites')) : [])].join(', '),
      )
    }

    {
      // 63 characters — the longest a project name may be — plus a 5-character suffix.
      const dir = project('wizard-long')
      const long = `a${'b'.repeat(62)}`
      const out = run(dir, ['init', long, '--yes', '--site', 'nextjs'])
      ok(
        'a project name at the length limit still yields a valid site id',
        out.status === 0,
        `${out.stdout}\n${out.stderr}`,
      )
      const sites = join(dir, long, 'sites')
      const generated = existsSync(sites) ? readdirSync(sites) : []
      ok('the long-name site is generated', generated.length === 1, generated.join(', '))
      ok(
        'the derived site id fits what a part name allows',
        generated.every((name) => /^[a-z][a-z0-9_]{0,63}$/.test(name)),
        generated.join(', '),
      )
      ok(
        'the derived site id keeps the suffix it was shortened to make room for',
        generated.some((name) => name.endsWith('_site')),
        generated.join(', '),
      )
    }

    // 6. A bare `hamolus create` opens the wizard, and a bare `hamolus create --yes`
    //    opens it too.
    //
    // `create` cannot invent a project name, so a nameless `create` is the one invocation
    // the wizard is the obvious answer to. It used to be gated on `canPrompt(--yes)`,
    // which is false whenever `--yes` is set — so `hamolus create --yes`, the one form
    // that needs no terminal at all, was the one form that could not reach the wizard and
    // fell through to "missing name". `--yes` means "take the defaults", not "ask me
    // nothing and then fail".
    {
      // A bare directory, *not* `project()`: the wizard's default name comes from the
      // directory it runs in, so a pre-written `hamolus.json` here would only be a
      // project this test is not trying to make.
      const dir = join(root, 'wizard-bare-create')
      mkdirSync(dir, { recursive: true })
      const out = run(dir, ['create', '--yes'])
      // The wizard's banner, not `create`'s. Whichever one ran, the run has to have
      // written a project — that is the part that was broken.
      ok(
        'a bare `hamolus create --yes` reaches the wizard instead of failing',
        out.status === 0 && out.stdout.includes('hamolus — new project'),
        `${out.stdout}\n${out.stderr}`,
      )
      ok(
        'the bare create --yes run wrote a project named after the directory it ran in',
        existsSync(join(dir, 'wizard-bare-create', 'hamolus.json')),
        readdirSync(dir).join(', '),
      )

      // Still a usage error, though: nameless, no terminal, and no permission to guess.
      const bareDir = join(root, 'wizard-bare-usage')
      mkdirSync(bareDir, { recursive: true })
      const bare = run(bareDir, ['create'])
      ok(
        'a nameless non-interactive `create` without --yes is still a usage error',
        bare.status !== 0 && /name/i.test(bare.stderr),
        `${bare.stdout}\n${bare.stderr}`,
      )
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
