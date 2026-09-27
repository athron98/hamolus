/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Generation of `tsconfig.json` files for generated projects.
 *
 * Every package we generate must be **self-contained**: the Hamolus repository's
 * packages extend `../../tsconfig.base.json`, but a generated project has no such
 * file above it. Copying a monorepo `tsconfig.json` into a generated app therefore
 * produced a dangling `extends` and, worse, silently dropped the base options —
 * the generated console then failed to typecheck with dozens of `TS1259
 * esModuleInterop` errors from third-party typings. The base options are inlined
 * here so the emitted config behaves identically inside or outside the monorepo.
 */

/** Compiler options shared by every generated package. */
export const BASE_COMPILER_OPTIONS = {
  target: 'ES2022',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  strict: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  resolveJsonModule: true,
  isolatedModules: true,
  skipLibCheck: true,
  noEmit: true,
} as const

/** Per-flavor overrides layered on top of {@link BASE_COMPILER_OPTIONS}. */
export type TsconfigFlavor = 'core' | 'console' | 'panel' | 'mcp'

interface TsconfigSpec {
  /** Extra compiler options merged after the base options. */
  compilerOptions?: Record<string, unknown>
  /** Paths to type-check, relative to the generated package. */
  include: string[]
  /** Merge a local `compilerOptions` block (the copied one) into the result. */
  local?: unknown
}

/** Options for a given flavor of generated package. */
export function flavorOptions(flavor: TsconfigFlavor): Record<string, unknown> {
  switch (flavor) {
    case 'core':
      return { lib: ['ES2022'], types: ['@cloudflare/workers-types'] }
    case 'mcp':
      return { lib: ['ES2022'], types: ['@cloudflare/workers-types'] }
    case 'console':
    case 'panel':
      return {
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        types: ['vite/client'],
      }
  }
}

/**
 * Build a standalone `tsconfig.json`.
 *
 * A copied `local` config contributes its own `compilerOptions` and `include`, so
 * hand-written settings in a source package survive, but its `extends` target is
 * deliberately dropped.
 */
export function tsconfigJson(flavor: TsconfigFlavor, spec: TsconfigSpec = { include: [] }): string {
  const local = (spec.local ?? {}) as {
    compilerOptions?: Record<string, unknown>
    include?: string[]
  }

  const compilerOptions: Record<string, unknown> = {
    ...BASE_COMPILER_OPTIONS,
    ...flavorOptions(flavor),
    ...(local.compilerOptions ?? {}),
    ...(spec.compilerOptions ?? {}),
  }

  // `extends` is never carried over: it would point outside the generated project.
  const include = spec.include.length > 0 ? spec.include : (local.include ?? ['src'])

  return `${JSON.stringify({ compilerOptions, include }, null, 2)}\n`
}

/** Parse a `tsconfig.json` from disk, tolerating comments and trailing commas. */
export function readTsconfig(raw: string): {
  compilerOptions?: Record<string, unknown>
  include?: string[]
} {
  try {
    const parsed = JSON.parse(raw) as { compilerOptions?: Record<string, unknown>; include?: string[] }
    return parsed
  } catch {
    return {}
  }
}
