// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import type { Metadata } from 'next'
import { defaultLocale } from '@/lib/hamolus'

/**
 * Root layout.
 *
 * Deliberately fetches no data at all. A layout that calls the core makes **every** page
 * depend on the core being available — including pages whose data is already cached. The
 * split is: the layout is the frame, the pages fetch.
 */

export const metadata: Metadata = {
  title: {
    default: 'Hamolus Blog',
    template: '%s — Hamolus Blog',
  },
  description: 'A Next.js blog example that reads its content from the Hamolus core.',
  alternates: {
    languages: { [defaultLocale]: '/' },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale}>
      <body>
        <header>
          <a href="/">Hamolus Blog</a>
        </header>
        <main>{children}</main>
        <footer>
          <p>A Next.js example for Hamolus. Content is read from the core over REST.</p>
        </footer>
      </body>
    </html>
  )
}
