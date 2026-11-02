import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

async function bundle(path) {
  const output = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser' })
  return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
}
const { getSiteContact } = await bundle('src/db.ts')
const { renderSiteFooter } = await bundle('src/components/site-footer.ts')
const envFor = company => ({ RENT: { prepare: () => ({ first: async () => ({ value: JSON.stringify(company) }) }) } })

test('company social configuration reaches footer profile links and QR panels', async () => {
  const contact = await getSiteContact(envFor({
    wechatUrl: 'https://weixin.qq.com/profile?a=1&b=2', wechatQrUrl: 'https://images.example.test/wechat.png',
    xiaohongshuUrl: 'https://www.xiaohongshu.com/user/profile/example',
    douyinQrUrl: 'https://images.example.test/douyin.png',
  }))
  const html = renderSiteFooter(contact)
  assert.match(html, /href="https:\/\/weixin.qq.com\/profile\?a=1&amp;b=2"/)
  assert.match(html, /src="https:\/\/images.example.test\/wechat.png" alt="微信二维码"/)
  assert.match(html, /href="https:\/\/www.xiaohongshu.com\/user\/profile\/example"/)
  assert.match(html, /alt="抖音二维码"/)
  assert.equal((html.match(/<details class="foot-social-qr"/g) || []).length, 2)
})

test('unconfigured social platforms show icons without fake links or empty QR panels', async () => {
  const html = renderSiteFooter(await getSiteContact(envFor({})))
  assert.match(html, /aria-label="微信" title="微信" role="img"/)
  assert.match(html, /aria-label="小红书" title="小红书" role="img"/)
  assert.match(html, /aria-label="抖音" title="抖音" role="img"/)
  assert.doesNotMatch(html, /<details|href="#"/)
})

test('unsafe stored social URLs never become footer links or images', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://user:pass@example.test/qr.png', 'http://example.test/qr.png']) {
    const html = renderSiteFooter(await getSiteContact(envFor({ wechatUrl: url, wechatQrUrl: url })))
    assert.doesNotMatch(html, /<details class="foot-social-qr"/)
    assert.match(html, /aria-label="微信" title="微信" role="img"/)
  }
})
