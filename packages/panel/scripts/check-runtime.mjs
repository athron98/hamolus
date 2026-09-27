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
 * Gate for the panel runtime surface `@hamolus/panel` exposes to generated panels.
 *
 * Two things are checked, because they are the two halves of "a generated panel is
 * just a thin wrapper":
 *
 *   1. The SDK behaves. `createPanelRuntimeConfig` normalises a Vite env into a
 *      config, `missingTokenMessage` explains a missing token, and
 *      `getLocalization` reads the core's public `GET /_meta/localization` — with no
 *      token, because that endpoint is public.
 *   2. The shipped template delegates instead of re-implementing. The template used
 *      to hand-roll the env reads and carry its own idea of the locale; it now calls
 *      the SDK and follows the core. A copy/paste of the old `panel.ts` must fail
 *      this gate rather than reach a generated project.
 *
 * Run: pnpm check:panel-runtime
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_PANEL_API_URL,
  PanelClient,
  createPanelRuntimeConfig,
  fetchPanelLocalization,
  missingTokenMessage,
} from '../dist/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const TEMPLATE = join(REPO, 'templates', 'panels', 'basic', 'src')

let passed = 0
let failed = 0

function ok(name, condition, detail) {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? `\n      ${String(detail).replace(/\n/g, '\n      ')}` : ''}`)
  }
}

// --- 1. createPanelRuntimeConfig: normalising a Vite env ------------------------
{
  const config = createPanelRuntimeConfig(
    { VITE_PANEL_API_URL: 'http://localhost:8787', VITE_PANEL_API_TOKEN: ' tok ' },
    { id: 'shop_ops', name: 'Shop Operations' },
  )
  ok('a bare host gains the /api suffix the client expects', config.apiUrl === 'http://localhost:8787/api', config.apiUrl)
  ok('the token is trimmed', config.token === 'tok', config.token)
  ok('the generator-supplied id and name are used', config.id === 'shop_ops' && config.name === 'Shop Operations')

  const defaulted = createPanelRuntimeConfig({}, { id: 'x', name: 'X' })
  ok('an unset API base falls back to the documented default', defaulted.apiUrl === DEFAULT_PANEL_API_URL, defaulted.apiUrl)
  ok('an unset token is empty, not undefined', defaulted.token === '')

  const blank = createPanelRuntimeConfig(
    { VITE_PANEL_LAND: '   ', VITE_PANEL_COLONY: '', VITE_PANEL_DEFAULT_VIEW: ' sales ', VITE_PANEL_LOCALE: ' id ' },
    { id: 'x', name: 'X' },
  )
  ok('a whitespace-only scope becomes undefined, not an empty header', blank.land === undefined && blank.colony === undefined, JSON.stringify(blank))
  ok('optional values are trimmed', blank.defaultView === 'sales' && blank.locale === 'id', JSON.stringify(blank))

  let threw = null
  try {
    createPanelRuntimeConfig({}, { name: 'X' })
  } catch (error) {
    threw = error
  }
  ok('a panel without an id is rejected', threw !== null, String(threw))
}

// --- 2. missingTokenMessage -----------------------------------------------------
{
  ok('a configured token needs no explanation', missingTokenMessage({ token: 'tok' }) === null)
  const message = missingTokenMessage({ token: '' })
  ok('a missing token names the variable', typeof message === 'string' && message.includes('VITE_PANEL_API_TOKEN'), String(message))
  ok('a missing token names the endpoint that mints one', String(message).includes('/_auth/login'), String(message))
}

// --- 3. getLocalization: public, scoped, and honest about "no locales" -----------
{
  const calls = []
  const answering = (payload) => async (url, init) => {
    calls.push({ url, headers: Object.fromEntries(new Headers(init.headers)) })
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const declared = {
    defaultLocale: 'id',
    locales: [
      { code: 'id', label: 'Bahasa Indonesia' },
      { code: 'en', label: 'English' },
    ],
    multilingual: true,
  }

  const client = new PanelClient({
    apiBase: 'http://localhost:8787',
    token: 'a-token',
    land: 'acme',
    fetch: answering({ data: declared }),
  })
  const resolved = await client.getLocalization()
  ok('the client resolves the project locales', resolved?.defaultLocale === 'id' && resolved.locales.length === 2, JSON.stringify(resolved))
  ok('the request goes to the core localization endpoint', calls[0]?.url === 'http://localhost:8787/api/_meta/localization', calls[0]?.url)
  ok('the scope travels with the request', calls[0]?.headers['x-land'] === 'acme', JSON.stringify(calls[0]?.headers))
  ok('the read is public, so it needs no Authorization header', calls[0]?.headers.authorization === undefined, JSON.stringify(calls[0]?.headers))

  const standalone = await fetchPanelLocalization({ apiBase: '/api', fetch: answering({ data: declared }) })
  ok('localization is readable without a client or a token', standalone?.defaultLocale === 'id', JSON.stringify(standalone))

  const unlocalized = await fetchPanelLocalization({ apiBase: '/api', fetch: answering({ data: null }) })
  ok('a project with no locales answers null, not an error', unlocalized === null, JSON.stringify(unlocalized))

  let networkError = null
  try {
    await fetchPanelLocalization({
      apiBase: '/api',
      fetch: async () => {
        throw new Error('ECONNREFUSED')
      },
    })
  } catch (error) {
    networkError = error
  }
  ok(
    'an unreachable core throws, so it stays distinct from "not localized"',
    networkError !== null && networkError.code === 'NETWORK_ERROR',
    String(networkError),
  )

  let httpError = null
  try {
    await fetchPanelLocalization({
      apiBase: '/api',
      fetch: async () =>
        new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'scope denied' } }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    })
  } catch (error) {
    httpError = error
  }
  ok(
    'a rejected read surfaces the core message, not a silent null',
    httpError !== null && httpError.message.includes('scope denied'),
    String(httpError),
  )

  let malformed = null
  try {
    await fetchPanelLocalization({ apiBase: '/api', fetch: async () => new Response('{}', { status: 200 }) })
  } catch (error) {
    malformed = error
  }
  ok(
    'a response without a data envelope is rejected',
    malformed !== null && malformed.code === 'INVALID_RESPONSE',
    String(malformed),
  )

  let badEntry = null
  try {
    await fetchPanelLocalization({
      apiBase: '/api',
      fetch: answering({ data: { defaultLocale: 'en', multilingual: true, locales: [{ code: 'en' }] } }),
    })
  } catch (error) {
    badEntry = error
  }
  ok(
    'a locale entry missing its label is rejected rather than trusted',
    badEntry !== null && badEntry.code === 'INVALID_RESPONSE',
    String(badEntry),
  )
}

// --- 4. The template delegates to the SDK --------------------------------------
{
  const panelSource = readFileSync(join(TEMPLATE, 'panel.ts'), 'utf8')
  ok('the template panel.ts builds its config with the SDK', /createPanelRuntimeConfig\(/.test(panelSource))
  ok('the template panel.ts re-exports the SDK token hint', /missingTokenMessage/.test(panelSource))
  ok(
    'the template panel.ts no longer reads the Vite env itself',
    !/import\.meta\.env\.VITE_PANEL_/.test(panelSource),
    'panel.ts still reads import.meta.env directly',
  )
  ok(
    'the template panel.ts does not declare its own config shape',
    !/export interface PanelConfig/.test(panelSource),
  )

  const appSource = readFileSync(join(TEMPLATE, 'App.tsx'), 'utf8')
  ok('the template asks the core for its locales', /getLocalization\(\)/.test(appSource))
  ok('the template imports the config type from the SDK', /PanelRuntimeConfig/.test(appSource))
  ok(
    'the template does not hardcode a locale list of its own',
    !/locales:\s*\[[^\]]*code:/.test(appSource),
    'App.tsx appears to declare locales inline',
  )
  // `missingTokenMessage` takes the resolved config. A bare `missingTokenMessage()`
  // only shows up when the panel is generated and compiled, so assert it here.
  ok(
    'the template passes the panel config to missingTokenMessage',
    !/missingTokenMessage\(\s*\)/.test(appSource),
    'App.tsx calls missingTokenMessage() with no argument',
  )
  ok(
    'the template resolves the core locale before the first record request',
    /getLocalization[\s\S]*?setLocale\([\s\S]*?setRuntime\(/u.test(appSource),
    'localization must be applied before the view mounts, or it double-fetches',
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
