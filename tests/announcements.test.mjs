import { htmlScripts } from '../scripts/lib/html-scripts.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { DomUtils, parseDocument } from 'htmlparser2'

async function bundled(path) {
  const result = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser' })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { prepareNoticeContent } = await bundled('src/notice-content.ts')
const { listPublicNotices } = await bundled('src/db.ts')
const { renderAnnouncementDetail, renderAnnouncements } = await bundled('src/pages/announcements.ts')
const { renderPage } = await bundled('src/layout.ts')

const title = '店铺假期暂停营业通知/Holiday Closure Notice'
const html = `<h2>店铺假期暂停营业通知</h2>
<p>尊敬的客户：</p>
<p>本店将于 <strong>2026年11月20日至2027年2月28日</strong> 暂停营业。</p>
<ul><li>设备取货、更换及归还：暂停服务。</li><li>未取货及预订订单：原路退款。</li></ul>
<hr><h2 style="text-align:center">Holiday Closure Notice</h2>
<p>Dear Customers,</p>
<p>Our store will be closed from <strong>20 November 2026 to 28 February 2027</strong>.</p>
<ul><li>Collection and returns: suspended.</li><li>Uncollected orders: refunded.</li></ul>`

test('published bilingual HTML retains headings, paragraphs, lists, emphasis and safe styles', () => {
  const content = prepareNoticeContent(title, html)
  assert.equal(content.title, '店铺假期暂停营业通知')
  assert.equal(content.titleEn, 'Holiday Closure Notice')
  assert.match(content.messageHtml, /<h2>店铺假期暂停营业通知<\/h2>/)
  assert.match(content.messageHtml, /<ul><li>/)
  assert.match(content.messageHtml, /<strong>2026年11月20日至2027年2月28日<\/strong>/)
  assert.doesNotMatch(content.messageHtml, /Dear Customers|Holiday Closure Notice/)
  assert.match(content.messageHtmlEn, /style="text-align:center"/)
  assert.match(content.messageHtmlEn, /<ul><li>Collection/)
  assert.doesNotMatch(content.messageHtmlEn, /\p{Script=Han}/u)
})

test('existing combined plain text and CRLF publication format splits at the English greeting', () => {
  const content = prepareNoticeContent(title, '尊敬的客户：\r\n\r\n假期暂停营业。\r\n\r\nDear Customers,\r\n\r\nOur store is closed.\r\n\r\nThank you.')
  assert.equal(content.messageHtml, '<p>尊敬的客户：</p><p>假期暂停营业。</p>')
  assert.equal(content.messageHtmlEn, '<p>Dear Customers,</p><p>Our store is closed.</p><p>Thank you.</p>')
})

test('explicit language blocks, English fields and encoded HTML remain supported', () => {
  const marked = prepareNoticeContent(title, '<section lang="zh-CN"><p>中文通知</p></section><section lang="en-AU"><p>English notice</p></section>')
  assert.match(marked.messageHtml, /中文通知/)
  assert.doesNotMatch(marked.messageHtml, /English notice/)
  assert.match(marked.messageHtmlEn, /English notice/)
  const separate = prepareNoticeContent('通知', '<p>中文通知</p>', 'Notice', '<p>English notice</p>')
  assert.equal(separate.messageHtmlEn, '<p>English notice</p>')
  const encoded = prepareNoticeContent('通知', '&lt;h2&gt;中文通知&lt;/h2&gt;&lt;p&gt;正文&lt;/p&gt;')
  assert.equal(encoded.messageHtml, '<h2>中文通知</h2><p>正文</p>')
})

test('an English brand name inside a Chinese notice is never treated as a translation', () => {
  const content = prepareNoticeContent('服务通知', '<p>关于 GeekSlope 服务的通知。</p><p>服务暂停，请联系客服。</p>')
  assert.equal(content.messageHtmlEn, '')
  assert.match(content.messageHtml, /服务暂停/)
})

test('published HTML removes scripts, handlers, unsafe links, frames and layout injection', () => {
  const content = prepareNoticeContent('安全通知', '<h2 onclick="alert(1)">通知</h2><script>alert(1)</script><iframe src="https://example.com"></iframe><p style="position:fixed;color:#ff0000" onmouseover="alert(1)">正文</p><a href="javascript:alert(1)" target="_blank">链接</a><img src=x onerror=alert(1)>')
  assert.doesNotMatch(content.messageHtml, /script|iframe|onclick|onmouseover|onerror|position:fixed/i)
  assert.match(content.messageHtml, /color:#ff0000/)
  assert.match(content.messageHtml, /rel="noopener noreferrer"/)
})

test('the public data layer returns sanitized bilingual content from shared notification rows', async () => {
  const rows = [{ id: 'holiday', type: 'announcement', title, message: html, created_at: '2026-10-31 14:29:42' }]
  const notices = await listPublicNotices({ RENT: { prepare(sql) { return { bind() { return this }, async all() { return { results: sql.includes('FROM notifications') ? rows : [] } } } } } })
  assert.equal(notices.length, 1)
  assert.equal(notices[0].titleEn, 'Holiday Closure Notice')
  assert.match(notices[0].messageHtmlEn, /<strong>20 November/)
  assert.doesNotMatch(notices[0].message, /<h2>/)
})

test('policy updates parse HTML and encoded templates without exposing script contents or signatures', async () => {
  const template = '<SCRIPT data-note=">">协议内容：退款政策。</SCRIPT ignored="yes"><p>协议内容：<strong>隐私政策</strong></p><p>PRIVATE_SIGNATURE</p>'
  for (const message of [template, template.replaceAll('<', '&lt;').replaceAll('>', '&gt;'), '<p>协议内容：隐私政策<br>PRIVATE_SIGNATURE</p>']) {
    const rows = [{ id: 'policy', type: 'policy_update', message, created_at: '2026-11-05 00:00:00' }]
    const notices = await listPublicNotices({ RENT: { prepare(sql) { return { bind() { return this }, async all() { return { results: sql.includes('FROM notifications') ? rows : [] } } } } } })
    assert.equal(notices.length, 1)
    assert.equal(notices[0].title, '服务政策及协议更新公告')
    assert.equal(notices[0].titleEn, 'Service policies and agreements update notice')
    assert.doesNotMatch(notices[0].messageHtml + notices[0].messageHtmlEn, /PRIVATE_SIGNATURE|退款政策|<script/i)
  }
})

test('detail pages render separate rich language panes and list cards use plain text previews', () => {
  const notice = { id: 'announcement:holiday', kind: 'announcement', isAdminAnnouncement: true, createdAt: '2026-10-31', ...prepareNoticeContent(title, html) }
  const detail = renderAnnouncementDetail(notice)
  assert.match(detail, /data-notice-lang="zh"[^>]*data-no-translate>/)
  assert.equal((detail.match(/店铺假期暂停营业通知<\/h[12]>/g) || []).length, 1)
  assert.match(detail, /data-notice-lang="en"[^>]*hidden/)
  assert.doesNotMatch(detail, /&lt;h2&gt;|white-space: pre-wrap/)
  const cards = parseDocument(renderAnnouncements([notice]))
  assert.equal(DomUtils.findAll(node => node.name === 'a', cards.children).length, 1)
  const previews = DomUtils.findAll(node => node.name === 'p' && node.attribs['data-notice-lang'], cards.children)
  assert.equal(previews.length, 2)
  assert.equal(DomUtils.findAll(node => node.name === 'h2', previews).length, 0)
})

test('unpublished English content shows the same explicit availability behavior as legal pages', () => {
  const notice = { id: 'announcement:zh', kind: 'announcement', title: '通知', message: '<p>中文正文</p>', createdAt: '' }
  const detail = parseDocument(renderAnnouncementDetail(notice))
  const english = DomUtils.findOne(node => node.attribs?.['data-notice-lang'] === 'en', detail.children, true)
  assert.match(DomUtils.textContent(english), /English version.*not available yet/)
  assert.doesNotMatch(DomUtils.textContent(english), /中文正文/)
})

test('the announcement reader and language scripts compile in rendered pages', () => {
  const page = renderPage({ title: 'Test', description: '', body: '', path: '/', appUrl: 'https://dashboard.geekslope.de5.net', contact: { name: 'GeekSlope', email: '', phone: '', logo: '' } })
  assert.match(page, /id="gs-announcement-dialog"/)
  for (const { code: script } of htmlScripts(page)) {
    if (script.trim().startsWith('{')) continue
    assert.doesNotThrow(() => new Function(script))
  }
})
