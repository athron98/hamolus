import { createEffect, createSignal, For, on } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { FieldDefinition } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { LexicalEditor, type LexicalValue } from './LexicalEditor'
import { MarkdownEditor } from './MarkdownEditor'

const styles = stylex.create({
  tabs: {
    display: 'flex',
    gap: 2,
    marginBottom: 6,
  },
  tab: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': {
      color: tokens.text,
      backgroundColor: tokens.surfaceRaised,
    },
  },
  tabActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  missing: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
  },
})

function displayValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined) return ''
  switch (field.type) {
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    case 'datetime':
      return String(value).slice(0, 16)
    default:
      return String(value)
  }
}

function LangInput(props: {
  field: FieldDefinition
  getValue: () => LexicalValue
  onChange: (val: string) => void
}) {
  const { field, getValue, onChange } = props
  const ft = field.type

  if (ft === 'richtext') {
    if (field.format === 'markdown' || field.format === 'mdx') {
      return (
        <MarkdownEditor
          value={() => String(getValue() ?? '')}
          onChange={onChange}
          mode={field.format}
          placeholder="Start typing markdown…"
        />
      )
    }
    return <LexicalEditor value={getValue} onChange={onChange} placeholder="Start typing…" />
  }

  if (ft === 'text') {
    return (
      <textarea
        {...stylex.props(s.textarea)}
        value={String(getValue() ?? '')}
        onInput={(e) => onChange(e.currentTarget.value)}
      />
    )
  }

  return (
    <input
      type={ft === 'email' ? 'email' : ft === 'url' ? 'url' : 'text'}
      {...stylex.props(s.input)}
      value={String(getValue() ?? '')}
      onInput={(e) => onChange(e.currentTarget.value)}
    />
  )
}

export function LocalizedInput(props: {
  field: FieldDefinition
  value: () => unknown
  onChange: (value: unknown) => void
  languages: string[]
  initialLocale?: string
}) {
  const { field, onChange, languages } = props
  const current = () => (props.value() as Record<string, LexicalValue>) ?? {}
  const [activeLang, setActiveLang] = createSignal(
    props.initialLocale && languages.includes(props.initialLocale)
      ? props.initialLocale
      : languages[0] ?? 'en',
  )

  createEffect(
    on(() => props.initialLocale, (loc) => {
      if (loc && languages.includes(loc)) setActiveLang(loc)
    }),
  )

  const setLangValue = (l: string, val: string) => {
    const obj = { ...current(), [l]: val }
    onChange(obj)
  }

  return (
    <div>
      <div {...stylex.props(styles.tabs)}>
        <For each={languages}>
          {(l) => (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setActiveLang(l)
              }}
              {...stylex.props(styles.tab, activeLang() === l && styles.tabActive)}
            >
              {l}
            </button>
          )}
        </For>
      </div>
      <For each={[activeLang()]}>
        {(lang) => (
          <LangInput
            field={field}
            getValue={() => current()[lang] ?? ''}
            onChange={(val) => setLangValue(lang, val)}
          />
        )}
      </For>
    </div>
  )
}

export function getLocalizedPreview(value: unknown, languages: string[]): string {
  if (!value || typeof value !== 'object') return String(value ?? '')
  const obj = value as Record<string, string>
  const parts = languages.map((lang) => `${lang}: ${obj[lang] ?? '—'}`)
  return parts.join(' | ')
}
