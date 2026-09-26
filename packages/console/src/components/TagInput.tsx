import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { XIcon } from './Icons'

const styles = stylex.create({
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '6px 8px',
    minHeight: 38,
    backgroundColor: tokens.surfaceRaised,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowInput}`,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus-within': {
      boxShadow: `0 0 0 1px ${tokens.accentSoft}, ${tokens.shadowInputFocus}`,
    },
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.accent,
    backgroundColor: tokens.accentBold,
    boxShadow: `inset 0 0 0 1px ${tokens.accentBold}`,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
  },
  chipRemove: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.accent,
    cursor: 'pointer',
    borderRadius: '50%',
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.borderStrong },
  },
  input: {
    flex: 1,
    minWidth: 90,
    borderStyle: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: 13,
    color: tokens.text,
    padding: '2px 0',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadow}`,
    borderRadius: tokens.radius,
    maxHeight: 200,
    overflow: 'auto',
  },
  wrapper: {
    position: 'relative',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 10px',
    fontSize: 13,
    color: tokens.text,
    cursor: 'pointer',
    transition: 'background-color 0.12s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  empty: {
    padding: '10px 10px',
    fontSize: 12,
    color: tokens.textDim,
  },
  hint: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
  },
})

export function TagInput(props: {
  value: () => string[]
  onChange: (tags: string[]) => void
  suggestions?: () => string[]
}) {
  const [query, setQuery] = createSignal('')
  const [open, setOpen] = createSignal(false)

  const tags = () => props.value()

  const normalized = () => query().trim().replace(/,$/, '')

  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '')
    if (!t) return
    const next = [...new Set([...tags(), t])].slice(0, 30)
    props.onChange(next)
    setQuery('')
  }

  const remove = (t: string) => {
    props.onChange(tags().filter((x) => x !== t))
  }

  const suggestions = () => {
    const q = normalized().toLowerCase()
    const current = new Set(tags())
    return (props.suggestions?.() ?? []).filter((t) => !current.has(t) && (!q || t.toLowerCase().includes(q)))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(normalized())
    } else if (e.key === 'Backspace' && normalized() === '' && tags().length > 0) {
      remove(tags()[tags().length - 1]!)
    }
  }

  return (
    <div {...stylex.props(styles.wrapper)}>
      <div {...stylex.props(styles.chips)}>
        <For each={tags()}>
          {(t) => (
            <span {...stylex.props(styles.chip)}>
              <span>{t}</span>
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => remove(t)}
                {...stylex.props(styles.chipRemove)}
              >
                <XIcon size={10} />
              </button>
            </span>
          )}
        </For>
        <input
          type="text"
          placeholder={tags().length === 0 ? 'Type a tag, press Enter…' : ''}
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          {...stylex.props(styles.input)}
        />
      </div>
      <Show when={open() && suggestions().length > 0}>
        <div {...stylex.props(styles.dropdown)}>
          <For each={suggestions()}>
            {(t) => (
              <div
                {...stylex.props(styles.option)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(t)
                }}
              >
                {t}
              </div>
            )}
          </For>
        </div>
      </Show>
      <p {...stylex.props(styles.hint)}>Enter adds a tag; existing tags appear as suggestions.</p>
    </div>
  )
}