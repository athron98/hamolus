/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { z } from 'zod'
import type { CollectionDefinition } from './collection'

/** A navigation group in the registry. `parent` references another group id
 *  (snake_case), so groups can nest arbitrarily deep (self-parenting). */
export interface GroupDefinition {
  id: string
  label: string
  parent?: string | null
  icon?: string
}

export const groupDefinitionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Group id must be snake_case'),
    label: z.string().min(1, 'Label is required').max(80, 'Label is too long'),
    parent: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Parent must be a snake_case group id')
      .nullable()
      .optional(),
    icon: z.string().max(40, 'Icon name is too long').optional(),
  })
  .strict()

/** One node in the resolved group tree. */
export interface GroupTreeNode {
  id: string
  label: string
  icon?: string
  parent?: string | null
  collections: CollectionDefinition[]
  children: GroupTreeNode[]
}

/**
 * Resolve registered groups + collection definitions into a normalized tree.
 *
 * - Registered groups become nodes; children are attached via `parent`.
 * - Any `collection.group` value that is not a registered group id renders as an
 *   implicit root group (label = the raw value), so pre-registry data still works.
 * - Nodes whose `parent` is empty/unknown land at the root.
 * - Cycles are structurally impossible (putGroup validates them); if one ever
 *   appears in data this still terminates (unhooked nodes become roots).
 */
export function buildGroupTree(
  groups: GroupDefinition[],
  collections: CollectionDefinition[],
): GroupTreeNode[] {
  const byId = new Map<string, GroupDefinition>()
  for (const g of groups) byId.set(g.id, g)

  // Implicit roots for collection.group values that aren't registered.
  for (const c of collections) {
    if (c.group && !byId.has(c.group)) {
      byId.set(c.group, { id: c.group, label: c.group })
    }
  }

  const nodes = new Map<string, GroupTreeNode>()
  for (const g of byId.values()) {
    nodes.set(g.id, { id: g.id, label: g.label, icon: g.icon, parent: g.parent, collections: [], children: [] })
  }
  // A collection appears under exactly one group. De-duplicate by name so a
  // source response that ever contained duplicate rows can never render the
  // same collection twice in the nav tree.
  const attached = new Set<string>()
  for (const c of collections) {
    if (attached.has(c.name)) continue
    attached.add(c.name)
    const node = c.group ? nodes.get(c.group) : undefined
    if (node) node.collections.push(c)
  }

  const roots: GroupTreeNode[] = []
  for (const g of byId.values()) {
    const node = nodes.get(g.id)!
    const parent = g.parent ? nodes.get(g.parent) : undefined
    if (parent && parent !== node) parent.children.push(node)
  }
  for (const g of byId.values()) {
    const node = nodes.get(g.id)!
    if (!g.parent || !nodes.has(g.parent) || nodes.get(g.parent) === node) roots.push(node)
  }

  const sortTree = (arr: GroupTreeNode[]) => {
    arr.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
    for (const n of arr) sortTree(n.children)
  }
  sortTree(roots)
  return roots
}