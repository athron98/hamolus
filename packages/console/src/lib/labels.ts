/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import type { FieldDefinition } from '@hamolus/types'

const ACRONYMS = new Set(['id', 'url', 'api', 'json', 'kv', 'd1', 'r2', 'uuid'])

/** Convert a snake_case field/collection name to Title Case (e.g. `tag_ids` → "Tag IDs"). */
export function titleCase(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase()
      return ACRONYMS.has(lower) ? lower.toUpperCase() : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    })
    .join(' ')
}

/** Human label for a field: its `label` if set, otherwise the title-cased name. */
export function fieldLabel(field: FieldDefinition): string {
  return (field.label ?? '').trim() || titleCase(field.name)
}