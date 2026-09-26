import { z } from 'zod'

export const PANEL_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
export const PANEL_FIELD_PATTERN = /^[a-z][a-z0-9_]*$/
export const PANEL_PATH_PATTERN = /^\/[a-z0-9/_-]*$/

export const panelIdSchema = z.string().regex(PANEL_ID_PATTERN, 'Panel id must use lowercase letters, numbers, and underscores')
export const panelFieldNameSchema = z.string().regex(PANEL_FIELD_PATTERN, 'Field names must use snake_case')
export const panelPathSchema = z.string().regex(PANEL_PATH_PATTERN, 'Panel path must be a safe absolute route').refine((value) => !value.includes('//') && !value.split('/').includes('..'), 'Panel path contains an unsafe segment')

export const PANEL_OPERATIONS = ['read', 'create', 'update', 'delete'] as const
export type PanelOperation = (typeof PANEL_OPERATIONS)[number]
export const panelOperationSchema = z.enum(PANEL_OPERATIONS)

export const PANEL_VIEW_KINDS = ['table', 'form', 'dashboard'] as const
export type PanelViewKind = (typeof PANEL_VIEW_KINDS)[number]
export const panelViewKindSchema = z.enum(PANEL_VIEW_KINDS)

export const PANEL_METRIC_OPERATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const
export type PanelMetricOperation = (typeof PANEL_METRIC_OPERATIONS)[number]
export const panelMetricOperationSchema = z.enum(PANEL_METRIC_OPERATIONS)

const panelFilterOperatorSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'contains'])
const panelFilterSourceSchema = z.string().regex(/^member\.attributes\.[a-z][a-z0-9_]*$/, 'Filter source must be member.attributes.<name>')

export const panelFilterRuleSchema = z.object({
  field: panelFieldNameSchema,
  op: panelFilterOperatorSchema,
  value: z.unknown().optional(),
  source: panelFilterSourceSchema.optional(),
}).strict().superRefine((rule, ctx) => {
  if (rule.source !== undefined && rule.value !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'A filter must use either value or source, not both' })
  }
  if (rule.source === undefined && rule.value === undefined) {
    ctx.addIssue({ code: 'custom', message: 'A filter must have a value or source' })
  }
})

export type PanelFilterRule = z.infer<typeof panelFilterRuleSchema>

export const panelFieldAccessSchema = z.object({
  read: z.array(panelFieldNameSchema).max(200).default([]),
  write: z.array(panelFieldNameSchema).max(200).default([]),
}).strict()

export type PanelFieldAccess = z.infer<typeof panelFieldAccessSchema>

export const panelMetricSchema = z.object({
  id: panelIdSchema,
  label: z.string().trim().min(1).max(120),
  collection: panelFieldNameSchema,
  operation: panelMetricOperationSchema,
  field: panelFieldNameSchema.optional(),
  groupBy: panelFieldNameSchema.optional(),
  format: z.enum(['number', 'compact', 'currency']).optional(),
}).strict().superRefine((metric, ctx) => {
  if (metric.operation !== 'count' && metric.field === undefined) {
    ctx.addIssue({ code: 'custom', message: 'A non-count metric needs a field' })
  }
})

export type PanelMetricDefinition = z.infer<typeof panelMetricSchema>

const panelViewBase = {
  id: panelIdSchema,
  label: z.string().trim().min(1).max(120),
  path: panelPathSchema,
  icon: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(500).optional(),
  searchable: z.boolean().default(false),
  pageSize: z.number().int().min(1).max(100).default(20),
  fields: panelFieldAccessSchema,
  operations: z.array(panelOperationSchema).min(1).max(4),
  filters: z.array(panelFilterRuleSchema).max(20).default([]),
  defaultSort: z.object({
    field: panelFieldNameSchema,
    direction: z.enum(['asc', 'desc']),
  }).strict().optional(),
}

export const panelTableViewSchema = z.object({
  ...panelViewBase,
  kind: z.literal('table'),
  collection: panelFieldNameSchema,
  form: z.boolean().default(true),
})

export const panelFormViewSchema = z.object({
  ...panelViewBase,
  kind: z.literal('form'),
  collection: panelFieldNameSchema,
  submitLabel: z.string().trim().min(1).max(80).default('Save'),
})

export const panelDashboardViewSchema = z.object({
  ...panelViewBase,
  kind: z.literal('dashboard'),
  metrics: z.array(panelMetricSchema).min(1).max(40),
})

export const panelViewDefinitionSchema = z.union([
  panelTableViewSchema,
  panelFormViewSchema,
  panelDashboardViewSchema,
])

export type PanelViewDefinition = z.infer<typeof panelViewDefinitionSchema>
export type PanelTableViewDefinition = z.infer<typeof panelTableViewSchema>
export type PanelFormViewDefinition = z.infer<typeof panelFormViewSchema>
export type PanelDashboardViewDefinition = z.infer<typeof panelDashboardViewSchema>

export const panelMenuItemSchema = z.object({
  id: panelIdSchema,
  label: z.string().trim().min(1).max(120),
  path: panelPathSchema,
  viewId: panelIdSchema,
  icon: z.string().trim().min(1).max(40).optional(),
}).strict()

export type PanelMenuItem = z.infer<typeof panelMenuItemSchema>

export const panelRoleViewAccessSchema = z.object({
  viewId: panelIdSchema,
  operations: z.array(panelOperationSchema).min(1).max(4),
  readFields: z.array(panelFieldNameSchema).max(200).optional(),
  writeFields: z.array(panelFieldNameSchema).max(200).optional(),
}).strict()

export type PanelRoleViewAccess = z.infer<typeof panelRoleViewAccessSchema>

export const panelRoleDefinitionSchema = z.object({
  id: panelIdSchema,
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  views: z.array(panelRoleViewAccessSchema).max(200).default([]),
}).strict()

export type PanelRoleDefinition = z.infer<typeof panelRoleDefinitionSchema>

export const panelAttributeValueSchema = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])
export const panelAttributesSchema = z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), panelAttributeValueSchema)

export const panelMemberSchema = z.object({
  userId: z.string().trim().min(1).max(80),
  roleId: panelIdSchema,
  attributes: panelAttributesSchema.default({}),
}).strict()

export type PanelMember = z.infer<typeof panelMemberSchema>

export const panelThemeSchema = z.object({
  mode: z.enum(['dark', 'light']).optional(),
  palette: z.string().trim().min(1).max(40).optional(),
  font: z.string().trim().min(1).max(40).optional(),
}).strict()

export type PanelTheme = z.infer<typeof panelThemeSchema>

export const panelDefinitionSchema = z.object({
  id: panelIdSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  theme: panelThemeSchema.optional(),
  views: z.array(panelViewDefinitionSchema).min(1).max(100),
  menu: z.array(panelMenuItemSchema).max(200).default([]),
  roles: z.array(panelRoleDefinitionSchema).min(1).max(50),
  members: z.array(panelMemberSchema).max(2000).default([]),
  defaultRoleId: panelIdSchema.optional(),
}).strict().superRefine((panel, ctx) => {
  const viewIds = new Set(panel.views.map((view) => view.id))
  const menuPaths = new Set<string>()
  const menuIds = new Set<string>()
  for (const item of panel.menu) {
    if (!viewIds.has(item.viewId)) {
      ctx.addIssue({ code: 'custom', path: ['menu'], message: `Menu item '${item.id}' references unknown view '${item.viewId}'` })
    }
    if (menuIds.has(item.id)) {
      ctx.addIssue({ code: 'custom', path: ['menu'], message: `Duplicate menu id '${item.id}'` })
    }
    if (menuPaths.has(item.path)) {
      ctx.addIssue({ code: 'custom', path: ['menu'], message: `Duplicate menu path '${item.path}'` })
    }
    menuIds.add(item.id)
    menuPaths.add(item.path)
  }
  const roleIds = new Set<string>()
  for (const role of panel.roles) {
    if (roleIds.has(role.id)) ctx.addIssue({ code: 'custom', path: ['roles'], message: `Duplicate role id '${role.id}'` })
    roleIds.add(role.id)
    for (const access of role.views) {
      if (!viewIds.has(access.viewId)) ctx.addIssue({ code: 'custom', path: ['roles'], message: `Role '${role.id}' references unknown view '${access.viewId}'` })
    }
  }
  if (panel.defaultRoleId && !roleIds.has(panel.defaultRoleId)) {
    ctx.addIssue({ code: 'custom', path: ['defaultRoleId'], message: `Default role '${panel.defaultRoleId}' is not registered` })
  }
  const userIds = new Set<string>()
  for (const member of panel.members) {
    if (!roleIds.has(member.roleId)) ctx.addIssue({ code: 'custom', path: ['members'], message: `Member '${member.userId}' references unknown role '${member.roleId}'` })
    if (userIds.has(member.userId)) ctx.addIssue({ code: 'custom', path: ['members'], message: `User '${member.userId}' is assigned more than once` })
    userIds.add(member.userId)
  }
})

export type PanelDefinition = z.infer<typeof panelDefinitionSchema>

export const panelDefinitionInputSchema = panelDefinitionSchema

export const panelIdInputSchema = z.object({ id: panelIdSchema }).strict()

export const panelMemberInputSchema = panelMemberSchema

export const panelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  locale: z.string().trim().min(1).max(20).optional(),
  sortBy: panelFieldNameSchema.optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
}).strict()

export type PanelQuery = z.infer<typeof panelQuerySchema>

export const panelBootstrapSchema = z.object({
  panel: panelDefinitionSchema,
  role: panelRoleDefinitionSchema,
  user: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string().nullable(),
  }).strict(),
  attributes: panelAttributesSchema,
}).strict()

export type PanelBootstrap = z.infer<typeof panelBootstrapSchema>

export const panelMetricResultSchema = z.object({
  id: panelIdSchema,
  label: z.string(),
  value: z.number().nullable(),
  group: z.string().nullable().optional(),
}).strict()

export type PanelMetricResult = z.infer<typeof panelMetricResultSchema>

export const panelRecordListResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).strict(),
  lastUpdate: z.string().nullable().optional(),
}).strict()

export const panelCreateInputSchema = z.object({
  definition: panelDefinitionSchema,
}).strict()

export const panelUpdateInputSchema = z.object({
  definition: panelDefinitionSchema,
}).strict()

export const panelAssetKindSchema = z.enum(['media', 'document', 'attachment'])
export type PanelAssetKind = z.infer<typeof panelAssetKindSchema>

export const panelAssetQuerySchema = z.object({
  field: panelFieldNameSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
}).strict()

export type PanelAssetQuery = z.infer<typeof panelAssetQuerySchema>

export const panelAssetObjectSchema = z.object({
  id: z.string(),
  panelId: panelIdSchema,
  kind: panelAssetKindSchema,
  name: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  ext: z.string(),
  url: z.string(),
  downloadUrl: z.string(),
  expiresAt: z.number().int().positive(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict()

export type PanelAssetObject = z.infer<typeof panelAssetObjectSchema>

export const panelAssetListResponseSchema = z.object({
  data: z.array(panelAssetObjectSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).strict(),
}).strict()

export type PanelAssetListResponse = z.infer<typeof panelAssetListResponseSchema>
