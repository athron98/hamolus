import { A, useLocation, useNavigate } from '@solidjs/router'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { JSX } from 'solid-js/jsx-runtime'
import type { CollectionDefinition, GroupTreeNode, PanelDefinition } from '@hamolus/types'
import { buildGroupTree } from '@hamolus/types'
import type { ConsolePlugin } from '../plugins/types'
import { s, tokens } from '../theme.stylex'
import { useCollections } from '../hooks/collections'
import { PLUGINS, pluginById } from '../plugins/registry'
import { useGroups } from '../hooks/groups'
import { usePanels } from '../hooks/panels'
import { activeEndpoint, addEndpoint, activeUrl, endpoints, removeEndpoint, renameEndpoint, setEndpoint, storeToken } from '../lib/store'
import { clearRecordCaches } from '../lib/cache'
import { clearSession, hasPermission, user } from '../lib/session'
import { FONTS, THEMES, applyFont, applyMode, applyPalette, font, isDark, mode, palette } from '../lib/theme'
import {
  container,
  navAutoHide,
  navMode,
  pinned,
  setNavAutoHide,
  setNavMode,
  toggleContainer,
  togglePin,
} from '../lib/prefs'
import { locale, setLocale } from '../lib/locale'
import { api } from '../lib/api'
import {
  BracesIcon,
  CheckIcon,
  ChevronDownIcon,
  CollectionIcon,
  ContainerIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  GridIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LogoutIcon,
  MenuIcon,
  MoonIcon,
  PanelLeftIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  PuzzleIcon,
  SlidersIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from './Icons'

function contrastOn(hex: string): string {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.5 ? 'rgba(18, 20, 27, 0.92)' : '#ffffff'
}

const GROUPS_KEY = 'console-nav-groups'

function loadCollapsedGroups(): string[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

const paletteIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

const sidebarIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateX(-4px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
})

const styles = stylex.create({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tokens.bg,
    backgroundImage: `radial-gradient(1200px 560px at 16% -8%, ${tokens.accentSoft}, transparent 55%)`,
    transition: 'background-color 0.2s ease, background-image 0.2s ease',
  },
  bodyRow: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  navbar: {
    position: 'relative',
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px 6px 8px',
    backgroundColor: tokens.surface,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    transition: `background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1)`,
  },
  navbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  popAnchor: {
    position: 'relative',
  },
  navShortcut: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 700,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
    '@media (max-width: 900px)': {
      padding: '4px 6px',
      fontSize: 11,
    },
  },
  navShortcutActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  pluginRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  pluginLink: {
    flex: 1,
    minWidth: 0,
  },
  pluginPin: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 22,
    height: 22,
    padding: 0,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    backgroundColor: 'transparent',
    color: tokens.textDim,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.accent, backgroundColor: tokens.accentSoft },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  pluginPinActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  menuBtn: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 34,
    height: 34,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.textDim,
    cursor: 'pointer',
    borderRadius: tokens.radius,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':active': { transform: 'scale(0.95)' },
    ':focus-visible': {
      outline: 'none',
      backgroundColor: tokens.surfaceRaised,
    },
    '@media (max-width: 900px)': {
      display: 'inline-flex',
    },
  },
  scrim: {
    display: 'none',
    position: 'fixed',
    inset: 0,
    zIndex: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    '@media (max-width: 900px)': {
      display: 'block',
    },
  },
  sidebar: {
    width: 232,
    backgroundColor: tokens.surface,
    boxShadow: `inset -1px 0 0 0 ${tokens.border}`,
    display: 'flex',
    flexDirection: 'column',
    padding: 18,
    gap: 2,
    flexShrink: 0,
    overflow: 'auto',
    transition: `background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1)`,
    animationName: sidebarIn,
    animationDuration: '0.22s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
    '@media (max-width: 900px)': {
      animationName: 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      width: 280,
      maxWidth: '85vw',
      margin: 0,
      zIndex: 50,
      boxShadow: `inset -1px 0 0 0 ${tokens.borderStrong}, ${tokens.shadow}`,
      transition:
        'transform 0.22s cubic-bezier(0.34, 1.2, 0.64, 1), background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  sidebarHidden: {
    '@media (max-width: 900px)': {
      transform: 'translateX(-100%)',
    },
  },
  sidebarAutoBase: {
    minWidth: 0,
    transition:
      'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), padding 0.22s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  sidebarIconRail: {
    '@media (min-width: 901px)': {
      width: 56,
      padding: '16px 9px',
    },
  },
  railHide: {
    '@media (min-width: 901px)': {
      display: 'none',
    },
  },
  railLink: {
    '@media (min-width: 901px)': {
      justifyContent: 'center',
      padding: '7px 0',
    },
  },
  railGroupHeader: {
    '@media (min-width: 901px)': {
      justifyContent: 'center',
      gap: 0,
      padding: '5px 0',
    },
  },
  gutter: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: 6,
    zIndex: 20,
    cursor: 'pointer',
    backgroundColor: tokens.accentBold,
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.accent },
    '@media (max-width: 900px)': {
      display: 'none',
    },
  },
  switchTrack: {
    position: 'relative',
    flexShrink: 0,
    width: 32,
    height: 18,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.surfaceRaised,
    transition: 'background-color 0.18s ease',
  },
  switchTrackOn: {
    backgroundColor: tokens.accent,
  },
  switchKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 14,
    height: 14,
    borderRadius: '50%',
    backgroundColor: tokens.text,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
    transition: 'transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1)',
  },
  switchKnobOn: {
    transform: 'translateX(14px)',
  },
  brand: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: tokens.text,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease',
    ':hover': { opacity: 0.7 },
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: tokens.radiusSm,
    fontSize: 13,
    color: tokens.textDim,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  navLinkActive: {
    color: tokens.text,
    backgroundColor: tokens.surfaceRaised,
  },
  badge: {
    marginLeft: 'auto',
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
  },
  navDivider: {
    height: 14,
    margin: '0 2px',
  },
  groupWrap: {
    width: '100%',
    backgroundColor: 'transparent',
    marginBottom: 6,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '5px 8px',
    backgroundColor: 'transparent',
    outline: 'none',
    color: tokens.textDim,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    borderRadius: tokens.radiusSm,
    borderStyle: 'none',
    userSelect: 'none',
    transition:
      'color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':focus-visible': { backgroundColor: tokens.surfaceRaised },
  },
  groupHeaderOpen: {
    backgroundColor: tokens.accentSoft,
    color: tokens.accent,
    boxShadow: `0 0 0 1px ${tokens.accentBold}`,
    ':hover': { backgroundColor: tokens.accentSoft },
  },
  groupLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    backgroundColor: 'transparent',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    transition: 'color 0.18s ease',
  },
  groupLabelOpen: {
    color: tokens.accent,
  },
  groupCount: {
    fontSize: 10,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
    transition: 'color 0.18s ease',
  },
  groupCountOpen: {
    color: tokens.accent,
  },
  groupChevron: {
    display: 'inline-flex',
    transition:
      'transform 0.16s cubic-bezier(0.34, 1.4, 0.64, 1), color 0.18s ease',
  },
  groupChevronCollapsed: {
    transform: 'rotate(-90deg)',
  },
  groupChevronOpen: {
    color: tokens.accent,
  },
  groupBody: {
    display: 'grid',
    gridTemplateRows: '1fr',
    transition: 'grid-template-rows 0.16s ease',
    marginLeft: 8,
    marginRight: 2,
  },
  groupBodyCollapsed: {
    gridTemplateRows: '0fr',
  },
  groupBodyInner: {
    overflow: 'hidden',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    opacity: 1,
    transition: 'opacity 0.14s ease',
  },
  groupBodyInnerCollapsed: {
    opacity: 0,
  },
  navLinkActiveGroupItem: {
    color: tokens.text,
    backgroundColor: tokens.surfaceRaised,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    minWidth: 0,
  },
  mainInner: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    padding: '28px 32px 40px',
    '@media (max-width: 900px)': {
      padding: '16px',
    },
  },
  mainContainer: {
    maxWidth: 1216,
    margin: '0 auto',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 30,
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 240,
    zIndex: 31,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadow}`,
    borderRadius: tokens.radius,
    padding: 12,
    animationName: paletteIn,
    animationDuration: '0.14s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
  popoverTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
    marginBottom: 8,
  },
  section: {
    marginBottom: 12,
  },
  seg: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    padding: 3,
  },
  segBtn: {
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
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  segActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  swatchRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    justifyItems: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    borderStyle: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    padding: 0,
    transition:
      'transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': { transform: 'scale(1.18)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  swatchActive: {
    boxShadow: `0 0 0 1px ${tokens.surface}, 0 0 0 2px ${tokens.accent}`,
  },
  fontRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
  },
  fontBtn: {
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  fontBtnActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  localeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
  },
  localeActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  endpointBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 700,
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    '@media (max-width: 900px)': {
      maxWidth: 96,
    },
  },
  endpointRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    padding: '7px 8px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.text,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  endpointRowWrap: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  endpointRowWrapInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  endpointRename: {
    minWidth: 0,
    flex: 1,
  },
  endpointAddWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  endpointAdd: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  endpointRowActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  endpointRowLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  endpointRowLand: {
    flex: 'none',
    fontSize: 9,
    fontFamily: tokens.fontMono,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderRadius: tokens.radiusSm,
    padding: '1px 4px',
  },
  endpointRowUrl: {
    flex: 'none',
    fontSize: 10,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
  },
  endpointRemove: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 20,
    height: 20,
    padding: 0,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
  },
  endpointAddBtn: {
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.accentBold },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  endpointEmpty: {
    fontSize: 12,
    color: tokens.textDim,
    padding: '2px 4px',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.text,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  optionRowValue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontFamily: tokens.fontMono,
    fontWeight: 700,
    color: tokens.textDim,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 'auto',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    boxShadow: `inset 0 1px 0 0 ${tokens.border}`,
  },
  footerText: {
    fontSize: 12,
    color: tokens.textDim,
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    padding: '3px 8px 3px 4px',
    borderRadius: tokens.radius,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.textDim,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
    '@media (max-width: 900px)': {
      maxWidth: 110,
    },
  },
  userAvatar: {
    width: 24,
    height: 24,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    fontSize: 10,
    fontWeight: 800,
  },
  userText: {
    minWidth: 0,
    textAlign: 'left',
  },
  userName: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    display: 'block',
    fontSize: 10,
    color: tokens.textDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userPopLabel: {
    fontSize: 11,
    color: tokens.textDim,
  },
  groupChild: {
    paddingLeft: 10,
  },
})

/** Total collections inside a subtree (direct members + all descendants). */
function countCollections(node: GroupTreeNode): number {
  return node.collections.length + node.children.reduce((a, c) => a + countCollections(c), 0)
}

type SidebarGroupProps = {
  node: GroupTreeNode
  collapsed: () => string[]
  toggleGroup: (id: string) => void
  navMode: () => 'full' | 'icons'
  counts: () => Record<string, number>
  isActive: (name: string) => boolean
}

// Recursive sidebar group: header (collapsible) + nested child groups and direct member links.
function SidebarGroup(props: SidebarGroupProps) {
  const id = createMemo(() => props.node.id)
  const isOpen = createMemo(() => !props.collapsed().includes(id()))
  const count = createMemo(() => countCollections(props.node))
  return (
    <div {...stylex.props(styles.groupWrap)}>
      <button
        type="button"
        onClick={() => props.toggleGroup(id())}
        aria-expanded={isOpen()}
        title={props.navMode() === 'icons' ? props.node.label : undefined}
        {...stylex.props(
          styles.groupHeader,
          isOpen() && styles.groupHeaderOpen,
          props.navMode() === 'icons' && styles.railGroupHeader,
        )}
      >
        <span
          {...stylex.props(
            styles.groupLabel,
            isOpen() && styles.groupLabelOpen,
            props.navMode() === 'icons' && styles.railHide,
          )}
        >
          {props.node.label}
        </span>
        <span
          {...stylex.props(
            styles.groupCount,
            isOpen() && styles.groupCountOpen,
            props.navMode() === 'icons' && styles.railHide,
          )}
        >
          {count()}
        </span>
        <span
          {...stylex.props(
            styles.groupChevron,
            isOpen() && styles.groupChevronOpen,
            !isOpen() && styles.groupChevronCollapsed,
          )}
        >
          <ChevronDownIcon size={12} />
        </span>
      </button>
      <div
        {...stylex.props(
          styles.groupBody,
          !isOpen() && styles.groupBodyCollapsed,
        )}
      >
        <div
          {...stylex.props(
            styles.groupBodyInner,
            !isOpen() && styles.groupBodyInnerCollapsed,
          )}
        >
          <For each={props.node.children}>
            {(child) => (
              <div {...stylex.props(styles.groupChild)}>
                <SidebarGroup
                  node={child}
                  collapsed={props.collapsed}
                  toggleGroup={props.toggleGroup}
                  navMode={props.navMode}
                  counts={props.counts}
                  isActive={props.isActive}
                />
              </div>
            )}
          </For>
          <For each={props.node.collections}>
            {(c) => (
              <A
                href={`/collections/${c.name}`}
                title={`${c.label} (${props.counts()[c.name] ?? 0} records)`}
                {...stylex.props(
                  styles.navLink,
                  props.navMode() === 'icons' && styles.railLink,
                  props.isActive(c.name) && styles.navLinkActiveGroupItem,
                )}
              >
                <CollectionIcon name={c.icon} size={14} />
                <span {...stylex.props(props.navMode() === 'icons' && styles.railHide)}>
                  {c.label}
                </span>
                <span
                  {...stylex.props(styles.badge, props.navMode() === 'icons' && styles.railHide)}
                >
                  {props.counts()[c.name] ?? 0}
                </span>
              </A>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

type BuiltinGroupProps = {
  id: string
  label: string
  count: number
  collapsed: () => string[]
  toggleGroup: (id: string) => void
  navMode: () => 'full' | 'icons'
  children: JSX.Element
}

// Built-in (non-collection) sidebar group: header + collapsible body, same chrome as SidebarGroup.
function BuiltinGroup(props: BuiltinGroupProps) {
  const id = createMemo(() => props.id)
  const isOpen = createMemo(() => !props.collapsed().includes(id()))
  return (
    <div {...stylex.props(styles.groupWrap)}>
      <button
        type="button"
        onClick={() => props.toggleGroup(id())}
        aria-expanded={isOpen()}
        title={props.navMode() === 'icons' ? props.label : undefined}
        {...stylex.props(
          styles.groupHeader,
          isOpen() && styles.groupHeaderOpen,
          props.navMode() === 'icons' && styles.railGroupHeader,
        )}
      >
        <span
          {...stylex.props(
            styles.groupLabel,
            isOpen() && styles.groupLabelOpen,
            props.navMode() === 'icons' && styles.railHide,
          )}
        >
          {props.label}
        </span>
        <span
          {...stylex.props(
            styles.groupCount,
            isOpen() && styles.groupCountOpen,
            props.navMode() === 'icons' && styles.railHide,
          )}
        >
          {props.count}
        </span>
        <span
          {...stylex.props(
            styles.groupChevron,
            isOpen() && styles.groupChevronOpen,
            !isOpen() && styles.groupChevronCollapsed,
          )}
        >
          <ChevronDownIcon size={12} />
        </span>
      </button>
      <div
        {...stylex.props(
          styles.groupBody,
          !isOpen() && styles.groupBodyCollapsed,
        )}
      >
        <div
          {...stylex.props(
            styles.groupBodyInner,
            !isOpen() && styles.groupBodyInnerCollapsed,
          )}
        >
          {props.children}
        </div>
      </div>
    </div>
  )
}

export function Layout(props: { children?: JSX.Element }) {
  const collections = useCollections()
  const groupDefs = useGroups()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = createSignal<string[]>(loadCollapsedGroups())
  const [paletteOpen, setPaletteOpen] = createSignal(false)
  const [localeOpen, setLocaleOpen] = createSignal(false)
  const [endpointOpen, setEndpointOpen] = createSignal(false)
  const [newEndpoint, setNewEndpoint] = createSignal('')
  const [newEndpointName, setNewEndpointName] = createSignal('')
  const [newEndpointLand, setNewEndpointLand] = createSignal('')
  const [renameUrl, setRenameUrl] = createSignal<string | null>(null)
  const [renameValue, setRenameValue] = createSignal('')
  const [sideOpen, setSideOpen] = createSignal(false)
  const [navOpen, setNavOpen] = createSignal(false)
  const [navPeek, setNavPeek] = createSignal(false)
  const [languages, setLanguages] = createSignal<string[]>([])
  const [counts, setCounts] = createSignal<Record<string, number>>({})
  const [desktop, setDesktop] = createSignal<boolean>(false)
  const [userOpen, setUserOpen] = createSignal(false)

  createEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 901px)')
    const apply = () => setDesktop(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    onCleanup(() => mq.removeEventListener('change', apply))
  })

  const autoOn = createMemo(() => navAutoHide() && desktop())

  let hideTimer: ReturnType<typeof setTimeout> | undefined
  const revealNav = () => {
    clearTimeout(hideTimer)
    setNavPeek(true)
  }
  const scheduleNavHide = () => {
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => setNavPeek(false), 400)
  }

  onMount(async () => {
    try {
      const { data } = await api.getSettings()
      const loc = data.localization
      if (loc && typeof loc === 'object' && 'languages' in loc) {
        const langs = (loc as Record<string, unknown>).languages
        if (Array.isArray(langs) && langs.every((l) => typeof l === 'string')) {
          setLanguages(langs as string[])
          if (!langs.includes(locale())) setLocale(langs[0] as string)
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const { data } = await api.getStats()
      setCounts(Object.fromEntries(data.perCollection.map((c) => [c.name, c.count])))
    } catch {
      /* ignore */
    }
  })

  createEffect(on(() => location.pathname, () => {
    setNavOpen(false)
    setNavPeek(false)
  }))

  createEffect(() => {
    document.body.style.overflow = navOpen() ? 'hidden' : ''
  })

  const isActive = (name: string) =>
    location.pathname === `/collections/${name}` ||
    location.pathname.startsWith(`/collections/${name}/`)

  const all = () => collections.data ?? []
  const ungrouped = () => {
    const seen = new Set<string>()
    return all().filter((c) => !c.group && (seen.has(c.name) ? false : (seen.add(c.name), true)))
  }
  const tree = createMemo(() => buildGroupTree(groupDefs.data ?? [], all()))
  const pinnedPins = createMemo(() => {
    const seen = new Set<string>()
    const out: CollectionDefinition[] = []
    for (const n of pinned()) {
      const c = all().find((x) => x.name === n)
      if (c && !seen.has(c.name)) {
        seen.add(c.name)
        out.push(c)
      }
    }
    return out
  })
  const pinnedPlugins = createMemo(() => {
    const collNames = new Set(pinnedPins().map((c) => c.name))
    const seen = new Set<string>()
    const out: ConsolePlugin[] = []
    for (const n of pinned()) {
      if (collNames.has(n)) continue
      const p = pluginById(n)
      if (p && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  })
  const panelsQuery = usePanels()
  const panelList = createMemo(() => {
    const seen = new Set<string>()
    return (panelsQuery.data ?? []).filter((p) =>
      seen.has(p.id) ? false : (seen.add(p.id), true),
    )
  })
  const pinnedPanels = createMemo(() => {
    const taken = new Set([
      ...pinnedPins().map((c) => c.name),
      ...pinnedPlugins().map((p) => p.id),
    ])
    const seen = new Set<string>()
    const out: PanelDefinition[] = []
    for (const n of pinned()) {
      if (taken.has(n)) continue
      const p = panelList().find((x) => x.id === n)
      if (p && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  })

  // Reserved collapse ids for the built-in nav groups (hyphen can never appear
  // in a collection group id, so they can't collide with the registry).
  const BUCKET_GROUP = 'app-bucket'
  const ENV_GROUP = 'app-environment'
  const PLUGINS_GROUP = 'app-plugins'
  const PANELS_GROUP = 'app-panels'

  const envMs = createMemo(() => {
    const m: { id: string; href: string; title: string; label: string; icon: JSX.Element }[] = []
    if (hasPermission('lands.read')) {
      m.push({ id: 'lands', href: '/universe', title: 'Universe', label: 'Universe', icon: <GlobeIcon size={15} /> })
    }
    if (hasPermission('config.read')) {
      m.push({ id: 'config', href: '/config', title: 'Configuration', label: 'Config', icon: <BracesIcon size={15} /> })
    }
    if (hasPermission('users.read')) {
      m.push({ id: 'users', href: '/users', title: 'Users', label: 'Users', icon: <UsersIcon size={15} /> })
    }
    if (hasPermission('settings.write')) {
      m.push({ id: 'seed', href: '/seed', title: 'Seed', label: 'Seed', icon: <DownloadIcon size={15} /> })
    }
    return m
  })

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const logout = () => {
    clearSession()
    storeToken(null)
    setUserOpen(false)
    navigate('/')
  }

  const switchEndpoint = (url: string) => {
    if (url === activeUrl()) {
      setEndpointOpen(false)
      return
    }
    setEndpoint(url)
    clearRecordCaches()
    setEndpointOpen(false)
    window.location.reload()
  }

  const addAndSwitchEndpoint = (raw: string, label?: string, landValue?: string) => {
    const url = raw.trim()
    if (!url) return
    addEndpoint(url, label, landValue)
    clearRecordCaches()
    setNewEndpoint('')
    setNewEndpointName('')
    setNewEndpointLand('')
    setEndpointOpen(false)
    window.location.reload()
  }

  const removeSavedEndpoint = (url: string) => {
    removeEndpoint(url)
  }

  const year = new Date().getFullYear()

  return (
    <div {...stylex.props(styles.layout)}>
      <header {...stylex.props(styles.navbar)}>
        <button
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          aria-label="Toggle navigation"
          aria-expanded={navOpen()}
          {...stylex.props(styles.menuBtn)}
        >
          <MenuIcon size={18} />
        </button>
        <A
          href="/"
          title="Dashboard"
          {...stylex.props(styles.brand)}
        >
          Hamolus Console
        </A>
        <div {...stylex.props(styles.navbarActions)}>
          <Show when={pinnedPins().length > 0}>
            <For each={pinnedPins()}>
              {(c) => (
                <A
                  href={`/collections/${c.name}`}
                  title={`${c.label} · pinned`}
                  {...stylex.props(
                    styles.navShortcut,
                    location.pathname === `/collections/${c.name}` &&
                      styles.navShortcutActive,
                  )}
                >
                  <CollectionIcon name={c.icon} size={13} />
                  <span>{c.label}</span>
                </A>
              )}
            </For>
          </Show>

          <Show when={pinnedPlugins().length > 0}>
            <For each={pinnedPlugins()}>
              {(p) => (
                <A
                  href={`/plugins/${p.id}`}
                  title={`${p.name} · pinned`}
                  {...stylex.props(
                    styles.navShortcut,
                    location.pathname === `/plugins/${p.id}` &&
                      styles.navShortcutActive,
                  )}
                >
                  <CollectionIcon name={p.icon} size={13} />
                  <span>{p.name}</span>
                </A>
              )}
            </For>
          </Show>

          <Show when={pinnedPanels().length > 0}>
            <For each={pinnedPanels()}>
              {(p) => (
                <A
                  href={`/panels/${p.id}`}
                  title={`${p.name} · pinned`}
                  {...stylex.props(
                    styles.navShortcut,
                    location.pathname === `/panels/${p.id}` &&
                      styles.navShortcutActive,
                  )}
                >
                  <CollectionIcon name={p.icon} size={13} />
                  <span>{p.name}</span>
                </A>
              )}
            </For>
          </Show>

          <div {...stylex.props(styles.popAnchor)}>
            <Show when={endpointOpen()}>
              <div {...stylex.props(styles.overlay)} onClick={() => setEndpointOpen(false)} />
              <div {...stylex.props(styles.popover)} role="dialog" aria-label="API endpoint">
                <div {...stylex.props(styles.popoverTitle)}>API endpoint</div>
                <Show when={endpoints().length === 0} fallback={<></>}>
                  <div {...stylex.props(styles.endpointEmpty)}>No endpoints saved yet.</div>
                </Show>
                <For each={endpoints()}>
                  {(ep) => (
                    <div
                      {...stylex.props(
                        styles.endpointRowWrap,
                      )}
                    >
                      <Show
                        when={renameUrl() === ep.url}
                        fallback={
                          <button
                            type="button"
                            onClick={() => switchEndpoint(ep.url)}
                            title={ep.url}
                            aria-pressed={activeUrl() === ep.url}
                            {...stylex.props(
                              styles.endpointRow,
                              activeUrl() === ep.url && styles.endpointRowActive,
                            )}
                          >
                            <span {...stylex.props(styles.endpointRowLabel)}>{ep.label}</span>
                            <Show when={ep.land}>
                              <span {...stylex.props(styles.endpointRowLand)}>{ep.land}</span>
                            </Show>
                            <span {...stylex.props(styles.endpointRowUrl)}>{ep.url}</span>
                            {activeUrl() === ep.url && <CheckIcon size={12} strokeWidth={2.4} />}
                          </button>
                        }
                      >
                        <span {...stylex.props(styles.endpointRowWrapInner)}>
                          <input
                            type="text"
                            value={renameValue()}
                            spellcheck={false}
                            onInput={(e) => setRenameValue(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                renameEndpoint(ep.url, renameValue())
                                setRenameUrl(null)
                              } else if (e.key === 'Escape') {
                                setRenameUrl(null)
                              }
                            }}
                            {...stylex.props(s.input, styles.endpointRename)}
                          />
                          <button
                            type="button"
                            title="Save name"
                            aria-label="Save name"
                            onClick={() => {
                              renameEndpoint(ep.url, renameValue())
                              setRenameUrl(null)
                            }}
                            {...stylex.props(styles.endpointRemove)}
                          >
                            <CheckIcon size={11} />
                          </button>
                        </span>
                      </Show>
                      <button
                        type="button"
                        onClick={() => {
                          if (renameUrl() === ep.url) return
                          setRenameUrl(ep.url)
                          setRenameValue(ep.label)
                        }}
                        title={`Rename ${ep.url}`}
                        aria-label={`Rename ${ep.url}`}
                        {...stylex.props(styles.endpointRemove)}
                      >
                        <PencilIcon size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSavedEndpoint(ep.url)}
                        title={`Remove ${ep.url}`}
                        aria-label={`Remove ${ep.url}`}
                        {...stylex.props(styles.endpointRemove)}
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  )}
                </For>
                <div {...stylex.props(styles.endpointAddWrap)}>
                  <div {...stylex.props(styles.endpointAdd)}>
                    <input
                      type="text"
                      placeholder="Name (e.g. Local dev)"
                      value={newEndpointName()}
                      spellcheck={false}
                      onInput={(e) => setNewEndpointName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addAndSwitchEndpoint(newEndpoint(), newEndpointName(), newEndpointLand())
                        }
                      }}
                      {...stylex.props(s.input)}
                    />
                    <input
                      type="text"
                      placeholder="/api or https://host/api"
                      value={newEndpoint()}
                      spellcheck={false}
                      onInput={(e) => setNewEndpoint(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addAndSwitchEndpoint(newEndpoint(), newEndpointName(), newEndpointLand())
                        }
                      }}
                      {...stylex.props(s.input)}
                    />
                    <input
                      type="text"
                      placeholder="Land — optional"
                      value={newEndpointLand()}
                      spellcheck={false}
                      onInput={(e) => setNewEndpointLand(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addAndSwitchEndpoint(newEndpoint(), newEndpointName(), newEndpointLand())
                        }
                      }}
                      {...stylex.props(s.input)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => addAndSwitchEndpoint(newEndpoint(), newEndpointName(), newEndpointLand())}
                    disabled={!newEndpoint().trim()}
                    title="Add and connect"
                    {...stylex.props(styles.endpointAddBtn)}
                  >
                    <PlusIcon size={13} />
                  </button>
                </div>
              </div>
            </Show>
            <button
              type="button"
              onClick={() => setEndpointOpen((o) => !o)}
              title={`Endpoint: ${activeEndpoint()?.label ?? 'api'}`}
              aria-label="API endpoint"
              aria-expanded={endpointOpen()}
              {...stylex.props(styles.endpointBtn, endpointOpen() && styles.localeActive)}
            >
              <DatabaseIcon size={13} />
              {activeEndpoint()?.label ?? 'api'}
              {activeEndpoint()?.land ? ` · ${activeEndpoint()?.land}` : ''}
            </button>
          </div>

          <div {...stylex.props(styles.popAnchor)}>
            <Show when={localeOpen() && languages().length > 1}>
              <div {...stylex.props(styles.overlay)} onClick={() => setLocaleOpen(false)} />
              <div {...stylex.props(styles.popover)} role="dialog" aria-label="Locale selector">
                <div {...stylex.props(styles.popoverTitle)}>Language</div>
                <div {...stylex.props(styles.seg)}>
                  <For each={languages()}>
                    {(lang) => (
                      <button
                        type="button"
                        onClick={() => {
                          setLocale(lang)
                          setLocaleOpen(false)
                        }}
                        {...stylex.props(styles.segBtn, locale() === lang && styles.segActive)}
                      >
                        {lang.toUpperCase()}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
            <Show when={languages().length > 1}>
              <button
                type="button"
                onClick={() => setLocaleOpen((o) => !o)}
                title={`Locale: ${locale().toUpperCase()}`}
                aria-label="Select locale"
                {...stylex.props(styles.localeBtn, localeOpen() && styles.localeActive)}
              >
                <GlobeIcon size={13} />
                {locale().toUpperCase()}
              </button>
            </Show>
          </div>

          <div {...stylex.props(styles.popAnchor)}>
            <Show when={sideOpen()}>
              <div {...stylex.props(styles.overlay)} onClick={() => setSideOpen(false)} />
              <div {...stylex.props(styles.popover)} role="dialog" aria-label="Sidebar">
                <div {...stylex.props(styles.section)}>
                  <div {...stylex.props(styles.popoverTitle)}>Sidebar</div>
                  <div {...stylex.props(styles.seg)}>
                    <button
                      type="button"
                      onClick={() => setNavMode('full')}
                      title="Expanded sidebar with labels"
                      {...stylex.props(styles.segBtn, navMode() === 'full' && styles.segActive)}
                    >
                      Expand
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavMode('icons')}
                      title="Icon-only rail (labels on hover)"
                      {...stylex.props(styles.segBtn, navMode() === 'icons' && styles.segActive)}
                    >
                      Icons
                    </button>
                  </div>
                </div>
                <div {...stylex.props(styles.section)}>
                  <div {...stylex.props(styles.popoverTitle)}>Auto-hide</div>
                  <button
                    type="button"
                    onClick={() => setNavAutoHide((o) => !o)}
                    title={
                      navAutoHide()
                        ? 'Auto-hide is on — hover the left edge to reveal'
                        : 'Auto-hide is off'
                    }
                    aria-pressed={navAutoHide()}
                    {...stylex.props(styles.optionRow)}
                  >
                    <span {...stylex.props(styles.optionRowValue)}>
                      <PanelLeftIcon size={13} />
                      Auto-hide sidebar
                    </span>
                    <span
                      {...stylex.props(styles.switchTrack, navAutoHide() && styles.switchTrackOn)}
                    >
                      <span
                        {...stylex.props(styles.switchKnob, navAutoHide() && styles.switchKnobOn)}
                      />
                    </span>
                  </button>
                </div>
              </div>
            </Show>
            <button
              type="button"
              onClick={() => setSideOpen((o) => !o)}
              title="Sidebar (mode, auto-hide)"
              aria-label="Sidebar"
              aria-expanded={sideOpen()}
              {...stylex.props(s.btnIcon, sideOpen() && styles.localeActive)}
            >
              <PanelLeftIcon size={15} />
            </button>
          </div>

          <div {...stylex.props(styles.popAnchor)}>
            <Show when={paletteOpen()}>
              <div {...stylex.props(styles.overlay)} onClick={() => setPaletteOpen(false)} />
              <div {...stylex.props(styles.popover)} role="dialog" aria-label="Appearance">
                <div {...stylex.props(styles.section)}>
                  <div {...stylex.props(styles.popoverTitle)}>Mode</div>
                  <div {...stylex.props(styles.seg)}>
                    <button
                      type="button"
                      onClick={() => applyMode('dark')}
                      {...stylex.props(styles.segBtn, mode() === 'dark' && styles.segActive)}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMode('light')}
                      {...stylex.props(styles.segBtn, mode() === 'light' && styles.segActive)}
                    >
                      Light
                    </button>
                  </div>
                </div>
                <div {...stylex.props(styles.section)}>
                  <div {...stylex.props(styles.popoverTitle)}>Theme</div>
                  <div {...stylex.props(styles.swatchRow)}>
                    <For each={THEMES}>
                      {(t) => (
                        <button
                          type="button"
                          title={`${t.name} theme`}
                          aria-label={`Set ${t.name} theme`}
                          aria-pressed={palette() === t.id}
                          onClick={() => applyPalette(t.id)}
                          {...stylex.props(
                            styles.swatch,
                            palette() === t.id && styles.swatchActive,
                          )}
                          style={{ 'background-color': isDark() ? t.dark : t.light }}
                        >
                          {palette() === t.id && (
                            <span style={{ color: contrastOn(isDark() ? t.dark : t.light), display: 'inline-flex' }}>
                              <CheckIcon size={12} strokeWidth={2.4} />
                            </span>
                          )}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
                <div {...stylex.props(styles.section)}>
                  <div {...stylex.props(styles.popoverTitle)}>Font</div>
                  <div {...stylex.props(styles.fontRow)}>
                    <For each={FONTS}>
                      {(f) => (
                        <button
                          type="button"
                          title={`${f.name} UI font`}
                          aria-label={`Set ${f.name} font`}
                          aria-pressed={font() === f.id}
                          onClick={() => applyFont(f.id)}
                          {...stylex.props(styles.fontBtn, font() === f.id && styles.fontBtnActive)}
                        >
                          {f.name}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
                <div {...stylex.props(styles.section)}>
                  <div {...stylex.props(styles.popoverTitle)}>Container</div>
                  <button
                    type="button"
                    onClick={toggleContainer}
                    title={`Container: ${container() === 'on' ? 'On (boxed width)' : 'Off (full width)'}`}
                    {...stylex.props(styles.optionRow)}
                  >
                    <span {...stylex.props(styles.optionRowValue)}>
                      <ContainerIcon size={13} />
                      Layout width
                    </span>
                    <span {...stylex.props(styles.optionRowValue)}>
                      {container() === 'on' ? 'Boxed' : 'Full'}
                    </span>
                  </button>
                </div>
              </div>
            </Show>
            <button
              type="button"
              onClick={() => setPaletteOpen((o) => !o)}
              title="Appearance (mode, theme, container)"
              aria-label="Appearance"
              aria-expanded={paletteOpen()}
              {...stylex.props(s.btnIcon, paletteOpen() && styles.localeActive)}
            >
              {isDark() ? <MoonIcon size={15} /> : <SunIcon size={15} />}
            </button>
          </div>

          <Show when={user()}>
            <div {...stylex.props(styles.popAnchor)}>
              <Show when={userOpen()}>
                <div {...stylex.props(styles.overlay)} onClick={() => setUserOpen(false)} />
                <div {...stylex.props(styles.popover)} role="dialog" aria-label="Signed in as">
                  <div {...stylex.props(styles.popoverTitle)}>Signed in as</div>
                  <div {...stylex.props(styles.userPopLabel)}>
                    {user()!.name ?? user()!.username}
                  </div>
                  <div {...stylex.props(styles.userPopLabel)}>@{user()!.username}</div>
                  <div {...stylex.props(styles.userPopLabel)}>
                    {user()!.privilegeLabel ?? user()!.privilegeName ?? '—'}
                  </div>
                </div>
              </Show>
              <button
                type="button"
                onClick={() => setUserOpen((o) => !o)}
                title={`Signed in as ${user()!.username}`}
                aria-label="Account"
                aria-expanded={userOpen()}
                {...stylex.props(styles.userChip, userOpen() && styles.localeActive)}
              >
                <span {...stylex.props(styles.userAvatar)}>
                  {(user()!.name ?? user()!.username).slice(0, 2).toUpperCase()}
                </span>
                <span {...stylex.props(styles.userText)}>
                  <span {...stylex.props(styles.userName)}>{user()!.name ?? user()!.username}</span>
                  <Show when={hasPermission('users.read') || hasPermission('config.read')}>
                    <span {...stylex.props(styles.userRole)}>
                      {user()!.privilegeLabel ?? user()!.privilegeName ?? ''}
                    </span>
                  </Show>
                </span>
                <ChevronDownIcon size={12} />
              </button>
            </div>
          </Show>

          <button
            type="button"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            {...stylex.props(s.btnIcon, s.btnIconDanger)}
          >
            <LogoutIcon size={15} />
          </button>
        </div>
      </header>

      <Show when={navOpen()}>
        <div {...stylex.props(styles.scrim)} onClick={() => setNavOpen(false)} />
      </Show>

      <div {...stylex.props(styles.bodyRow)}>
        <Show when={autoOn() && !navPeek()}>
          <div
            {...stylex.props(styles.gutter)}
            onPointerEnter={revealNav}
            onPointerLeave={scheduleNavHide}
            aria-hidden="true"
          />
        </Show>
        <aside
          onPointerEnter={autoOn() ? revealNav : undefined}
          onPointerLeave={autoOn() ? scheduleNavHide : undefined}
          style={
            autoOn()
              ? {
                  width: navPeek() ? (navMode() === 'icons' ? '56px' : '232px') : '0px',
                  padding: navPeek() ? (navMode() === 'icons' ? '16px 9px' : '18px') : '0px',
                  overflow: navPeek() ? 'auto' : 'hidden',
                }
              : undefined
          }
          {...stylex.props(
            styles.sidebar,
            navMode() === 'icons' && styles.sidebarIconRail,
            autoOn() && styles.sidebarAutoBase,
            !navOpen() && styles.sidebarHidden,
          )}
        >
        <A
          href="/"
          title="Dashboard"
          {...stylex.props(
            styles.navLink,
            navMode() === 'icons' && styles.railLink,
            location.pathname === '/' && styles.navLinkActive,
          )}
        >
          <LayoutDashboardIcon size={15} />
          <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>Dashboard</span>
        </A>

        <A
          href="/collections"
          title="Collections"
          {...stylex.props(
            styles.navLink,
            navMode() === 'icons' && styles.railLink,
            (location.pathname === '/collections' ||
              location.pathname.startsWith('/collections/')) &&
              styles.navLinkActive,
          )}
        >
          <GridIcon size={15} />
          <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>Collections</span>
        </A>

        <div {...stylex.props(styles.navDivider)} />

        <BuiltinGroup
          id={BUCKET_GROUP}
          label="Bucket"
          count={3}
          collapsed={collapsed}
          toggleGroup={toggleGroup}
          navMode={navMode}
        >
          <A
            href="/media"
            title="Media"
            {...stylex.props(
              styles.navLink,
              navMode() === 'icons' && styles.railLink,
              location.pathname === '/media' && styles.navLinkActiveGroupItem,
            )}
          >
            <ImageIcon size={15} />
            <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>Media</span>
          </A>

          <A
            href="/documents"
            title="Documents"
            {...stylex.props(
              styles.navLink,
              navMode() === 'icons' && styles.railLink,
              location.pathname === '/documents' && styles.navLinkActiveGroupItem,
            )}
          >
            <FileTextIcon size={15} />
            <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>Documents</span>
          </A>

          <A
            href="/attachments"
            title="Attachments"
            {...stylex.props(
              styles.navLink,
              navMode() === 'icons' && styles.railLink,
              location.pathname === '/attachments' && styles.navLinkActiveGroupItem,
            )}
          >
            <FolderIcon size={15} />
            <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>Attachments</span>
          </A>
        </BuiltinGroup>

        <Show when={hasPermission('settings.read')}>
          <BuiltinGroup
            id={PLUGINS_GROUP}
            label="Plugins"
            count={PLUGINS.length}
            collapsed={collapsed}
            toggleGroup={toggleGroup}
            navMode={navMode}
          >
                <A
                  href="/plugins"
                  title="All plugins"
                  {...stylex.props(
                    styles.navLink,
                    styles.pluginLink,
                    navMode() === 'icons' && styles.railLink,
                    location.pathname === '/plugins' && styles.navLinkActiveGroupItem,
                  )}
                >
                  <PuzzleIcon size={14} />
                  <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>
                    All plugins
                  </span>
                </A>
                <For each={PLUGINS}>
                  {(p) => (
                    <div {...stylex.props(styles.pluginRow)}>
                      <A
                        href={`/plugins/${p.id}`}
                        title={`${p.name} plugin`}
                        {...stylex.props(
                          styles.navLink,
                          styles.pluginLink,
                          navMode() === 'icons' && styles.railLink,
                          location.pathname === `/plugins/${p.id}` &&
                            styles.navLinkActiveGroupItem,
                        )}
                      >
                        <CollectionIcon name={p.icon} size={14} />
                        <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>
                          {p.name}
                        </span>
                      </A>
                      <button
                        type="button"
                        onClick={() => togglePin(p.id)}
                        title={
                          pinned().includes(p.id)
                            ? `Unpin ${p.name} from the navbar`
                            : `Pin ${p.name} to the navbar`
                        }
                        aria-label={`Pin ${p.name}`}
                        aria-pressed={pinned().includes(p.id)}
                        {...stylex.props(
                          styles.pluginPin,
                          navMode() === 'icons' && styles.railHide,
                          pinned().includes(p.id) && styles.pluginPinActive,
                        )}
                      >
                        <PinIcon size={12} />
                      </button>
                    </div>
                  )}
                </For>
          </BuiltinGroup>
        </Show>

        <Show when={hasPermission('panels.read')}>
          <BuiltinGroup
            id={PANELS_GROUP}
            label="Panels"
            count={panelList().length + 1}
            collapsed={collapsed}
            toggleGroup={toggleGroup}
            navMode={navMode}
          >
            <A
              href="/panels"
              title="All panels"
              {...stylex.props(
                styles.navLink,
                styles.pluginLink,
                navMode() === 'icons' && styles.railLink,
                location.pathname === '/panels' && styles.navLinkActiveGroupItem,
              )}
            >
              <LayoutDashboardIcon size={14} />
              <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>
                All panels
              </span>
            </A>
            <For each={panelList()}>
              {(p) => (
                <div {...stylex.props(styles.pluginRow)}>
                  <A
                    href={`/panels/${p.id}`}
                    title={`${p.name} panel`}
                    {...stylex.props(
                      styles.navLink,
                      styles.pluginLink,
                      navMode() === 'icons' && styles.railLink,
                      location.pathname === `/panels/${p.id}` &&
                        styles.navLinkActiveGroupItem,
                    )}
                  >
                    <CollectionIcon name={p.icon} size={14} />
                    <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>
                      {p.name}
                    </span>
                  </A>
                  <button
                    type="button"
                    onClick={() => togglePin(p.id)}
                    title={
                      pinned().includes(p.id)
                        ? `Unpin ${p.name} from the navbar`
                        : `Pin ${p.name} to the navbar`
                    }
                    aria-label={`Pin ${p.name}`}
                    aria-pressed={pinned().includes(p.id)}
                    {...stylex.props(
                      styles.pluginPin,
                      navMode() === 'icons' && styles.railHide,
                      pinned().includes(p.id) && styles.pluginPinActive,
                    )}
                  >
                    <PinIcon size={12} />
                  </button>
                </div>
              )}
            </For>
          </BuiltinGroup>
        </Show>

        <Show when={envMs().length > 0}>
          <BuiltinGroup
            id={ENV_GROUP}
            label="Environment"
            count={envMs().length}
            collapsed={collapsed}
            toggleGroup={toggleGroup}
            navMode={navMode}
          >
            <For each={envMs()}>
              {(m) => (
                <A
                  href={m.href}
                  title={m.title}
                  {...stylex.props(
                    styles.navLink,
                    navMode() === 'icons' && styles.railLink,
                    location.pathname === m.href && styles.navLinkActiveGroupItem,
                  )}
                >
                  {m.icon}
                  <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>
                    {m.label}
                  </span>
                </A>
              )}
            </For>
          </BuiltinGroup>
        </Show>

        <div {...stylex.props(styles.navDivider)} />

        <For each={ungrouped()}>
          {(c) => (
            <A
              href={`/collections/${c.name}`}
              title={`${c.label} (${counts()[c.name] ?? 0} records)`}
              {...stylex.props(
                styles.navLink,
                navMode() === 'icons' && styles.railLink,
                isActive(c.name) && styles.navLinkActive,
              )}
            >
              <CollectionIcon name={c.icon} />
              <span {...stylex.props(navMode() === 'icons' && styles.railHide)}>{c.label}</span>
              <span
                {...stylex.props(styles.badge, navMode() === 'icons' && styles.railHide)}
>
          {counts()[c.name] ?? 0}
        </span>
            </A>
          )}
        </For>

        <For each={tree()}>
          {(node) => (
            <SidebarGroup
              node={node}
              collapsed={collapsed}
              toggleGroup={toggleGroup}
              navMode={navMode}
              counts={counts}
              isActive={isActive}
            />
          )}
        </For>

      </aside>
      <main {...stylex.props(styles.main)}>
        <div
          {...stylex.props(styles.mainInner, container() === 'on' && styles.mainContainer)}
        >
          {props.children}
        </div>
        <footer {...stylex.props(styles.footer)}>
          <span {...stylex.props(styles.footerText)}>Hamolus · Headless CMS for Cloudflare Workers</span>
          <span {...stylex.props(styles.footerText)}>© {year}</span>
        </footer>
      </main>
      </div>
    </div>
  )
}