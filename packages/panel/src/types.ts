/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import type {
  PanelAssetListResponse,
  PanelAssetObject,
  PanelAssetQuery,
  PanelQuery,
} from '@hamolus/types'

export type {
  PanelAssetKind,
  PanelAssetListResponse,
  PanelAssetObject,
  PanelBootstrap,
  PanelDashboardViewDefinition,
  PanelDefinition,
  PanelFieldAccess,
  PanelFilterRule,
  PanelFormViewDefinition,
  PanelMember,
  PanelMenuItem,
  PanelMetricDefinition,
  PanelMetricOperation,
  PanelMetricResult,
  PanelOperation,
  PanelQuery,
  PanelRoleDefinition,
  PanelRoleViewAccess,
  PanelTableViewDefinition,
  PanelTheme,
  PanelViewDefinition,
  PanelViewKind,
} from '@hamolus/types'

export type PanelFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export interface PanelOptions {
  apiBase: string
  token: string
  land?: string
  colony?: string
  fetch?: PanelFetch
}

export interface PanelCallOptions {
  signal?: AbortSignal
}

export type PanelRecord = Record<string, unknown>
export type PanelRecordInput = Record<string, unknown>
export type PanelRecordQuery = Partial<PanelQuery>

export interface PanelRecordListResponse {
  data: PanelRecord[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  lastUpdate?: string | null
}

export interface PanelRecordRequestOptions extends PanelCallOptions {
  locale?: string
}

export interface PanelRelationOption {
  value: string
  label: string
}

export type PanelAssetListQuery = Omit<Partial<PanelAssetQuery>, 'field'>

export interface PanelAssetUploadOptions extends PanelCallOptions {
  name?: string
}

export interface PanelAssetUrlOptions {
  download?: boolean
}

export interface PanelAssetExpiryOptions {
  nowMs?: number
  leewaySeconds?: number
}
