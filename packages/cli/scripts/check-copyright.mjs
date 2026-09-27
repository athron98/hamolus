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
 * Copyright/author-notice coverage check.
 *
 * Why this exists: Hamolus ships its TypeScript sources to npm rather than a
 * bundle for two of its packages (`@hamolus/core` and `@hamolus/mcp` publish
 * `src/` directly), so the file a consumer reads is the file in this repository.
 * The MIT terms ask for the copyright notice to travel with every copy, and a
 * notice that only exists in `LICENSE` at the repository root is not travelling
 * with anything — the published tarball never sees the repository. Half the
 * packages carried the notice, half did not, and nothing in the type checker or
 * the test suites can see a missing comment, so coverage silently rotted.
 *
 * Three things are pinned here, and they are deliberately different rules:
 *
 *  1. Every source file in a published package carries the full block, verbatim
 *     at the top of the file (after a shebang, if any). Verbatim, not
 *     "contains a copyright": a header that drifts in wording is a header where
 *     only the first file still says the right year and holder.
 *  2. Scaffolds — `templates/` and `examples/` — carry one line instead. Those
 *     files are copied into a user's project, where a seven-line license block on
 *     every file is noise the user did not ask for. The single line is still a
 *     notice, so the MIT requirement holds without the file losing its shape.
 *  3. Every published manifest declares `license`, `author`, `homepage`,
 *     `bugs` and `repository`, and lists `LICENSE` in `files` while a `prepack`
 *     hook puts one there.
 *
 *   node packages/cli/scripts/check-copyright.mjs
 *
 * Read-only and offline: it walks the working tree, generates nothing, installs
 * nothing, and touches no network. A new source file without a notice is a
 * failing assertion, not a silent gap.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

/**
 * The canonical block, one entry per line, as it appears in a source file.
 *
 * The blank entries are the ` *` separator lines of a block comment. `sql` and
 * `scaffold` are the two other shapes the same notice has to take, because a
 * `--` comment in SQL and a one-line notice in a file a user owns are both
 * places the same statement has to be made.
 */
const HOLDER = 'Gilang Albathin Nurhabibi <https://github.com/athron98>'
const BLOCK = [
  'Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>',
  '',
  'Author: Gilang Albathin Nurhabibi <https://github.com/athron98>',
  '',
  'SPDX-License-Identifier: MIT',
  '',
  'Licensed under the MIT License. See the LICENSE file at the repository root.',
]
const SINGLE_LINE = `Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT`

/** Extensions that can carry a comment at all. JSON cannot, so it is absent. */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.cjs', '.css', '.sql'])
const SCAFFOLD_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.sql',
  '.dart',
  '.html',
])

/**
 * Directories that are never source: build output, caches, installed
 * dependencies, and the two trees a `prepack` hook generates. `packages/cli/templates`
 * is a copy of the repository's `templates/` written by `copy-templates.mjs`, and
 * the per-package `LICENSE` files are written by `copy-license.mjs`; checking
 * either would only re-check the file they were copied from.
 */
const IGNORED = new Set([
  '.git',
  '.next',
  '.astro',
  '.svelte-kit',
  '.dart_tool',
  '.turbo',
  '.wrangler',
  '.mf',
  'Pods',
  'build',
  'dist',
  'dist-lib',
  'node_modules',
  'out',
  'templates',
])

let passed = 0
const failures = []
const ok = (name, condition, detail = '') => {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
  } else {
    failures.push(name)
    console.log(`FAIL  ${name}${detail ? `\n      ${String(detail).replace(/\n/g, '\n      ')}` : ''}`)
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (IGNORED.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/**
 * Whether `file` opens with the canonical block, and the first lines to show if
 * it does not.
 *
 * A shebang has to stay on line one for the file to be executable, so the notice
 * is expected on the lines after it rather than on line one. SQL opens the notice
 * with a bare `--` line and closes it with another one, because a line comment has
 * no terminator; every other language gets a block comment that must be closed.
 */
function hasBlock(file) {
  const raw = readFileSync(file, 'utf8')
  const shebang = raw.match(/^#![^\n]*\n/)
  const text = shebang ? raw.slice(shebang[0].length) : raw
  const sql = extname(file) === '.sql'
  const open = sql ? '--\n' : text.startsWith('/*\n') ? '/*\n' : '/**\n'
  const prefix = sql ? '--' : ' *'
  const expected = BLOCK.map((line) => (line ? `${prefix} ${line}` : prefix))
  const lines = text.slice(open.length).split('\n')
  const found = lines.slice(0, expected.length)
  if (found.join('\n') !== expected.join('\n')) return { ok: false, found }
  // The block must also be closed, otherwise the "notice" is an unterminated
  // comment that swallows the file behind it. SQL's notice is a run of line
  // comments, so what closes it is the next `--` line (or the blank line before
  // whatever the file said originally).
  const next = lines[expected.length]
  if (sql) return { ok: next === '--' || next.trim() === '' || next.startsWith('--'), next }
  return { ok: next === ' */' || next === ' *', next }
}

/** Whether a scaffold file carries the one-line notice near the top. */
function hasScaffoldNotice(file) {
  const raw = readFileSync(file, 'utf8')
  if (!raw.includes(SINGLE_LINE)) return { ok: false, found: raw.split('\n').slice(0, 3) }
  const head = raw.split('\n').slice(0, extname(file) === '.html' ? 3 : 2)
  return { ok: head.some((line) => line.includes(SINGLE_LINE)), found: head }
}

// 1. Every source file of a published package carries the block.
const packageFiles = []
for (const dir of walk(join(REPO, 'packages'))) {
  if (SOURCE_EXTENSIONS.has(extname(dir))) packageFiles.push(dir)
}
const withoutBlock = []
for (const file of packageFiles) {
  const { ok: has, found } = hasBlock(file)
  if (!has) withoutBlock.push(`${relative(REPO, file)}\n${(found ?? []).join('\n')}`)
}
ok(
  `every source file in packages/ carries the copyright block (${packageFiles.length} files)`,
  withoutBlock.length === 0,
  withoutBlock.length === 0 ? '' : `${withoutBlock.length} file(s):\n${withoutBlock.join('\n\n')}`,
)
ok(
  'the block is a closed comment, not an unterminated one',
  packageFiles.every((file) => hasBlock(file).ok),
)
ok(
  'the block names the author and an SPDX identifier',
  packageFiles.every((file) => {
    const text = readFileSync(file, 'utf8')
    return text.includes(HOLDER) && text.includes('SPDX-License-Identifier: MIT')
  }),
)
ok(
  'the block is never repeated in one file',
  // This file spells the notice out twice by definition — once in `BLOCK` and once
  // in the pattern below — so it is the one file exempt from the count.
  packageFiles.every((file) => {
    if (file === fileURLToPath(import.meta.url)) return true
    const text = readFileSync(file, 'utf8')
    return (text.match(/SPDX-License-Identifier: MIT/g) ?? []).length === 1
  }),
)

// 2. Scaffolds carry one line, at the front.
const scaffoldFiles = []
for (const base of ['templates', 'examples']) {
  for (const file of walk(join(REPO, base))) {
    if (SCAFFOLD_EXTENSIONS.has(extname(file))) scaffoldFiles.push(file)
  }
}
const withoutNotice = scaffoldFiles
  .filter((file) => !hasScaffoldNotice(file).ok)
  .map((file) => relative(REPO, file))
ok(
  `every template and example file carries the one-line notice (${scaffoldFiles.length} files)`,
  withoutNotice.length === 0,
  withoutNotice.length === 0 ? '' : withoutNotice.join('\n'),
)
ok(
  'templates are not given the full block — a scaffold stays one line',
  scaffoldFiles.every((file) => !readFileSync(file, 'utf8').includes('SPDX-License-Identifier: MIT')),
)

// 3. Every published manifest carries the fields npm renders, and a real license
//    file on the way out.
const manifests = []
for (const file of walk(join(REPO, 'packages'))) {
  if (extname(file) !== '.json') continue
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  if (!manifest.name?.startsWith('@hamolus/')) continue
  if (manifest.private === true) continue
  manifests.push({ file, manifest })
}
const REQUIRED = ['license', 'author', 'homepage', 'bugs', 'repository']
for (const { file, manifest } of manifests) {
  const name = relative(REPO, file)
  for (const field of REQUIRED) {
    ok(`${manifest.name} declares "${field}"`, manifest[field] !== undefined, name)
  }
  ok(`${manifest.name} is licensed MIT`, manifest.license === 'MIT', name)
  ok(
    `${manifest.name} names the author`,
    typeof manifest.author === 'string' && manifest.author.includes(HOLDER),
    `${name}: author = ${JSON.stringify(manifest.author)}`,
  )
  ok(
    `${manifest.name} lists LICENSE in "files"`,
    Array.isArray(manifest.files) && manifest.files.includes('LICENSE'),
    name,
  )
  ok(
    `${manifest.name} copies LICENSE in prepack`,
    typeof manifest.scripts?.prepack === 'string' && manifest.scripts.prepack.includes('copy-license.mjs'),
    `${name}: prepack = ${JSON.stringify(manifest.scripts?.prepack)}`,
  )
  const repository = manifest.repository
  ok(
    `${manifest.name} points its repository at its own directory`,
    typeof repository === 'object' && typeof repository.directory === 'string',
    name,
  )
}
ok(
  'the copy-license script exists',
  statSync(join(HERE, 'copy-license.mjs')).isFile(),
  'packages/cli/scripts/copy-license.mjs is referenced by every prepack hook',
)

console.log(`\n${passed} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
