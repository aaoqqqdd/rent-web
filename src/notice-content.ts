import { DomUtils, parseDocument } from 'htmlparser2'
import { esc } from './escape'
import { sanitizeDocument } from './rich-content'

function publishedHtml(value: string): string {
  let source = value.replace(/\r\n?/g, '\n').trim()
  // Some editors store the whole HTML fragment as entities.
  if (!/<[a-z][^>]*>/i.test(source) && /&lt;\/?(?:h[1-6]|p|div|ul|ol|strong)\b/i.test(source)) {
    source = DomUtils.textContent(parseDocument(source))
  }
  if (/<[a-z][^>]*>/i.test(source)) return source
  return source.split(/\n\s*\n/).filter(Boolean)
    .map(paragraph => `<p>${esc(paragraph).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`).join('')
}

export function noticePlainText(html: string): string {
  return DomUtils.textContent(parseDocument(html.replace(/<\/(?:p|h[1-6]|li|div)>|<br\s*\/?>/gi, '$&\n')))
    .replace(/\n\s*\n+/g, '\n\n').trim()
}

/** The reader already supplies the document title above its body. */
export function noticeBodyHtml(html: string, title: string): string {
  const document = parseDocument(html)
  const first = document.children.find(node => node.type === 'tag')
  if (first?.type === 'tag' && /^h[1-4]$/.test(first.name) && DomUtils.textContent(first).trim() === title.trim()) {
    DomUtils.removeElement(first)
  }
  return DomUtils.getInnerHTML(document)
}

/** Keep the published bilingual blocks separate, as on legal document pages. */
export function prepareNoticeContent(title: string, message: string, titleEn?: string, messageEn?: string) {
  let titleZh = title.trim()
  const titlePair = titleZh.match(/^(.+?)\s*[/／]\s*([A-Za-z][\s\S]+)$/)
  if (titlePair && /\p{Script=Han}/u.test(titlePair[1])) {
    titleZh = titlePair[1].trim()
    titleEn ||= titlePair[2].trim()
  }
  let zh = publishedHtml(message)
  let en = messageEn ? publishedHtml(messageEn) : ''
  if (!en) {
    const document = parseDocument(zh, { withStartIndices: true })
    const blocks = DomUtils.findAll(node => /^(?:h[1-6]|p|div|section|article)$/.test(node.name), document.children)
    const english = blocks.find(node => {
      const text = DomUtils.textContent(node).trim()
      const language = node.attribs.lang || node.attribs['data-lang'] || ''
      return /^en(?:-|$)/i.test(language) || (!/\p{Script=Han}/u.test(text)
        && (/^h[1-6]$/.test(node.name) && /^[A-Za-z]/.test(text) || /^Dear\s+(?:customers?|clients?|members?|all)\b/i.test(text)))
    })
    // A language boundary must follow Chinese content; English names inside a
    // Chinese paragraph are never treated as a separate translation.
    if (english?.startIndex != null && /\p{Script=Han}/u.test(noticePlainText(zh.slice(0, english.startIndex)))) {
      en = zh.slice(english.startIndex)
      zh = zh.slice(0, english.startIndex)
      if (!titleEn && /^h[1-6]$/.test(english.name)) titleEn = DomUtils.textContent(english).trim()
    }
  }
  const messageHtml = sanitizeDocument(zh)
  const messageHtmlEn = sanitizeDocument(en)
  return {
    title: noticePlainText(sanitizeDocument(titleZh)),
    titleEn: titleEn ? noticePlainText(sanitizeDocument(titleEn)) : undefined,
    message: noticePlainText(messageHtml),
    messageEn: messageHtmlEn ? noticePlainText(messageHtmlEn) : undefined,
    messageHtml,
    messageHtmlEn,
  }
}

export const NOTICE_ENGLISH_UNAVAILABLE = '<p>An English version of this announcement is not available yet. Contact us for the latest version.</p>'
