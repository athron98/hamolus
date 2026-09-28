// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Render Markdown to HTML, on the server.
 *
 * Deliberately as small as possible: paragraphs, headings, code, lists, and bold/italic.
 * The point is to show where rendering happens — on the server, not in the browser — and
 * not to become a full renderer.
 *
 * Two things to hold on to if this is ever swapped for a real renderer:
 *
 *   1. **Escape first, then wrap in tags.** Markdown from an untrusted author can contain
 *      `<script>`. Skip the escaping and a single article can steal a reader's session.
 *   2. **Sanitise links.** `[text](javascript:...)` is an attack path that ordinary text
 *      escaping does not catch.
 *
 * For production, use `marked` plus `sanitize-html`, or let the core render Markdown to HTML
 * before storing it — then this function only has to accept an HTML string that is already
 * trusted.
 */
export function renderMarkdown(source: string): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  return source
    .split(/\n{2,}/)
    .map((block) => {
      const text = escape(block.trim())
      if (text === '') return ''

      if (/^```/.test(text)) {
        const code = text.replace(/^```[a-z]*\n?/, '').replace(/```$/, '')
        return `<pre><code>${code}</code></pre>`
      }

      const heading = /^(#{1,3})\s+(.*)$/.exec(text)
      if (heading) {
        const level = heading[1].length
        return `<h${level}>${heading[2]}</h${level}>`
      }

      if (/^[-*]\s+/m.test(text)) {
        const items = text
          .split('\n')
          .map((line) => `<li>${line.replace(/^[-*]\s+/, '')}</li>`)
          .join('')
        return `<ul>${items}</ul>`
      }

      return `<p>${text.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
}
