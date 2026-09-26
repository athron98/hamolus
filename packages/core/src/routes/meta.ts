import { Hono } from 'hono'
import type { AuthTokenPayload } from '@hamolus/types'
import type { Env } from '../env'
import { badRequest, forbidden } from '../errors'
import { createDb } from '../db/client'
import {
  deleteCollection,
  getCollection,
  listCollections,
  putCollection,
} from '../meta/store'
import { deleteGroup, getGroup, listGroups, putGroup } from '../meta/groups'
import { getSettings, putSettings } from '../meta/settings'
import { getDashboardStats } from '../meta/stats'
import { PROTECTED_COLLECTION } from '../auth/privileges'
import { requireRead, requireSession, requireWrite } from '../auth/session'
import { resolveRequestScope } from '../scope'

export const metaRoutes = new Hono<{ Bindings: Env }>()

/** Aggregate dashboard statistics (collection/record/media counts + per-collection). */
metaRoutes.get('/stats', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireSession(payload, 'settings.read')
  const scope = await resolveRequestScope(c)
  const data = await getDashboardStats(db, scope.land, scope.colony)
  return c.json({ data })
})

/** Read the full settings blob from KV. */
metaRoutes.get('/settings', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireRead(payload, 'settings.read')
  const scope = await resolveRequestScope(c)
  const data = await getSettings(c.env.SETTINGS, scope.land, scope.colony)
  return c.json({ data })
})

/** Merge `patch` into the current settings and persist to KV. */
metaRoutes.put('/settings', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireWrite(payload, 'settings.write')
  const scope = await resolveRequestScope(c)
  const body = (await c.req.json().catch(() => null)) as unknown
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Settings body must be a JSON object')
  }
  const data = await putSettings(c.env.SETTINGS, body as Record<string, unknown>, scope.land, scope.colony)
  return c.json({ data })
})

/** List all collection definitions. */
metaRoutes.get('/collections', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireRead(payload, 'collections.read')
  const scope = await resolveRequestScope(c)
  const defs = await listCollections(db, scope.land, scope.colony)
  return c.json({ data: defs })
})

metaRoutes.get('/collections/:name', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireRead(payload, 'collections.read')
  const scope = await resolveRequestScope(c)
  const def = await getCollection(db, c.req.param('name'), scope.land, scope.colony)
  return c.json({ data: def })
})

/** Upsert a collection definition (create/update metadata + physical table). */
metaRoutes.put('/collections/:name', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireWrite(payload, 'collections.write')
  const scope = await resolveRequestScope(c)
  const name = c.req.param('name')
  if (name === PROTECTED_COLLECTION) {
    throw forbidden(`The '${PROTECTED_COLLECTION}' definition is managed by the platform`)
  }
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw badRequest('Body must be a JSON object')
  if (body.name !== undefined && body.name !== name) {
    throw badRequest('Body name must match the path parameter')
  }
  const def = await putCollection(db, { ...body, name }, scope.land, scope.colony)
  return c.json({ data: def })
})

metaRoutes.delete('/collections/:name', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireWrite(payload, 'collections.write')
  const scope = await resolveRequestScope(c)
  const name = c.req.param('name')
  // Deleting `privileges` is allowed (ensurePrivileges re-bootstraps the
  // definition + seeds with stable ids on the next request), so seeds keep working.
  await deleteCollection(db, name, scope.land, scope.colony)
  return c.body(null, 204)
})

/** List all registered navigation groups. */
metaRoutes.get('/groups', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireRead(payload, 'collections.read')
  const scope = await resolveRequestScope(c)
  const groups = await listGroups(db, scope.land, scope.colony)
  return c.json({ data: groups })
})

metaRoutes.get('/groups/:id', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireRead(payload, 'collections.read')
  const scope = await resolveRequestScope(c)
  const group = await getGroup(db, c.req.param('id'), scope.land, scope.colony)
  return c.json({ data: group })
})

/** Upsert a group definition (registry + nesting/parent validation + cycle check). */
metaRoutes.put('/groups/:id', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireWrite(payload, 'collections.write')
  const scope = await resolveRequestScope(c)
  const id = c.req.param('id')
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') throw badRequest('Body must be a JSON object')
  if (body.id !== undefined && body.id !== id) {
    throw badRequest('Body id must match the path parameter')
  }
  const group = await putGroup(db, { ...body, id }, scope.land, scope.colony)
  return c.json({ data: group })
})

metaRoutes.delete('/groups/:id', async (c) => {
  const db = createDb(c.env.DB)
  const payload = c.get('jwtPayload') as AuthTokenPayload | undefined
  requireWrite(payload, 'collections.write')
  const scope = await resolveRequestScope(c)
  await deleteGroup(db, c.req.param('id'), scope.land, scope.colony)
  return c.body(null, 204)
})