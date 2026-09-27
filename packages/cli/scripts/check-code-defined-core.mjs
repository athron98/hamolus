#!/usr/bin/env node
/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Code-defined collections/panels over HTTP — the half of the contract that
 * needs a real core.
 *
 * The offline check (`packages/core/scripts/check-code-definitions.mjs`) covers
 * boot-time validation. This one covers what only a booted Worker can prove:
 *
 *   1. a code-defined collection and panel exist in the API immediately after
 *      start, with the field list, primary key and parsed defaults the file
 *      declared — nothing has to be created through the console first,
 *   2. the definition is frozen over HTTP: `PUT`/`DELETE` on the collection and
 *      `PUT`/`PATCH`/`DELETE` on the panel are refused with their `403` codes,
 *   3. the freeze is scoped, not global: a collection that is *not* declared in
 *      code can still be created, renamed and deleted, and records inside a
 *      code-defined collection stay fully editable (create, read, update, list,
 *      delete, then `404`),
 *   4. definitions are applied per scope, not only to the default one: a land
 *      registered after boot comes up with the same collection and panel, its
 *      own physical table (a record created there is invisible to the default
 *      land), and the same `403` freeze.
 *
 * Point it at a **generated `predefined` core** — that template registers `posts` and a
 * `content` panel, and this check asserts exactly those. The default `basic` template
 * registers nothing, so against a core generated without `--core predefined` the
 * registration checks fail by design.
 *
 *   # in the generated app
 *   hamolus create acme --core predefined && cd acme/core
 *   pnpm install && pnpm exec wrangler dev --port 8799
 *   # in the monorepo
 *   BASE=http://127.0.0.1:8799 ADMIN_KEY=... \
 *     node packages/cli/scripts/check-code-defined-core.mjs
 *   pnpm -F @hamolus/cli check:code-defined-core
 *
 * Loopback only, and self-cleaning: it creates a scratch collection and a
 * scratch land, and both are removed on the way out.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:8799'
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'dev-admin-key-change-me'
// Slug-safe on purpose: the stamp ends up in record slugs, which are
// lowercase-alphanumeric-and-dashes.
const STAMP = process.env.CODE_DEF_STAMP ?? `cddef${Date.now().toString(36)}`
const LAND = `${STAMP}_lnd`
const COLONY = `${STAMP}_cny`
const SCRATCH = `${STAMP}_notes`

let pass = 0
const failures = []
const ok = (name, condition, detail = '') => {
  if (condition) {
    pass += 1
    console.log(`PASS  ${name}`)
  } else {
    failures.push(name)
    console.log(`FAIL  ${name}${detail ? `\n      ${String(detail).replace(/\n/g, '\n      ')}` : ''}`)
  }
}
const json = async (res) => res.json().catch(() => ({}))

if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(BASE).hostname)) {
  console.error('ERROR  Refusing to run against a non-loopback BASE.')
  process.exit(1)
}

const bootstrap = await json(
  await fetch(`${BASE}/api/_auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: ADMIN_KEY }),
  }),
)
const TOKEN = bootstrap.data?.token
if (!TOKEN) {
  console.error(`ERROR  Could not mint an admin token from ${BASE} — is the core running and ADMIN_KEY correct?`)
  process.exit(1)
}

const call = async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) },
  })
  return { status: res.status, body: await json(res) }
}
const body = (method, payload) => ({ method, body: JSON.stringify(payload) })

// 1. Registration at boot ---------------------------------------------------
const collections = await call('/api/_meta/collections')
const names = (collections.body?.data ?? []).map((definition) => definition.name)
ok('code-defined `posts` collection is registered at boot', names.includes('posts'), names.join(', '))
ok('bootstrapped `privileges` is still present', names.includes('privileges'), names.join(', '))

const posts = (collections.body?.data ?? []).find((definition) => definition.name === 'posts')
ok('`posts` uses the implicit id primary key', posts?.primaryKey === 'id', String(posts?.primaryKey))
const declaredFields = (posts?.fields ?? []).map((field) => field.name)
ok(
  '`posts` has exactly the declared fields (id is not duplicated)',
  JSON.stringify(declaredFields) === JSON.stringify(['title', 'slug', 'excerpt', 'body', 'published', 'published_at']),
  declaredFields.join(', '),
)
ok(
  'the `published` default survived the write',
  (posts?.fields ?? []).find((field) => field.name === 'published')?.default === false,
  JSON.stringify((posts?.fields ?? []).find((field) => field.name === 'published')?.default),
)

const panels = await call('/api/_panels')
const panelIds = (panels.body?.data ?? []).map((definition) => definition.id)
ok('code-defined `content` panel is registered at boot', panelIds.includes('content'), panelIds.join(', '))
const content = (panels.body?.data ?? []).find((definition) => definition.id === 'content')
ok('`content` declares one view', content?.views?.length === 1, String(content?.views?.length))
ok('the view resolved its collection reference to posts', content?.views?.[0]?.collection === 'posts', content?.views?.[0]?.collection)
ok(
  'the view read projection kept every declared field',
  JSON.stringify(content?.views?.[0]?.fields?.read) ===
    JSON.stringify(['id', 'title', 'slug', 'excerpt', 'published', 'published_at']),
  JSON.stringify(content?.views?.[0]?.fields?.read),
)

// 2. Definitions are frozen ------------------------------------------------
const putCollection = await call('/api/_meta/collections/posts', body('PUT', posts))
ok(
  'PUT on a code-defined collection -> 403 CODE_DEFINED_COLLECTION',
  putCollection.status === 403 && putCollection.body?.error?.code === 'CODE_DEFINED_COLLECTION',
  `${putCollection.status} ${JSON.stringify(putCollection.body)}`,
)
const deleteCollection = await call('/api/_meta/collections/posts', { method: 'DELETE' })
ok(
  'DELETE on a code-defined collection -> 403 CODE_DEFINED_COLLECTION',
  deleteCollection.status === 403 && deleteCollection.body?.error?.code === 'CODE_DEFINED_COLLECTION',
  `${deleteCollection.status} ${JSON.stringify(deleteCollection.body)}`,
)
for (const method of ['PUT', 'PATCH', 'DELETE']) {
  const result = await call('/api/_panels/content', method === 'DELETE' ? { method } : body(method, content))
  ok(
    `${method} on a code-defined panel -> 403 CODE_DEFINED_PANEL`,
    result.status === 403 && result.body?.error?.code === 'CODE_DEFINED_PANEL',
    `${result.status} ${JSON.stringify(result.body)}`,
  )
}

// 3. Collections that are not declared in code stay manageable --------------
const scratch = {
  name: SCRATCH,
  label: 'Scratch Notes',
  primaryKey: 'id',
  fields: [{ name: 'title', type: 'string', required: true }],
}
const created = await call(`/api/_meta/collections/${SCRATCH}`, body('PUT', scratch))
ok(
  'a collection that is not code-defined can still be created',
  created.status === 200 || created.status === 201,
  `${created.status} ${JSON.stringify(created.body)}`,
)
const renamed = await call(
  `/api/_meta/collections/${SCRATCH}`,
  body('PUT', { ...scratch, label: 'Scratch Notes Renamed' }),
)
ok('…and renamed', renamed.status === 200, `${renamed.status} ${JSON.stringify(renamed.body)}`)
const dropped = await call(`/api/_meta/collections/${SCRATCH}`, { method: 'DELETE' })
ok('…and deleted', dropped.status === 200 || dropped.status === 204, dropped.status)

// 4. Records inside a code-defined collection stay editable ----------------
const createdRecord = await call('/api/posts', body('POST', { title: 'Code-defined check', slug: `${STAMP}-post` }))
ok(
  'a record can be created inside a code-defined collection',
  createdRecord.status === 200 || createdRecord.status === 201,
  `${createdRecord.status} ${JSON.stringify(createdRecord.body)}`,
)
const recordId = createdRecord.body?.data?.id
const read = await call(`/api/posts/${recordId}`)
ok('and read back', read.status === 200, `${read.status} ${JSON.stringify(read.body)}`)
const updated = await call(`/api/posts/${recordId}`, body('PUT', { title: 'Code-defined check edited', published: true }))
ok(
  'and updated, including a boolean the schema defaulted to false',
  updated.status === 200 &&
    updated.body?.data?.title === 'Code-defined check edited' &&
    updated.body?.data?.published === true,
  `${updated.status} ${JSON.stringify(updated.body?.data)}`,
)
const listed = await call('/api/posts?pageSize=100')
ok('and appears in the list', (listed.body?.data ?? []).some((row) => row.id === recordId), String(listed.status))
const removedRecord = await call(`/api/posts/${recordId}`, { method: 'DELETE' })
ok('and deleted', removedRecord.status === 200 || removedRecord.status === 204, String(removedRecord.status))
const gone = await call(`/api/posts/${recordId}`)
ok('and is then 404', gone.status === 404, String(gone.status))

// 5. Definitions are applied per scope -------------------------------------
// An admin-key session carries no land claim, so the headers alone decide the
// scope. A land is inert until it owns a colony — `bootstrapScope` only acts on
// a (land, colony) pair the registry knows — so the check registers both.
const landHeaders = { 'x-land': LAND, 'x-colony': COLONY }
const landCreated = await call(`/api/_meta/universe/lands/${LAND}`, body('PUT', { label: 'Code-defined check' }))
ok(
  'a land can be registered after boot',
  landCreated.status === 200 || landCreated.status === 201,
  `${landCreated.status} ${JSON.stringify(landCreated.body)}`,
)
const colonyCreated = await call(
  `/api/_meta/universe/colonies/${COLONY}`,
  body('PUT', { landId: LAND, label: 'Code-defined check' }),
)
ok(
  '…with a colony of its own',
  colonyCreated.status === 200 || colonyCreated.status === 201,
  `${colonyCreated.status} ${JSON.stringify(colonyCreated.body)}`,
)
const landCollections = await call('/api/_meta/collections', { headers: landHeaders })
const landNames = (landCollections.body?.data ?? []).map((definition) => definition.name)
ok('the new land starts with the code-defined collection', landNames.includes('posts'), landNames.join(', '))
ok('…and starts clean, without the default land’s scratch data', !landNames.includes(SCRATCH), landNames.join(', '))
const landPanels = await call('/api/_panels', { headers: landHeaders })
ok(
  'the new land starts with the code-defined panel',
  (landPanels.body?.data ?? []).some((definition) => definition.id === 'content'),
  (landPanels.body?.data ?? []).map((definition) => definition.id).join(', '),
)
const landPut = await call('/api/_meta/collections/posts', { ...body('PUT', posts), headers: landHeaders })
ok(
  'the freeze applies in the new land too',
  landPut.status === 403 && landPut.body?.error?.code === 'CODE_DEFINED_COLLECTION',
  `${landPut.status} ${JSON.stringify(landPut.body)}`,
)
const landRecord = await call('/api/posts', {
  ...body('POST', { title: 'Land-scoped check', slug: `${STAMP}-land` }),
  headers: landHeaders,
})
ok(
  'records are writable in the new land (its own physical table)',
  landRecord.status === 200 || landRecord.status === 201,
  `${landRecord.status} ${JSON.stringify(landRecord.body)}`,
)
const landRecordId = landRecord.body?.data?.id
const defaultList = await call('/api/posts?pageSize=100')
ok(
  '…and stay scoped to it',
  !(defaultList.body?.data ?? []).some((row) => row.id === landRecordId),
  `id ${landRecordId} leaked into the default land`,
)
if (landRecordId) {
  await call(`/api/posts/${landRecordId}`, { method: 'DELETE', headers: landHeaders })
}
const colonyDeleted = await call(`/api/_meta/universe/colonies/${COLONY}`, { method: 'DELETE' })
ok('the scratch colony is removed', colonyDeleted.status === 200 || colonyDeleted.status === 204, String(colonyDeleted.status))
const landDeleted = await call(`/api/_meta/universe/lands/${LAND}`, { method: 'DELETE' })
ok('the scratch land is removed', landDeleted.status === 200 || landDeleted.status === 204, String(landDeleted.status))

console.log(`\n${pass} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
