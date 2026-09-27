// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { getLocalization, getRecord, listRecords, defaultLocale } from './hamolus'
import type { ResolvedLocalization } from './hamolus'

/**
 * Shape of a `team_members` record.
 *
 * Localized columns follow the core's rule: a `role` field with locales `en` and `id` is
 * stored as `role_en` and `role_id`, and the core returns the requested `locale` version on
 * the `role` field. The site does not need to know anything about that naming.
 */
export interface TeamMember {
  id: string
  name: string
  /** An optional slug; when blank, `memberSlug` falls back to `name`. */
  slug?: string
  role: string
  bio: string
  photo: string
  email: string
  order: number
}

/** A single company profile record; this collection holds one row. */
export interface CompanyProfile {
  id: string
  name: string
  tagline: string
  about: string
  address: string
  email: string
}

/**
 * The localizations that can be used to build URLs.
 *
 * If the core has no localization yet, the result is still one language — taken from the
 * environment, not from an invented list. The site never makes up a language code the core
 * does not know about.
 */
export async function effectiveLocales(): Promise<ResolvedLocalization> {
  const resolved = await getLocalization()
  if (resolved) return resolved
  return {
    defaultLocale,
    locales: [{ code: defaultLocale }],
    multilingual: false,
  }
}

/**
 * The first record of a collection.
 *
 * The company profile collection holds a single row, so calling `/companies/single` means
 * guessing an id — and guessing an id is fragile. Reading the list with `pageSize: 1` and
 * taking the first element is more honest: an empty collection yields `undefined` and the
 * caller can show a matching message.
 */
export async function getCompanyProfile(locale?: string): Promise<CompanyProfile | undefined> {
  const result = await listRecords<CompanyProfile>('companies', {
    page: 1,
    pageSize: 1,
    locale,
  })
  return result.data[0]
}

/** The detail of one team member, fetched per page. */
export function getTeamMember(id: string, locale?: string) {
  return getRecord<TeamMember>('team_members', id, { locale })
}

/**
 * The URL slug for one team member.
 *
 * The `slug` field is used when present, because a human-written slug is more stable than a
 * display name: changing jobs should not change the URL. Without a `slug`, the name is
 * simplified instead. The raw name is never used directly as a path segment, because spaces
 * and punctuation make for ugly links that break easily.
 */
export function memberSlug(member: TeamMember): string {
  const explicit = typeof member.slug === 'string' ? member.slug.trim() : ''
  if (explicit) return explicit
  return slugify(member.name)
}

/** Lowercase, no punctuation, spaces become hyphens. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
