import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

const output = buildSync({ entryPoints: ['src/pages/referral.ts', 'src/db.ts', 'src/index.ts', 'src/i18n.ts'], bundle: true, write: false, outdir: 'out', format: 'esm', platform: 'browser', minify: true })
const modules = await Promise.all(output.outputFiles.map(file => import('data:text/javascript;base64,' + Buffer.from(file.text).toString('base64'))))
const { renderReferral } = modules.find(module => module.renderReferral)
const { getReferralConfig } = modules.find(module => module.getReferralConfig)
const worker = modules.find(module => module.default)?.default
const { ENGLISH_COPY, ENGLISH_PATTERNS } = modules.find(module => module.ENGLISH_COPY)
const defaults = { rate: 10, settlementDays: 30, levelLimit: 3, referralsPerLevel: 5, rateIncreasePerLevel: 0 }
const unavailableConfig = Object.fromEntries(Object.keys(defaults).map(key => [key, null]))

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
  assert.deepEqual(config, { ...defaults, rate: 12.5, settlementDays: 14 })
  const html = renderReferral(config, 'https://dashboard.example.test')
  assert.match(html, /12\.5%/)
  assert.match(html, /A\$125\.00/)
  assert.match(html, /14 天/)
  assert.doesNotMatch(html, /10%/)
  assert.match(html, /最低提现金额<\/span><strong>A\$100<\/strong>/)
  assert.match(html, /href="https:\/\/dashboard\.example\.test\/customer\/referral"/)
})

test('zero is a valid rate, with the same rate and settlement bounds as rent', async () => {
  assert.deepEqual(await getReferralConfig(env({ defaultRate: 0, settlementPeriod: 0 })), { ...defaults, rate: 0, settlementDays: 1 })
  assert.deepEqual(await getReferralConfig(env({ defaultRate: -5, settlementPeriod: -2 })), { ...defaults, rate: 0, settlementDays: 1 })
  assert.deepEqual(await getReferralConfig(env({ defaultRate: 150, settlementPeriod: 2.9 })), { ...defaults, rate: 100, settlementDays: 2 })
  assert.match(renderReferral({ ...defaults, rate: 0 }, 'https://dashboard.example.test'), /class="referral-rate">0%/)
})

test('unsaved settings use rent defaults', async () => {
  assert.deepEqual(await getReferralConfig(env(null, { missing: true })), defaults)
  assert.deepEqual(await getReferralConfig(env({})), defaults)
})

test('unavailable or malformed settings never advertise an unverified percentage', async () => {
  for (const db of [env(null, { unavailable: true }), env('{broken'), env(null), env([]), env({ defaultRate: 'invalid' }), env({ rateIncreasePerLevel: 'invalid' }), env({ levelLimit: 'invalid' }), env({ referralsPerLevel: 'invalid' })]) {
    const config = await getReferralConfig(db)
    assert.deepEqual(config, unavailableConfig)
    const html = renderReferral(config, 'https://dashboard.example.test')
    assert.match(html, /分成比例暂不可用/)
    assert.doesNotMatch(html, /class="referral-rate"|A\$1,000|class="referral-level"/)
    assert.match(html, /A\$100/)
  }
})

test('updated tier rules show 15%, 20%, 25% at the same thresholds as rent', async () => {
  const config = await getReferralConfig(env({ defaultRate: 15, levelLimit: 3, referralsPerLevel: 5, rateIncreasePerLevel: 5, settlementPeriod: 30 }))
  const html = renderReferral(config, 'https://dashboard.example.test')
  assert.match(html, /class="referral-rate">15%/)
  assert.match(html, /最高可达 25%/)
  assert.match(html, /A\$150\.00/)
  assert.match(html, /每累计 5 位有效推荐，提升 1 级，分成增加 5 个百分点；最高 3 级。/)
  assert.match(html, /1 级<\/h3><strong>15%<\/strong><p>有效推荐 0–4 人/)
  assert.match(html, /2 级<\/h3><strong>20%<\/strong><p>有效推荐 5–9 人/)
  assert.match(html, /3 级<\/h3><strong>25%<\/strong><p>有效推荐 10 人及以上/)
  assert.match(html, /30 天/)
  const text = html.replace(/<[^>]*>/g, '\n').split('\n').map(value => value.trim()).filter(Boolean)
  for (const value of text.filter(value => /\p{Script=Han}/u.test(value))) {
    const translated = ENGLISH_COPY[value] ?? ENGLISH_PATTERNS.reduce((result, [pattern, replacement]) => result ?? (new RegExp(pattern).test(value) ? value.replace(new RegExp(pattern), replacement) : null), null)
    assert.ok(translated && !/\p{Script=Han}/u.test(translated), `Missing English: ${value}`)
  }
})

test('tier rules respect a single level, rate caps and long ladders', async () => {
  const single = renderReferral({ ...defaults, rate: 15, levelLimit: 1, rateIncreasePerLevel: 5 }, 'https://dashboard.example.test')
  assert.equal((single.match(/class="referral-level"/g) || []).length, 1)
  assert.match(single, /最高可达 15%/)
  assert.match(single, /有效推荐 0 人及以上/)
  const capped = renderReferral({ ...defaults, rate: 95, rateIncreasePerLevel: 10, levelLimit: 20 }, 'https://dashboard.example.test')
  assert.match(capped, /最高可达 100%/)
  assert.match(capped, /20 级<\/h3><strong>100%<\/strong><p>有效推荐 95 人及以上/)
  assert.equal((capped.match(/class="referral-level"/g) || []).length, 4)
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
    assert.match(html, /href="\/referral">推广计划<\/a>/)
    assert.match(html, /rel="canonical" href="https:\/\/www\.example\.test\/referral"/)
    const sitemap = await worker.fetch(new Request('https://www.example.test/sitemap.xml'), siteEnv)
    assert.match(await sitemap.text(), /<loc>https:\/\/www\.example\.test\/referral<\/loc>/)
    await Promise.all(pending)
  } finally {
    globalThis.caches = previousCaches
  }
})
