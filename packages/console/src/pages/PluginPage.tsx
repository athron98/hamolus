import { useParams } from '@solidjs/router'
import { createMemo, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { pluginById } from '../plugins/registry'
import { createPluginKv } from '../lib/pluginKv'
import { hasPermission } from '../lib/session'

const styles = stylex.create({
  missing: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
  },
  missingTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: tokens.text,
  },
  missingBody: {
    fontSize: 13,
    color: tokens.textDim,
  },
})

function MissingPlugin({ name }: { name: string }) {
  return (
    <div {...stylex.props(s.page, styles.missing)}>
      <div {...stylex.props(styles.missingTitle)}>Plugin not found</div>
      <div {...stylex.props(styles.missingBody)}>No plugin registered under "{name}".</div>
    </div>
  )
}

export function PluginPage() {
  const params = useParams()
  const name = () => params.name ?? ''

  const view = createMemo<JSX.Element>(() => {
    const plugin = pluginById(name())
    if (!plugin) return <MissingPlugin name={name()} />
    const kv = createPluginKv(plugin.id)
    const Comp = plugin.component
    return (
      <Comp
        plugin={plugin}
        kv={kv}
        permissions={{ canWrite: hasPermission('settings.write') }}
      />
    )
  })

  return <Show when={view()} fallback={null}>
    {view()}
  </Show>
}