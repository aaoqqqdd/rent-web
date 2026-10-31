import { parseAccept } from 'hono/utils/accept'
import { DomUtils, parseDocument } from 'htmlparser2'
import { SITE_URL } from './seo'

type Node = ReturnType<typeof parseDocument>['children'][number]

const PUBLIC_PAGES = new Set([
  '/', '/products', '/rental-guide', '/about', '/gift-cards', '/referral', '/announcements',
  '/terms', '/user-terms', '/service-terms', '/privacy', '/software-terms', '/refund-policy',
  '/copyright', '/cookies', '/cookie-policy', '/complaints', '/dispute-resolution',
  '/acceptable-use', '/aup', '/consumer-rights', '/rental-terms', '/rental-agreement',
])

export function acceptsMarkdown(path: string, accept: string | undefined): boolean {
  if (!PUBLIC_PAGES.has(path) && !/^\/(products|announcements)\/[^/]+$/.test(path)) return false
  const ranges = parseAccept(accept || '').map((range) => ({ ...range, type: range.type.toLowerCase() }))
  // Wildcards alone must continue to serve browser HTML. An explicit q=0 is
  // an opt-out, even when a less-specific wildcard accepts other text types.
  const markdown = ranges.find((range) => range.type === 'text/markdown')
  const html = ranges.find((range) => range.type === 'text/html')
    ?? ranges.find((range) => range.type === 'text/*')
    ?? ranges.find((range) => range.type === '*/*')
  return Boolean(markdown && markdown.q > 0 && markdown.q >= (html?.q ?? 0))
}

function escapeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/([\\`*_[\]<>#|])/g, '\\$1')
}

function safeUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? url.href.replace(/</g, '%3C').replace(/>/g, '%3E') : null
  } catch {
    return null
  }
}

function fenced(text: string, language = ''): string {
  const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1)))
  return `\n\n${fence}${language}\n${text.trim()}\n${fence}\n\n`
}

// Convert only the server-rendered main content, not the page shell or any
// client scripts. htmlparser2 already parses our legal content via sanitize-html.
export function htmlToMarkdown(html: string): { body: string; robots: string } {
  const document = parseDocument(html)
  const find = (name: string) => DomUtils.findOne((node) => node.name === name, document.children, true)
  const main = find('main')
  if (!main) throw new Error('Markdown source is missing main content')
  const meta = (name: string) => DomUtils.findOne(
    (node) => node.name === 'meta' && node.attribs.name === name, document.children, true,
  )?.attribs.content || ''
  const canonical = DomUtils.findOne(
    (node) => node.name === 'link' && node.attribs.rel === 'canonical', document.children, true,
  )?.attribs.href || `${SITE_URL}/`
  const children = (node: Node): string => 'children' in node ? node.children.map(render).join('') : ''

  function render(node: Node): string {
    if (node.type === 'text') return escapeText(node.data)
    if (node.type !== 'tag') return '' // includes scripts, styles and comments
    const { name, attribs } = node
    if ('hidden' in attribs || attribs['aria-hidden'] === 'true'
      || ['nav', 'header', 'footer', 'svg', 'iframe', 'noscript', 'form', 'input', 'select', 'textarea', 'button', 'label', 'template'].includes(name)
      || /(?:^|\s)(catalog-tools|detail-rental-term)(?:\s|$)/.test(attribs.class || '')) return ''
    if (name === 'pre') return fenced(DomUtils.textContent(node))
    if (name === 'table') {
      const rows = DomUtils.findAll((row) => row.name === 'tr', node.children).map((row) => row.children
        .filter((cell) => cell.type === 'tag' && ['td', 'th'].includes(cell.name))
        .map((cell) => children(cell).trim().replace(/\n+/g, ' ')))
        .filter((row) => row.length)
      if (!rows.length) return ''
      const width = Math.max(...rows.map((row) => row.length))
      const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] || '').join(' | ')} |`
      return `\n\n${line(rows[0])}\n${line(Array(width).fill('---'))}\n${rows.slice(1).map(line).join('\n')}\n\n`
    }
    if (name === 'img') {
      const url = safeUrl(attribs.src || '', canonical)
      return url && attribs.alt ? `![${escapeText(attribs.alt)}](<${url}>)` : ''
    }
    const content = children(node)
    const text = content.trim()
    if (/^h[1-6]$/.test(name)) return `\n\n${'#'.repeat(Number(name[1]))} ${text}\n\n`
    if (name === 'a') {
      const url = safeUrl(attribs.href || '', canonical)
      if (!text || !url || !attribs.href) return content ? `${content} ` : ''
      // Cards wrap several block elements; do not turn them into invalid
      // multiline link labels. Keep their content and expose the destination.
      return text.includes('\n') ? `\n\n${text}\n\n[${escapeText(url)}](<${url}>)\n\n` : `[${text}](<${url}>) `
    }
    if (name === 'li') {
      const parent = node.parent
      const siblings = parent && 'children' in parent ? parent.children.filter((item) => item.type === 'tag' && item.name === 'li') : []
      const ordered = parent?.type === 'tag' && parent.name === 'ol'
      const start = ordered ? Number.parseInt(parent.attribs.start || '1', 10) || 1 : 1
      const marker = ordered ? `${start + siblings.indexOf(node)}.` : '-'
      return `\n${marker} ${text.replace(/\n/g, '\n  ')}\n`
    }
    if (['ul', 'ol', 'dl', 'section', 'article', 'aside', 'div', 'p', 'details', 'figure'].includes(name)) return `\n\n${text}\n\n`
    if (['summary', 'dt'].includes(name)) return `\n\n**${text}**\n\n`
    if (name === 'blockquote') return `\n\n${text.split('\n').map((line) => `> ${line}`).join('\n')}\n\n`
    if (name === 'hr') return '\n\n---\n\n'
    if (name === 'br') return '\n'
    if (['del', 's'].includes(name)) return text ? `~~${text}~~ ` : ''
    // Layout spans often separate a spec label, a value and a price unit.
    if (['span', 'small', 'strong', 'b', 'em', 'i'].includes(name)) return text ? `${text} ` : ''
    return content
  }

  const title = find('title')
  const frontmatter = [
    `title: ${JSON.stringify(title ? DomUtils.textContent(title) : '')}`,
    `description: ${JSON.stringify(meta('description'))}`,
    `url: ${JSON.stringify(canonical)}`,
    'language: zh-CN',
  ].join('\n')
  const content = children(main).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const schemas = DomUtils.findAll(
    (node) => node.name === 'script' && node.attribs.type === 'application/ld+json', document.children,
  ).map((node) => {
    try { return JSON.stringify(JSON.parse(DomUtils.textContent(node)), null, 2) } catch { return '' }
  }).filter(Boolean)
  const structuredData = schemas.length ? fenced(schemas.join('\n'), 'json') : ''
  return { body: `---\n${frontmatter}\n---\n\n${content}${structuredData}\n`, robots: meta('robots') }
}
