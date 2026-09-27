/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

/**
 * Small, dependency-free terminal helpers.
 *
 * Colour is emitted only when the stream is a TTY and `NO_COLOR` is unset, so
 * piping CLI output into a file or a CI log stays clean.
 */

const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR

function wrap(open: number, close: number) {
  return (value: string): string => (enabled ? `\u001B[${open}m${value}\u001B[${close}m` : value)
}

export const bold = wrap(1, 22)
export const dim = wrap(2, 22)
export const red = wrap(31, 39)
export const green = wrap(32, 39)
export const yellow = wrap(33, 39)
export const blue = wrap(34, 39)
export const cyan = wrap(36, 39)
export const magenta = wrap(35, 39)

export const symbols = {
  success: green('✔'),
  error: red('✖'),
  warn: yellow('!'),
  info: blue('•'),
  arrow: dim('→'),
} as const

export function heading(text: string): void {
  console.log(`\n${bold(text)}`)
}

export function step(text: string): void {
  console.log(`${symbols.arrow} ${text}`)
}

export function success(text: string): void {
  console.log(`${symbols.success} ${text}`)
}

export function info(text: string): void {
  console.log(`${symbols.info} ${text}`)
}

export function warn(text: string): void {
  console.log(`${symbols.warn} ${text}`)
}

export function failure(text: string): void {
  console.error(`${symbols.error} ${text}`)
}

/** Print a `Next:` block of shell hints. */
export function next(commands: string[]): void {
  if (commands.length === 0) return
  console.log(`\n${dim('Next:')}`)
  for (const command of commands) console.log(`  ${cyan(command)}`)
}
