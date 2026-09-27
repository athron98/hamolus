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
 * `pnpm-workspace.yaml` glob-coverage regression check.
 *
 * Why this exists: `hamolus add <part>` has to register the part's directory as a
 * workspace glob, or pnpm never sees the new package and `pnpm install` skips it
 * (or `pnpm -F` cannot find it). The registry was originally patched with
 * `appendFile`, which appended the entry to the *end of the file* — landing it
 * under whatever top-level key happened to be last (`onlyBuiltDependencies:`),
 * where it is silently ignored. It then also missed a manifest with no top-level
 * `packages:` key at all and appended anyway.
 *
 * `ensureWorkspaceGlob()` now inserts directly after the last entry of the
 * `packages:` block, and refuses to guess when the key is missing. Both branches
 * are load-bearing, and neither is reachable from the type checker, so they are
 * pinned here.
 *
 *   node packages/cli/scripts/check-workspace-glob.mjs
 *
 * Self-cleaning and non-destructive: every case runs against a throwaway project
 * in a temp directory, which is removed afterwards. No shared state is touched
 * and no network call is made — `hamolus add` copies templates and edits
 * manifests only, so no `pnpm install` is needed.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(HERE, '..', 'bin', 'hamolus.mjs')

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

const root = mkdtempSync(join(tmpdir(), 'hamolus-wg-'))

/**
 * A throwaway project with a hand-written workspace manifest.
 *
 * The `hamolus.json` marker is required: `add` resolves the project root by
 * walking up to it, and a directory without one is rejected before the manifest
 * is ever read.
 */
function project(manifest, name) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), manifest, 'utf8')
  writeFileSync(
    join(dir, 'hamolus.json'),
    `${JSON.stringify(
      {
        version: 1,
        name,
        scope: `@${name}`,
        mode: 'independent',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        parts: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: name, private: true, workspaces: undefined }, null, 2)}\n`,
    'utf8',
  )
  return dir
}

const run = (cwd, ...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })

const packagesBlock = (manifest) => manifest.slice(0, manifest.indexOf('\n\n') + 2)

try {
  // 1. A missing glob is inserted as the last entry of the `packages:` block, not at EOF.
  {
    const dir = project(
      [
        'packages:',
        "  - 'core'",
        "  - 'configs/*'",
        '',
        '# Build scripts of transitive dependencies, trusted for this project.',
        'onlyBuiltDependencies:',
        '  - esbuild',
        '',
      ].join('\n'),
      'insert',
    )
    const out = run(dir, 'add', 'panel', 'shop_ops')
    const after = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
    ok('add panel reports success', out.status === 0, out.stderr)
    ok(
      "the missing glob is added as - 'panels/*'",
      after.includes("  - 'panels/*'"),
      after,
    )
    ok(
      'the entry stays inside the packages: block',
      packagesBlock(after).includes("  - 'panels/*'"),
      after,
    )
    ok(
      'it is not appended after the last top-level key',
      !after.includes('onlyBuiltDependencies:\n  - esbuild\n  - \'panels/*\''),
      after,
    )
    ok(
      'the entry is the last one in the block',
      packagesBlock(after).trimEnd().endsWith("- 'panels/*'"),
      packagesBlock(after),
    )
  }

  // 2. Adding a second part of the same kind must not duplicate the glob.
  {
    const dir = project(
      ['packages:', "  - 'core'", "  - 'panels/*'", '', 'onlyBuiltDependencies:', '  - esbuild', ''].join('\n'),
      'idempotent',
    )
    const out = run(dir, 'add', 'panel', 'orders')
    const after = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
    ok('add panel succeeds when the glob is present', out.status === 0, out.stderr)
    ok(
      "the existing - 'panels/*' entry is left alone",
      (after.match(/- 'panels\/\*'/g) ?? []).length === 1,
      after,
    )
    ok('the file is byte-identical', after.endsWith('onlyBuiltDependencies:\n  - esbuild\n'), after)
  }

  // 3. A manifest whose entries are unquoted still counts as covered.
  {
    const dir = project(
      ['packages:', '  - core', '  - panels/*', '', 'onlyBuiltDependencies:', '  - esbuild', ''].join('\n'),
      'unquoted',
    )
    const out = run(dir, 'add', 'panel', 'carts')
    const after = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
    ok('add panel succeeds with unquoted entries', out.status === 0, out.stderr)
    ok(
      'no duplicate glob is added for an unquoted match',
      (after.match(/panels\/\*/g) ?? []).length === 1,
      after,
    )
  }

  // 4. A glob mentioned in a comment is not coverage, and a missing `packages:`
  //    key is reported instead of being patched blindly.
  {
    const dir = project(
      [
        '# packages:',
        "onlyBuiltDependencies:",
        '  - esbuild',
        '',
        '# generated parts live in panels/* but this key is gone',
        '',
      ].join('\n'),
      'no-key',
    )
    const out = run(dir, 'add', 'panel', 'orders')
    const after = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
    ok('a manifest without a top-level packages: key fails loudly', out.status !== 0, out.stdout)
    ok(
      'the error names the missing key',
      /packages:/.test(out.stderr) && /re-run/.test(out.stderr),
      out.stderr,
    )
    ok('the manifest is left untouched', after.includes("  - esbuild"), after)
    ok(
      'no glob was appended at the end of the file',
      !after.trimEnd().endsWith("- 'panels/*'"),
      after,
    )
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length === 0 ? 0 : 1)
