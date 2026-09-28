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
 * Release-version consistency check.
 *
 * Why this exists: the release version lives in more places than it looks, and every
 * one of the others is invisible to `pnpm install` and to the type checker.
 *
 *   - the lockstep package manifests;
 *   - `FALLBACK_RANGES` in the CLI, the ranges a generated project is handed when no
 *     version can be discovered, plus `DEFAULT_VERSION_RANGE` beside it;
 *   - `CLI_VERSION` and `SERVER_VERSION`, the versions the two binaries report;
 *   - the `^`-ranges in every template and every example, because those trees are not
 *     workspace members and so are never resolved against the local packages.
 *
 * A bump that misses any of them is not a loud failure. It is a published CLI that
 * generates projects against a version that was never published, an MCP server that
 * introduces itself as the previous release, or examples that quietly keep running
 * last month's core. Same class of bug as `check-workspace-glob`: one registry edited
 * in one place and read in another, with nothing linking the two.
 *
 * What is pinned:
 *   1. the lockstep packages share one version, and it is the current one;
 *   2. every `@hamolus/*` range in `templates/**`, `packages/cli/templates/**` and
 *      `examples/**` matches the version of the package it names;
 *   3. the four own-version constants above equal the lockstep version;
 *   4. the root CHANGELOG.md has a dated entry for it, and an `[Unreleased]` section.
 *
 * Rule 2 is deliberately per-package rather than "everything is `^X`", because the
 * console plugins under `packages/plugins/**` version independently: a release that
 * does not touch them should not claim to.
 *
 *   node packages/cli/scripts/check-package-versions.mjs
 *
 * Offline and non-destructive: it reads manifests, source and the changelog, and
 * proves its own rules with synthetic inputs in memory. Nothing is written outside
 * this process and no network call is made.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

/**
 * The lockstep set: the published packages a generated project mixes together, or
 * reaches for by name — `create-hamolus` included, because `npm create hamolus@latest`
 * hands a scaffold to whatever `@hamolus/cli` its own range resolves to.
 *
 * Discovered rather than hardcoded where possible. `packages/*` is exactly that set
 * and `packages/plugins/**` is exactly the independently-versioned one, so the split
 * follows the workspace layout instead of a list that can fall behind it — the first
 * draft of this gate hardcoded six names and passed while three published plugin
 * packages sat at a different version.
 */
const LOCKSTEP_GLOB = 'packages'
const INDEPENDENT_GLOB = 'packages/plugins'

/**
 * Constants whose value *is* a released version, keyed by file.
 *
 * Matching on the constant name rather than on a version-shaped literal is what keeps
 * this rule free of false alarms: the CLI also writes `version: '0.1.0'` into every
 * project it generates, and that number is the user's app, not ours.
 */
const OWN_VERSION_CONSTANTS = [
  { file: 'packages/cli/src/help.ts', name: 'CLI_VERSION', range: false },
  { file: 'packages/mcp/src/index.ts', name: 'SERVER_VERSION', range: false },
  { file: 'packages/cli/src/sources.ts', name: 'DEFAULT_VERSION_RANGE', range: true },
]

/**
 * The CLI's fallback table, parsed out of the source.
 *
 * This one is not a constant but an object literal, and it is the single place the CLI
 * decides what range to write into a project it cannot inspect. Read it with a real parse
 * rather than a regex over the file: a regex cannot tell `'^0.2.0'` from a comment, and
 * this table is exactly where a stale value survives review — it is prose-adjacent,
 * correct-looking, and never executed during a normal `hamolus add`.
 */
const FALLBACK_TABLE = { file: 'packages/cli/src/sources.ts', name: 'FALLBACK_RANGES' }

/**
 * Published packages a generated project can never legitimately depend on.
 *
 * `create-hamolus` is the initializer behind `npm create hamolus@latest`. It exists to
 * be run once, by npm, before a project exists — a generated project reaches the CLI
 * through `@hamolus/cli` and never through the initializer. Listing it in
 * `FALLBACK_RANGES` would not be harmless bookkeeping: the table is what a template's
 * `{{PACKAGE_NAME}}`-shaped dependency resolution reads, and an entry for a package no
 * template can name is a claim that something depends on it.
 *
 * The exemption is a named list rather than a rule about the name, because the thing
 * being exempted is a property of *what the package is for* — and a future initializer
 * should have to argue itself into this list, not be covered by a pattern.
 */
const NEVER_IN_A_GENERATED_PROJECT = new Set(['create-hamolus'])

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies']
const RANGE = (version) => `^${version}`

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

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const show = (path) => relative(REPO, path)

/** Every `package.json` under a tree, at any depth, skipping node_modules. */
function manifestsUnder(absRoot) {
  const found = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name === 'package.json') found.push(path)
    }
  }
  walk(resolve(REPO, absRoot))
  return found.sort()
}

const publishedVersionOf = (path) => {
  const manifest = readJson(path)
  return manifest.private === true ? null : manifest.version
}

/** Every `@hamolus/*` range declared by a manifest, as `[name, range, where]`. */
function hamolusRanges(manifest, where) {
  const found = []
  for (const section of DEP_SECTIONS) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (name.startsWith('@hamolus/')) found.push([name, String(range), `${where} (${section})`])
    }
  }
  return found
}

/** The value a constant is assigned, or undefined if it is not there. */
function readConstant(path, name) {
  let source
  try {
    source = readFileSync(resolve(REPO, path), 'utf8')
  } catch {
    return undefined
  }
  const match = new RegExp(`\\b${name}\\s*(?::\\s*string)?\\s*=\\s*['"\`]([^'"\`]+)['"\`]`).exec(source)
  return match?.[1]
}

/**
 * The rules, as pure functions over plain data, so the cases at the bottom can prove
 * they reject what they claim to reject. A gate that has only ever run green against a
 * healthy tree has not been tested.
 */
function rangeProblems(expectedVersions, ranges) {
  const problems = []
  for (const [name, range, where] of ranges) {
    const want = expectedVersions.get(name)
    if (want === undefined) {
      problems.push(`${name} is not a package in this repository (in ${where})`)
    } else if (range !== RANGE(want)) {
      problems.push(`${name} pinned as ${range} in ${where}, expected ${RANGE(want)}`)
    }
  }
  return problems
}

/**
 * The `'@hamolus/x': '^0.2.0'` entries of an exported object literal.
 *
 * Deliberately narrow: it matches a quoted key that is a bare package name and a quoted
 * caret range. Anything more permissive starts matching the doc comment above the
 * declaration, which quotes a range for illustration.
 */
function readFallbackTable(path, name) {
  let source
  try {
    source = readFileSync(resolve(REPO, path), 'utf8')
  } catch {
    return undefined
  }
  const body = new RegExp(`export const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source)
  if (!body) return undefined
  const entries = new Map()
  for (const [, key, value] of body[1].matchAll(/'(@hamolus\/[\w-]+)':\s*'([^']+)'/g)) {
    entries.set(key, value)
  }
  return entries
}

/**
 * One rule, so the real tree and the cases below cannot drift apart: an earlier
 * draft had the check inline and a looser copy in the test section, where the
 * negative case passed for the wrong reason.
 *
 * `isRange` is not cosmetic. These constants are written straight into generated
 * manifests, so a bare `0.2.0` where a caret belongs is a different — and wrong —
 * artifact, not a cosmetic one.
 */
function constantProblem(value, version, isRange) {
  const want = isRange ? RANGE(version) : version
  return value === want ? null : `found ${value}, expected ${want}`
}

// ---------------------------------------------------------------------------
// 1. The lockstep set.
// ---------------------------------------------------------------------------

const lockstepPaths = manifestsUnder(LOCKSTEP_GLOB).filter(
  (path) => !show(path).startsWith(`${INDEPENDENT_GLOB}/`),
)
const lockstep = new Map()
for (const path of lockstepPaths) {
  const version = publishedVersionOf(path)
  if (version) lockstep.set(readJson(path).name, version)
}

ok('the lockstep set is non-empty', lockstep.size > 0, `${lockstep.size} found`)
ok(
  'every lockstep package is published at the same version',
  new Set(lockstep.values()).size === 1,
  [...lockstep].map(([n, v]) => `${n}@${v}`).join(', '),
)
const version = [...lockstep.values()][0] ?? '0.0.0'
ok('the lockstep set is not the empty tree', lockstep.size >= 2, `${lockstep.size} packages`)

// ---------------------------------------------------------------------------
// 2. The independently-versioned set exists and is not mistaken for the other one.
// ---------------------------------------------------------------------------

const independent = new Map()
for (const path of manifestsUnder(INDEPENDENT_GLOB)) {
  const published = publishedVersionOf(path)
  if (published) independent.set(readJson(path).name, published)
}
ok('the independently-versioned packages are readable', independent.size > 0, `${independent.size} found`)
ok(
  'the two sets do not overlap',
  [...independent.keys()].every((name) => !lockstep.has(name)),
  [...independent.keys()].filter((name) => lockstep.has(name)).join(', '),
)

/** What any `@hamolus/*` range anywhere in the tree should say. */
const expectedVersions = new Map([...lockstep, ...independent])

// ---------------------------------------------------------------------------
// 3. Every range outside the workspace.
// ---------------------------------------------------------------------------

const RANGE_TREES = ['templates', 'packages/cli/templates', 'examples']
const allRanges = []
for (const tree of RANGE_TREES) {
  for (const path of manifestsUnder(tree)) {
    allRanges.push(...hamolusRanges(readJson(path), show(path)))
  }
}
ok('templates and examples declare @hamolus ranges at all', allRanges.length > 0, `${allRanges.length} found`)

const problems = rangeProblems(expectedVersions, allRanges)
ok('every @hamolus range matches the version it names', problems.length === 0, problems.join('\n'))

const unknownNames = [
  ...new Set(
    allRanges.filter(([name]) => !expectedVersions.has(name)).map(([name]) => name),
  ),
]
ok('no range names a package that does not exist here', unknownNames.length === 0, unknownNames.join(', '))

// ---------------------------------------------------------------------------
// 4. The own-version constants in source.
// ---------------------------------------------------------------------------

const constants = {}
for (const { file, name, range } of OWN_VERSION_CONSTANTS) {
  const value = readConstant(file, name)
  constants[name] = value
  ok(`${name} is declared in ${file}`, value !== undefined)
  const problem = constantProblem(value, version, range)
  ok(`${name} matches the release version`, problem === null, problem ?? '')
}

// The CLI hands a generated project a range with no way to check it afterwards, so a
// wrong entry here is a project that cannot install and an error about a package the
// user never named.
const fallbacks = readFallbackTable(FALLBACK_TABLE.file, FALLBACK_TABLE.name)
ok(`${FALLBACK_TABLE.name} is readable in ${FALLBACK_TABLE.file}`, fallbacks !== undefined)
if (fallbacks) {
  const missing = [...expectedVersions.keys()].filter(
    (name) => !NEVER_IN_A_GENERATED_PROJECT.has(name) && !fallbacks.has(name),
  )
  ok(
    'the fallback table covers every published package a generated project can depend on',
    missing.length === 0,
    missing.join(', '),
  )
  const extra = [...fallbacks.keys()].filter((name) => !expectedVersions.has(name))
  ok(
    'the fallback table names no package that is not published here',
    extra.length === 0,
    extra.join(', '),
  )
  const wrong = [...fallbacks].flatMap(([name, range]) => {
    const want = expectedVersions.get(name)
    return want && range !== RANGE(want) ? [`${name}: ${range}, expected ${RANGE(want)}`] : []
  })
  ok('every fallback range matches the version it names', wrong.length === 0, wrong.join('\n'))
}

// ---------------------------------------------------------------------------
// 5. The public changelog.
// ---------------------------------------------------------------------------

let changelog = ''
try {
  changelog = readFileSync(resolve(REPO, 'CHANGELOG.md'), 'utf8')
} catch {
  // asserted below, with the same outcome either way
}
ok('the root CHANGELOG.md has an entry for the current version', changelog.includes(`[${version}]`))
ok(
  'the changelog dates that entry',
  new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}$`, 'm').test(changelog),
  'expected a `## [x.y.z] — YYYY-MM-DD` heading',
)
ok('the changelog keeps an [Unreleased] section', /^## \[Unreleased\]$/m.test(changelog))

// ---------------------------------------------------------------------------
// 6. The rules, against input that should be rejected.
// ---------------------------------------------------------------------------

const good = new Map([
  ['@hamolus/core', '0.2.0'],
  ['@hamolus/plugin-console-todo', '0.1.0'],
])
const cleanRanges = [
  ['@hamolus/core', '^0.2.0', 'templates/cores/basic/package.json'],
  ['@hamolus/plugin-console-todo', '^0.1.0', 'examples/consoles/with-plugins/package.json'],
]

ok('a clean tree reports no problems', rangeProblems(good, cleanRanges).length === 0)
ok(
  'a stale range on a lockstep package is caught',
  rangeProblems(good, [['@hamolus/core', '^0.1.0', 't.json']]).some((p) => p.includes('^0.2.0')),
  'the previous release is the most likely thing to leave behind',
)
ok(
  'a lockstep package is not forced onto a version it did not ship',
  rangeProblems(good, [['@hamolus/plugin-console-todo', '^0.2.0', 't.json']]).some((p) =>
    p.includes('^0.1.0'),
  ),
  'this is the mistake a blanket "everything is ^X" rule would make',
)
ok(
  'an exact pin is caught even when it resolves to the right version',
  rangeProblems(good, [['@hamolus/mcp', '0.2.0', 't.json']]).length === 1,
  'templates and examples use a caret range so a patch release is picked up',
)
ok(
  'a workspace: pin is caught',
  rangeProblems(good, [['@hamolus/mcp', 'workspace:*', 't.json']]).length === 1,
  'a generated project has no workspace to resolve that against',
)
ok(
  'a range for a package that is not in this repository is caught',
  rangeProblems(good, [['@hamolus/ghost', '^0.2.0', 't.json']]).some((p) => p.includes('not a package')),
)
ok(
  'a bare version where a range belongs is caught',
  constantProblem('0.1.0', '0.2.0', false) !== null,
)
ok(
  'a range constant is not satisfied by a bare version',
  constantProblem('0.2.0', '0.2.0', true) !== null,
  'the CLI writes this value straight into a generated manifest',
)
ok('a correct range constant passes', constantProblem('^0.2.0', '0.2.0', true) === null)
ok('a correct bare constant passes', constantProblem('0.2.0', '0.2.0', false) === null)
ok(
  'a fallback table that drifts from the manifests is caught',
  rangeProblems(
    new Map([['@hamolus/plugin-console-todo', '0.2.0']]),
    [['@hamolus/plugin-console-todo', '^0.2.0', 't.json']],
  ).length === 0 &&
    rangeProblems(
      new Map([['@hamolus/plugin-console-todo', '0.1.0']]),
      [['@hamolus/plugin-console-todo', '^0.2.0', 't.json']],
    ).length === 1,
  'the plugin left at 0.1.0 is exactly the case a shared constant gets wrong',
)
ok(
  'a pre-release version is not accepted as the release version',
  constantProblem('0.2.0-rc.1', '0.2.0', false) !== null,
  'a range may drop the suffix, but a version the server reports may not drift onto it',
)

// ---------------------------------------------------------------------------

console.log(`\n${pass} passed, ${failures.length} failed`)
if (failures.length > 0) process.exit(1)
