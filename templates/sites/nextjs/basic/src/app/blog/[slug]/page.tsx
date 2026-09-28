// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listPublishedArticles } from '@/lib/articles'
import { getRecord, HamolusApiError, defaultLocale } from '@/lib/hamolus'
import { renderMarkdown } from '@/lib/markdown'

/**
 * One article page.
 *
 * `generateStaticParams` runs at build time and fetches only the **list**, to decide which
 * routes get built. The detail is fetched per page through `getRecord(id)`, so the core stays
 * the single source of truth. Fetching the detail in `generateStaticParams` as well would
 * read one record twice and leave two places where the data can go stale.
 *
 * `dynamicParams = false` because the article list already bounds the routes: a slug that is
 * not in the list means 404, not a render that tries to fetch the data again.
 *
 * Which is also why `generateStaticParams` has to fail loudly. It runs during
 * `next build`, and a build that cannot see the core is a build that would publish an empty
 * blog — a deploy that silently drops every article is far worse than a deploy that stops
 * with a message naming the cause. The Astro example takes the same position for the same
 * reason, and the wording is kept identical so the fix is the same search either way.
 */

export const dynamicParams = false

export async function generateStaticParams() {
  let articles: Awaited<ReturnType<typeof listPublishedArticles>>['data']
  try {
    articles = (await listPublishedArticles()).data
  } catch (cause) {
    throw new Error(
      'Could not read the article list from the core. Start the core first, or set HAMOLUS_API_ORIGIN.',
      { cause },
    )
  }
  return articles.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data } = await listPublishedArticles()
  const article = data.find((entry) => entry.slug === slug)

  if (!article) return { title: 'Article not found' }

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.cover ? [article.cover] : undefined,
      type: 'article',
      publishedTime: article.published_at,
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: articles } = await listPublishedArticles()
  const listed = articles.find((entry) => entry.slug === slug)
  if (!listed) notFound()

  let article = listed
  try {
    article = (await getRecord<typeof listed>('articles', listed.id)).data
  } catch (cause) {
    if (cause instanceof HamolusApiError && cause.status === 404) notFound()
    throw cause
  }

  return (
    <article>
      <p>
        <Link href="/">← All articles</Link>
      </p>
      <h1>{article.title}</h1>
      <p>
        {article.author_name} · <time dateTime={article.published_at}>{article.published_at}</time>
      </p>
      {article.cover && (
        // `next/image` needs the remote domain allowed through `images.remotePatterns`. This
        // example uses `<img>` so it needs no extra configuration.
        <img src={article.cover} alt="" width={720} height={360} loading="lazy" />
      )}
      {/*
        `dangerouslySetInnerHTML` is used because `renderMarkdown` already justifies it: it
        escapes every `<`, `>`, and `"` before wrapping any tag, and never writes an
        attribute from Markdown content. Swapping the renderer swaps that rule too — check
        again before touching this line.
      */}
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }} />
      <p>
        <small>Locale: {defaultLocale}</small>
      </p>
    </article>
  )
}
