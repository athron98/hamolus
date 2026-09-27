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

/** Token name per the commands that render them (see the `*Tokens()` functions). */
const SUPPLIED_BY = {
  create: ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'CORE_MODE', 'PUBLIC_GETS', 'DB_NAME', 'BUCKET_NAME', 'KV_NAMESPACE'],
  'add configuration': ['CONFIG_ID', 'CONFIG_NAME', 'CONFIG_SLUG', 'PACKAGE_NAME'],
  'add seed': ['SEED_ID', 'SEED_NAME', 'SEED_SLUG', 'PACKAGE_NAME'],
  'add panel': ['PANEL_ID', 'PANEL_NAME', 'PANEL_SLUG'],
  'add console': ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'PACKAGE_NAME'],
  'add mcp': ['PROJECT_NAME', 'PROJECT_LABEL', 'PROJECT_SCOPE', 'PROJECT_SLUG', 'PACKAGE_NAME'],
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

try {
  // 1. Every template token is supplied by the command that renders it.
  const parts = [
    ['cores', 'create'],
    ['configurations/basic', 'add configuration'],
    ['seeds/basic', 'add seed'],
    ['panels/basic', 'add panel'],
    ['consoles/basic', 'add console'],
    ['mcps/basic', 'add mcp'],
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
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
