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
import { fieldDefinitionSchema, type FieldDefinition } from './field'
import { fileRefValueSchema, mediaFieldValueSchema } from './dto'
import { customCurrencyValueSchema, moneyValueSchema } from './currency'

export interface CollectionDefinition {
  /** Collection name = D1 table name, must be snake_case */
  name: string
  /** Human label for the UI */
  label: string
  description?: string
  /** Grouping key for sidebar/navigation organization (e.g. "Content", "Inbox") */
  group?: string
  /** Icon name for the sidebar navigation (rendered as an SVG in the console) */
  icon?: string
  /** Auto-fill created_at / updated_at */
  timestamps?: boolean
  /** Field soft-delete (deleted_at) */
  softDelete?: boolean
  /** Field used as the primary key, defaults to 'id' */
  primaryKey?: string
  fields: FieldDefinition[]
}

export const RESERVED_COLLECTION_NAMES = ['_meta', '_auth', 'health'] as const

export const collectionDefinitionSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Collection name must be snake_case')
      .refine((v) => !v.includes('__'), 'Collection name cannot contain a double underscore (reserved as the physical-table separator)'),
    label: z.string().min(1, 'Label is required'),
    description: z.string().optional(),
    group: z.string().optional(),
    icon: z.string().optional(),
    timestamps: z.boolean().optional(),
    softDelete: z.boolean().optional(),
    primaryKey: z.string().default('id'),
    fields: z.array(fieldDefinitionSchema).min(1, 'At least one field is required'),
  })
  .strict()
  .superRefine((def, ctx) => {
    const reserved = RESERVED_COLLECTION_NAMES.find((r) => def.name.endsWith(r) || r === def.name)
    if (reserved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `'${def.name}' is a reserved name (${reserved})`,
        path: ['name'],
      })
    }
    const seen = new Map<string, number>()
    for (const f of def.fields) {
      const merged = `${f.name}:${f.type}`
      const prev = seen.get(merged)
      if (prev !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field '${f.name}'`,
          path: ['fields', String(prev), 'name'],
        })
      }
      seen.set(merged, def.fields.indexOf(f))
    }
  })

/** Zod schema for a single field value based on its type */
export function fieldValueSchema(field: FieldDefinition, languages?: string[]): z.ZodType<unknown> {
  // Required without default => mandatory; otherwise optional (nullable).
  const required = field.required === true && field.default === undefined

  const localeSchema = (valSchema: z.ZodType<unknown> = z.string()) => {
    const langs = languages ?? []
    const shape: Record<string, z.ZodType<unknown>> = {}
    for (const lang of langs) {
      shape[lang] = valSchema
    }
    return z.object(shape)
  }

  const lexicalLike = z.union([
    z.string(),
    z.object({ root: z.record(z.string(), z.unknown()) }),
  ])

  let base: z.ZodType<unknown>
  switch (field.type) {
    case 'number': {
      let s = z.number({ message: 'Must be a number' })
      if (field.min !== undefined) s = s.gte(field.min)
      if (field.max !== undefined) s = s.lte(field.max)
      base = required ? s : s.optional().nullable()
      break
    }
    case 'currency':
    case 'custom_currency': {
      // Accept the raw amount (number) or the serialized read shape, so a value
      // that came out of a GET can be written straight back. Only the amount is
      // stored; the display string is derived per read.
      let num = z.number({ message: 'Must be a number' })
      if (field.min !== undefined) num = num.gte(field.min)
      if (field.max !== undefined) num = num.lte(field.max)
      const s = z.union([num, moneyValueSchema, customCurrencyValueSchema])
      base = required ? s : s.optional().nullable()
      break
    }
    case 'boolean': {
      const s = z.boolean({ message: 'Must be a boolean' })
      base = required ? s : s.optional().nullable()
      break
    }
    case 'enum': {
      const e =
        field.enumValues && field.enumValues.length > 0
          ? z.enum(field.enumValues as [string, ...string[]])
          : z.string()
      // multichecklist enum stores an ARRAY of values in D1 (JSON).
      const s = field.control === 'multichecklist' ? z.array(e) : e
      base = required ? s : s.optional().nullable()
      break
    }
    case 'richtext': {
      const s =
        field.format === 'markdown' || field.format === 'mdx'
          ? z.string({ message: 'Must be a string' })
          : lexicalLike
      if (field.localized && languages && languages.length > 0) {
        base = required ? localeSchema(s) : localeSchema(s).optional().nullable()
      } else {
        base = required ? s : s.optional().nullable()
      }
      break
    }
    case 'text':
    case 'string':
    case 'slug':
    case 'email':
    case 'url': {
      let s = z.string()
      if (field.minLength !== undefined) s = s.min(field.minLength)
      if (field.maxLength !== undefined) s = s.max(field.maxLength)
      if (field.type === 'slug') {
        s = s.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with dashes')
      }
      if (field.localized && languages && languages.length > 0) {
        base = required ? localeSchema(s) : localeSchema(s).optional().nullable()
      } else {
        base = required ? s : s.optional().nullable()
      }
      break
    }
    case 'date': {
      const s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD')
      base = required ? s : s.optional().nullable()
      break
    }
    case 'datetime': {
      const s = z.iso.datetime({ message: 'Datetime must be ISO 8601' })
      base = required ? s : s.optional().nullable()
      break
    }
    case 'json': {
      const s = z.unknown()
      base = required ? s : s.optional().nullable()
      break
    }
    case 'relation': {
      const kind = field.relation?.kind ?? 'belongsTo'
      if (kind === 'hasMany') {
        const s = z.array(z.string())
        base = required ? s : s.optional().nullable()
      } else {
        const s = z.string()
        base = required ? s : s.optional().nullable()
      }
      break
    }
    case 'media': {
      const s = mediaFieldValueSchema as z.ZodType<unknown>
      base = required ? s : s.optional().nullable()
      break
    }
    case 'document':
    case 'attachment': {
      const s = fileRefValueSchema as z.ZodType<unknown>
      base = required ? s : s.optional().nullable()
      break
    }
    case 'id':
    default: {
      const s = z.string()
      base = required ? s : s.optional().nullable()
      break
    }
  }
  return base
}

/** Input payload accepted by the API for a single record */
export type EntityInput = Record<string, unknown>

/**
 * Build a Zod schema from collection metadata.
 * `strict()` rejects unknown fields (potential SQL injection) outright.
 */
export function buildEntitySchema(def: Pick<CollectionDefinition, 'fields' | 'primaryKey'>, languages?: string[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of def.fields) {
    if (f.type === 'id') continue
    shape[f.name] = fieldValueSchema(f, languages)
  }
  return z.object(shape).strict()
}

export type EntityZod = ReturnType<typeof buildEntitySchema>

export type CollectionDefinitionInput = z.input<typeof collectionDefinitionSchema>