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
//   ADMIN_KEY=$(grep '^ADMIN_KEY=' core/.dev.vars | cut -d= -f2-) pnpm seed
//   BASE=https://<core-host> ADMIN_KEY=<key> DRY_RUN=1 pnpm seed
//
// ADMIN_KEY has no default, deliberately. The wizard generates a random one into
// core/.dev.vars, so a default here would be a wrong key that produced a confusing 401
// instead of a clear "ADMIN_KEY is required".
//
// BASE is the core's origin. The `/api` prefix is added by this script.

const BASE = (process.env.BASE ?? 'http://localhost:8787').replace(/\/+$/, '')
const API = `${BASE}/api`
const KEY = process.env.ADMIN_KEY
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

// Everything this seed owns. The site collection below is deliberately *not* namespaced
// with `{{SEED_ID}}`, unlike the notes collection next to it: the generated site asks the
// core for `articles` by that exact name (`src/lib/articles.ts`), so a prefixed collection
// would leave the site just as empty as it was before you ran this. Everything else is
// prefixed to stay out of the way of whatever you already had in the core.
const MEDIA_GROUP = '{{SEED_ID}}'

/**
 * The collections this seed creates, in dependency order, with the records each one gets.
 * Adding a second collection is a matter of appending another `{ definition, records }`
 * entry here — nothing below needs to change.
 */
const collections = [
  {
    records: [
      {
        title: 'Your first article',
        slug: 'your-first-article',
        excerpt: 'This page is example content, so the site was not empty when you opened it.',
        body: [
          'A seed is just a Node script that talks to the core over HTTP, so there is nothing',
          'magic about it: create a collection, write a few records, and delete both later.',
        ].join('\n\n'),
        cover: '',
        tags: ['intro'],
        author_name: '{{PACKAGE_NAME}}',
        published_at: '2026-01-14',
        status: 'published',
      },
      {
        title: 'Why an empty site looks broken',
        slug: 'why-an-empty-site-looks-broken',
        excerpt: 'An empty page and a failing page look identical to the person reading it.',
        body: [
          'The first thing anyone does with a new site is open it. If there is nothing on',
          'screen, they cannot tell "no content yet" apart from "this is broken", and they',
          'stop looking.',
          '',
          'So the wizard asks whether to seed example content, and answers yes when there is',
          'a site to fill. Delete these records when your own content arrives.',
        ].join('\n\n'),
        cover: '',
        tags: ['guide', 'intro'],
        author_name: '{{PACKAGE_NAME}}',
        published_at: '2026-02-03',
        status: 'published',
      },
      {
        title: 'How to replace this content',
        slug: 'how-to-replace-this-content',
        excerpt: 'The seed owns exactly the collections and media group it declares.',
        body: [
          'Every collection this seed created is named in one place, and so is the media',
          'group it cleans up, so re-running it drops and rebuilds rather than duplicating.',
          '',
          'Edit the `collections` array in this file to change the shape, then run it again.',
          'Your own content in a collection this seed does not own is never touched.',
        ].join('\n\n'),
        cover: '',
        tags: ['guide'],
        author_name: '{{PACKAGE_NAME}}',
        published_at: '2026-03-21',
        status: 'published',
      },
      {
        // Deliberately `draft`: the site filters on `status = published`, so this row proves
        // the filter works instead of adding a fourth card to the front page.
        title: 'An unpublished draft',
        slug: 'an-unpublished-draft',
        excerpt: 'Not shown on the site, and not meant to be.',
        body: 'This one is a draft, so the site leaves it out.',
        cover: '',
        tags: ['notes'],
        author_name: '{{PACKAGE_NAME}}',
        published_at: '2026-04-02',
        status: 'draft',
      },
    ],
    definition: {
      // Not `{{SEED_ID}}_articles` — see the note above MEDIA_GROUP. The generated site
      // hard-codes this name, so this is the one collection a seed cannot namespace.
      name: 'articles',
      label: 'Articles',
      description:
        'Example content read by the generated site. Delete this collection to undo the seed.',
      group: 'seeds',
      icon: 'file',
      timestamps: true,
      fields: [
        // Not `localized`. The site asks for records without a `locale` parameter, and the
        // core returns a localized field's whole `{ id, en }` object in that case — which
        // the site would then render as `[object Object]`. A plain string is what the
        // template's `Article` interface actually describes. Add `localized: true` and pass
        // a locale from the site, in that order, not the other way round.
        { name: 'title', label: 'Title', type: 'string', required: true, consoleView: 'header' },
        { name: 'slug', label: 'Slug', type: 'slug', required: true, unique: true },
        { name: 'excerpt', label: 'Excerpt', type: 'text' },
        { name: 'body', label: 'Body', type: 'richtext', format: 'markdown' },
        // `url`, not `media`: the template renders `cover` as `<img src={cover}>`, and a
        // media field reads back as an `{ id, url, alt, ... }` snapshot object instead of a
        // string. Seed real cover images into MEDIA_GROUP and switch this to `media` when
        // you want the console's asset picker.
        { name: 'cover', label: 'Cover', type: 'url' },
        {
          name: 'tags',
          label: 'Tags',
          type: 'enum',
          enumValues: ['intro', 'guide', 'notes'],
          control: 'multichecklist',
        },
        { name: 'author_name', label: 'Author', type: 'string' },
        { name: 'published_at', label: 'Published at', type: 'date' },
        {
          name: 'status',
          label: 'Status',
          type: 'enum',
          enumValues: ['draft', 'published'],
          default: 'draft',
          consoleView: 'side',
        },
      ],
    },
  },
  {
    records: [
      { title: 'First note', slug: 'first-note', body: 'Replace this with your own content.', pinned: true },
      { title: 'Second note', slug: 'second-note', body: 'A seed is just a script.', pinned: false },
      { title: 'Third note', slug: 'third-note', body: 'Re-run it as often as you like.', pinned: false },
    ],
    definition: {
      name: '{{SEED_ID}}_notes',
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
    throw new Error(
      'ADMIN_KEY is required. The wizard generated one for this project:\n' +
        '  ADMIN_KEY=$(grep "^ADMIN_KEY=" core/.dev.vars | cut -d= -f2-) pnpm seed',
    )
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

  console.log(`\ndone — open the console and browse "articles".`)
  console.log('The generated site reads this collection, so it has something to show now.')
}

main().catch((error) => {
  console.error(`\nseed failed: ${error.message}`)
  process.exit(1)
})
