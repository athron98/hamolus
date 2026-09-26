import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { CoreClient } from './core'
import type { Env } from './env'

const MAX = 250_000

const nameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'snake_case, must start with a lowercase letter (core metadata identifiers)')

const scopeArgs = {
  land: z
    .string()
    .regex(/^[a-z0-9_]+$/, 'snake_case')
    .max(64)
    .optional()
    .describe('Tenant land; overrides the server CORE_LAND. Required when the core runs in centralized mode without a server default.'),
  colony: z
    .string()
    .regex(/^[a-z0-9_]+$/, 'snake_case')
    .max(64)
    .optional()
    .describe('Tenant colony within the land (optional).'),
}

const paginationArgs = {
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25).describe('Rows per page (core caps at 100).'),
}

const fileListArgs = {
  search: z.string().max(200).optional(),
  group: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  ...paginationArgs,
  ...scopeArgs,
}

function format(v: unknown): string {
  let s: string
  try {
    s = JSON.stringify(v, null, 2)
  } catch {
    s = String(v)
  }
  if (s.length > MAX) s = `${s.slice(0, MAX)}\n… (result truncated at ${MAX} chars)`
  return s ?? ''
}

function ok(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function err(message: unknown): CallToolResult {
  return { content: [{ type: 'text', text: message instanceof Error ? message.message : String(message) }], isError: true }
}

function run<A>(fn: (args: A) => Promise<unknown>): (args: A) => Promise<CallToolResult> {
  return async (args: A) => {
    try {
      return ok(format(await fn(args)))
    } catch (e) {
      return err(e)
    }
  }
}

function runWrite<A>(core: CoreClient, fn: (args: A) => Promise<unknown>): (args: A) => Promise<CallToolResult> {
  return async (args: A) => {
    try {
      core.assertWritable()
      return ok(format(await fn(args)))
    } catch (e) {
      return err(e)
    }
  }
}

/** Wrap a list response for a readable first line in the tool result. */
function summarize(label: string, resp: { data?: unknown[]; meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number } }): string {
  const rows = resp.data?.length ?? 0
  const meta = resp.meta
  if (!meta) return label
  return `${label}: ${meta.total ?? rows} total, page ${meta.page ?? 1}/${meta.totalPages ?? 1}, showing ${rows}`
}

export function registerTools(server: McpServer, core: CoreClient, env: Env): void {
  void env

  /* ------------------------------------------------------------------ */
  /* global registry (lands / colonies)                                  */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    'list_lands',
    {
      description: 'List all lands registered on the core (global, scope-agnostic).',
      inputSchema: z.object({}),
    },
    run(() => core.get('/_meta/universe/lands')),
  )

  server.registerTool(
    'list_colonies',
    {
      description: 'List all colonies registered on the core (global, scope-agnostic).',
      inputSchema: z.object({}),
    },
    run(() => core.get('/_meta/universe/colonies')),
  )

  /* ------------------------------------------------------------------ */
  /* settings + stats                                                    */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    'get_stats',
    {
      description: 'Dashboard stats from the core: collection count, total records, media assets, groups, and a per-collection breakdown.',
      inputSchema: z.object({ ...scopeArgs }),
    },
    run(({ land, colony }: z.infer<typeof scopeArgsSchema>) => core.get('/_meta/stats', undefined, { land, colony })),
  )

  server.registerTool(
    'get_settings',
    {
      description: 'Read the KV settings blob (site name, navigation, localization, etc.) of the active land/colony scope.',
      inputSchema: z.object({ ...scopeArgs }),
    },
    run(({ land, colony }: z.infer<typeof scopeArgsSchema>) => core.get('/_meta/settings', undefined, { land, colony })),
  )

  server.registerTool(
    'update_settings',
    {
      description: 'Shallow-merge a patch into the KV settings blob of the active land/colony scope (write tool; disabled in read-only mode).',
      inputSchema: z.object({
        patch: z.record(z.string(), z.unknown()).describe('Partial settings object merged into the stored settings.'),
        ...scopeArgs,
      }),
    },
    runWrite(core, ({ patch, land, colony }: { patch: Record<string, unknown>; land?: string; colony?: string }) =>
      core.put('/_meta/settings', patch, { land, colony }),
    ),
  )

  /* ------------------------------------------------------------------ */
  /* groups                                                              */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    'list_groups',
    {
      description: 'List navigation groups registered on the core (id, label, optional parent group id, icon).',
      inputSchema: z.object({ ...scopeArgs }),
    },
    run(({ land, colony }: z.infer<typeof scopeArgsSchema>) => core.get('/_meta/groups', undefined, { land, colony })),
  )

  server.registerTool(
    'put_group',
    {
      description: 'Create or update a navigation group (write tool; disabled in read-only mode). parent must already exist; cycles are rejected.',
      inputSchema: z.object({
        id: nameSchema,
        label: z.string().min(1).max(80),
        parent: z
          .string()
          .regex(/^[a-z][a-z0-9_]*$/)
          .optional()
          .describe('Parent group id for nesting (must already be registered).'),
        icon: z.string().max(40).optional(),
        ...scopeArgs,
      }),
    },
    runWrite(core, (args: { id: string; label: string; parent?: string; icon?: string; land?: string; colony?: string }) =>
      core.put(`/_meta/groups/${args.id}`, { id: args.id, label: args.label, parent: args.parent, icon: args.icon }, { land: args.land, colony: args.colony }),
    ),
  )

  server.registerTool(
    'delete_group',
    {
      description: 'Delete a navigation group (write tool; disabled in read-only mode). Fails while child groups or referencing collections exist.',
      inputSchema: z.object({ id: nameSchema, ...scopeArgs }),
    },
    runWrite(core, (args: { id: string; land?: string; colony?: string }) => core.delete(`/_meta/groups/${args.id}`, { land: args.land, colony: args.colony })),
  )

  /* ------------------------------------------------------------------ */
  /* collections                                                         */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    'list_collections',
    {
      description: 'List every collection defined on the core with its full field definition (name, label, group, fields, options).',
      inputSchema: z.object({ ...scopeArgs }),
    },
    run(({ land, colony }: z.infer<typeof scopeArgsSchema>) => core.get('/_meta/collections', undefined, { land, colony })),
  )

  server.registerTool(
    'get_collection',
    {
      description: 'Get one collection definition (schema, fields, consoleView/group layout, relation configs).',
      inputSchema: z.object({ name: nameSchema, ...scopeArgs }),
    },
    run(({ name, land, colony }: { name: string; land?: string; colony?: string }) =>
      core.get(`/_meta/collections/${encodeURIComponent(name)}`, undefined, { land, colony }),
    ),
  )

  server.registerTool(
    'put_collection',
    {
      description:
        'Create or update a collection definition (write tool; disabled in read-only mode). Creating a collection creates its D1 table ' +
        'and exposes CRUD at /api/<name>. Include the full definition; updating an existing collection auto-migrates new fields.',
      inputSchema: z.object({
        definition: z
          .record(z.string(), z.unknown())
          .describe('CollectionDefinition JSON: { name, label?, description?, group?, icon?, timestamps?, softDelete?, fields: FieldDefinition[] }.'),
        ...scopeArgs,
      }),
    },
    runWrite(core, (args: { definition: Record<string, unknown>; land?: string; colony?: string }) => {
      const name = String(args.definition.name ?? '')
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        throw new Error('definition.name must be a snake_case identifier (core metadata).')
      }
      return core.put(`/_meta/collections/${encodeURIComponent(name)}`, args.definition, { land: args.land, colony: args.colony })
    }),
  )

  server.registerTool(
    'delete_collection',
    {
      description: 'Delete a collection: drops its metadata AND its D1 table and all records (write tool; disabled in read-only mode). Destructive.',
      inputSchema: z.object({ name: nameSchema, ...scopeArgs }),
    },
    runWrite(core, (args: { name: string; land?: string; colony?: string }) =>
      core.delete(`/_meta/collections/${encodeURIComponent(args.name)}`, { land: args.land, colony: args.colony }),
    ),
  )

  /* ------------------------------------------------------------------ */
  /* records                                                             */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    'list_records',
    {
      description:
        'Paginated read of a collection. Supports full-text search (?search=), locale resolution for localized fields, server-side ' +
        'sorting, and row-limit control. See get_collection for the field schema.',
      inputSchema: z.object({
        collection: nameSchema,
        search: z.string().max(200).optional().describe('Full-text LIKE search across string-like fields.'),
        locale: z.string().max(20).optional().describe('Resolve localized fields to this language (e.g. en, id).'),
        sortBy: z.string().max(64).optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        ...paginationArgs,
        ...scopeArgs,
      }),
    },
    run(
      (args: {
        collection: string
        search?: string
        locale?: string
        sortBy?: string
        sortDir?: string
        page?: number
        pageSize?: number
        land?: string
        colony?: string
      }) =>
        core
          .get(
            `/${encodeURIComponent(args.collection)}`,
            {
              page: args.page,
              pageSize: args.pageSize,
              locale: args.locale,
              search: args.search,
              sortBy: args.sortBy,
              sortDir: args.sortDir,
            },
            { land: args.land, colony: args.colony },
          )
          .then((resp) => `${summarize(`records:${args.collection}`, resp as any)}\n\n${format(resp)}`),
    ),
  )

  server.registerTool(
    'get_record',
    {
      description: 'Read a single record by its primary key (usually a UUID). Pass ?locale to resolve localized fields.',
      inputSchema: z.object({
        collection: nameSchema,
        id: z.string().max(200),
        locale: z.string().max(20).optional(),
        ...scopeArgs,
      }),
    },
    run((args: { collection: string; id: string; locale?: string; land?: string; colony?: string }) =>
      core.get(`/${encodeURIComponent(args.collection)}/${encodeURIComponent(args.id)}`, { locale: args.locale }, { land: args.land, colony: args.colony }),
    ),
  )

  server.registerTool(
    'create_record',
    {
      description:
        'Create a record in a collection (write tool; disabled in read-only mode). Pass the record fields as a snake_case object; ' +
        'the core validates against the collection definition (required fields, enums, relation targets). Call get_collection first to learn the fields.',
      inputSchema: z.object({
        collection: nameSchema,
        data: z.record(z.string(), z.unknown()),
        ...scopeArgs,
      }),
    },
    runWrite(core, (args: { collection: string; data: Record<string, unknown>; land?: string; colony?: string }) =>
      core.post(`/${encodeURIComponent(args.collection)}`, args.data, { land: args.land, colony: args.colony }),
    ),
  )

  server.registerTool(
    'update_record',
    {
      description: 'Update a record by primary key (write tool; disabled in read-only mode). Send only the fields that change.',
      inputSchema: z.object({
        collection: nameSchema,
        id: z.string().max(200),
        data: z.record(z.string(), z.unknown()),
        ...scopeArgs,
      }),
    },
    runWrite(core, (args: { collection: string; id: string; data: Record<string, unknown>; land?: string; colony?: string }) =>
      core.put(`/${encodeURIComponent(args.collection)}/${encodeURIComponent(args.id)}`, args.data, { land: args.land, colony: args.colony }),
    ),
  )

  server.registerTool(
    'delete_record',
    {
      description: 'Delete a record by primary key (write tool; disabled in read-only mode).',
      inputSchema: z.object({
        collection: nameSchema,
        id: z.string().max(200),
        ...scopeArgs,
      }),
    },
    runWrite(core, (args: { collection: string; id: string; land?: string; colony?: string }) =>
      core.delete(`/${encodeURIComponent(args.collection)}/${encodeURIComponent(args.id)}`, { land: args.land, colony: args.colony }),
    ),
  )

  server.registerTool(
    'bulk_delete_records',
    {
      description: 'Delete many records of one collection by id list (write tool; disabled in read-only mode).',
      inputSchema: z.object({
        collection: nameSchema,
        ids: z.array(z.string().max(200)).min(1).max(500),
        ...scopeArgs,
      }),
    },
    runWrite(core, (args: { collection: string; ids: string[]; land?: string; colony?: string }) =>
      core.post(`/${encodeURIComponent(args.collection)}/__bulk_delete`, { ids: args.ids }, { land: args.land, colony: args.colony }),
    ),
  )

  /* ------------------------------------------------------------------ */
  /* media + file libraries                                              */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    'list_media',
    {
      description: 'Paginated media library listing (R2 assets with taxonomy). Supports ?search and group/category/tag exact filters.',
      inputSchema: z.object({ ...fileListArgs }),
    },
    run(
      (args: {
        search?: string
        group?: string
        category?: string
        tag?: string
        page?: number
        pageSize?: number
        land?: string
        colony?: string
      }) =>
        core
          .get(
            '/_media',
            { search: args.search, group: args.group, category: args.category, tag: args.tag, page: args.page, pageSize: args.pageSize },
            { land: args.land, colony: args.colony },
          )
          .then((resp) => `${summarize('media', resp as any)}\n\n${format(resp)}`),
    ),
  )

  server.registerTool(
    'list_documents',
    {
      description: 'Paginated documents library listing (non-image files). Supports ?search and group/category/tag exact filters.',
      inputSchema: z.object({ ...fileListArgs }),
    },
    run(
      (args: {
        search?: string
        group?: string
        category?: string
        tag?: string
        page?: number
        pageSize?: number
        land?: string
        colony?: string
      }) =>
        core
          .get(
            '/_documents',
            { search: args.search, group: args.group, category: args.category, tag: args.tag, page: args.page, pageSize: args.pageSize },
            { land: args.land, colony: args.colony },
          )
          .then((resp) => `${summarize('documents', resp as any)}\n\n${format(resp)}`),
    ),
  )

  server.registerTool(
    'list_attachments',
    {
      description: 'Paginated attachments library listing (non-image files). Supports ?search and group/category/tag exact filters.',
      inputSchema: z.object({ ...fileListArgs }),
    },
    run(
      (args: {
        search?: string
        group?: string
        category?: string
        tag?: string
        page?: number
        pageSize?: number
        land?: string
        colony?: string
      }) =>
        core
          .get(
            '/_attachments',
            { search: args.search, group: args.group, category: args.category, tag: args.tag, page: args.page, pageSize: args.pageSize },
            { land: args.land, colony: args.colony },
          )
          .then((resp) => `${summarize('attachments', resp as any)}\n\n${format(resp)}`),
    ),
  )
}

const scopeArgsSchema = z.object({ ...scopeArgs })