/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import type { JSX } from 'solid-js/jsx-runtime'

export interface IconProps {
  size?: number
  strokeWidth?: number
}

function svg(props: IconProps, children: JSX.Element): JSX.Element {
  const size = props.size ?? 16
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.7}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PencilIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </>,
  )

export const TrashIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>,
  )

export const PlusIcon = (props: IconProps) =>
  svg(props, (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ) as JSX.Element)

export const ChevronLeftIcon = (props: IconProps) => svg(props, <path d="M15 18l-6-6 6-6" />)

export const ChevronRightIcon = (props: IconProps) => svg(props, <path d="M9 18l6-6-6-6" />)

export const ColumnsIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>,
  )

export const EyeIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  )

export const SunIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2" />
      <path d="M12 21v2" />
      <path d="M4.22 4.22l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M1 12h2" />
      <path d="M21 12h2" />
      <path d="M4.22 19.78l1.42-1.42" />
      <path d="M18.36 5.64l1.42-1.42" />
    </>,
  )

export const MoonIcon = (props: IconProps) =>
  svg(props, <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />)

export const ContainerIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M3 8h18" />
      <path d="M3 16h18" />
      <path d="M8 8v8" />
      <path d="M16 8v8" />
    </>,
  )

export const LogoutIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <path d="M21 12H9" />
    </>,
  )

export const CheckIcon = (props: IconProps) => svg(props, <path d="M20 6L9 17l-5-5" />)

export const XIcon = (props: IconProps) => svg(props, (
  <>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </>
) as JSX.Element)

export const SlidersIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>,
  )

export const ChevronDownIcon = (props: IconProps) => svg(props, <path d="M6 9l6 6 6-6" />)

export const ChevronUpIcon = (props: IconProps) => svg(props, <path d="M18 15l-6-6-6 6" />)

export const MenuIcon = (props: IconProps) => svg(props, (
  <>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </>
) as JSX.Element)

export const PaletteIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M12 2a10 10 0 1 0 0 20h1.5a2.5 2.5 0 0 0 1.9-4.1 2.1 2.1 0 0 1 .1-2.9A2.48 2.48 0 0 1 17.7 12H19a2.42 2.42 0 0 1 1.79.75A2.42 2.42 0 0 0 22 11c0-5-4.48-9-10-9z" />
      <circle cx="7.5" cy="10.5" r="1.1" />
      <circle cx="11" cy="7.5" r="1.1" />
      <circle cx="15.5" cy="8.5" r="1.1" />
      <circle cx="16.5" cy="12.5" r="1.1" />
    </>,
  )

export const BracesIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
      <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
    </>,
  )

export const GlobeIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>,
  )

export const ImageIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>,
  )

export const CopyIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>,
  )

export const UploadIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </>,
  )

export const BoxIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>,
  )

export const FileTextIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M15 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
      <path d="M9 9h1" />
    </>,
  )

export const UsersIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  )

export const TagIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" />
      <path d="M7 7h.01" />
    </>,
  )

export const MailIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>,
  )

export const FolderIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </>,
  )

export const GridIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>,
  )

export const ListIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </>,
  )

export const CodeIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>,
  )

export const DatabaseIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </>,
  )

export const DownloadIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>,
  )

export const StarIcon = (props: IconProps) =>
  svg(props, <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />)

export const CalendarIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </>,
  )

export const ZapIcon = (props: IconProps) =>
  svg(props, <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />)

/** A key, for per-caller credentials — a token is someone's, not the instance's. */
export const KeyIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2" />
      <path d="M17 6l3 3" />
      <path d="M14 9l3 3" />
    </>,
  )

export const LayoutDashboardIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>,
  )

export const HistoryIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </>,
  )

export const HeartIcon = (props: IconProps) =>
  svg(
    props,
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  )

export const CropIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </>,
  )

export const CrosshairIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </>,
  )

export const ExternalLinkIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>,
  )

export const MaximizeIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </>,
  )

export const MinimizeIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </>,
  )

export const PinIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
    </>,
  )

export const PanelLeftIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>,
  )

export const PuzzleIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
    </>,
  )

/** Registry of icon names usable as a collection's `icon` for the sidebar nav. */
export const COLLECTION_ICONS = {
  box: BoxIcon,
  file: FileTextIcon,
  users: UsersIcon,
  tag: TagIcon,
  mail: MailIcon,
  folder: FolderIcon,
  grid: GridIcon,
  list: ListIcon,
  code: CodeIcon,
  database: DatabaseIcon,
  star: StarIcon,
  calendar: CalendarIcon,
  zap: ZapIcon,
  heart: HeartIcon,
} as const

export type CollectionIconName = keyof typeof COLLECTION_ICONS

export const CollectionIcon = (props: IconProps & { name?: string }) => {
  const Icon = (props.name && COLLECTION_ICONS[props.name as CollectionIconName]) || FolderIcon
  return <Icon size={props.size ?? 15} strokeWidth={props.strokeWidth ?? 1.7} />
}