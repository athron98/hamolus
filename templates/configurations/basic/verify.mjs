// Validate this configuration's wrangler.jsonc.
//
// `pnpm typecheck` only runs `node --check` on this file, which proves it parses but says
// nothing about the config it validates. Run it directly (`node ./verify.mjs`) to actually
// check the preset — the point of a configuration template is that a typo in a resource id
// or a renamed binding fails here, before `wrangler deploy` fails on Cloudflare's side.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(HERE, 'wrangler.jsonc')

const CORE_MODES = ['independent', 'centralized', 'proxy', 'bridge']
const REQUIRED_BINDINGS = ['DB', 'SETTINGS', 'MEDIA']
const REQUIRED_VARS = ['CORE_MODE', 'DEFAULT_LAND', 'PUBLIC_GETS']
const PLACEHOLDER_IDS = new Set(['00000000-0000-0000-0000-000000000000', '0'.repeat(32)])

/**
 * Strip JSONC comments so the file can be parsed as JSON.
 *
 * A regex cannot do this safely (it would eat a `//` inside a string), so this walks the
 * text and tracks quoting. Trailing commas are left to the checks below to report.
 */
function stripJsonComments(text) {
  let out = ''
  let inString = false
  let inLine = false
  let inBlock = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inLine) {
      if (char === '\n') {
        inLine = false
        out += char
      }
      continue
    }
    if (inBlock) {
      if (char === '*' && next === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (inString) {
      out += char
      if (char === '\\') {
        out += next ?? ''
        i++
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      continue
    }
    if (char === '/' && next === '/') {
      inLine = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      inBlock = true
      i++
      continue
    }
    out += char
  }

  return out
}

const problems = []
const warnings = []

function check(label, ok, detail) {
  if (ok) {
    console.log(`  ok    ${label}`)
  } else {
    problems.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('verifying wrangler.jsonc\n')

let config
try {
  config = JSON.parse(stripJsonComments(readFileSync(CONFIG_PATH, 'utf8')))
} catch (error) {
  console.error(`  FAIL  could not parse wrangler.jsonc — ${error.message}`)
  console.error('\n1 problem found.')
  process.exit(1)
}

check('worker name', typeof config.name === 'string' && config.name.length > 0, 'missing "name"')
check(
  'compatibility_date',
  typeof config.compatibility_date === 'string',
  'missing "compatibility_date"',
)
check(
  'nodejs_compat flag',
  (config.compatibility_flags ?? []).includes('nodejs_compat'),
  'the core needs nodejs_compat',
)

if (typeof config.main !== 'string') {
  check('main entry', false, 'missing "main"')
} else {
  const mainPath = resolve(HERE, config.main)
  check(
    `main entry (${config.main})`,
    existsSync(mainPath),
    `does not resolve to a file — expected the core part at ${mainPath}`,
  )
}

for (const binding of REQUIRED_BINDINGS) {
  const found =
    (config.d1_databases ?? []).some((b) => b.binding === binding) ||
    (config.kv_namespaces ?? []).some((b) => b.binding === binding) ||
    (config.r2_buckets ?? []).some((b) => b.binding === binding)
  check(`binding ${binding}`, found, 'no resource declares this binding')
}

const vars = config.vars ?? {}
for (const name of REQUIRED_VARS) check(`var ${name}`, name in vars, 'missing from "vars"')
check(
  `CORE_MODE is one of ${CORE_MODES.join(' | ')}`,
  CORE_MODES.includes(vars.CORE_MODE),
  `got ${JSON.stringify(vars.CORE_MODE)}`,
)
check(
  'PUBLIC_GETS is "true" or "false"',
  ['true', 'false'].includes(vars.PUBLIC_GETS),
  `got ${JSON.stringify(vars.PUBLIC_GETS)}`,
)

for (const db of config.d1_databases ?? []) {
  if (PLACEHOLDER_IDS.has(db.database_id)) {
    warnings.push(`${db.binding} still has a placeholder database_id — create the D1 database and paste the real id`)
  }
}
for (const kv of config.kv_namespaces ?? []) {
  if (PLACEHOLDER_IDS.has(kv.id)) {
    warnings.push(`${kv.binding} still has a placeholder id — create the KV namespace and paste the real id`)
  }
}

const secretish = Object.keys(vars).filter((name) => /SECRET|PASSWORD|KEY|TOKEN/.test(name))
check(
  'no credentials in vars',
  secretish.length === 0,
  secretish.length === 1
    ? `${secretish[0]} belongs in \`wrangler secret put\`, not in vars`
    : `${secretish.join(', ')} belong in \`wrangler secret put\`, not in vars`,
)

for (const warning of warnings) console.log(`  warn  ${warning}`)

if (problems.length) {
  console.error(`\n${problems.length} problem(s) found.`)
  process.exit(1)
}

console.log(
  `\n${warnings.length ? `configuration is deployable, with ${warnings.length} warning(s)` : 'configuration is valid'}.`,
)
