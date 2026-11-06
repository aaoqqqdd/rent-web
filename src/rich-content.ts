import sanitizeHtml from 'sanitize-html'

export function sanitizeDocument(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote',
      'a', 'span', 'div', 'hr', 'code', 'pre', 'img',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], '*': ['class', 'style'] },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['data', 'http', 'https'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        width: [/^\d+(\.\d+)?(%|px)$/],
        margin: [/^[\d\s.%px-]+$/],
        padding: [/^[\d\s.%px-]+$/],
        border: [/^[\d\s.#a-z()-]+$/i],
        'border-collapse': [/^(collapse|separate)$/],
      },
    },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
  })
}

