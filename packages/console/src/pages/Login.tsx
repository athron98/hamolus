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
 * The pre-auth screen: pick an endpoint, then sign in to it.
 *
 * Three things here are load-bearing and all three are about *which core you are
 * looking at*:
 *
 * 1. **The endpoint is a choice, so everything else follows it.** Setup status, the
 *    core's version and the scope headers all have to be read from the URL in the form,
 *    not from the stored default. Checking setup status on mount against the default
 *    means a fresh production core is told "no users yet" while the operator is typing
 *    a different URL — and the Setup tab is then the most prominent thing on a screen
 *    for a core that already has an administrator.
 * 2. **Colony is asked for here, because after this screen there is no way to add it.**
 *    `store.ts` has carried `ConsoleEndpoint.colony` and every request sends `x-colony`
 *    from it, but this form never collected it, so the field could only ever be empty —
 *    a colony other than the default was unreachable from the UI. It sits beside Land
 *    for the same reason and with the same optionality: both are only needed on a
 *    core running more than one scope.
 * 3. **The admin key is not a peer of Sign in.** It is the deprecated `ADMIN_KEY`
 *    exchange, kept working on the core for one more release so an existing deployment
 *    is not locked out by an upgrade. Presenting it as a third equal tab is what makes
 *    it look current, so it is a link at the bottom that opens the field.
 */

import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { api, type CoreProbe } from '../lib/api'
import { addEndpoint, apiBase, endpoints, storeToken } from '../lib/store'
import { applySession } from '../lib/session'
import { CONSOLE_VERSION } from '../lib/version'
import { s, tokens } from '../theme.stylex'

type Mode = 'setup' | 'login' | 'legacy'

/** How long to wait after the last keystroke before probing. A hostname is typed in pieces. */
const PROBE_DEBOUNCE_MS = 500

const cardFade = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

const styles = stylex.create({
  screen: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: 360,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadow}`,
    borderRadius: tokens.radius,
    padding: 28,
    gap: 14,
    display: 'flex',
    flexDirection: 'column',
    animationName: cardFade,
    animationDuration: '0.25s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: 12,
    color: tokens.textDim,
    marginTop: -8,
  },
  modeRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 4,
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    padding: 3,
  },
  modeBtn: {
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.accent, backgroundColor: tokens.accentSoft },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  modeActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  /**
   * The endpoint's own identity, shown under the URL field.
   *
   * Its job is to make "which core am I about to log into" answerable before the
   * credentials are typed. `unknown` for the version is a real state — a core older
   * than the field — and it is worded that way rather than shown blank or guessed.
   */
  probe: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: tokens.textDim,
    marginTop: -6,
    minHeight: 16,
  },
  probeOk: {
    color: tokens.ok,
  },
  probeBad: {
    color: tokens.danger,
  },
  /** Deprecation notice for the admin-key path: an alternative, not an equal choice. */
  legacyNote: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: -6,
  },
  legacyLink: {
    alignSelf: 'center',
    background: 'none',
    borderStyle: 'none',
    padding: '4px 0',
    fontSize: 11,
    color: tokens.textDim,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    ':hover': { color: tokens.accent },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  consoleVersion: {
    alignSelf: 'center',
    fontSize: 10,
    color: tokens.textDim,
    marginTop: 2,
  },
})

/** Nothing probed yet — the initial state before the first debounce fires. */
const UNPROBED: CoreProbe = { reachable: false, version: null, setupRequired: false, setupKnown: false }

export function LoginPage() {
  const [mode, setMode] = createSignal<Mode>('login')
  const [setupAvailable, setSetupAvailable] = createSignal(false)
  const [probing, setProbing] = createSignal(true)
  const [probe, setProbe] = createSignal<CoreProbe>(UNPROBED)
  const [username, setUsername] = createSignal('')
  const [name, setName] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [key, setKey] = createSignal('')
  const [endpoint, setEndpoint] = createSignal(apiBase())
  const [endpointName, setEndpointName] = createSignal('')
  const [endpointLand, setEndpointLand] = createSignal('')
  const [endpointColony, setEndpointColony] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  /**
   * Probe the URL currently in the form, debounced, and drop a stale answer.
   *
   * The sequence guard is what makes typing safe: without it, a slow probe of a
   * half-typed hostname resolves after a fast probe of the finished one and overwrites
   * it, showing one core's version above another core's URL. `probing` is only cleared
   * by the answer that is still current.
   */
  let probeSeq = 0
  const runProbe = (base: string) => {
    const seq = ++probeSeq
    setProbing(true)
    void api.probe(base).then((result) => {
      if (seq !== probeSeq) return
      setProbe(result)
      setProbing(false)
      if (result.setupKnown) setSetupAvailable(result.setupRequired)
    })
  }

  let debounce: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const base = endpoint()
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => runProbe(base), PROBE_DEBOUNCE_MS)
  })
  onCleanup(() => {
    if (debounce) clearTimeout(debounce)
  })

  onMount(() => {
    // The saved-endpoint pick already carries a scope, and the stored one usually does
    // too — a second sign-in should not have to retype the colony it was saved with.
    const active = endpoints().find((e) => e.url === apiBase())
    if (active) {
      setEndpointName(active.label)
      setEndpointLand(active.land ?? '')
      setEndpointColony(active.colony ?? '')
    }
  })

  const pickEndpoint = (url: string) => {
    const ep = endpoints().find((x) => x.url === url)
    if (!ep) return
    setEndpoint(ep.url)
    setEndpointName(ep.label)
    setEndpointLand(ep.land ?? '')
    setEndpointColony(ep.colony ?? '')
  }

  const canSubmit = () => {
    if (busy()) return false
    if (mode() === 'setup') return username().trim().length > 1 && name().trim().length > 0 && password().length >= 8
    if (mode() === 'login') return username().trim().length > 0 && password().length > 0
    return key().length > 0
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (!canSubmit()) return
    setBusy(true)
    setError(null)
    try {
      addEndpoint(endpoint(), endpointName(), endpointLand(), endpointColony())
      if (mode() === 'setup') {
        const res = await api.setup({ username: username().trim(), name: name().trim(), password: password() })
        storeToken(res.data.token)
        if (res.data.user && res.data.permissions) applySession(res.data.user, res.data.permissions)
      } else if (mode() === 'login') {
        const res = await api.login({ username: username().trim(), password: password() })
        storeToken(res.data.token)
        if (res.data.user && res.data.permissions) applySession(res.data.user, res.data.permissions)
      } else {
        const res = await api.token(key())
        storeToken(res.data.token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div {...stylex.props(styles.screen)}>
      <form {...stylex.props(styles.card)} onSubmit={submit}>
        <div {...stylex.props(styles.title)}>Hamolus Console</div>
        <p {...stylex.props(styles.subtitle)}>
          {mode() === 'setup'
            ? 'No users yet on this core — create the first administrator account.'
            : 'Manage collections, records, media, users, MCP servers & configuration.'}
        </p>

        <Show when={endpoints().length > 1}>
          <label {...stylex.props(s.label)}>Saved endpoints</label>
          <select {...stylex.props(s.select)} onChange={(e) => pickEndpoint(e.currentTarget.value)}>
            <option value="" disabled>
              Select a saved endpoint…
            </option>
            <For each={endpoints()}>
              {(ep) => (
                <option value={ep.url}>
                  {ep.label}
                  {ep.land ? ` · ${ep.land}` : ''}
                  {ep.colony ? ` · ${ep.colony}` : ''} — {ep.url}
                </option>
              )}
            </For>
          </select>
        </Show>
        <label {...stylex.props(s.label)}>Endpoint name</label>
        <input
          type="text"
          {...stylex.props(s.input)}
          value={endpointName()}
          onInput={(e) => setEndpointName(e.currentTarget.value)}
          placeholder="e.g. Local dev / Production"
          spellcheck={false}
        />
        <label {...stylex.props(s.label)}>Endpoint URL</label>
        <input
          type="text"
          {...stylex.props(s.input)}
          value={endpoint()}
          onInput={(e) => setEndpoint(e.currentTarget.value)}
          placeholder="/api or https://host/api"
          spellcheck={false}
        />

        {/*
          Which core answered, before any credential is typed. Wording is deliberate:
          "unknown" is what a core predating the version field says, and "no version" or
          a blank cell would both read as a bug in the console.
        */}
        <Show
          when={!probing()}
          fallback={<div {...stylex.props(styles.probe)}>Checking this core…</div>}
        >
          <div
            {...stylex.props(
              styles.probe,
              probe().reachable ? styles.probeOk : styles.probeBad,
            )}
          >
            <Show when={probe().reachable} fallback={<>Not reachable</>}>
              Core {probe().version ?? 'version unknown'}
              {probe().setupRequired ? ' · no users yet' : ''}
            </Show>
          </div>
        </Show>

        <label {...stylex.props(s.label)}>Land — optional</label>
        <input
          type="text"
          {...stylex.props(s.input)}
          value={endpointLand()}
          onInput={(e) => setEndpointLand(e.currentTarget.value)}
          placeholder="e.g. staging (blank = default land)"
          spellcheck={false}
        />
        <label {...stylex.props(s.label)}>Colony — optional</label>
        <input
          type="text"
          {...stylex.props(s.input)}
          value={endpointColony()}
          onInput={(e) => setEndpointColony(e.currentTarget.value)}
          placeholder="e.g. brand (blank = default colony)"
          spellcheck={false}
        />

        <Show when={mode() === 'setup' || mode() === 'login'}>
          <div {...stylex.props(styles.modeRow)}>
            <button
              type="button"
              onClick={() => setMode('login')}
              {...stylex.props(styles.modeBtn, mode() === 'login' && styles.modeActive)}
            >
              Sign in
            </button>
            <Show when={setupAvailable()}>
              <button
                type="button"
                onClick={() => setMode('setup')}
                {...stylex.props(styles.modeBtn, mode() === 'setup' && styles.modeActive)}
              >
                Setup
              </button>
            </Show>
          </div>
        </Show>

        <Show when={mode() === 'login' || mode() === 'setup'}>
          <label {...stylex.props(s.label)}>Username</label>
          <input
            type="text"
            {...stylex.props(s.input)}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            placeholder="e.g. admin"
            spellcheck={false}
            autocomplete="username"
          />
        </Show>
        <Show when={mode() === 'setup'}>
          <label {...stylex.props(s.label)}>Display name</label>
          <input
            type="text"
            {...stylex.props(s.input)}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. Site Administrator"
            spellcheck={false}
          />
        </Show>
        <Show when={mode() === 'login' || mode() === 'setup'}>
          <label {...stylex.props(s.label)}>Password</label>
          <input
            type="password"
            {...stylex.props(s.input)}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            placeholder={mode() === 'setup' ? 'At least 8 characters' : 'Enter password'}
            autocomplete={mode() === 'setup' ? 'new-password' : 'current-password'}
          />
        </Show>

        <Show when={mode() === 'legacy'}>
          <p {...stylex.props(styles.legacyNote)}>
            The core's <code>ADMIN_KEY</code> is deprecated and kept only so an existing
            deployment survives an upgrade. Prefer a user account.
          </p>
          <label {...stylex.props(s.label)}>Admin key</label>
          <input
            type="password"
            {...stylex.props(s.input)}
            value={key()}
            onInput={(e) => setKey(e.currentTarget.value)}
            placeholder="Enter ADMIN_KEY"
          />
        </Show>

        <Show when={error()}>
          <p {...stylex.props(s.error)}>{error()}</p>
        </Show>
        <button type="submit" disabled={!canSubmit()} {...stylex.props(s.btn)}>
          {busy() ? 'Working…' : mode() === 'setup' ? 'Create administrator' : 'Sign in'}
        </button>

        <Show when={mode() !== 'legacy'}>
          <button
            type="button"
            {...stylex.props(styles.legacyLink)}
            onClick={() => setMode(mode() === 'legacy' ? 'login' : 'legacy')}
          >
            {mode() === 'legacy' ? 'Back to sign in' : 'Sign in with an admin key instead'}
          </button>
        </Show>
        <div {...stylex.props(styles.consoleVersion)}>Console v{CONSOLE_VERSION}</div>
      </form>
    </div>
  )
}
