// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * A collection defined in source control.
 *
 * The shape is the same one the console writes, so you can move a collection
 * between the two without translating it: create it in the console, copy the
 * JSON into a file like this one, and the API refuses to edit it afterwards.
 *
 * Two properties come with declaring it here:
 *
 * - **The definition is read-only.** `PUT`/`DELETE /_meta/collections/posts`
 *   return `403 CODE_DEFINED_COLLECTION`. Change the file and redeploy instead.
 * - **The records stay editable.** Everything under `/posts` — create, update,
 *   delete, search, filters — works exactly as it does for a console-made
 *   collection. Only the schema is frozen.
 *
 * The physical D1 table is created and migrated automatically, so adding a field
 * here and redeploying adds the column without touching records.
 *
 * Note on `primaryKey`: `id` is the implicit primary key and is *not* one of
 * `fields`. Naming it here is what makes the column exist; declaring an `id`
 * field alongside it would be a duplicate. Every collection gets `id` whether or
 * not it is spelled out, so `fields` lists only the columns you are adding.
 */
import type { CollectionDefinitionInput } from '@hamolus/types'

export const POSTS = {
  name: 'posts',
  label: 'Posts',
  description: 'Editorial content, defined in code.',
  group: 'Content',
  icon: 'file',
  timestamps: true,
  primaryKey: 'id',
  fields: [
    { name: 'title', type: 'string', label: 'Title', required: true },
    { name: 'slug', type: 'slug', label: 'Slug', unique: true, required: true },
    { name: 'excerpt', type: 'text', label: 'Excerpt' },
    { name: 'body', type: 'richtext', label: 'Body', format: 'markdown' },
    { name: 'published', type: 'boolean', label: 'Published', default: false },
    { name: 'published_at', type: 'datetime', label: 'Published at' },
  ],
} satisfies CollectionDefinitionInput
