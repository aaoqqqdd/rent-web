// Read-only checks against a running Worker. Usage: node scripts/verify-seo.mjs [base URL]
import assert from 'node:assert/strict'

const base = process.argv[2] || 'http://127.0.0.1:8811'
const canonicalOrigin = 'https://www.geekslope.de5.net'
let checkedPages = 0

async function read(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' })
  assert.equal(response.status, expectedStatus, `${path}: status`)
  assert.ok(response.headers.get('content-security-policy'), `${path}: CSP`)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${path}: nosniff`)
  return { response, text: await response.text() }
}

async function page(path, { canonicalPath = path.split('?')[0], noindex = false, status = 200 } = {}) {
  const { response, text } = await read(path, status)
  assert.match(response.headers.get('content-type'), /text\/html/)
  assert.ok(text.includes(`<link rel="canonical" href="${canonicalOrigin}${canonicalPath}">`), `${path}: canonical`)
  const robots = text.match(/<meta name="robots" content="([^"]+)"/)?.[1] || ''
  assert.equal(robots.includes('noindex'), noindex, `${path}: index policy`)
  if (!noindex) assert.equal([...text.matchAll(/<h1(?:\s[^>]*)?>/g)].length, 1, `${path}: one h1`)
  const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  const graph = scripts.filter(([, attrs]) => attrs.includes('application/ld+json')).flatMap(([, , json]) => JSON.parse(json)['@graph'])
  assert.ok(graph.some((item) => item['@type'] === 'Organization'), `${path}: organization`)
  assert.equal(new Set(graph.map((item) => item['@id']).filter(Boolean)).size, graph.filter((item) => item['@id']).length, `${path}: unique schema IDs`)
  for (const [, attrs, script] of scripts) {
    if (!attrs.includes('application/ld+json') && !attrs.includes('src=')) new Function(script)
  }
  const faq = graph.find((item) => item['@type'] === 'FAQPage')
  for (const item of faq?.mainEntity || []) {
    assert.ok(text.includes(item.name), `${path}: FAQ question visible`)
    // Escape only HTML text characters, as renderPage's esc() does.
    const escaped = item.acceptedAnswer.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
    assert.ok(text.includes(escaped), `${path}: FAQ answer visible`)
  }
  checkedPages++
  return { text, graph }
}

const { text: robots } = await read('/robots.txt')
assert.match(robots, /User-agent: \*\s+Allow: \//)
assert.ok(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`))
assert.match(robots, /Disallow: \/api\//)
assert.ok(!robots.includes('Disallow: /login'), 'Forms must be crawlable to expose noindex')
const { text: llms } = await read('/llms.txt')
assert.ok(llms.includes(`${canonicalOrigin}/products`))
assert.ok(llms.includes('Melbourne computer rental'))

const { text: sitemap, response: sitemapResponse } = await read('/sitemap.xml')
assert.match(sitemapResponse.headers.get('content-type'), /application\/xml/)
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url))
assert.ok(locations.length >= 7, 'Public pages in sitemap')
assert.equal(new Set(locations.map(String)).size, locations.length, 'No duplicate URLs')
for (const url of locations) {
  assert.equal(url.origin, canonicalOrigin, 'Sitemap canonical host')
  assert.equal(url.search, '', 'No tracking or filter parameters in sitemap')
  assert.ok(!/^\/(api|sso|login|register|checkout|apply|order-lookup)(\/|$)/.test(url.pathname), 'No private or transaction URLs')
  await page(url.pathname)
}
for (const path of ['/terms', '/service-terms', '/privacy', '/software-terms', '/refund-policy', '/cookies', '/complaints', '/acceptable-use', '/consumer-rights', '/rental-terms']) {
  // With an empty local D1 these are placeholders; published documents are
  // already checked above. Verify that placeholders remain accessible/noindex.
  if (!locations.some((url) => url.pathname === path)) await page(path, { noindex: true })
}

const { text: home, graph } = await page('/') // Also exercise the HTML edge cache hit.
assert.match(home, /<h1>墨尔本电脑租赁/)
assert.match(home, /留学生与办公笔记本租赁/)
assert.ok(graph.some((item) => item['@type'] === 'Service' && item.areaServed.name === 'Melbourne'))
await page('/products?q=laptop&category=gaming', { canonicalPath: '/products' })
for (const path of ['/login', '/apply', '/checkout', '/order-lookup']) await page(path, { noindex: true })
await page('/__seo_missing_page__', { canonicalPath: '/', noindex: true, status: 404 })
await page('/products/__seo_missing_product__', { noindex: true, status: 404 })
for (const path of ['/api/session', '/healthz']) {
  const { response } = await read(path)
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
}
console.log(`SEO verification passed: ${checkedPages} HTML responses, ${locations.length} sitemap URLs, JSON-LD, FAQs, script syntax, canonical hosts, robots and security headers.`)
