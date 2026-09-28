/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * `hamolus init` — the guided way to create a project. This is what
 * `npm create hamolus@latest` runs.
 *
 * The wizard owns no scaffolding logic. It asks ten questions and then calls
 * `hamolus create` and `hamolus add …` with the answers, so a wizard run and the
 * equivalent hand-written command line produce the same files. That is the whole design:
 * the interactive path is a front end for the flags, not a second implementation of
 * them, which is why a new question is a new flag and never a new code path.
 *
 * Every question has a flag, and a question whose flag is present is not asked. The
 * wizard is therefore a scriptable default set rather than a fixed form: `hamolus init
 * acme --mode bridge --mcp` asks only what is still unknown, and `--yes` asks nothing
 * at all. The same holds without a TTY, so a CI job gets defaults instead of a hang.
 */

import { basename, resolve } from 'node:path'
import type { ParsedArgs } from '../args.js'
import type { CoreMode } from '../help.js'
import { PromptCancelled, Prompter } from '../prompt.js'
import { dim, heading, info, next, step, success, warn } from '../util/log.js'
import { runAddConsole } from './add-console.js'
import { runAddMcp } from './add-mcp.js'
import { runAddPanel } from './add-panel.js'
import { DEFAULT_SITE_FRAMEWORK, runAddSite, SITE_DIRECTORY } from './add-site.js'
import { BASIC_TEMPLATE, DEFAULT_DEV_HOST, DEFAULT_SCOPE_NAME, runCreate } from './create.js'

/**
 * Project names as `create` validates them, restated here so the wizard can reject a
 * bad name while it is still a question rather than after a directory was created.
 */
const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,62}$/

/** The length `PROJECT_NAME_PATTERN` allows, counted as a number rather than as a regex. */
const PROJECT_NAME_MAX = 63

/**
 * A core template name, matching `CORE_TEMPLATE_NAME_PATTERN` in `create.ts`.
 *
 * Kept in step with it deliberately: a template name the wizard accepts and `create`
 * rejects turns a typo into a failure after every other question, which is the worst
 * moment to discover it.
 */
const CORE_TEMPLATE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/

/**
 * A core name, matching what `create` accepts for `--core-name`. Dots and dashes are
 * allowed, so the default only has to be *shortened*, not respelled.
 */
const CORE_NAME_PATTERN = /^[a-z][a-z0-9._-]{0,62}$/
const CORE_NAME_MAX = 63

/**
 * A part name, matching `PART_NAME_PATTERN` in ./shared.js. The site id the wizard
 * derives has to fit this, and the wizard cannot ask about it.
 */
const PART_NAME_MAX = 64

/** The template that ships a collection and a panel under `core/src/`. */
const PREDEFINED_TEMPLATE = 'predefined'

/** Everything the wizard decides, before anything is written. */
interface Plan {
  name: string
  coreName: string
  mode: CoreMode
  land: string
  colony: string
  /** Named core template — `basic`, `predefined`, or one a repository ships. */
  core: string
  jwt: string
  key: string
  jwtGenerated: boolean
  keyGenerated: boolean
  host: string
  console: boolean
  mcp: boolean
  /** Undefined means no site; otherwise the framework or directory to generate from. */
  site?: string
  siteId: string
  /** Undefined means no panel; otherwise the panel name to generate. */
  panel?: string
}

/**
 * One line per decision, printed before anything is written.
 *
 * The label column is computed rather than hand-padded. This is the last thing the
 * person sees before the wizard starts creating directories, and a hand-aligned block
 * that is one space out — which is what happened the moment `dev host` stopped being
 * the longest label — reads as a bug in the thing it is about to run.
 */
function summary(plan: Plan, target: string): void {
  const rows: Array<[string, string]> = [
    ['project', `${plan.name} → ${target}`],
    ['core', `${plan.coreName} (${plan.mode}, template ${plan.core})`],
  ]
  if (plan.mode !== 'independent') {
    rows.push(['scope', `land ${plan.land} · colony ${plan.colony}`])
  }
  rows.push(['dev host', plan.host])
  rows.push([
    'secrets',
    `JWT_SECRET ${plan.jwtGenerated ? 'generated' : 'yours'} · ` +
      `ADMIN_KEY ${plan.keyGenerated ? 'generated' : 'yours'}`,
  ])
  const extras = [
    plan.console ? 'console' : null,
    plan.mcp ? 'mcp' : null,
    plan.site ? `site ${plan.site} → ${SITE_DIRECTORY}` : null,
    plan.panel ? `panel ${plan.panel}` : null,
  ].filter((entry): entry is string => entry !== null)
  rows.push([
    'also',
    extras.length > 0 ? extras.join(', ') : 'nothing — add parts later with `hamolus add`',
  ])

  const width = Math.max(...rows.map(([label]) => label.length))
  heading('Summary')
  for (const [label, value] of rows) {
    step(`${dim(label.padEnd(width))}  ${value}`)
  }
}

/**
 * Build the `ParsedArgs` one command needs.
 *
 * The wizard calls the real commands rather than reimplementing them, so it has to hand
 * them something shaped like a parsed command line. Only the options that mean the same
 * thing for every target are carried across — `--link` is the one — and everything else
 * comes from the answers.
 *
 * `--output` is *not* carried across, because it does not mean the same thing twice. For
 * `create` it names the root of the project being made; for an `add` it means "put this
 * part at this path". Forwarding it to the adds pointed the first optional part at the
 * project root itself, on top of the core, and `guardExisting` then refused it as an
 * unrecorded directory:
 *
 *   ✖ /tmp/acme already exists and is not recorded in hamolus.json.
 *
 * which is a true sentence about a path nobody meant to write to. Each add here has a
 * path the wizard already decided. The `create` call passes `output` back in explicitly.
 */
function argsFor(
  parent: ParsedArgs,
  positionals: string[],
  options: ParsedArgs['options'] = {},
): ParsedArgs {
  return {
    positionals,
    // `yes` is set because none of these commands ask anything: a prompt appearing after
    // the wizard finished would mean a question the wizard forgot to ask.
    flags: { help: false, yes: true, force: parent.flags.force, dryRun: false, clear: false },
    options: {
      ...(parent.options.link ? { link: parent.options.link } : {}),
      ...options,
    },
  }
}

/** A project name guessed from the current directory, for the default of question one. */
function guessName(): string {
  const directory = basename(process.cwd())
  const slug = directory
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/, '')
  return slug === '' ? '' : slug.slice(0, PROJECT_NAME_MAX)
}

/**
 * Derive a name that has to satisfy a *tighter* length limit than the one it comes from,
 * by shortening it.
 *
 * A project name is 63 characters; a core name is 63; a part name is 64. So a name the
 * wizard derives from question one — the core name, the default site id — overflows its
 * own limit the moment the project name is at the length limit, since every one of them
 * adds a suffix.
 *
 * The wizard does not ask about these, which is the point: they are defaults, and a
 * twelfth question to correct a default nobody typed is worse than the default. But
 * absorbing the difference has to happen *here*, at derivation time. Deriving an invalid
 * name instead means writing the project, the core, possibly a console and an MCP
 * server, and only then failing on a name the user never gave — the last step of the
 * wizard, with the most to undo and nobody to blame.
 *
 * `max` is the derived name's own limit and `suffix` is never shortened: which half to
 * give up is not a decision to hand back to someone at this point, and a name whose
 * suffix has been eaten is no longer recognisable as what it is.
 *
 * This shortens only. Whether the derived grammar also forbids characters the stem
 * allows — a part name is `snake_case`, a core name is not — is left to the caller, so
 * that `hamolus init my-project` still yields the readable core name `my-project-core`
 * and the part-legal site id `my_project_site`.
 */
function shorten(stem: string, suffix: string, max: number): string {
  // A stem that is nothing but a separator cannot happen — a project name starts with a
  // letter — so the trim can never leave an empty name.
  return `${stem.slice(0, max - suffix.length).replace(/[-_]+$/, '')}${suffix}`
}

/**
 * Ask the ten questions.
 *
 * Each one reads `flag ?? ask(...)`, which is what makes the wizard composable: anything
 * already decided on the command line is not asked again. The order is the order a
 * person needs to answer them in — the mode decides whether land and colony exist at
 * all, and the core name defaults to what question one produced.
 */
async function ask(args: ParsedArgs, prompter: Prompter): Promise<Plan> {
  const { options, positionals } = args

  // 1. Project name — also the directory it goes in, so it has to be a valid name.
  const suggested = positionals[0] ?? guessName()
  const name =
    positionals[0] ??
    (await prompter.text('Project name (the directory it goes in)', {
      default: suggested,
      hint: 'lowercase, dashes or underscores',
      validate: (value) =>
        PROJECT_NAME_PATTERN.test(value)
          ? undefined
          : 'Use lowercase letters, digits, dashes or underscores, starting with a letter.',
    }))
  if (!PROJECT_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid project name "${name}". Use lowercase letters, digits, dashes or underscores, ` +
        'starting with a letter.',
    )
  }

  // 2. The core's own name — its package name and its Worker name, not its template.
  //    Shortened for the same reason the site id is: a project name at the length limit
  //    plus `-core` is longer than a core name may be, and question three is the wrong
  //    place to fail.
  const coreName =
    options.coreName ??
    (await prompter.text('Core name', {
      default: shorten(name, '-core', CORE_NAME_MAX),
      hint: 'package + Worker name',
      validate: (value) =>
        CORE_NAME_PATTERN.test(value)
          ? undefined
          : 'Use lowercase letters, digits, dots, dashes or underscores, starting with a letter.',
    }))
  if (!CORE_NAME_PATTERN.test(coreName)) {
    throw new Error(
      `Invalid core name "${coreName}". Use lowercase letters, digits, dots, dashes or ` +
        'underscores, starting with a letter, 63 characters at most.',
    )
  }

  // 3. Core mode. A multi-tenant mode is unusable without a scope, so land and colony
  //    are asked here rather than left to fail on the first request that needs them.
  const mode =
    options.mode ??
    (await prompter.select<CoreMode>('Core mode', {
      choices: [
        {
          label: 'independent',
          value: 'independent',
          hint: 'one tenant, no land/colony routing — the usual starting point',
        },
        { label: 'centralized', value: 'centralized', hint: 'many lands behind one Worker' },
        { label: 'proxy', value: 'proxy', hint: 'one land, path-prefix routing to upstreams' },
        { label: 'bridge', value: 'bridge', hint: 'joins lands across cores via upstreams:v1' },
      ],
    }))

  const multiTenant = mode !== 'independent'

  const scopeProblem = (value: string): string | undefined => {
    if (value === DEFAULT_SCOPE_NAME) return undefined
    if (value === 'root') return '"root" is reserved for the unnamed scope — pick another name.'
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(value) || value.includes('__')) {
      return 'Use 2-40 lowercase letters, digits or underscores, starting with a letter.'
    }
    return undefined
  }

  const land =
    options.land ??
    (multiTenant
      ? await prompter.text('Land for bare (unprefixed) requests', {
          default: DEFAULT_SCOPE_NAME,
          hint: 'the core appends _lnd; "default" is the unnamed scope',
          validate: scopeProblem,
        })
      : DEFAULT_SCOPE_NAME)

  const colony =
    options.colony ??
    (multiTenant
      ? await prompter.text('Colony for bare (unprefixed) requests', {
          default: DEFAULT_SCOPE_NAME,
          hint: 'the core appends _cny; "default" is the unnamed scope',
          validate: scopeProblem,
        })
      : DEFAULT_SCOPE_NAME)

  // 4. Collections in source control, or none. A typed name picks another template
  //    directory, so a repository can ship its own the same way `--core` does.
  const collections = options.core
    ? ({ kind: 'custom', value: options.core } as const)
    : await prompter.maybe('Ship predefined collections in core/src/?', {
        yes: PREDEFINED_TEMPLATE,
        no: 'none',
        defaultKind: 'no',
        hint: 'or type a template name',
        validate: (value) =>
          CORE_TEMPLATE_PATTERN.test(value)
            ? undefined
            : 'A template name is one lowercase word — `predefined`, `basic`, or one this repository ships.',
      })
  const core =
    collections.kind === 'yes'
      ? PREDEFINED_TEMPLATE
      : collections.kind === 'custom'
        ? collections.value
        : BASIC_TEMPLATE

  // 5 & 6. Secrets. Generated when left blank, so a fresh project never starts with a
  //    `change-me` in the file the user has to remember to edit.
  const jwt = options.jwt
    ? { value: options.jwt, generated: false }
    : await prompter.secret('JWT secret (signs console + panel sessions)')
  const key = options.key
    ? { value: options.key, generated: false }
    : await prompter.secret('Admin key (console login, CLI, seeds)')

  // 7. Which addresses the dev servers answer on. A typed address beats y/n, and
  //    `0.0.0.0` is written into the dev scripts rather than remembered.
  const exposure = options.host
    ? ({ kind: 'custom', value: options.host } as const)
    : await prompter.maybe('Expose the dev servers on the LAN?', {
        yes: '0.0.0.0',
        no: DEFAULT_DEV_HOST,
        defaultKind: 'no',
        hint: 'or type an address such as mac.lan',
      })
  const host =
    exposure.kind === 'yes' ? '0.0.0.0' : exposure.kind === 'no' ? DEFAULT_DEV_HOST : exposure.value

  // 8 & 9. Optional parts. Both default to no: a project should pay for the parts it
  //    uses, and `hamolus add console` is one command away.
  const withConsole =
    options.console ?? (await prompter.confirm('Add an admin console?', { defaultValue: false }))
  const withMcp =
    options.mcp ?? (await prompter.confirm('Add an MCP server for AI agents?', { defaultValue: false }))

  // 10. A site, from a framework or a directory of your own.
  const answer = options.site
    ? ({ kind: 'custom', value: options.site } as const)
    : await prompter.maybe('Add a public site?', {
        yes: DEFAULT_SITE_FRAMEWORK,
        no: 'none',
        defaultKind: 'no',
        hint: `or type a framework or a path (${DEFAULT_SITE_FRAMEWORK}, nextjs, ./my-site)`,
      })
  const site =
    answer.kind === 'no' ? undefined : answer.kind === 'yes' ? DEFAULT_SITE_FRAMEWORK : answer.value

  // 11. A panel. A panel is a page inside the console rather than a process of its own,
  // so it has no `dev` entry and no port — but `hamolus add panel <name>` needs a name, so
  // unlike the yes/no questions above this one is a name from the start.
  const panelAnswer = options.panel
    ? ({ kind: 'custom', value: options.panel } as const)
    : await prompter.maybe('Add a panel?', {
        yes: 'admin',
        no: 'none',
        defaultKind: 'no',
        hint: 'or type a name (a panel is a page inside the console)',
      })
  const panel =
    panelAnswer.kind === 'no'
      ? undefined
      : panelAnswer.kind === 'yes'
        ? 'admin'
        : panelAnswer.value

  return {
    name,
    coreName,
    mode,
    land,
    colony,
    core,
    jwt: jwt.value,
    key: key.value,
    jwtGenerated: jwt.generated,
    keyGenerated: key.generated,
    host,
    console: withConsole,
    mcp: withMcp,
    site,
    // A site part needs an id, and the wizard does not spend a question on it: the
    // project's own name is unambiguous here, and `hamolus add site <name>` makes
    // another one whenever the default does not fit.
    siteId: defaultSiteId(name),
    panel,
  }
}

/**
 * The default site id: the project name, in `snake_case`, plus `_site`.
 *
 * Length is {@link shorten}'s job; the spelling is this function's, because a part name
 * forbids the hyphens a project name allows (`PART_NAME_PATTERN` in ./shared.js). It is
 * a default derived from a name that was already accepted, so the difference is absorbed
 * here rather than becoming a twelfth question.
 */
function defaultSiteId(projectName: string): string {
  return shorten(projectName, '_site', PART_NAME_MAX).replace(/-/g, '_')
}

/**
 * Run the wizard, then the commands its answers describe.
 *
 * The CWD moves to the generated project before the `add` calls, because every one of
 * them resolves the project root by walking up to `hamolus.json` from where it was
 * invoked — a limitation of running the real commands rather than a copy of their
 * logic. The previous directory is restored so a failure leaves the shell where it was.
 */
export async function runInit(args: ParsedArgs): Promise<void> {
  if (args.flags.dryRun) {
    throw new Error(
      '`hamolus init` has nothing to preview — the answers *are* the plan, and it runs them.\n' +
        'For a dry run, use the flags directly: `hamolus create acme --dry-run` prints the same plan.',
    )
  }

  const prompter = new Prompter(args.flags.yes)

  heading('hamolus — new project')
  if (prompter.isFallback) {
    info(
      args.flags.yes
        ? 'Running with --yes: every question takes its default.'
        : 'No terminal to ask on: every question takes its default.',
    )
  }

  let plan: Plan
  try {
    plan = await ask(args, prompter)
  } catch (error) {
    if (error instanceof PromptCancelled) {
      console.log()
      warn('Cancelled — nothing was written.')
      return
    }
    throw error
  } finally {
    prompter.finish()
  }

  const target = args.options.output ?? plan.name
  console.log()
  summary(plan, target)

  // `create` writes `./<name>` relative to the CWD it is given, and every `add` finds
  // its project root by walking up from the CWD: the two only meet if the process
  // stands inside the project it just made.
  const previous = process.cwd()
  try {
    await runCreate(
      argsFor(args, [plan.name], {
        // The one caller that does want `--output`, because it names the root of the
        // project about to be written rather than the place a part goes.
        ...(args.options.output ? { output: args.options.output } : {}),
        coreName: plan.coreName,
        mode: plan.mode,
        core: plan.core,
        host: plan.host,
        land: plan.land,
        colony: plan.colony,
        jwt: plan.jwt,
        key: plan.key,
      }),
    )

    process.chdir(resolve(previous, target))

    if (plan.console) await runAddConsole(argsFor(args, ['console']))
    if (plan.mcp) await runAddMcp(argsFor(args, ['mcp']))
    if (plan.site) await runAddSite(argsFor(args, ['site', plan.siteId], { template: plan.site }))
    if (plan.panel) await runAddPanel(argsFor(args, ['panel', plan.panel]))
  } finally {
    process.chdir(previous)
  }

  console.log()
  success(`${plan.name} is ready in ${resolve(previous, target)}`)
  // Both secrets always have a value by now — a question left empty generates one — so
  // `create` has always written a complete `core/.dev.vars`. The only thing worth saying
  // is which of the two a person chose, because that is what tells them whether the
  // values in the file are ones they will still recognise next week.
  const generated = [plan.jwtGenerated && 'JWT_SECRET', plan.keyGenerated && 'ADMIN_KEY'].filter(
    (name): name is string => name !== false,
  )
  info(
    generated.length > 0
      ? `core/.dev.vars holds ${generated.join(' and ')} generated, and the rest you typed — it is git-ignored.`
      : 'core/.dev.vars holds the secrets you typed — it is git-ignored.',
  )

  // The project's own `dev` script starts the core and every part that was asked for,
  // so it is what the last line should name. `hamolus list` is the way to see what the
  // answers produced, which is the question people have after a wizard run.
  next([`cd ${target}`, 'pnpm install', 'pnpm dev', 'hamolus list'])
}
