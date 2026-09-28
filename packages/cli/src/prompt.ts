/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Interactive prompts for `hamolus init` — what `npm create hamolus@latest` runs.
 *
 * Built on `node:readline/promises` for the same reason the argument parser is built
 * on `node:util`'s `parseArgs`: the CLI ships a single dependency-free file, and a
 * prompt library would be the first dependency every user downloads before they have
 * a project at all. Everything here is a thin, typed wrapper over a line of stdin.
 *
 * Two rules shape the behaviour:
 *
 *   1. **A prompt never blocks a machine.** With no TTY — a CI job, an `npm init` in a
 *      Docker build, a piped heredoc — every question falls back to its default and
 *      says which default it took. `--yes` does the same in a real terminal. A
 *      scaffolder that hangs on a keystroke nobody can type is its worst failure mode.
 *   2. **An answer given as a flag is never asked.** The wizard skips a question whose
 *      flag is already on the command line, so `hamolus init acme --mode bridge --mcp`
 *      asks only about what is still unknown. That is what makes the wizard
 *      scriptable, rather than merely automatable.
 */

import { randomBytes } from 'node:crypto'
import { createInterface, type Interface } from 'node:readline/promises'
import { bold, cyan, dim, green, yellow } from './util/log.js'

/** Thrown when the user aborts the wizard with Ctrl+C, or stdin closes under it. */
export class PromptCancelled extends Error {
  constructor() {
    super('Cancelled.')
    this.name = 'PromptCancelled'
  }
}

export interface Choice<T> {
  /** What the choice is called, and what the user types to pick it. */
  label: string
  value: T
  /** Second line under the label — what the choice means, not what it is called. */
  hint?: string
}

export interface TextOptions {
  /** Used when the answer is empty. Shown in the prompt as `(default)`. */
  default?: string
  /** Extra line in the prompt, e.g. the shape the answer has to have. */
  hint?: string
  /** Return a message to reject the answer, or `undefined` to accept it. */
  validate?: (value: string) => string | undefined
}

export interface SelectOptions<T> {
  choices: Choice<T>[]
  /** Choice selected when the answer is empty. Defaults to the first one. */
  defaultValue?: T
  hint?: string
}

export interface ConfirmOptions {
  defaultValue?: boolean
  hint?: string
}

export interface MaybeOptions {
  /** What `y` means, in words. */
  yes: string
  /** What `n` means, in words. */
  no: string
  defaultKind?: 'yes' | 'no' | 'custom'
  /** The pre-filled custom value, when `defaultKind` is `custom`. */
  defaultValue?: string
  hint?: string
  /**
   * Reject a typed value, exactly as `text` does. Return a message to ask again.
   *
   * Only the custom branch is validated: a name that is not one of `y`/`n` is a
   * template name, and a template name that does not exist is a typo the user wants to
   * hear about while they are still looking at the question.
   */
  validate?: (value: string) => string | undefined
}

/**
 * A yes/no answer that may also be a value.
 *
 * Several wizard questions are "y", "n", or name something else — which core
 * template, which site framework. Modelling that as a boolean loses the third case;
 * modelling it as free text loses the fact that most people answer with one letter.
 */
export type Maybe =
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'custom'; value: string }

/**
 * A generated secret.
 *
 * `base64url` rather than hex: 32 random bytes become 43 characters instead of 64, the
 * alphabet needs no quoting in a `.dev.vars` line or a `wrangler secret put`, and 32
 * bytes is the width an HMAC-SHA256 key is read at — so one generated string is safe
 * to hand to both `JWT_SECRET` and `ADMIN_KEY`.
 */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Whether a human can answer a question in this process. */
export function canPrompt(assumeYes: boolean): boolean {
  return !assumeYes && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY)
}

/**
 * A session of questions against stdin/stdout.
 *
 * The readline interface is created on the first question and closed by
 * {@link finish}, so a run that prompts nothing never touches stdin — which is what
 * lets `--yes`, CI and `hamolus create <name>` leave the input stream alone.
 */
export class Prompter {
  private readonly fallback: boolean
  private rl: Interface | null = null

  /** @param assumeYes `--yes`: take every default without asking. */
  constructor(assumeYes = false) {
    this.fallback = !canPrompt(assumeYes)
  }

  /** True when every answer comes from a default rather than from a person. */
  get isFallback(): boolean {
    return this.fallback
  }

  /** Close stdin. Safe to call twice, and safe when nothing was asked. */
  finish(): void {
    const rl = this.rl
    this.rl = null
    rl?.close()
  }

  private interface(): Interface {
    if (this.rl) return this.rl
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    // Ctrl+C arrives as a signal, and readline's own handler would close the stream out
    // from under the pending question. Closing here instead turns it into a rejection,
    // which the wizard reports as a cancellation rather than as a half-read answer.
    rl.on('SIGINT', () => {
      this.rl = null
      rl.close()
    })
    this.rl = rl
    return rl
  }

  /** Ask one line. Rejects on Ctrl+C or EOF rather than resolving with a partial answer. */
  private async ask(question: string): Promise<string> {
    try {
      return (await this.interface().question(question)).trim()
    } catch (error) {
      // `readline/promises` rejects a pending question with an AbortError when the
      // interface is closed — which is exactly what a SIGINT handler and a closed stdin
      // both do. Anything else is a real error and keeps its own message.
      if (error instanceof Error && error.name === 'AbortError') throw new PromptCancelled()
      throw error
    }
  }

  /**
   * The line a `?` question is written on, so a scrolled-back transcript reads as a
   * conversation rather than as prompt text the terminal overwrote.
   */
  private prompt(message: string, hint: string | undefined, suffix: string): string {
    const note = hint ? ` ${dim(hint)}` : ''
    return `${cyan('?')} ${message}${note} ${dim(suffix)} ${dim('›')} `
  }

  /** Echo an answer that was typed. */
  private echo(message: string, answer: string): void {
    console.log(`${cyan('?')} ${message} ${dim('›')} ${bold(answer)}`)
  }

  /** Echo an answer that was chosen for the user, and say so. */
  private took(message: string, answer: string): void {
    console.log(`${cyan('?')} ${message} ${dim('›')} ${dim(answer)} ${dim('(default)')}`)
  }

  /**
   * A free-text answer, re-asked until `validate` accepts it.
   *
   * A rejected answer is answered again rather than replaced by the default: silently
   * generating a project name nobody chose is worse than one extra question.
   */
  async text(message: string, options: TextOptions = {}): Promise<string> {
    const fallback = options.default ?? ''
    if (this.fallback) {
      this.took(message, fallback)
      return fallback
    }

    for (;;) {
      const answer = await this.ask(
        this.prompt(message, options.hint, `(${fallback === '' ? 'empty' : fallback})`),
      )
      const value = answer === '' ? fallback : answer
      const problem = options.validate?.(value)
      if (!problem) {
        this.echo(message, value)
        return value
      }
      console.log(`  ${yellow('!')} ${problem}`)
    }
  }

  /** A numbered menu. Accepts the number, the label, or nothing for the default. */
  async select<T>(message: string, options: SelectOptions<T>): Promise<T> {
    if (options.choices.length === 0) throw new Error('select() needs at least one choice')
    const fallback = options.defaultValue ?? options.choices[0]!.value

    if (this.fallback) {
      const label = options.choices.find((choice) => choice.value === fallback)?.label
      this.took(message, label ?? String(fallback))
      return fallback
    }

    for (;;) {
      console.log(`${cyan('?')} ${message}`)
      options.choices.forEach((choice, index) => {
        const marker = choice.value === fallback ? dim(' (default)') : ''
        console.log(`  ${dim(String(index + 1))} ${choice.label}${marker}`)
        if (choice.hint) console.log(`     ${dim(choice.hint)}`)
      })
      const question = this.prompt('', options.hint, 'number or label')
      const answer = (await this.ask(question)).toLowerCase()

      if (answer === '') {
        const choice = options.choices.find((entry) => entry.value === fallback)
        this.echo(message, choice?.label ?? String(fallback))
        return fallback
      }

      const index = Number.parseInt(answer, 10)
      const chosen =
        Number.isInteger(index) && index >= 1 && index <= options.choices.length
          ? options.choices[index - 1]
          : options.choices.find(
              (choice) => choice.label.toLowerCase() === answer || String(choice.value) === answer,
            )

      if (chosen) {
        this.echo(message, chosen.label)
        return chosen.value
      }
      console.log(`  ${yellow('!')} Pick 1-${options.choices.length}, or type a label.`)
    }
  }

  /** y / n. Anything else is re-asked; an empty answer takes the default. */
  async confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    const fallback = options.defaultValue ?? true
    if (this.fallback) {
      this.took(message, fallback ? 'yes' : 'no')
      return fallback
    }

    for (;;) {
      const answer = (
        await this.ask(this.prompt(message, options.hint, fallback ? 'Y/n' : 'y/N'))
      ).toLowerCase()

      if (answer === '') {
        this.echo(message, fallback ? 'yes' : 'no')
        return fallback
      }
      if (answer === 'y' || answer === 'yes') {
        this.echo(message, 'yes')
        return true
      }
      if (answer === 'n' || answer === 'no') {
        this.echo(message, 'no')
        return false
      }
      console.log(`  ${yellow('!')} Answer y or n.`)
    }
  }

  /**
   * "y", "n", or a value of your own — the shape several wizard questions need.
   *
   * The wording comes from the caller, so the prompt can read
   * `predefined collections? (y = predefined, n = none, or type a template name)`
   * instead of making the user map the letters onto a menu they cannot see.
   */
  async maybe(message: string, options: MaybeOptions): Promise<Maybe> {
    const defaultKind = options.defaultKind ?? 'no'
    if (this.fallback) {
      if (defaultKind === 'custom') {
        const value = options.defaultValue ?? ''
        this.took(message, value)
        return { kind: 'custom', value }
      }
      this.took(message, defaultKind)
      return { kind: defaultKind }
    }

    for (;;) {
      const letters = `(y = ${options.yes}, n = ${options.no}, or type your own)`
      const answer = await this.ask(this.prompt(message, options.hint, letters))
      const value = answer.toLowerCase()

      if (value === 'y' || value === 'yes') {
        this.echo(message, 'yes')
        return { kind: 'yes' }
      }
      if (value === 'n' || value === 'no') {
        this.echo(message, 'no')
        return { kind: 'no' }
      }
      if (answer !== '') {
        const problem = options.validate?.(answer)
        if (problem) {
          console.log(`  ${yellow('!')} ${problem}`)
          continue
        }
        this.echo(message, answer)
        return { kind: 'custom', value: answer }
      }
      if (defaultKind === 'custom' && options.defaultValue) {
        this.echo(message, options.defaultValue)
        return { kind: 'custom', value: options.defaultValue }
      }
      this.echo(message, defaultKind)
      return defaultKind === 'yes' ? { kind: 'yes' } : { kind: 'no' }
    }
  }

  /**
   * A secret: typed in, or generated when left blank.
   *
   * The generated value is not shown — it is written into a git-ignored `.dev.vars`
   * that is then the only copy of it, and a secret echoed into a terminal scrollback is
   * a leak the convenience is not worth. `hamolus list` and the summary say which
   * secrets were generated, and the file itself is one `cat` away.
   */
  async secret(
    message: string,
    options: { hint?: string; bytes?: number } = {},
  ): Promise<{ value: string; generated: boolean }> {
    const generated = generateSecret(options.bytes)
    if (this.fallback) {
      this.took(message, 'generated')
      return { value: generated, generated: true }
    }

    for (;;) {
      const answer = await this.ask(
        this.prompt(message, options.hint, '(empty to generate)'),
      )
      if (answer === '') {
        this.echo(message, green('generated'))
        return { value: generated, generated: true }
      }
      if (answer.length < 16) {
        console.log(
          `  ${yellow('!')} Use at least 16 characters, or leave it empty to generate one.`,
        )
        continue
      }
      this.echo(message, answer)
      return { value: answer, generated: false }
    }
  }
}
