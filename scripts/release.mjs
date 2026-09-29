#!/usr/bin/env node
// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Cut a release: bump every version that has to move, publish, verify, tag.
 *
 * Why this exists: the release version lives in six manifests, three constants and a
 * changelog heading, and `pnpm install` and `tsc` cannot see any of them. Missing one is
 * not a build failure — it is a published CLI that generates projects against a version
 * nobody published, or an MCP server that introduces itself as last month's release. The
 * same failure, three releases running, is what the version bump is done here rather than
 * by hand.
 *
 * Usage:
 *   node scripts/release.mjs patch           # 0.2.2 -> 0.2.3
 *   node scripts/release.mjs minor           # 0.2.2 -> 0.3.0
 *   node scripts/release.mjs major           # 0.2.2 -> 1.0.0
 *   node scripts/release.mjs patch --dry     # report every file; change nothing
 *   node scripts/release.mjs verify          # what is on the registry, and the order
 *   node scripts/release.mjs publish 0.2.3   # run this yourself; it needs your OTP
 *
 * `verify` and `publish` take no version argument, because they read it from the
 * manifests — a version typed twice is a version that can disagree with itself.
 *
 * Publish is a separate command on purpose. `npm` wants an OTP, and a non-interactive
 * shell gets `ERR_PNPM_OTP_NON_INTERACTIVE`; a script that tried to publish would fail at
 * the last step after having already written the version everywhere, which is the worst
 * place to discover it cannot finish. So the bump is one command and the publish is
 * another, and only you can run the second.
 *
 * `--dry` and `verify` are safe at any time and need no OTP.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CWD = process.cwd()

/**
 * The lockstep set, in dependency order.
 *
 * Order is the whole point, and it is not the alphabetical order the filesystem gives.
 * A published package is installable by anyone the moment it lands, so each one has to
 * find its dependencies already on the registry:
 *
 *   - `types` before everything, because every other manifest names it.
 *   - `core` before `panel`, `console` and `mcp`, which all sit on the core runtime.
 *   - `cli` before `create-hamolus`, which depends on the CLI by *exact* version. Publish
 *     `create-hamolus` first and every `npm create hamolus@latest` in the world fails with
 *     ERR_PNPM_NO_MATCHING_VERSION until the CLI follows. The CLI itself is only safe after
 *     the packages whose ranges it writes into a generated project.
 *
 * `create-hamolus` is last because it is the only entry point a person types by name; every
 * publish of it is immediately exposed to real users rather than to a build.
 */
const ORDER = [
  '@hamolus/types',
  '@hamolus/core',
  '@hamolus/panel',
  '@hamolus/console',
  '@hamolus/mcp',
  '@hamolus/cli',
  'create-hamolus',
]

/** Names the lockstep bump is allowed to touch in a dependency map. */
const LOCKSTEP_NAMES = new Set(ORDER)

/** The plugin packages version independently and are never touched here. */
const INDEPENDENT = ['@hamolus/plugin-console-contracts', '@hamolus/plugin-console-kanban', '@hamolus/plugin-console-todo']

const flags = process.argv.slice(2)
const command = flags[0]



/**
 * What is on the registry right now, against what this tree would publish.
 *
 * The point is the *left* column. A version that exists locally and not on the registry
 * is a commit that is not releasable; one that exists on the registry and not locally is a
 * tag that no longer describes its tree. Both are invisible to `pnpm install` until
 * somebody installs it.
 */
function reportRegistry() {
  const version = readJson(join(dirFor(ORDER[0]), 'package.json')).version
  console.log(`this tree: ${version}\n`)
  console.log(`  ${'package'.padEnd(24)} ${'registry'.padEnd(12)} local`)

  let drift = 0
  for (const name of [...ORDER, ...INDEPENDENT]) {
    const local = readJson(join(dirFor(name), 'package.json')).version
    const published = spawnSync('npm', ['view', name, 'dist-tags.latest'], { encoding: 'utf8' })
    const onRegistry = published.status === 0 ? published.stdout.trim() : '—'
    const mark = onRegistry === local ? '·' : onRegistry === '—' ? '!' : ' '
    if (mark !== '·') drift += 1
    console.log(`  ${name.padEnd(24)} ${onRegistry.padEnd(12)} ${local} ${mark}`)
  }
  console.log(
    drift === 0
      ? '\nregistry and tree agree.\n'
      : `\n${drift} package(s) differ — '!' is not published, blank is ahead of the registry.\n`,
  )
}

/**
 * Publish the lockstep set, in dependency order, then confirm each landed.
 *
 * pnpm rather than npm, and not as a preference: pnpm rewrites `workspace:*` to a real
 * version when it packs. npm does not, which is how 0.2.0 shipped four packages nobody
 * could install. `--no-git-checks` because the tag is pushed after the publish, not
 * before, so a clean tree is the normal state here rather than a reason to stop.
 */
async function publish(requested) {
  const version = readJson(join(dirFor(ORDER[0]), 'package.json')).version
  if (requested && requested !== version) {
    console.error(`this tree is ${version}, not ${requested}. Run the bump first.`)
    process.exit(1)
  }

  const tag = (await git(['rev-parse', 'HEAD'])).trim()
  const dirty = (await git(['status', '--porcelain'])).trim()
  if (dirty) {
    console.error('refusing to publish from a dirty tree — commit or stash first:')
    console.error(dirty.split('\n').slice(0, 10).join('\n'))
    process.exit(1)
  }
  console.log(`publishing ${version} from ${tag.slice(0, 8)}\n`)

  for (const name of ORDER) {
    // A version is immutable, so a package that already carries this version is done —
    // npm answers 403 and there is no way back. Skipping is what makes a publish that
    // died halfway (a bad token, an expired OTP, a 0.2.6 that never landed) resumable
    // instead of permanently stuck on the first entry.
    const landed = spawnSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8' })
    if (landed.status === 0 && landed.stdout.trim() === version) {
      console.log(`=== ${name}@${version} === already published, skipping\n`)
      continue
    }

    console.log(`=== ${name}@${version} ===`)
    // Inherits the terminal, so npm's OTP prompt is a prompt and not a hang.
    const result = spawnSync('pnpm', ['-F', name, 'publish', '--no-git-checks'], { stdio: 'inherit' })
    if (result.status !== 0) {
      // Stopping here is the point of the order: a package whose dependency is missing
      // breaks installs for everyone the moment it lands. Later entries are not worse
      // than useless, they are not attempted.
      console.error(`\n${name} failed. Later packages are not published — that is deliberate.`)
      process.exit(result.status ?? 1)
    }
    console.log()
  }

  console.log('=== what landed ===')
  for (const name of ORDER) {
    const published = spawnSync('npm', ['view', name, 'version'], { encoding: 'utf8' })
    const at = published.status === 0 ? published.stdout.trim() : 'not yet visible'
    console.log(`  ${name.padEnd(24)} ${at}${at === version ? '' : '   <- npm is still propagating'}`)
  }
  console.log(`
Tag and push it:

  git tag v${version} && git push origin main v${version}
`)
}

function git(args) {
  const result = spawnSync('git', args, { cwd: CWD, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

/**
 * Find a workspace directory by package name, by asking the manifests rather than by
 * guessing the path.
 *
 * Guessing is what breaks here: the lockstep packages sit at `packages/<short-name>`, but
 * the plugins live at `packages/plugins/console/<short-name>`, so a `packages/*` +
 * name-suffix rule finds six of the ten and returns `null` for the rest — which surfaces
 * as a `TypeError` from `path.join` rather than as "I could not find that package".
 *
 * Costs a directory read per lookup and cannot be wrong about a package that was renamed.
 */
function dirFor(name) {
  for (const candidate of manifestDirs(join(REPO, 'packages'), 0)) {
    if (readJson(join(candidate, 'package.json')).name === name) return candidate
  }
  return null
}

/**
 * Every directory under `root` that holds a `package.json`, depth-limited.
 *
 * Depth is not a fixed number because the workspace is not flat: the lockstep packages
 * are at `packages/<name>`, the plugins at `packages/plugins/console/<name>`, and
 * `packages/plugins/console/examples` holds no manifest of its own. Guessing the depth
 * wrong misses packages silently, so this walks and stops on the manifest.
 */
function* manifestDirs(dir, depth) {
  if (depth > 3) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (existsSync(join(full, 'package.json'))) yield full
    else yield* manifestDirs(full, depth + 1)
  }
}


function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    // `node_modules` and `dist` hold copies that a later `copy-templates.mjs` overwrites
    // anyway; editing them would be noise in the diff and a lie about what shipped.
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') continue
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

/**
 * Bump every place the release version lives, or — with `--dry` — report what it would.
 *
 * The version is in the manifests, the two binaries' own constants, the ranges a
 * generated project is handed, and every `^`-range in the templates and examples. None of
 * those are checked against each other by `pnpm install` or `tsc`, so a bump that misses
 * one is not a build failure; it is a published CLI generating projects against a version
 * that does not exist. `check:package-versions` is the gate that catches it afterwards,
 * which is too late once the commit is pushed.
 */
function bumpVersion(bump, dry) {
  if (!['patch', 'minor', 'major'].includes(bump)) {
    console.error('usage: node scripts/release.mjs <patch|minor|major> [--dry]')
    process.exit(1)
  }

  const missing = ORDER.filter((name) => !dirFor(name))
  if (missing.length > 0) {
    console.error(`cannot find workspace directories for: ${missing.join(', ')}`)
    process.exit(1)
  }

  const current = readJson(join(dirFor(ORDER[0]), 'package.json')).version

  // Semver, in the two lines that matter. Pre-release is not handled: this repository has
  // never shipped one, and claiming to support it here would be a claim nothing tests.
  const [majorPart, minorPart, patchPart] = current.split('.').map(Number)
  if ([majorPart, minorPart, patchPart].some(Number.isNaN)) {
    console.error(`cannot parse the current version: ${current}`)
    process.exit(1)
  }
  const next =
    bump === 'major'
      ? `${majorPart + 1}.0.0`
      : bump === 'minor'
        ? `${majorPart}.${minorPart + 1}.0`
        : `${majorPart}.${minorPart}.${patchPart + 1}`

  console.log(`${current} -> ${next} (${bump})\n`)

  /** Every file carrying the release version, and how it spells it. */
  const edits = []

  for (const name of ORDER) {
    edits.push({
      what: `${name} manifest`,
      path: join(dirFor(name), 'package.json'),
      apply: (value, manifest) => JSON.stringify({ ...manifest, version: next }, null, 2) + '\n',
    })
  }

  // The two binaries report their own version, and a mismatch is a server that calls
  // itself 0.2.2 while carrying 0.2.3's behaviour.
  edits.push({
    what: 'CLI_VERSION (packages/cli/src/help.ts)',
    path: join(REPO, 'packages', 'cli', 'src', 'help.ts'),
    apply: (text) => text.replace(/(CLI_VERSION = ')[^']+(')/, `$1${next}$2`),
  })
  edits.push({
    what: 'SERVER_VERSION (packages/mcp/src/index.ts)',
    path: join(REPO, 'packages', 'mcp', 'src', 'index.ts'),
    apply: (text) => text.replace(/(SERVER_VERSION = ')[^']+(')/, `$1${next}$2`),
  })

  // The ranges a generated project is handed when no version can be discovered. These
  // decide what a *new* project installs, and nothing in the workspace resolves them.
  // The plugins are skipped: they version independently, and a release that did not
  // touch them should not claim to.
  edits.push({
    what: 'FALLBACK_RANGES + DEFAULT_VERSION_RANGE (packages/cli/src/sources.ts)',
    path: join(REPO, 'packages', 'cli', 'src', 'sources.ts'),
    apply: (text) =>
      text
        // A lockstep range moves to the new version.
        //
        // The capture is `(...)` around a *pattern*, not around a literal, so the
        // replacement is `$1${next}` and there is no `$3`: an extra `$3` here does not
        // fail loudly, it writes the literal string `$3` into every range, and the first
        // thing anyone sees is a generated project that will not install.
        //
        // The replacement has to put the closing quote back. The pattern ends at `[^']+'`
        // — the quote *included*, since `[^']` would otherwise stop one character short and
        // leave the quote to be replaced as literal text — so a replacement of `$1${next}`
        // ends the string with `^0.2.4` and no quote. It parses as a runaway string, which
        // is what happened on the 0.2.4 bump.
        .replace(/('(?:@hamolus\/(?:cli|console|core|mcp|panel|types))': '\^)[^']+'/g, `$1${next}'`)
        // The plugins' `^0.1.0` must survive this, so DEFAULT_VERSION_RANGE is matched by
        // name rather than by pattern.
        .replace(/(DEFAULT_VERSION_RANGE = ')[^']+(')/, `$1^${next}$2`),
  })

  // Every `^`-range in the templates and examples, because those trees are not workspace
  // members and are never resolved against the local packages.
  // `templates/` and `examples/` only. `packages/cli/templates/` is a generated copy —
  // gitignored, and rewritten by `copy-templates.mjs` from `templates/` on every prepack —
  // so bumping it would be editing a build output and the bump would be undone anyway.
  for (const tree of ['templates', 'examples']) {
    const root = join(REPO, tree)
    if (!existsSync(root)) continue
    for (const entry of walk(root)) {
      if (!entry.endsWith('package.json')) continue
      const manifest = readJson(entry)
      const lockstep = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).filter(
        ([name, range]) => typeof range === 'string' && LOCKSTEP_NAMES.has(name) && range !== `^${next}`,
      )
      if (lockstep.length === 0) continue
      edits.push({
        what: join(tree, relative(root, entry)),
        path: entry,
        apply: (value, m) => {
          for (const field of ['dependencies', 'devDependencies']) {
            if (!m[field]) continue
            for (const [name] of lockstep) m[field][name] = `^${next}`
          }
          return JSON.stringify(m, null, 2) + '\n'
        },
      })
    }
  }

  let changed = 0
  for (const edit of edits) {
    const manifest = edit.path.endsWith('package.json') ? readJson(edit.path) : undefined
    const before = readFileSync(edit.path, 'utf8')
    const after = edit.apply(before, manifest)
    if (before === after) continue
    changed += 1
    console.log(`  ${dry ? 'would change' : 'changed'}  ${edit.what}`)
    if (!dry) writeFileSync(edit.path, after)
  }

  // `create-hamolus` declares its CLI dependency as `workspace:*` on purpose, and this
  // must not "fix" it to a caret.
  //
  // pnpm rewrites `workspace:*` to the real version when it packs, which is what makes the
  // declared value honest: the tree always depends on the CLI sitting next to it, and the
  // published manifest depends on the CLI that was published first. A literal `^0.2.3`
  // here is instead a promise about the registry, made *before* anything is published —
  // so `pnpm install` in this very repository fails:
  //
  //   ERR_PNPM_NO_MATCHING_VERSION  No matching version found for @hamolus/cli@^0.2.3
  //
  // with the latest on the registry still being the release you have not cut yet. The
  // version is right and the tree is unbuildable, which is the worst combination. The
  // publish order in `publish()` is what protects real users; `workspace:*` is what keeps
  // the tree itself installable.
  const createManifest = readJson(join(dirFor('create-hamolus'), 'package.json'))
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const range = createManifest[field]?.['@hamolus/cli']
    // Both guards, not one. Skipping a field that does not *have* `@hamolus/cli` is the
    // obvious half; the other half is that `create-hamolus` holds it in `dependencies`, so
    // a loop that only checked the value would walk into `devDependencies` — which does
    // not exist — and die on `Cannot set properties of undefined`. That happened on the
    // 0.2.4 bump, after it had already written every version, so the tree was left at
    // 0.2.4 with the changelog step unreached. A release script that can only be run
    // twice is a release script nobody runs twice.
    if (range === undefined || range === 'workspace:*') continue
    console.log(`  ${dry ? 'would change' : 'changed'}  create-hamolus ${field} @hamolus/cli -> workspace:*`)
    if (!dry) {
      createManifest[field]['@hamolus/cli'] = 'workspace:*'
      writeJson(join(dirFor('create-hamolus'), 'package.json'), createManifest)
    }
    changed += 1
  }

  console.log(`\n${changed} file(s) ${dry ? 'would change' : 'changed'}`)

  if (dry) {
    console.log('\n--dry: nothing was written.')
    return
  }

  // The changelog is a gate, not a suggestion: `check:package-versions` fails a release
  // whose version has no dated entry, so this rename is what makes the tree committable.
  const changelogPath = join(REPO, 'CHANGELOG.md')
  const changelog = readFileSync(changelogPath, 'utf8')
  if (!changelog.includes(`## [${next}]`)) {
    const today = new Date().toISOString().slice(0, 10)
    const body = /## \[Unreleased\]\n\n([\s\S]*?)\n## \[/.exec(changelog)?.[1]?.trim()
    if (!body || body === 'Nothing yet.') {
      console.log('\nCHANGELOG.md [Unreleased] is empty — write the release notes, then rerun.')
    } else {
      const section = `## [${next}] — ${today}\n\n${body}\n\n`
      writeFileSync(
        changelogPath,
        changelog.replace(/## \[Unreleased\]\n\n[\s\S]*?\n## \[/, `## [Unreleased]\n\nNothing yet.\n\n${section}## [`),
      )
      console.log(`  changed  CHANGELOG.md: released ${next} with this session's [Unreleased] notes`)
    }
  }

  console.log(`
Next, in order:

  pnpm install                       # relink the workspace at ${next}
  pnpm -w build                      # dist before publish: prepack copies templates
  pnpm check:package-versions        # proves the bump reached every place that carries it
  node scripts/release.mjs verify     # registry vs this tree, before anything goes out

Then commit, and publish — that step needs your npm OTP, so run it yourself:

  git add -A && git commit -m "release: ${next} — <what changed>"
  node scripts/release.mjs publish

Then tag:

  git tag v${next} && git push origin main v${next}
`)
}

if (command === 'verify') {
  reportRegistry()
} else if (command === 'publish') {
  await publish(flags[1])
} else {
  bumpVersion(command, flags.includes('--dry'))
}
