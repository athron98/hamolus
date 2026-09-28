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
 * `npm create hamolus@latest` — the initializer npm looks for by name.
 *
 * Why this package has to exist: `npm init <name>` does not run `<name>`. It looks for
 * a package called `create-<name>` and runs its binary, and only if that package does
 * not exist does it fall back to installing `<name>` and passing `init` as the first
 * argument. Both halves of that fallback are unattractive here. The published name for
 * the CLI is `@hamolus/cli`, so the fallback would depend on the bare name `hamolus`
 * being ours — and a fallback that depends on a name nobody registered under us is not a
 * fallback, it is a race. `create-hamolus` is the convention made explicit, and it is
 * also the only one that can work for a scoped package at all: the scoped form
 * `npm create @hamolus/cli` would ask npm for `create-@hamolus/cli`, which no package
 * can be called.
 *
 * This file deliberately contains no scaffolding. It picks the command and hands
 * everything to `hamolus`, so the thing a newcomer runs and the thing a project
 * installs cannot drift apart — the wizard is `hamolus init`, reachable afterwards as
 * `npx hamolus init`, and this package is the front door rather than a second door.
 *
 * What arrives here, and what it runs:
 *
 *   npm create hamolus@latest                    ->  hamolus init
 *   npm create hamolus@latest acme               ->  hamolus init acme
 *   npm create hamolus@latest --yes acme         ->  hamolus init --yes acme
 *   npm create hamolus@latest acme --site nextjs ->  hamolus init acme --site nextjs
 *   npm create hamolus@latest create acme        ->  hamolus create acme
 *   npm create hamolus@latest add site blog      ->  hamolus add site blog
 *
 * One rule, and it is the whole of the argument munging: a *command word* in first
 * position is passed through, anything else gets `init` in front of it. The second half
 * matters more than it looks — `npm create hamolus@latest --yes acme` is a natural
 * thing to type, and forwarding it as-is would send `--yes` to `run()` as the command.
 *
 * A project name that is also a command word (`add`, `create`, `list`) cannot be
 * created through this front door, and there is no flag that could fix it without
 * making the common case ambiguous. Such a name is still creatable:
 * `npx hamolus init add` works, because there the word is unambiguously the command
 * and the name is the argument.
 */

import { run } from '@hamolus/cli'

/** Words `hamolus` already claims; the first of them is passed straight through. */
const COMMANDS = new Set(['init', 'create', 'add', 'list', 'link'])

/**
 * Questions and version numbers asked of the tool rather than about a project.
 *
 * These also skip the `init` prefix, and `--help` deliberately lands on the top-level
 * usage instead of `hamolus init --help`: someone who typed `npm create hamolus@latest
 * --help` wants to know what the whole tool does, and the wizard is the first line of
 * that usage.
 */
const ABOUT_THE_TOOL = new Set(['help', '--help', '-h', 'version', '--version', '-v'])

const argv = process.argv.slice(2)
const first = argv[0]
const forwarded =
  first === undefined || (!COMMANDS.has(first) && !ABOUT_THE_TOOL.has(first))
    ? ['init', ...argv]
    : argv

process.exitCode = await run(forwarded)
