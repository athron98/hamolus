/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * The `hamolus` project file: `hamolus.json`.
 *
 * Every scaffolded project keeps a small JSON manifest at its root that records
 * what the CLI has generated. That makes `hamolus add` idempotent-aware (it can
 * tell you a console already exists instead of silently overwriting it) and lets
 * `hamolus list` report the shape of a project without guessing.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { CoreMode } from './help.js'

export const PROJECT_FILE = 'hamolus.json'

/** Bumped when the shape of `hamolus.json` changes incompatibly. */
export const PROJECT_FILE_VERSION = 1

export type PartKind =
  | 'core'
  | 'console'
  | 'panel'
  | 'mcp'
  | 'plugin'
  | 'seed'
  | 'configuration'
  | 'site'

export interface ProjectPart {
  /** Part kind, e.g. `console`. */
  kind: PartKind
  /** Stable identifier: the project name for a core, the snake_case id otherwise. */
  id: string
  /** Human label shown by `hamolus list`. */
  label: string
  /** Path relative to the project root. */
  path: string
  /** npm package the source came from, when the CLI resolved one. */
  source?: string
  /** Installed version of that package, when known. */
  sourceVersion?: string
  /** ISO timestamp of the last generation. */
  generatedAt: string
}

export interface Project {
  version: number
  name: string
  /** Package scope used for generated workspace members, e.g. `@acme`. */
  scope: string
  /**
   * Tenancy of the project's core.
   *
   * Optional, and absent on a project created without a core: `--console` and the other
   * bare part flags ask for a project that *is* one part, so there is no core whose
   * tenancy there is anything to record. Readers must treat it as "no core" rather than
   * defaulting it, or a core-less project would warn about a land it has no core to route.
   */
  mode?: CoreMode
  /**
   * Absolute path of the Hamolus checkout this project links its `@hamolus/*`
   * dependencies into, when it was created or updated with `--link`.
   *
   * Optional and purely local: a project generated against the registry has no
   * `link` key at all, and `hamolus link --clear` removes it. It is stored so a
   * later `hamolus add console|mcp|panel` links the same checkout instead of
   * silently reverting half of the project to npm.
   */
  link?: string
  /**
   * Interface the generated dev servers bind to, e.g. `0.0.0.0`.
   *
   * Recorded so `hamolus add console` generates a `dev` script that reaches the same
   * hosts the core does. Without it, adding a console after `hamolus create --host
   * 0.0.0.0` quietly produces a server only the machine it runs on can open.
   */
  devHost?: string
  /**
   * Land and colony the bare (unprefixed) requests of a multi-tenant core resolve to.
   *
   * Absent for an `independent` core, where the scope layer is off and there is nothing
   * to record. Also absent on projects created before these keys existed — every reader
   * treats them as optional and falls back to the root scope.
   */
  land?: string
  colony?: string
  createdAt: string
  updatedAt: string
  parts: ProjectPart[]
}

export function now(): string {
  return new Date().toISOString()
}

export async function readProject(projectRoot: string): Promise<Project | null> {
  try {
    const raw = await readFile(join(projectRoot, PROJECT_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Project
    if (typeof parsed !== 'object' || parsed === null) return null
    if (!Array.isArray(parsed.parts)) parsed.parts = []
    return parsed
  } catch (error) {
    if (isMissing(error)) return null
    if (error instanceof SyntaxError) {
      throw new Error(`${join(projectRoot, PROJECT_FILE)} is not valid JSON: ${error.message}`)
    }
    throw error
  }
}

export async function writeProject(projectRoot: string, project: Project): Promise<void> {
  project.updatedAt = now()
  await writeFile(join(projectRoot, PROJECT_FILE), `${JSON.stringify(project, null, 2)}\n`, 'utf8')
}

export function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}

/**
 * Walk up from `start` looking for a directory that contains `hamolus.json`.
 *
 * Returns `null` when the CLI is invoked outside a project, so callers can decide
 * whether that is an error (for `add`) or the point (for `create`).
 */
export async function findProjectRoot(start: string): Promise<string | null> {
  let current = resolve(start)
  for (;;) {
    const candidate = join(current, PROJECT_FILE)
    try {
      await readFile(candidate, 'utf8')
      return current
    } catch (error) {
      if (!isMissing(error)) return null
    }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

export async function requireProjectRoot(start: string): Promise<string> {
  const root = await findProjectRoot(start)
  if (root) return root
  throw new Error(
    `No ${PROJECT_FILE} found in ${resolve(start)} or any parent directory.\n` +
      'Run this command inside a Hamolus project, or create one with `hamolus create <name>`.',
  )
}

export function findPart(project: Project, kind: PartKind, id: string): ProjectPart | undefined {
  return project.parts.find((part) => part.kind === kind && part.id === id)
}

export function findPartByKind(project: Project, kind: PartKind): ProjectPart | undefined {
  return project.parts.find((part) => part.kind === kind)
}

export function recordPart(
  project: Project,
  part: Omit<ProjectPart, 'generatedAt'> & { generatedAt?: string },
): Project {
  const next: ProjectPart = { ...part, generatedAt: part.generatedAt ?? now() }
  project.parts = [
    ...project.parts.filter((existing) => !(existing.kind === part.kind && existing.id === part.id)),
    next,
  ]
  return project
}
