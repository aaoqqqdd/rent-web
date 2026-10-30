import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

const bundle = buildSync({ entryPoints: ['src/pages/legal.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { renderLegalDocument } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const dbBundle = buildSync({ entryPoints: ['src/db.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { getLegalDocument } = await import('data:text/javascript;base64,' + Buffer.from(dbBundle.outputFiles[0].text).toString('base64'))

function render(content, overrides = {}) {
  return renderLegalDocument({
    title: '用户协议', code: 'LEGAL / USER TERMS', variablePrefix: 'user_agreement',
    contact: { name: 'GeekSlope' },
    document: {
      content, contentEn: content,
      metadata: { version: '3.1', lastUpdatedDate: '2026-10-31' },
      companyDetails: {}, bankDetails: {}, ...overrides,
    },
  })
}

test('HTML-encoded version and date placeholders resolve in both language documents', () => {
  const html = render('<p>版本：&#36;&#123;user&#95;agreement&#95;version&#125;</p><p>最后更新日期：&#36;&#123;user&#95;agreement&#95;last&#95;updated&#95;date&#125;</p>')
  assert.equal((html.match(/<p>版本：3\.1<\/p>/g) || []).length, 2)
  assert.equal((html.match(/<p>最后更新日期：2026-10-31<\/p>/g) || []).length, 2)
  assert.doesNotMatch(html, /user_agreement_(version|last_updated_date)/)
})

test('plain, legacy, Markdown-escaped and hexadecimal-encoded tokens retain compatibility', () => {
  for (const placeholder of ['${user_agreement_version}', '{user_agreement_version}', '${user_terms_version}', '${user\\_agreement\\_version}', '&#x24;&#x7b;user&#x5f;agreement&#x5f;version&#x7d;']) {
    assert.match(render(`<p>${placeholder}</p>`), /<p>3\.1<\/p>/)
  }
})

test('metadata and company values are escaped and inserted literally', () => {
  const html = render('<p>{user_agreement_version}</p><p>{company_name}</p>', {
    metadata: { version: '$&<script>alert(1)</script>', lastUpdatedDate: '' },
    companyDetails: { name: 'Example $& <Partners>' },
  })
  assert.match(html, /\$&amp;&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /Example \$&amp; &lt;Partners&gt;/)
  assert.doesNotMatch(html, /\{company_name\}|\{user_agreement_version\}|<script>alert/)
})

test('HTML and substituted URLs remain sanitized', () => {
  const html = render('<script>alert(1)</script><p onclick="alert(1)">{company_name}</p><a href="{company_website}">Contact</a>', {
    companyDetails: { name: '<img src=x onerror=alert(1)>', website: 'javascript:alert(1)' },
  })
  assert.doesNotMatch(html, /<script>alert|<img src=x|onclick=|href="javascript:/)
})

test('service terms resolve referenced user-agreement metadata from shared D1 independently', async () => {
  const content = '<p>User: ${user_agreement_version} / ${user_agreement_last_updated_date}</p><p>Service: {service_terms_version} / {service_terms_last_updated_date}</p>'
  const rows = [
    { key: 'serviceTerms', value: content },
    { key: 'serviceTermsEn', value: content },
    { key: 'legalMetadata', value: JSON.stringify({
      user: { version: '2.5', lastUpdatedDate: '2026-09-12' },
      service: { version: '4.2', lastUpdatedDate: '2026-10-30' },
    }) },
  ]
  const document = await getLegalDocument({ RENT: { prepare() { return { bind() { return this }, async all() { return { results: rows } } } } } }, 'serviceTerms', 'service')
  assert.equal(document.metadata.version, '4.2')
  const html = renderLegalDocument({ title: '服务条款', code: 'LEGAL / SERVICE TERMS', variablePrefix: 'service_terms', document, contact: { name: 'GeekSlope' } })
  assert.equal((html.match(/User: 2\.5 \/ 2026-09-12/g) || []).length, 2)
  assert.equal((html.match(/Service: 4\.2 \/ 2026-10-30/g) || []).length, 2)
  assert.doesNotMatch(html, /\$?\{(?:user_agreement|service_terms)_/)
})
