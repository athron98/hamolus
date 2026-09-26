import { A } from '@solidjs/router'
import { For } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { PLUGINS } from '../plugins/registry'
import { CollectionIcon, PuzzleIcon } from '../components/Icons'

const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 14,
  },
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textDecoration: 'none',
    color: tokens.text,
    transition:
      'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
    ':hover': {
      boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadowCardHover}`,
      transform: 'translateY(-3px)',
    },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 15,
    fontWeight: 700,
  },
  icon: {
    color: tokens.accent,
    display: 'inline-flex',
    flexShrink: 0,
  },
  desc: {
    fontSize: 13,
    color: tokens.textDim,
    lineHeight: 1.5,
  },
  foot: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  pluginId: {
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
  },
})

export function PluginsPage() {
  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(styles.title)}>
        <PuzzleIcon size={18} />
        Plugins
      </div>
      <div {...stylex.props(styles.grid)}>
        <For each={PLUGINS}>
          {(p) => (
            <A href={`/plugins/${p.id}`} {...stylex.props(styles.card)}>
              <div {...stylex.props(styles.title)}>
                <CollectionIcon name={p.icon} size={17} />
                {p.name}
              </div>
              <div {...stylex.props(styles.desc)}>{p.description}</div>
              <div {...stylex.props(styles.foot)}>
                <span {...stylex.props(styles.pluginId)}>{p.id}</span>
              </div>
            </A>
          )}
        </For>
      </div>
    </div>
  )
}