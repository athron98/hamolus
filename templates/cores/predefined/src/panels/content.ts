// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * A panel defined in source control.
 *
 * A panel is a manifest — views, menu, roles, members — that a generated app
 * renders. Defining it here means the manifest is reviewable in a pull request
 * instead of living only in the database.
 *
 * Like code-defined collections, the **definition** is read-only: `POST`,
 * `PUT`/`PATCH` and `DELETE` on this panel id return `403 CODE_DEFINED_PANEL`.
 * What the panel *does* is unaffected — its views keep reading and writing
 * records, and the app built for it keeps working.
 *
 * Notes on the shape below:
 * - `views[].fields` is `{ read, write }`. There is no `all` shorthand; a role
 *   that may create records must list every required field under `write`.
 * - `members` is empty by default. Assign users in the console's Users page
 *   (or the API) once they exist — member ids are user ids, not roles.
 * - Panels are applied *after* collections, so every `collection` referenced by a
 *   view or metric must already be registered.
 */
import type { PanelDefinitionInput } from '@hamolus/types'

export const CONTENT = {
  id: 'content',
  name: 'Content',
  description: 'Editorial queue, defined in code.',
  icon: 'file',
  views: [
    {
      id: 'posts',
      kind: 'table',
      label: 'Posts',
      path: '/content/posts',
      collection: 'posts',
      operations: ['read'],
      searchable: true,
      pageSize: 20,
      fields: { read: ['id', 'title', 'slug', 'excerpt', 'published', 'published_at'], write: [] },
      defaultSort: { field: 'published_at', direction: 'desc' },
    },
  ],
  menu: [{ id: 'posts', label: 'Posts', path: '/content/posts', viewId: 'posts' }],
  roles: [
    {
      id: 'reader',
      label: 'Reader',
      description: 'May list posts, nothing else.',
      views: [{ viewId: 'posts', operations: ['read'] }],
    },
  ],
} satisfies PanelDefinitionInput
