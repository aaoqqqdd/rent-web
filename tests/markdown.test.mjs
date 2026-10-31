import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

async function bundled(path) {
  const output = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
}
const { acceptsMarkdown, htmlToMarkdown } = await bundled('src/markdown.ts')
const { default: worker } = await bundled('src/index.ts')
const { CONTENT_SIGNAL } = await bundled('src/seo.ts')

test('negotiation requires explicit Markdown and respects quality, exclusions and browser defaults', () => {
  for (const header of [undefined, '', '*/*', 'text/*', 'text/html', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'text/markdown;q=0,*/*;q=1', 'text/markdown;q=0.5,text/html;q=1', 'text/markdown;q=0.2,text/*;q=0.8']) {
    assert.equal(acceptsMarkdown('/', header), false, String(header))
  }
  for (const header of ['text/markdown', 'text/markdown; charset=utf-8', 'TEXT/MARKDOWN', 'text/html,text/markdown', 'text/markdown;q=0.8,text/html;q=0.5', 'text/markdown,text/html;q=0.9,*/*;q=0.8']) {
    assert.equal(acceptsMarkdown('/', header), true, header)
  }
  for (const path of ['/products', '/products/pc', '/announcements/announcement%3A1', '/user-terms', '/cookie-policy']) assert.equal(acceptsMarkdown(path, 'text/markdown'), true)
  for (const path of ['/api/session', '/checkout', '/apply', '/login', '/register', '/order-lookup', '/logout', '/sso/start', '/styles.css', '/robots.txt']) assert.equal(acceptsMarkdown(path, 'text/markdown'), false)
})

test('conversion retains real content, entities, absolute links and JSON-LD while removing shell and hidden controls', () => {
  const { body, robots } = htmlToMarkdown(`<!doctype html><html><head><title>PC &amp; laptop</title>
    <meta name="description" content="Specs &amp; prices"><meta name="robots" content="noindex, follow">
    <link rel="canonical" href="https://geekslope.de5.net/products/pc">
    <script type="application/ld+json">{"@type":"Product","name":"PC"}</script></head>
    <body><header>Account secret@example.test</header><nav>Navigation</nav><main>
      <h1>PC &amp; laptop</h1><p>Literal &lt;script&gt; &amp; [brackets]</p>
      <div><span>日租</span><strong>$12</strong><small>/ day</small></div>
      <p><del>$140</del> $112/week</p><a href="/rental-guide#delivery">配送说明</a>
      <a href="javascript:alert(1)">Unsafe link</a><a href="data:text/html,example">Data link</a>
      <details><summary>押金何时退？</summary><p>归还验收后。</p></details>
      <aside><h2>服务包含</h2><p>本地技术支持</p></aside>
      <div hidden>HIDDEN_SECRET</div><div aria-hidden="true">DECORATION</div>
      <div data-legal-lang="en" hidden>HIDDEN_TRANSLATION</div>
      <form><input value="FORM_SECRET"><p>FORM_TEXT</p></form><button>BUTTON_TEXT</button>
      <select><option>SELECT_TEXT</option></select><svg><text>SVG_TEXT</text></svg>
      <script>TRACKING_SCRIPT</script><style>STYLE_TEXT</style>
    </main><footer>FOOTER_TEXT</footer></body></html>`)
  assert.match(body, /^---\ntitle: "PC & laptop"\ndescription: "Specs & prices"/)
  assert.match(body, /# PC & laptop/)
  assert.match(body, /日租 \$12 \/ day/)
  assert.match(body, /~~\$140~~\s+\$112\/week/)
  assert.match(body, /\[配送说明\]\(<https:\/\/geekslope.de5.net\/rental-guide#delivery>\)/)
  assert.match(body, /\*\*押金何时退？\*\*\n\n归还验收后。/)
  assert.match(body, /## 服务包含\n\n本地技术支持/)
  assert.match(body, /\\<script\\>/)
  assert.match(body, /```json\n[\s\S]*"@type": "Product"/)
  assert.doesNotMatch(body, /(?<!\\)<\/?(?:html|head|main|script|div|iframe)\b|secret@example|Navigation|HIDDEN_|DECORATION|FORM_|BUTTON_|SELECT_|SVG_|TRACKING_|STYLE_|FOOTER_|javascript:|data:text/)
  assert.equal(robots, 'noindex, follow')
})

test('lists, tables, block cards and code fences remain readable Markdown', () => {
  const { body } = htmlToMarkdown(`<head><title>Guide</title></head><main>
    <ol start="3"><li>Choose a device</li><li>Apply<ul><li>Contact details</li></ul></li></ol>
    <table><thead><tr><th>Spec</th><th>Value</th></tr></thead><tbody><tr><td>CPU</td><td>Intel | AMD</td></tr></tbody></table>
    <a href="/products"><h2>Devices</h2><p>Compare configurations</p></a>
    <pre><code>const code = \\n;
${'`'.repeat(3)}
more</code></pre></main>`)
  assert.match(body, /3\. Choose a device/)
  assert.match(body, /4\. Apply[\s\S]*  - Contact details/)
  assert.match(body, /\| Spec \| Value \|\n\| --- \| --- \|\n\| CPU \| Intel \\\| AMD \|/)
  assert.match(body, /## Devices\n\nCompare configurations/)
  assert.doesNotMatch(body, /\[## Devices/)
  assert.match(body, /````\nconst code/)
})

function environment(authenticated = false) {
  const device = { id: 'pc', name: 'Test workstation', status: 'available', lifecycle_status: 'READY', pricePerDay: 12, depositAmount: 300, cpu: 'Intel i7', ram: '32GB', description: 'A rental workstation' }
  return {
    RENT: {
      prepare(sql) {
        return {
          bind() { return this },
          async first() {
            return sql.includes('FROM auth_sessions s JOIN users') && authenticated
              ? { id: 'private-user', name: 'Private Customer', email: 'private@example.test', role: 'CUSTOMER' } : null
          },
          async all() { return { results: sql === 'SELECT * FROM devices' ? [device] : [] } },
          async run() { return { success: true } },
        }
      },
      async batch() { return [] },
    }
  }
}

function cacheForTest(t) {
  const original = globalThis.caches
  const entries = new Map(), writes = [], pending = []
  globalThis.caches = {
    default: {
      async match(request) { return entries.get(request.url)?.clone() },
      async put(request, response) { writes.push(request.url); entries.set(request.url, response.clone()) },
    }
  }
  t.after(() => { globalThis.caches = original })
  const request = async (path, accept, cookie = '', authenticated = false) => {
    const headers = { cookie, ...(accept ? { accept } : {}) }
    const response = await worker.fetch(new Request('https://geekslope.de5.net' + path, { headers }), environment(authenticated), { waitUntil(promise) { pending.push(promise) } })
    await Promise.all(pending)
    return response
  }
  return { request, writes, entries }
}

test('HTML and Markdown caches never mix, whichever representation is requested first', async (t) => {
  const { request, writes, entries } = cacheForTest(t)
  for (const first of ['text/markdown', 'text/html']) {
    entries.clear(); writes.length = 0
    const second = first === 'text/html' ? 'text/markdown' : 'text/html'
    for (const accept of [first, second, first, second]) {
      const response = await request('/', accept)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), accept === 'text/html' ? /^text\/html/ : /^text\/markdown/)
      assert.equal(response.headers.get('vary'), 'Accept, Cookie')
      assert.equal(response.headers.get('content-signal'), CONTENT_SIGNAL)
      assert.ok(response.headers.get('content-security-policy'))
      assert.equal(response.headers.get('x-frame-options'), 'DENY')
      const text = await response.text()
      if (accept === 'text/html') assert.match(text, /^<!doctype html>/)
      else {
        assert.match(text, /^---\n/)
        assert.match(text, /# 墨尔本电脑租赁/)
        assert.match(text, /Test workstation/)
        assert.doesNotMatch(text, /<script|dataLayer|GTM-WNG9QDTP|geekslope-language/)
      }
    }
    assert.equal(writes.length, 2)
    assert.equal(new Set(writes).size, 2)
  }
})

test('real catalogue, product, FAQ and legal placeholders preserve details and indexing policy', async (t) => {
  const { request } = cacheForTest(t)
  for (const path of ['/products', '/products/pc', '/rental-guide', '/about', '/announcements', '/referral', '/terms']) {
    const response = await request(path, 'text/markdown')
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('content-type'), /^text\/markdown/)
    const text = await response.text()
    assert.doesNotMatch(text, /<\/?(?:html|script|input|select|button|svg)\b/)
    if (path === '/products/pc') {
      assert.match(text, /# Test workstation/)
      assert.match(text, /Intel i7/)
      assert.match(text, /32GB/)
      assert.match(text, /\$12/)
      assert.match(text, /\$300/)
    }
    if (path === '/rental-guide') assert.match(text, /\*\*押金什么时候退？\*\*/)
    if (path === '/terms') assert.match(response.headers.get('x-robots-tag'), /noindex/)
  }
  const missing = await request('/products/missing', 'text/markdown')
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('x-robots-tag'), /noindex/)
})

test('session requests bypass both format caches and personal header details are omitted from Markdown', async (t) => {
  const { request, writes } = cacheForTest(t)
  const cookie = `session=${'a'.repeat(43)}`
  for (const accept of ['text/html', 'text/markdown']) {
    await request('/', accept) // populate anonymous representation
    const before = writes.length
    const response = await request('/', accept, cookie, true)
    assert.match(response.headers.get('cache-control'), /private, no-store/)
    const text = await response.text()
    if (accept === 'text/html') assert.match(text, /进入 Dashboard/)
    else assert.doesNotMatch(text, /private@example|Private Customer|private-user/)
    assert.equal(writes.length, before)
  }
})

test('API, static files and transaction pages keep their existing media types', async (t) => {
  const { request } = cacheForTest(t)
  for (const [path, type] of [['/api/session', 'application/json'], ['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml'], ['/styles.css', 'text/css'], ['/login', 'text/html'], ['/apply', 'text/html'], ['/checkout', 'text/html'], ['/order-lookup', 'text/html']]) {
    const response = await request(path, 'text/markdown')
    assert.equal(response.status, 200, path)
    assert.ok(response.headers.get('content-type').startsWith(type), path)
  }
})
