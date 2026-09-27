// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
// {{SEED_NAME}} — a self-cleaning seed for a Hamolus core.
//
// Seeds are plain Node scripts: no build step, no dependencies, just fetch. This
// template is the starting point every generated seed gets, so it already handles the
// parts that are easy to get wrong:
//
//   * authentication — mints a short-lived admin token from ADMIN_KEY, then sends it
//     as a bearer token on every call. Nothing else needs a login step.
//   * self-cleaning — drops the collections (and media) this seed owns before
//     recreating them, so running it twice never duplicates records. It uses the
//     metadata endpoints rather than truncating tables, because those also drop the
//     physical D1 tables and R2 objects they own.
//   * scoping — it only ever touches its own collection and its own media group, so it
//     is safe to run against a core that already holds other data.
//
// Usage:
//   BASE=http://localhost:8787 ADMIN_KEY=dev-admin-key-change-me pnpm seed
//   BASE=https://<core-host> ADMIN_KEY=<key> DRY_RUN=1 pnpm seed
//
// BASE is the core's origin. The `/api` prefix is added by this script.

const BASE = (process.env.BASE ?? 'http://localhost:8787').replace(/\/+$/, '')
const API = `${BASE}/api`
const KEY = process.env.ADMIN_KEY
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

// Everything this seed owns. Rename the collection if you want a different dataset, and
// add your own collection definitions to `collections` below.
const COLLECTION = '{{SEED_ID}}_notes'
const MEDIA_GROUP = '{{SEED_ID}}'

/**
 * The collections this seed creates, in dependency order, with the records each one gets.
 * Adding a second collection is a matter of appending another `{ definition, records }`
 * entry here — nothing below needs to change.
 */
const collections = [
  {
    records: [
      { title: 'First note', slug: 'first-note', body: 'Replace this with your own content.', pinned: true },
      { title: 'Second note', slug: 'second-note', body: 'A seed is just a script.', pinned: false },
      { title: 'Third note', slug: 'third-note', body: 'Re-run it as often as you like.', pinned: false },
    ],
    definition: {
      name: COLLECTION,
      label: '{{SEED_NAME}} Notes',
      description: 'Seeded by {{PACKAGE_NAME}}. Delete this collection to undo the seed.',
      group: 'seeds',
      icon: 'file',
      timestamps: true,
      fields: [
        { name: 'title', label: 'Title', type: 'string', required: true, consoleView: 'header' },
        { name: 'slug', label: 'Slug', type: 'slug', required: true, unique: true },
        { name: 'body', label: 'Body', type: 'text' },
        { name: 'pinned', label: 'Pinned', type: 'boolean', default: false, consoleView: 'side' },
      ],
    },
  },
]

// ---------------------------------------------------------------------------
// Core client
// ---------------------------------------------------------------------------

let token = ''

/** Call the core and throw a readable error on any non-2xx response. `path` is relative to `/api`. */
async function api(path, init = {}) {
  const headers = { ...(init.headers ?? {}), authorization: `Bearer ${token}` }
  if (init.body && !headers['content-type']) headers['content-type'] = 'application/json'

  const res = await fetch(`${API}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 400)}`)
  }
  return res.status === 204 ? null : res.json()
}

/** Exchange ADMIN_KEY for a token. The token is only valid for a short while. */
async function login() {
  let res
  try {
    res = await fetch(`${API}/_auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: KEY }),
    })
  } catch (cause) {
    throw new Error(
      `Could not reach a core at ${BASE} (${cause.message}).\n` +
        `Start one with \`pnpm -F ./core dev\`, or point BASE at a deployed core.`,
    )
  }
  if (!res.ok) {
    throw new Error(
      `Could not mint a token (${res.status}). Check that ADMIN_KEY matches the core at ${BASE}.`,
    )
  }
  const payload = await res.json()
  token = payload?.data?.token
  if (!token) throw new Error('The core returned no token — is this really a Hamolus core?')
}

/** Collect every page of a list endpoint into one array. */
async function listAll(path) {
  const rows = []
  for (let page = 1; ; page++) {
    const res = await api(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`)
    rows.push(...(res.data ?? []))
    if (rows.length >= (res.meta?.total ?? rows.length)) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Drop the collections and media this seed owns, so the run is repeatable. */
async function reset() {
  const names = collections.map((c) => c.definition.name)
  const existing = new Set((await api('/_meta/collections')).data.map((c) => c.name))

  for (const name of names) {
    if (!existing.has(name)) continue
    await api(`/_meta/collections/${name}`, { method: 'DELETE' })
  }

  // Media is grouped rather than owned by id, so an asset added by hand in the same
  // group is cleaned up too. Delete the group from the seed if you manage no media.
  const media = await listAll(`/_media?group=${encodeURIComponent(MEDIA_GROUP)}`)
  for (const item of media) await api(`/_media/${item.id}`, { method: 'DELETE' })

  return { collections: names.filter((n) => existing.has(n)).length, media: media.length }
}

/** Create every collection definition. */
async function defineCollections() {
  for (const { definition } of collections) {
    await api(`/_meta/collections/${definition.name}`, {
      method: 'PUT',
      body: JSON.stringify(definition),
    })
  }
}

/** Write the records, in collection order so relations resolve. */
async function createRecords() {
  let created = 0
  for (const { definition, records } of collections) {
    for (const row of records) {
      await api(`/${definition.name}`, { method: 'POST', body: JSON.stringify(row) })
      created += 1
    }
  }
  return created
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!KEY) {
    throw new Error('ADMIN_KEY is required. Try: ADMIN_KEY=dev-admin-key-change-me pnpm seed')
  }

  await login()
  console.log(`connected to ${BASE}`)

  if (DRY_RUN) {
    console.log('\ndry run — nothing will be written:')
    for (const { definition, records } of collections) {
      console.log(`  would drop + recreate "${definition.name}" (${records.length} record(s))`)
    }
    console.log(`  would delete media in group "${MEDIA_GROUP}"`)
    return
  }

  const dropped = await reset()
  console.log(
    `reset: dropped ${dropped.collections} collection(s), ${dropped.media} media asset(s)`,
  )

  await defineCollections()
  console.log(`created ${collections.length} collection(s)`)

  const created = await createRecords()
  console.log(`created ${created} record(s)`)

  console.log(`\ndone — open the console and browse "${COLLECTION}".`)
}

main().catch((error) => {
  console.error(`\nseed failed: ${error.message}`)
  process.exit(1)
})
