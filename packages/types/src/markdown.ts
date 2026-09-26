function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHref(url: string): string {
  const u = url.trim().replace(/[\u0000-\u001f\u007f]/g, '')
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(u)) return u
  return '#'
}

const CODE_TOKEN = '\u0000CO\u0000'

function inline(text: string): string {
  let t = esc(text)
  const codes: string[] = []
  t = t.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code)
    return CODE_TOKEN + codes.length + '\u0000'
  })
  t = t.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt: string, url: string) =>
      `<img src="${safeHref(url)}" alt="${esc(alt || '')}">`,
  )
  t = t.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) => `<a href="${safeHref(url)}">${label}</a>`,
  )
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  t = t.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
  t = t.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  t = t.replace(
    new RegExp(CODE_TOKEN + '(\\d+)\\u0000', 'g'),
    (_m, n: string) => `<code>${esc(codes[Number(n) - 1] ?? '')}</code>`,
  )
  return t
}

/** Render markdown (or MDX-as-markdown) to an HTML string. All user text is escaped. */
export function markdownToHtml(src: string): string {
  if (!src) return ''
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  const flushPara = () => {
    if (!para.length) return
    out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i]!.trim()
    if (trimmed === '') {
      flushPara()
      i++
      continue
    }
    const fence = /^`{3,}(\w*)\s*$/.exec(trimmed)
    if (fence) {
      flushPara()
      const lang = fence[1]!
      const buf: string[] = []
      i++
      while (i < lines.length && !/^`{3,}\s*$/.test(lines[i]!.trim())) {
        buf.push(lines[i]!)
        i++
      }
      i++
      out.push(
        `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(buf.join('\n'))}</code></pre>`,
      )
      continue
    }
    const hd = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (hd) {
      flushPara()
      const level = hd[1]!.length
      out.push(`<h${level}>${inline(hd[2]!)}</h${level}>`)
      i++
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      flushPara()
      out.push('<hr />')
      i++
      continue
    }
    if (trimmed.startsWith('>')) {
      flushPara()
      const quote: string[] = []
      while (i < lines.length && lines[i]!.trimStart().startsWith('>')) {
        quote.push(lines[i]!.trimStart().replace(/^>\s?/, ''))
        i++
      }
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`)
      continue
    }
    const ul = /^[-*+]\s+(.*)$/.exec(trimmed)
    if (ul) {
      flushPara()
      const items: string[] = []
      while (i < lines.length) {
        const m = /^[-*+]\s+(.*)$/.exec(lines[i]!.trim())
        if (m) {
          items.push(m[1]!)
          i++
        } else break
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`)
      continue
    }
    const ol = /^\d+\.\s+(.*)$/.exec(trimmed)
    if (ol) {
      flushPara()
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\d+\.\s+(.*)$/.exec(lines[i]!.trim())
        if (m) {
          items.push(m[1]!)
          i++
        } else break
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`)
      continue
    }
    para.push(lines[i]!.trim())
    i++
  }
  flushPara()
  return out.join('')
}

/** Strip markdown syntax to plain text (table previews, excerpts). */
export function markdownToPlainText(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~\s][^*_~]*?)[*_~]{1,3}/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}