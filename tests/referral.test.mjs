import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

const output = buildSync({ entryPoints: ['src/pages/referral.ts', 'src/db.ts', 'src/index.ts'], bundle: true, write: false, outdir: 'out', format: 'esm', platform: 'browser', minify: true })
const modules = await Promise.all(output.outputFiles.map(file => import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'))))
const { renderReferral } = modules.find(module => module.renderReferral)
const { getReferralConfig } = modules.find(module => module.getReferralConfig)
const worker = modules.find(module => module.default)?.default

function env(settings, { missing = false, unavailable = false } = {}) {
  return { RENT: { prepare(sql) {
    assert.match(sql, /systemSettings WHERE key = 'referralSettings'/)
    return { async first() {
      if (unavailable) throw new Error('D1 unavailable')
      return missing ? null : { value: typeof settings === 'string' ? settings : JSON.stringify(settings) }
    } }
  } } }
}

test('shared rent configuration controls the displayed rate, example and settlement period', async () => {
  const config = await getReferralConfig(env({ defaultRate: 12.5, settlementPeriod: 14 }))
  assert.deepEqual(config, { rate: 12.5, settlementDays: 14 })
  const html = renderReferral(config, 'https://dashboard.example.test')
  assert.match(html, /12\.5%/)
  assert.match(html, /A\$125\.00/)
  assert.match(html, /14 天/)
  assert.doesNotMatch(html, /10%/)
  assert.match(html, /最低提现金额<\/span><strong>A\$100<\/strong>/)
  assert.match(html, /href="https:\/\/dashboard\.example\.test\/customer\/referral"/)
})

test('zero is a valid rate, with the same rate and settlement bounds as rent', async () => {
  assert.deepEqual(await getReferralConfig(env({ defaultRate: 0, settlementPeriod: 0 })), { rate: 0, settlementDays: 30 })
  assert.deepEqual(await getReferralConfig(env({ defaultRate: -5, settlementPeriod: -2 })), { rate: 0, settlementDays: 1 })
  assert.deepEqual(await getReferralConfig(env({ defaultRate: 150, settlementPeriod: 2.9 })), { rate: 100, settlementDays: 2 })
  assert.match(renderReferral({ rate: 0, settlementDays: 30 }, 'https://dashboard.example.test'), /class="referral-rate">0%/)
})

test('unsaved settings use rent defaults', async () => {
  assert.deepEqual(await getReferralConfig(env(null, { missing: true })), { rate: 10, settlementDays: 30 })
})

test('unavailable or malformed settings never advertise an unverified percentage', async () => {
  for (const db of [env(null, { unavailable: true }), env('{broken'), env(null), env([]), env({ defaultRate: 'invalid' })]) {
    const config = await getReferralConfig(db)
    assert.deepEqual(config, { rate: null, settlementDays: null })
    const html = renderReferral(config, 'https://dashboard.example.test')
    assert.match(html, /分成比例暂不可用/)
    assert.doesNotMatch(html, /class="referral-rate"|A\$1,000/)
    assert.match(html, /A\$100/)
  }
})

test('public referral route includes current settings, navigation, canonical URL and security headers', async () => {
  const previousCaches = globalThis.caches
  globalThis.caches = { default: { async match() {}, async put() {} } }
  const pending = []
  const siteEnv = { APP_URL: 'https://dashboard.example.test', RENT: { prepare(sql) {
    return {
      bind() { return this },
      async first() { return sql.includes("key = 'referralSettings'") ? { value: '{"defaultRate":7.5,"settlementPeriod":21}' } : null },
      async all() { return { results: [] } },
    }
  } } }
  try {
    const response = await worker.fetch(new Request('https://www.example.test/referral'), siteEnv, { waitUntil(promise) { pending.push(promise) } })
    assert.equal(response.status, 200)
    assert.ok(response.headers.get('content-security-policy'))
    const html = await response.text()
    assert.match(html, /class="referral-rate">7\.5%/)
    assert.match(html, /A\$75\.00/)
    assert.match(html, /21 天/)
    assert.match(html, /href="\/referral" aria-current="page"/)
    assert.match(html, /rel="canonical" href="https:\/\/www\.example\.test\/referral"/)
    const sitemap = await worker.fetch(new Request('https://www.example.test/sitemap.xml'), siteEnv)
    assert.match(await sitemap.text(), /<loc>https:\/\/www\.example\.test\/referral<\/loc>/)
    await Promise.all(pending)
  } finally {
    globalThis.caches = previousCaches
  }
})
