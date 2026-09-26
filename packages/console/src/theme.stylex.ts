import * as stylex from '@stylexjs/stylex'

/**
 * Core design tokens. Values are CSS custom properties driven from `index.css`:
 * `html[data-mode]` (dark/light) picks the mode and `html[data-theme]`
 * (16 palettes, see index.css) a full palette — a theme repaints surfaces, text
 * AND accent at once, and each palette works in both modes. Switching either
 * re-themes the app live; the surface colors are registered as `<color>` so the
 * change cross-fades smoothly. Radius is "small" (6–8px) with shadow-based input
 * depth (no visible borders).
 */
export const tokens = stylex.defineVars({
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceRaised: 'var(--surface-2)',
  surfaceDeep: 'var(--surface-3)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text)',
  textDim: 'var(--text-dim)',
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  accentBold: 'color-mix(in srgb, var(--accent) 26%, transparent)',
  accentFill: 'color-mix(in srgb, var(--accent) 48%, var(--surface))',
  focusRing: 'var(--focus-ring)',
  danger: 'var(--danger)',
  dangerSoft: 'var(--danger-soft)',
  ok: 'var(--ok)',
  okSoft: 'var(--ok-soft)',
  radius: 'var(--radius)',
  radiusSm: 'var(--radius-sm)',
  shadow: 'var(--shadow)',
  shadowSm: 'var(--shadow-sm)',
  shadowInput: 'var(--shadow-input)',
  shadowInputFocus: 'var(--shadow-input-focus)',
  shadowCard: 'var(--shadow-card)',
  shadowCardHover: 'var(--shadow-card-hover)',
  fontMono: 'var(--font-mono)',
  fontSans: 'var(--font-sans)',
  sheetTop: 'var(--sheet-top)',
})

export const fadeUp = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

export const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

const focusRing = {
  outline: 'none',
  boxShadow: `0 0 0 3px ${tokens.focusRing}`,
}

const shadowBtn = '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)'
const shadowBtnHover = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)'
const spring = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const smooth = 'cubic-bezier(0.4, 0, 0.2, 1)'

export const s = stylex.create({
  page: {
    color: tokens.text,
    fontFamily: tokens.fontSans,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    animationName: fadeUp,
    animationDuration: '0.22s',
    animationTimingFunction: smooth,
    animationFillMode: 'both',
    '@media (max-width: 900px)': {
      gap: 12,
    },
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    margin: 0,
  },
  subheading: {
    fontSize: 13,
    color: tokens.textDim,
    margin: '4px 0 0',
  },
  surface: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
    transition: `background-color 0.22s ${smooth}, box-shadow 0.22s ${smooth}`,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.18s ${smooth}, background-color 0.2s ${smooth}, color 0.2s ${smooth}`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  select: {
    width: '100%',
    padding: '8px 28px 8px 12px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2398a1b4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    transition: `box-shadow 0.18s ${smooth}, background-color 0.2s ${smooth}, color 0.2s ${smooth}`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: tokens.textDim,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
  },
  textarea: {
    width: '100%',
    minHeight: 120,
    padding: 8,
    fontSize: 13,
    fontFamily: tokens.fontMono,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.18s ${smooth}, background-color 0.2s ${smooth}, color 0.2s ${smooth}`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
  },
  muted: {
    color: tokens.textDim,
    fontSize: 13,
  },
  badge: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: tokens.radiusSm,
    boxShadow: `0 0 0 1px ${tokens.borderStrong}`,
    color: tokens.textDim,
  },
  /* Unified button system — text buttons (accent fill) */
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 600,
    color: tokens.accent,
    backgroundColor: tokens.accentFill,
    borderStyle: 'none',
    borderRadius: tokens.radius,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: shadowBtn,
    transition: `background-color 0.16s ${smooth}, color 0.16s ${smooth}, filter 0.16s ${smooth}, transform 0.16s ${spring}, box-shadow 0.16s ${smooth}`,
    ':hover': {
      filter: 'brightness(1.1)',
      transform: 'translateY(-1px)',
      boxShadow: shadowBtnHover,
    },
    ':focus-visible': focusRing,
    ':active': { transform: 'translateY(0) scale(0.97)' },
    ':disabled': { opacity: 0.5, cursor: 'default', transform: 'none', boxShadow: 'none', filter: 'none' },
  },
  /* Secondary text buttons — ghost (transparent, thin hairline border) */
  btnGhost: {
    backgroundColor: 'transparent',
    color: tokens.textDim,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    boxShadow: 'none',
    ':hover': {
      color: tokens.accent,
      backgroundColor: tokens.accentSoft,
      transform: 'translateY(-1px)',
      boxShadow: shadowBtnHover,
    },
  },
  btnDanger: {
    backgroundColor: 'transparent',
    color: tokens.danger,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    boxShadow: 'none',
    ':hover': { backgroundColor: tokens.dangerSoft, transform: 'translateY(-1px)', boxShadow: shadowBtnHover },
  },
  /* Unified button system — icon/square buttons (ghost style) */
  btnIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 30,
    height: 30,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    color: tokens.textDim,
    cursor: 'pointer',
    borderRadius: tokens.radius,
    boxShadow: 'none',
    transition: `color 0.15s ${smooth}, background-color 0.15s ${smooth}, border-color 0.15s ${smooth}, transform 0.15s ${spring}, box-shadow 0.15s ${smooth}`,
    ':hover': {
      color: tokens.accent,
      backgroundColor: tokens.accentSoft,
      transform: 'translateY(-1px)',
      boxShadow: shadowBtnHover,
    },
    ':focus-visible': focusRing,
    ':active': { transform: 'translateY(0) scale(0.94)' },
    ':disabled': { opacity: 0.45, cursor: 'default', transform: 'none' },
  },
  btnIconSm: {
    width: 26,
    height: 26,
  },
  btnIconDanger: {
    color: tokens.danger,
    ':hover': {
      color: tokens.danger,
      backgroundColor: tokens.dangerSoft,
      borderColor: tokens.danger,
      transform: 'translateY(-1px)',
      boxShadow: shadowBtnHover,
    },
  },
})
