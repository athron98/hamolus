// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import Link from 'next/link'
import { listPublishedArticles } from '@/lib/articles'
import { HamolusApiError, isMissingCollection } from '@/lib/hamolus'

/**
 * The front page.
 *
 * `force-dynamic` is there so the article list always follows the Next cache instead of
 * being prerendered at build time. Without it the page becomes static and a new article does
 * not show up until the next build — the same problem as in the Astro example, solved with a
 * different framework mechanism.
 *
 * A core failure does not leave the page blank: the message is shown so the problem is
 * visible while developing, rather than being translated into "there are no articles".
 */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof listPublishedArticles>>['data'] = []
  let failure: string | null = null
  // The core has no `articles` collection yet — a new project, not a broken one. Kept apart
  // from `failure` because a project that has simply never been seeded used to render
  // "Collection 'articles' is not registered" as an error, which is the wrong reading of a
  // core that has nothing in it yet.
  let missingCollection = false

  try {
    articles = (await listPublishedArticles()).data
  } catch (cause) {
    if (isMissingCollection(cause)) {
      missingCollection = true
    } else {
      failure =
        cause instanceof HamolusApiError
          ? `${cause.code} — ${cause.message}`
          : 'Could not reach the core.'
    }
  }

  return (
    <>
      <h1>Articles</h1>

      {failure && (
        <p role="alert">
          Could not load articles: {failure}.
        </p>
      )}

      {missingCollection && (
        <p>
          No articles yet — the core has no <code>articles</code> collection. Run a seed to
          create one, or define the collection and add records to it.
        </p>
      )}

      {!failure && !missingCollection && articles.length === 0 && (
        <p>No articles have been published yet.</p>
      )}

      {/* The list is guarded too, not just the messages. `articles` is empty on both failure
          paths, so this renders nothing rather than an empty `<ul>` — which is what a failed
          fetch used to leave behind, under the error text. */}
      {articles.length > 0 && (
        <ul>
          {articles.map((article) => (
            <li key={article.id}>
              <h2>
                <Link href={`/blog/${article.slug}`}>{article.title}</Link>
              </h2>
              <p>
                {article.author_name} ·{' '}
                <time dateTime={article.published_at}>{article.published_at}</time>
              </p>
              <p>{article.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
