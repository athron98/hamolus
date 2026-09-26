export interface PanelConfig {
  id: string
  name: string
  apiUrl: string
  token: string
  land?: string
  colony?: string
  defaultView?: string
  locale?: string
}

function optionalEnv(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

export const panel: PanelConfig = {
  id: '{{PANEL_ID}}',
  name: '{{PANEL_NAME}}',
  apiUrl: import.meta.env.VITE_PANEL_API_URL?.trim() || 'http://localhost:8787/api',
  token: import.meta.env.VITE_PANEL_API_TOKEN?.trim() || '',
  land: optionalEnv(import.meta.env.VITE_PANEL_LAND),
  colony: optionalEnv(import.meta.env.VITE_PANEL_COLONY),
  defaultView: optionalEnv(import.meta.env.VITE_PANEL_DEFAULT_VIEW),
  locale: optionalEnv(import.meta.env.VITE_PANEL_LOCALE),
}

/**
 * `PanelClient` throws a bundler-neutral "token is required" error, which leaves a
 * fresh app with no clue where the token belongs. Name the variable and the
 * endpoint that mints one, so the first run is self-explanatory.
 */
export function missingTokenMessage(): string | null {
  if (panel.token) return null
  return [
    'VITE_PANEL_API_TOKEN is not set.',
    'Mint a token for a panel user and put it in this app\'s .env, for example:',
    '  POST /api/_auth/login  { "username": "<panel_user>", "password": "…" }  ->  data.token',
  ].join('\n')
}
