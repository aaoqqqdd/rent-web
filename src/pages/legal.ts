// 公开法务文档页：正文、版本和公司资料均读取 rent 的 systemSettings。

import sanitizeHtml from 'sanitize-html'
import { esc } from '../layout'
import type { LegalDocumentData, SiteContact } from '../db'

interface LegalPageData {
  title: string
  code: string
  variablePrefix: string
  document: LegalDocumentData
  contact: SiteContact
  rentalTemplate?: boolean
}

function renderVariables(data: LegalPageData): Record<string, unknown> {
  const { companyDetails, bankDetails, metadata } = data.document
  return {
    company_name: companyDetails.name || data.contact.name,
    company_abn: companyDetails.abn || '',
    company_address: companyDetails.address || data.contact.address,
    company_phone: companyDetails.phone || data.contact.phone,
    company_email: companyDetails.email || data.contact.email,
    company_website: companyDetails.website || '',
    company_logo: companyDetails.logo || '',
    [`${data.variablePrefix}_version`]: metadata.version,
    [`${data.variablePrefix}_last_updated_date`]: metadata.lastUpdatedDate,
    ...(data.variablePrefix === 'refund_policy'
      ? { last_updated_date: metadata.lastUpdatedDate }
      : {}),
    ...(data.rentalTemplate
      ? {
          jurisdiction: 'VIC',
          gst_included: companyDetails.gstIncluded ? '是' : '否',
          bank_name: bankDetails.bankName || '',
          bank_bsb: bankDetails.bsb || '',
          bank_account: bankDetails.account || '',
          account_name: bankDetails.accountName || '',
        }
      : {}),
  }
}

function sanitizeDocument(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote',
      'a', 'span', 'div', 'hr', 'code', 'pre', 'img',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], '*': ['class', 'style'] },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['data'] },
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

export function renderLegalDocument(data: LegalPageData): string {
  let content = data.document.content
  for (const [key, value] of Object.entries(renderVariables(data))) {
    content = content.replace(new RegExp(`\\$\\{${key}\\}|\\{${key}\\}`, 'g'), esc(value))
  }
  if (data.rentalTemplate) {
    content = content.replace(/\$?\{[a-z0-9_]+\}/gi, '<span class="doc-blank">——</span>')
  }
  const safeContent = content
    ? sanitizeDocument(content)
    : '<p class="legal-empty">该文档暂未发布，请联系客服获取最新内容。</p>'
  const notice = data.rentalTemplate
    ? '<p class="legal-notice">以下为标准《设备租赁协议》范本。带 —— 的位置将在下单后按实际合同数据填写，最终以您签署的租赁合同为准。</p>'
    : ''

  return /* html */ `
<section class="section">
  <div class="wrap doc legal-document">
    <div class="kicker">${esc(data.code)}</div>
    <h1>${esc(data.title)}</h1>
    ${notice}
    <div class="legal-document__content">${safeContent}</div>
  </div>
</section>`
}
