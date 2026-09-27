/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, For, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { api } from '../lib/api'
import { addEndpoint, apiBase, endpoints, storeToken } from '../lib/store'
import { applySession } from '../lib/session'
import { s, tokens } from '../theme.stylex'

type Mode = 'setup' | 'login' | 'legacy'

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
    gridTemplateColumns: 'repeat(3, 1fr)',
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
})

export function LoginPage() {
  const [mode, setMode] = createSignal<Mode>('login')
  const [setupAvailable, setSetupAvailable] = createSignal(false)
  const [loadingSetup, setLoadingSetup] = createSignal(true)
  const [username, setUsername] = createSignal('')
  const [name, setName] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [key, setKey] = createSignal('')
  const [endpoint, setEndpoint] = createSignal(apiBase())
  const [endpointName, setEndpointName] = createSignal('')
  const [endpointLand, setEndpointLand] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  onMount(async () => {
    try {
      const { data } = await api.setupStatus()
      setSetupAvailable(data.setupRequired)
      setMode(data.setupRequired ? 'setup' : 'login')
    } catch {
      setSetupAvailable(false)
      setMode('login')
    } finally {
      setLoadingSetup(false)
    }
  })

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
      addEndpoint(endpoint(), endpointName(), endpointLand())
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
            ? 'No users yet — create the first administrator account.'
            : 'Manage collections, records, media, users & configuration.'}
        </p>

        <Show when={!loadingSetup()}>
          <div {...stylex.props(styles.modeRow)}>
            <button
              type="button"
              onClick={() => setMode('setup')}
              disabled={!loadingSetup() && !setupAvailable()}
              {...stylex.props(styles.modeBtn, mode() === 'setup' && styles.modeActive)}
            >
              Setup
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              {...stylex.props(styles.modeBtn, mode() === 'login' && styles.modeActive)}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('legacy')}
              {...stylex.props(styles.modeBtn, mode() === 'legacy' && styles.modeActive)}
            >
              Admin key
            </button>
          </div>
        </Show>

        <Show when={endpoints().length > 1}>
          <label {...stylex.props(s.label)}>Saved endpoints</label>
          <select
            {...stylex.props(s.select)}
            onChange={(e) => {
              const u = e.currentTarget.value
              const ep = endpoints().find((x) => x.url === u)
              if (ep) {
                setEndpoint(ep.url)
                setEndpointName(ep.label)
                setEndpointLand(ep.land ?? '')
              }
            }}
          >
            <option value="" disabled>
              Select a saved endpoint…
            </option>
            <For each={endpoints()}>
              {(ep) => (
                <option value={ep.url}>
                  {ep.label}
                  {ep.land ? ` · ${ep.land}` : ''} — {ep.url}
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
        <label {...stylex.props(s.label)}>Land — optional</label>
        <input
          type="text"
          {...stylex.props(s.input)}
          value={endpointLand()}
          onInput={(e) => setEndpointLand(e.currentTarget.value)}
          placeholder="e.g. staging (blank = default land)"
          spellcheck={false}
        />

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
          {busy()
            ? 'Working…'
            : mode() === 'setup'
              ? 'Create administrator'
              : mode() === 'legacy'
                ? 'Sign in'
                : 'Sign in'}
        </button>
      </form>
    </div>
  )
}