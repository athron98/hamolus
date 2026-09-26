import { createMemo, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { PanelDefinition, PanelViewDefinition } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { CollectionIcon } from './Icons'

const chip = stylex.create({
  base: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
    marginRight: 4,
    marginBottom: 3,
  },
  neutral: {
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
  },
  accent: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  ok: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
})

const styles = stylex.create({
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowSm}`,
    borderRadius: tokens.radius,
    padding: 16,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
    marginBottom: 10,
  },
  divider: {
    height: 16,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    marginBottom: 14,
  },
  propsGrid: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    columnGap: 12,
    rowGap: 8,
    alignItems: 'baseline',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '120px 1fr',
    },
  },
  propLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.textDim,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
  },
  propValue: {
    fontSize: 13,
    color: tokens.text,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  mono: {
    fontFamily: tokens.fontMono,
    fontSize: 12,
  },
  dim: {
    color: tokens.textDim,
  },
  iconWrap: {
    color: tokens.accent,
    display: 'inline-flex',
  },
  tableScroll: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    tableLayout: 'fixed',
    '@media (max-width: 900px)': {
      minWidth: 720,
    },
  },
  th: {
    textAlign: 'left',
    padding: '7px 10px',
    color: tokens.textDim,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    verticalAlign: 'top',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stacked: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  sub: {
    fontSize: 12,
    color: tokens.textDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  emptyRow: {
    padding: '14px 2px',
    color: tokens.textDim,
    fontSize: 13,
  },
})

function Flag({ label, tone }: { label: string; tone: 'neutral' | 'accent' | 'ok' }) {
  return (
    <span
      {...stylex.props(
        chip.base,
        tone === 'accent' && chip.accent,
        tone === 'ok' && chip.ok,
        tone === 'neutral' && chip.neutral,
      )}
    >
      {label}
    </span>
  )
}

function KindChip({ kind }: { kind: string }) {
  return (
    <span {...stylex.props(chip.base, kind === 'dashboard' ? chip.ok : chip.accent, styles.mono)}>
      {kind}
    </span>
  )
}

function listText(values: string[] | undefined): string {
  if (!values || values.length === 0) return '—'
  return values.join(', ')
}

function fieldAccess(view: PanelViewDefinition): { label: string; tone: 'neutral' | 'accent' | 'ok' }[] {
  const flags: { label: string; tone: 'neutral' | 'accent' | 'ok' }[] = []
  if (view.operations.includes('create')) flags.push({ label: 'create', tone: 'ok' })
  if (view.operations.includes('read')) flags.push({ label: 'read', tone: 'ok' })
  if (view.operations.includes('update')) flags.push({ label: 'update', tone: 'ok' })
  if (view.operations.includes('delete')) flags.push({ label: 'delete', tone: 'ok' })
  if (view.searchable) flags.push({ label: 'searchable', tone: 'accent' })
  if (view.kind === 'table' && view.form) flags.push({ label: 'form', tone: 'neutral' })
  flags.push({ label: `read ${view.fields.read.length} fields`, tone: 'neutral' })
  flags.push({ label: `write ${view.fields.write.length} fields`, tone: 'neutral' })
  return flags
}

function viewCollection(view: PanelViewDefinition): string | null {
  return view.kind === 'dashboard' ? null : view.collection
}

function viewMetrics(view: PanelViewDefinition): string {
  if (view.kind !== 'dashboard') return '—'
  return view.metrics.map((m) => m.label || m.id).join(', ')
}

function viewFilters(view: PanelViewDefinition): string {
  if (view.filters.length === 0) return '—'
  return view.filters
    .map((f) => `${f.op} ${'value' in f ? String(f.value) : 'source'}`)
    .join(' · ')
}

function themeText(panel: PanelDefinition): string {
  const t = panel.theme
  if (!t || (!t.mode && !t.palette && !t.font)) return '—'
  return [t.mode, t.palette, t.font].filter(Boolean).join(' · ')
}

function memberAttributes(attributes: Record<string, string | number | boolean | null>): string {
  const entries = Object.entries(attributes)
  if (entries.length === 0) return '—'
  return entries.map(([k, v]) => `${k}=${String(v)}`).join(', ')
}

export function PanelDefinitionView(props: { panel: PanelDefinition }) {
  const panel = createMemo(() => props.panel)
  const propsRows = createMemo<{ label: string; value: string | null }[]>(() => [
    { label: 'Name', value: panel().name },
    { label: 'Id', value: panel().id },
    { label: 'Description', value: panel().description ?? null },
    { label: 'Icon', value: panel().icon ?? null },
    { label: 'Theme', value: themeText(panel()) },
    { label: 'Default role', value: panel().defaultRoleId ?? null },
    { label: 'Views', value: String(panel().views.length) },
    { label: 'Menu items', value: String(panel().menu.length) },
    { label: 'Roles', value: String(panel().roles.length) },
    { label: 'Members', value: String(panel().members.length) },
  ])

  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.sectionTitle)}>Properties</div>
      <div {...stylex.props(styles.propsGrid)}>
        <For each={propsRows()}>
          {(row) => (
            <>
              <span {...stylex.props(styles.propLabel)}>{row.label}</span>
              <span {...stylex.props(styles.propValue)}>
                <Show
                  when={row.value}
                  fallback={<span {...stylex.props(styles.dim)}>—</span>}
                >
                  <Show when={row.label === 'Icon' && row.value}>
                    <span {...stylex.props(styles.iconWrap)}>
                      <CollectionIcon name={row.value!} size={14} />
                    </span>
                  </Show>
                  <Show when={row.label === 'Id' || row.label === 'Default role'}>
                    <span {...stylex.props(styles.mono)}>{row.value}</span>
                  </Show>
                  <Show when={row.label !== 'Id' && row.label !== 'Default role' && row.label !== 'Icon'}>
                    <span>{row.value}</span>
                  </Show>
                </Show>
              </span>
            </>
          )}
        </For>
      </div>

      <div {...stylex.props(styles.divider)} />
      <div {...stylex.props(styles.sectionTitle)}>Views · {panel().views.length}</div>
      <div {...stylex.props(styles.tableScroll)}>
        <table {...stylex.props(styles.table)}>
          <thead>
            <tr>
              <th {...stylex.props(styles.th)}>View</th>
              <th {...stylex.props(styles.th)}>Kind</th>
              <th {...stylex.props(styles.th)}>Path</th>
              <th {...stylex.props(styles.th)}>Source</th>
              <th {...stylex.props(styles.th)}>Access</th>
            </tr>
          </thead>
          <tbody>
            <For each={panel().views}>
              {(view) => (
                <tr>
                  <td {...stylex.props(styles.td)}>
                    <div {...stylex.props(styles.stacked)}>
                      <span>{view.label}</span>
                      <span {...stylex.props(styles.sub, styles.mono)}>{view.id}</span>
                    </div>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <KindChip kind={view.kind} />
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <span {...stylex.props(styles.mono)}>{view.path}</span>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <div {...stylex.props(styles.stacked)}>
                      <span {...stylex.props(styles.mono)}>
                        {viewCollection(view) ?? viewMetrics(view)}
                      </span>
                      <Show when={view.defaultSort}>
                        <span {...stylex.props(styles.sub)}>
                          sort: {view.defaultSort!.field} {view.defaultSort!.direction}
                        </span>
                      </Show>
                    </div>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <div {...stylex.props(styles.stacked)}>
                      <div>
                        <For each={fieldAccess(view)}>
                          {(fl) => <Flag label={fl.label} tone={fl.tone} />}
                        </For>
                      </div>
                      <Show when={view.filters.length > 0}>
                        <span {...stylex.props(styles.sub)}>filters: {viewFilters(view)}</span>
                      </Show>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={panel().menu.length > 0}>
        <div {...stylex.props(styles.divider)} />
        <div {...stylex.props(styles.sectionTitle)}>Menu · {panel().menu.length}</div>
        <div {...stylex.props(styles.tableScroll)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>Label</th>
                <th {...stylex.props(styles.th)}>Path</th>
                <th {...stylex.props(styles.th)}>View</th>
                <th {...stylex.props(styles.th)}>Icon</th>
              </tr>
            </thead>
            <tbody>
              <For each={panel().menu}>
                {(item) => (
                  <tr>
                    <td {...stylex.props(styles.td)}>{item.label}</td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.mono)}>{item.path}</span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.mono)}>{item.viewId}</span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <Show
                        when={item.icon}
                        fallback={<span {...stylex.props(styles.dim)}>—</span>}
                      >
                        <span {...stylex.props(styles.mono)}>{item.icon}</span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <div {...stylex.props(styles.divider)} />
      <div {...stylex.props(styles.sectionTitle)}>Roles · {panel().roles.length}</div>
      <div {...stylex.props(styles.tableScroll)}>
        <table {...stylex.props(styles.table)}>
          <thead>
            <tr>
              <th {...stylex.props(styles.th)}>Role</th>
              <th {...stylex.props(styles.th)}>Views</th>
              <th {...stylex.props(styles.th)}>Read fields</th>
              <th {...stylex.props(styles.th)}>Write fields</th>
            </tr>
          </thead>
          <tbody>
            <For each={panel().roles}>
              {(role) => (
                <tr>
                  <td {...stylex.props(styles.td)}>
                    <div {...stylex.props(styles.stacked)}>
                      <span>{role.label}</span>
                      <span {...stylex.props(styles.sub, styles.mono)}>{role.id}</span>
                    </div>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <div {...stylex.props(styles.stacked)}>
                      <span>
                        {role.views.length === 0
                          ? '—'
                          : role.views
                              .map((v) => `${v.viewId} (${v.operations.join('/')})`)
                              .join(', ')}
                      </span>
                      <Show when={panel().defaultRoleId === role.id}>
                        <span {...stylex.props(styles.sub)}>default role</span>
                      </Show>
                    </div>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <span {...stylex.props(styles.mono)}>
                      {role.views.length === 0
                        ? '—'
                        : role.views
                            .map((v) => (v.readFields ? listText(v.readFields) : 'all'))
                            .filter((t, i, a) => a.indexOf(t) === i)
                            .join(', ')}
                    </span>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <span {...stylex.props(styles.mono)}>
                      {role.views.length === 0
                        ? '—'
                        : role.views
                            .map((v) => (v.writeFields ? listText(v.writeFields) : 'all'))
                            .filter((t, i, a) => a.indexOf(t) === i)
                            .join(', ')}
                    </span>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show
        when={panel().members.length > 0}
        fallback={<div {...stylex.props(styles.emptyRow)}>No members assigned to this panel yet.</div>}
      >
        <div {...stylex.props(styles.divider)} />
        <div {...stylex.props(styles.sectionTitle)}>Members · {panel().members.length}</div>
        <div {...stylex.props(styles.tableScroll)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>User</th>
                <th {...stylex.props(styles.th)}>Role</th>
                <th {...stylex.props(styles.th)}>Attributes</th>
              </tr>
            </thead>
            <tbody>
              <For each={panel().members}>
                {(member) => (
                  <tr>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.mono)}>{member.userId}</span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.mono)}>{member.roleId}</span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.mono)}>
                        {memberAttributes(member.attributes)}
                      </span>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  )
}
