/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Local development links.
 *
 * A generated project depends on the published `@hamolus/*` packages, so `pnpm install`
 * fetches them from the registry. That is right for a real project and wrong for the two
 * cases where you are still building the packages themselves:
 *
 *   1. generating this monorepo's own `examples/cores/*`, which must exercise the core
 *      in the working tree rather than whatever 0.1.0 npm currently serves;
 *   2. trying a change in `packages/core` against a real project before publishing.
 *
 * `--link <path>` handles both: every `@hamolus/*` dependency becomes a pnpm `link:` spec
 * pointing into that checkout. It is opt-in and recorded in `hamolus.json`, so later
 * `hamolus add` calls inherit it instead of quietly reverting to the registry.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'

/** Scoped packages this project generates; all live under `<root>/packages/<name>`. */
export const LINKABLE_PACKAGES = [
  'core',
  'types',
  'console',
  'mcp',
  'panel',
  'plugin-console-contracts',
  'plugin-console-todo',
  'plugin-console-kanban',
  'cli',
] as const

export type LinkablePackage = (typeof LINKABLE_PACKAGES)[number]

const SCOPE = '@hamolus/'

/** Full package name for a short (unscoped) name, e.g. `core` -> `@hamolus/core`. */
export function packageName(short: string): string {
  return `${SCOPE}${short}`
}

/** Normalise a filesystem path to forward slashes for a specifier. */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

export interface LinkRoot {
  /** Absolute path of the Hamolus checkout. */
  root: string
  /** Absolute path of its `packages/` directory. */
  packages: string
}

/**
 * Validate `--link <path>` as a Hamolus checkout.
 *
 * The check is deliberately structural rather than a version or name match: what the link
 * actually needs to provide is `<root>/packages/core`, so that is what gets verified. A path
 * that is not a checkout fails here with a readable message instead of much later as an
 * unresolvable `link:` spec.
 */
export async function resolveLinkRoot(raw: string | undefined): Promise<LinkRoot | undefined> {
  if (!raw) return undefined

  const root = isAbsolute(raw) ? raw : resolve(process.cwd(), raw)
  const packages = join(root, 'packages')

  try {
    const manifest = JSON.parse(
      await readFile(join(packages, 'core', 'package.json'), 'utf8'),
    ) as { name?: string }
    if (manifest.name !== `${SCOPE}core`) {
      throw new Error('wrong package name')
    }
  } catch {
    throw new Error(
      `--link "${raw}" is not a Hamolus checkout: expected ${toPosix(join(packages, 'core'))}` +
        ' to contain a package.json named "@hamolus/core". Pass the repository root.',
    )
  }

  return { root, packages }
}

/**
 * Build the pnpm `link:` spec for a scoped package.
 *
 * The spec is **absolute**, and that is deliberate. A relative spec is computed against the
 * depending package's *realpath*, so a symlink anywhere in either path silently changes the
 * `..` arithmetic. On this machine `/tmp` is a symlink to `/private/tmp` while the checkout
 * lives on `/Volumes/macApp` (not `/private/Volumes`), so a spec that is correct when read
 * logically resolves to a directory that does not exist — pnpm reports
 * "Installing a dependency from a non-existent directory" and the link never lands.
 *
 * Absolute specs are immune to that. The cost is that a linked manifest records this
 * machine's layout, which is acceptable because linking is an explicit local-dev opt-in:
 * the path is also recorded in `hamolus.json`, and `hamolus link --clear` restores the
 * registry ranges. A project intended to be committed or shared never links.
 */
export function linkSpec(link: LinkRoot, name: string): string {
  return `link:${toPosix(packageDirectoryInCheckout(link.packages, name))}`
}

/**
 * Map a package's directory inside a Hamolus checkout's `packages/` directory.
 *
 * Most packages sit flat (`packages/core`, `packages/console`, …), but the console plugins
 * are nested two levels deep (`packages/plugins/console/<name>`) so that `todo` and
 * `kanban` can sit beside the `contracts` package they share. The flat guess is what made
 * `hamolus add plugin todo` both report the source package as missing and, once the source
 * was found, write a `link:` spec pointing at a directory that does not exist.
 *
 * This is the single place that knows the layout, shared by `linkSpec` and by the source
 * resolver, so a spec and the directory it names can never disagree.
 */
export function packageDirectoryInCheckout(packagesRoot: string, name: string): string {
  const short = name.replace(/^@hamolus\//, '')
  const plugin = /^plugin-console-(.+)$/.exec(short)
  if (plugin?.[1]) return join(packagesRoot, 'plugins', 'console', plugin[1])
  return join(packagesRoot, short)
}

/**
 * Rewrite every `@hamolus/*` dependency in a manifest to a `link:` spec.
 *
 * Only `@hamolus/*` keys are touched — the project's other dependencies (hono, zod, wrangler)
 * keep their published ranges, because a link points at a checkout, not a registry tarball.
 * Returns the rewritten dependency map plus the specs that were applied, so the caller can
 * report them.
 */
export function linkDependencies(
  dependencies: Record<string, string> | undefined,
  link: LinkRoot,
): { dependencies: Record<string, string>; applied: string[] } {
  const out: Record<string, string> = { ...dependencies }
  const applied: string[] = []

  for (const name of Object.keys(out)) {
    if (!name.startsWith(SCOPE)) continue
    const short = name.slice(SCOPE.length)
    if (!(LINKABLE_PACKAGES as readonly string[]).includes(short)) continue
    const spec = linkSpec(link, short)
    applied.push(`${name}@${spec}`)
    out[name] = spec
  }

  return { dependencies: out, applied }
}

/**
 * Rewrite the `@hamolus/*` dependencies of a manifest on disk.
 *
 * `dependencies` and `devDependencies` are both covered: the console and the plugin
 * packages are ordinary dev-time workspace members in a generated project, and a leftover
 * `^0.1.0` on a dev dependency would still resolve from npm and mask the link.
 * The file is only rewritten when something actually changed, so a manifest with no
 * scoped dependencies keeps its original mtime.
 *
 * A missing manifest is not an error. `hamolus add` funnels every target through
 * `commit`, including parts such as a seed script or a wrangler configuration preset that
 * are not npm packages at all and simply have no `package.json` to link.
 */
export async function linkManifestFile(
  manifestPath: string,
  link: LinkRoot | undefined,
): Promise<string[]> {
  if (!link) return []

  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf8')
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return []
    }
    throw error
  }

  const manifest = JSON.parse(raw) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  const applied: string[] = []

  for (const field of ['dependencies', 'devDependencies'] as const) {
    const current = manifest[field]
    if (!current) continue
    const result = linkDependencies(current, link)
    applied.push(...result.applied)
    if (result.applied.length) manifest[field] = result.dependencies
  }

  if (applied.length) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  return applied
}
