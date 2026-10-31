import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'
import { DomUtils, parseDocument } from 'htmlparser2'

const output = buildSync({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const canonical = 'https://geekslope.de5.net'
const searchAgents = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User']
const blockedAgents = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'Amazonbot', 'Claude-Web']

// The generated file uses one user-agent per group, literal path prefixes and
// no wildcard patterns. Check effective longest-path rules, not only labels.
function groupsFrom(text) {
  const groups = new Map()
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
    const agent = lines.find((line) => /^user-agent:/i.test(line))?.split(':')[1].trim().toLowerCase()
    if (!agent) continue
    assert.ok(!groups.has(agent), `Duplicate agent ${agent}`)
    groups.set(agent, lines.filter((line) => /^(allow|disallow):/i.test(line)).map((line) => {
      const split = line.indexOf(':')
      return { allow: line.slice(0, split).toLowerCase() === 'allow', path: line.slice(split + 1).trim() }
    }))
  }
  return groups
}

function allowed(groups, agent, path) {
  const rules = groups.get(agent.toLowerCase()) || groups.get('*')
  const applicable = rules.filter((rule) => rule.path && path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))
  return applicable[0]?.allow ?? true
}

test('robots.txt has valid media/status, the apex sitemap and effective explicit AI access policies', async () => {
  let originalText
  for (const userAgent of ['Googlebot', 'bingbot', ...searchAgents, ...blockedAgents]) {
    const response = await worker.fetch(new Request(canonical + '/robots.txt', { headers: { 'user-agent': userAgent } }), {})
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /^text\/plain; charset=UTF-8$/i)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300')
    assert.equal(response.headers.get('content-signal'), 'ai-train=no, search=yes, ai-input=yes')
    const text = await response.text()
    if (originalText === undefined) originalText = text
    else assert.equal(text, originalText, 'The policy must not depend on who reads robots.txt')
    assert.match(text, /^Sitemap: https:\/\/geekslope\.de5\.net\/sitemap.xml$/m)
    assert.doesNotMatch(text, /www\.geekslope\.de5\.net/)
  }
  const groups = groupsFrom(originalText)
  assert.equal(groups.size, 1 + searchAgents.length + blockedAgents.length)
  for (const agent of ['Googlebot', 'bingbot', ...searchAgents]) {
    for (const path of ['/', '/products', '/products/pc', '/rental-guide', '/.well-known/api-catalog', '/auth.md', '/login']) assert.equal(allowed(groups, agent, path), true, `${agent}: ${path}`)
    for (const path of ['/api/session', '/api/account-balance', '/sso/start', '/logout', '/healthz']) assert.equal(allowed(groups, agent, path), false, `${agent}: ${path}`)
  }
  for (const agent of blockedAgents) {
    assert.ok(groups.has(agent.toLowerCase()))
    for (const path of ['/', '/products', '/auth.md', '/api/session']) assert.equal(allowed(groups, agent, path), false, `${agent}: ${path}`)
  }
  const head = await worker.fetch(new Request(canonical + '/robots.txt', { method: 'HEAD' }), {})
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})

function setup(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`
    CREATE TABLE devices (id TEXT PRIMARY KEY, name TEXT, pricePerDay REAL, status TEXT, lifecycle_status TEXT, deleted_at TEXT);
    CREATE TABLE systemSettings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE notifications (id TEXT PRIMARY KEY, type TEXT, title TEXT, message TEXT, created_at TEXT, expires_at TEXT, sender_id TEXT, deleted_at TEXT);
    CREATE TABLE coupons (id TEXT PRIMARY KEY, code TEXT, discount_type TEXT, discount_value REAL, starts_at TEXT, expires_at TEXT, minimum_order_amount REAL, device_id TEXT, brand TEXT, config_keyword TEXT, created_at TEXT, max_uses INTEGER, used_count INTEGER, active INTEGER);
  `)
  const env = { RENT: { prepare(sql) {
    let values = []
    return {
      bind(...input) { values = input; return this },
      async all() { return { results: db.prepare(sql).all(...values) } },
      async first() { return db.prepare(sql).get(...values) || null },
    }
  } } }
  return { db, env }
}

async function sitemap(env) {
  const response = await worker.fetch(new Request(canonical + '/sitemap.xml'), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60')
  const text = await response.text()
  assert.match(text, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  const document = parseDocument(text, { xmlMode: true })
  const root = DomUtils.findOne((node) => node.name === 'urlset', document.children)
  assert.equal(root.attribs.xmlns, 'http://www.sitemaps.org/schemas/sitemap/0.9')
  const entries = root.children.filter((node) => node.type === 'tag')
  const urls = entries.map((node) => {
    assert.equal(node.name, 'url')
    const loc = DomUtils.findOne((child) => child.name === 'loc', node.children)
    const url = DomUtils.textContent(loc)
    assert.equal(new URL(url).origin, canonical)
    assert.equal(new URL(url).search, '')
    assert.doesNotMatch(new URL(url).pathname, /^\/(api|sso|login|register|apply|checkout|order-lookup)(\/|$)/)
    return url
  })
  assert.equal(new Set(urls).size, urls.length)
  assert.doesNotMatch(text, /<lastmod>|www\.geekslope\.de5\.net/)
  return { text, urls }
}

test('sitemap XML follows current publication state and escapes encoded device URLs', async (t) => {
  const { db, env } = setup(t)
  const specialId = "pc&<中文>'"
  db.prepare("INSERT INTO devices VALUES (?, 'Available PC', 12, 'available', 'READY', NULL)").run(specialId)
  db.exec(`
    INSERT INTO devices VALUES ('retired', 'Retired PC', 12, 'retired', 'RETIRED', NULL);
    INSERT INTO devices VALUES ('deleted', 'Deleted PC', 12, 'available', 'READY', '2026-01-01');
    INSERT INTO notifications VALUES ('public', 'announcement', 'Public update', 'Current public message', datetime('now'), NULL, 'admin', NULL);
    INSERT INTO notifications VALUES ('expired', 'announcement', 'Expired', 'Expired public message', datetime('now'), datetime('now', '-1 day'), 'admin', NULL);
    INSERT INTO notifications VALUES ('private', 'order_update', 'Private order', 'Private customer message', datetime('now'), NULL, 'admin', NULL);
    INSERT INTO coupons (id, code, discount_type, discount_value, created_at, active) VALUES ('offer', 'TEST10', 'percent', 10, datetime('now'), 1);
    INSERT INTO systemSettings VALUES ('serviceTerms', '<h2>Published service terms</h2>');
    INSERT INTO systemSettings VALUES ('privacyPolicy', '  ');
  `)
  const first = await sitemap(env)
  const productUrl = canonical + '/products/' + encodeURIComponent(specialId)
  assert.ok(first.urls.includes(productUrl))
  assert.match(first.text, /&apos;/)
  assert.ok(first.urls.includes(canonical + '/announcements/announcement%3Apublic'))
  assert.ok(first.urls.includes(canonical + '/announcements/coupon%3Aoffer'))
  assert.ok(first.urls.includes(canonical + '/service-terms'))
  assert.ok(!first.urls.includes(canonical + '/privacy'))
  assert.doesNotMatch(first.text, /\/products\/(retired|deleted)|announcement%3A(expired|private)|Private customer/)

  db.exec(`
    UPDATE devices SET lifecycle_status = 'RETIRED';
    UPDATE notifications SET deleted_at = datetime('now');
    UPDATE coupons SET active = 0;
    UPDATE systemSettings SET value = '' WHERE key = 'serviceTerms';
    UPDATE systemSettings SET value = '<p>Published privacy policy</p>' WHERE key = 'privacyPolicy';
  `)
  const updated = await sitemap(env)
  assert.ok(!updated.urls.includes(productUrl))
  assert.ok(!updated.urls.some((url) => url.includes('/announcements/')))
  assert.ok(!updated.urls.includes(canonical + '/service-terms'))
  assert.ok(updated.urls.includes(canonical + '/privacy'))
})

test('empty or unavailable D1 still returns a valid sitemap of the public main pages', async (t) => {
  const { env } = setup(t)
  for (const source of [env, { RENT: { prepare() { throw new Error('D1 unavailable') } } }]) {
    const { urls } = await sitemap(source)
    assert.equal(urls.length, 7)
    for (const path of ['/', '/products', '/gift-cards', '/referral', '/rental-guide', '/about', '/announcements']) assert.ok(urls.includes(canonical + path))
  }
})
