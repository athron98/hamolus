import { z } from 'zod'

export const FIELD_TYPES = [
  'id',
  'string',
  'slug',
  'text',
  'richtext',
  'number',
  'price',
  'boolean',
  'date',
  'datetime',
  'enum',
  'json',
  'email',
  'url',
  'relation',
  'media',
  'document',
  'attachment',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export const RELATION_ACTIONS = ['cascade', 'restrict', 'setNull'] as const
export type RelationAction = (typeof RELATION_ACTIONS)[number]

/** Rich-text sub-formats for `type === 'richtext'` fields. */
export const RICHTEXT_FORMATS = ['lexical', 'markdown', 'mdx'] as const
export type RichTextFormat = (typeof RICHTEXT_FORMATS)[number]

export const RELATION_KINDS = ['belongsTo', 'hasMany', 'hasOne'] as const
export type RelationKind = (typeof RELATION_KINDS)[number]

/** Where a field is rendered in the console record form */
export const CONSOLE_VIEWS = ['normal', 'side', 'header', 'footer'] as const
export type ConsoleView = (typeof CONSOLE_VIEWS)[number]

/**
 * Which input widget the console record form uses for a field.
 * - `combobox` (default for enum / belongsTo): native `<select>`
 * - `search`: searchable combobox — type to filter many options (tag-input style)
 * - `radio`: inline radio group for a small choice set
 * - `toggle`: switch widget (boolean fields)
 * - `checklist`: pick ONE from a list of rows (single-select)
 * - `multichecklist`: pick MANY with checkboxes → value is an array (JSON)
 */
export const CONTROL_TYPES = ['combobox', 'search', 'radio', 'toggle', 'checklist', 'multichecklist'] as const
export type ControlType = (typeof CONTROL_TYPES)[number]

/** Widgets a field may use given its type (and relation kind). */
export function allowedControls(
  field: Pick<FieldDefinition, 'type' | 'relation'>,
): ControlType[] {
  switch (field.type) {
    case 'boolean':
      return ['toggle', 'radio']
    case 'enum':
      return ['combobox', 'search', 'radio', 'checklist', 'multichecklist']
    case 'relation':
      return field.relation?.kind === 'hasMany'
        ? ['search', 'multichecklist']
        : ['combobox', 'search', 'radio', 'checklist']
    default:
      return []
  }
}

export interface RelationConfig {
  /** Target collection being referenced */
  collection: string
  /** Field of the target collection (usually the PK) being referenced */
  field: string
  onDelete?: RelationAction
  /**
   * - `belongsTo` (default): FK lives on this table (e.g. posts.category_id → categories.id)
   * - `hasMany`: this table stores an array of FKs (e.g. posts.tag_ids → tags.id[])
   * - `hasOne`: reverse lookup — one record on the target references this record
   */
  kind?: RelationKind
}

export interface FieldDefinition {
  /** Column / field name, must be snake_case */
  name: string
  /** Human label for forms/tables; falls back to title-cased `name` when empty */
  label?: string
  type: FieldType
  required?: boolean
  unique?: boolean
  indexed?: boolean
  default?: unknown
  /** Constraints for string/text types */
  minLength?: number
  maxLength?: number
  /** Numeric bounds */
  min?: number
  max?: number
  /** Candidate values for type === 'enum' */
  enumValues?: string[]
  relation?: RelationConfig
  /**
   * Console record-form widget. Only valid on `enum`, `relation` and `boolean`
   * fields — use `allowedControls()` to see the options for a given field.
   * Absent = the current default widget (select for enum / belongsTo, the
   * tag-style chips input for hasMany, a checkbox for boolean).
   */
  control?: ControlType
  /**
   * Rich-text format for `type === 'richtext'` fields:
   * - `lexical` (default): Lexical JSON editor state (object `{ root }` or JSON string)
   * - `markdown`: plain CommonMark string (rendered by the console preview + site)
   * - `mdx`: markdown + JSX string; stored as plain text, rendered as markdown (JSX escaped)
   */
  format?: RichTextFormat
  /** True: hidden from the API output (list/detail) */
  hidden?: boolean
  /** True: field value is a JSON object keyed by language code (e.g. {"en":"...","id":"..."}) */
  localized?: boolean
  /**
   * Console form placement: `normal` (default), `side` (right column),
   * `header` (top of the form), `footer` (bottom of the form).
   */
  consoleView?: ConsoleView
  /**
   * Optional group/section name; fields sharing the same group render inside a
   * collapsible section in the console form. Empty/absent = no grouping.
   */
  group?: string
  /** Whether the field's group section starts expanded (default true). */
  groupOpen?: boolean
}

export const relationConfigSchema = z
  .object({
    collection: z.string().min(1),
    field: z.string().min(1),
    onDelete: z.enum(RELATION_ACTIONS).optional(),
    kind: z.enum(RELATION_KINDS).optional(),
  })
  .strict()

export const fieldDefinitionSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Field name must be snake_case'),
    label: z.string().optional(),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    indexed: z.boolean().optional(),
    default: z.unknown().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    enumValues: z.array(z.string()).min(1).optional(),
    relation: relationConfigSchema.optional(),
    control: z.enum(CONTROL_TYPES).optional(),
    format: z.enum(RICHTEXT_FORMATS).optional(),
    hidden: z.boolean().optional(),
    localized: z.boolean().optional(),
    consoleView: z.enum(CONSOLE_VIEWS).optional(),
    group: z.string().optional(),
    groupOpen: z.boolean().optional(),
  })
  .strict()
  .refine((f) => (f.type === 'enum' ? !!f.enumValues?.length : true), {
    message: "Enum fields must define enumValues",
    path: ['enumValues'],
  })
  .refine((f) => (f.type === 'richtext' ? true : f.format === undefined), {
    message: 'format is only valid on richtext fields',
    path: ['format'],
  })
  .refine((f) => {
    if (f.control === undefined) return true
    const allowed = allowedControls(f)
    return allowed.includes(f.control)
  }, {
    message: 'control is not valid for this field type',
    path: ['control'],
  })

export type FieldDefinitionInput = z.input<typeof fieldDefinitionSchema>
export type FieldDefinitionOutput = z.output<typeof fieldDefinitionSchema>