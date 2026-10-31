import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

const output = buildSync({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const canonical = 'https://geekslope.de5.net'

function setup(t) {
  const original = globalThis.caches
  const entries = new Map(), pending = [], operations = []
  globalThis.caches = {
    default: {
      async match(request) { return entries.get(request.url)?.clone() },
      async put(request, response) { entries.set(request.url, response.clone()) },
    }
  }
  t.after(() => { globalThis.caches = original })
  const env = {
    RENT: {
      prepare(sql) {
        operations.push(sql)
        return {
          bind() { return this },
          async first() { return null },
          async all() { return { results: sql === 'SELECT * FROM devices' ? [{ id: 'test-pc', name: 'Public test PC', pricePerDay: 12, status: 'available', lifecycle_status: 'READY' }] : [] } },
          async run() { throw new Error('Discovery must not write to D1') },
        }
      }
    }
  }
  const request = async (path, { method = 'GET', accept = '*/*', cookie = '', origin = canonical } = {}) => {
    const response = await worker.fetch(new Request(origin + path, { method, headers: { accept, cookie } }), env, { waitUntil(promise) { pending.push(promise) } })
    await Promise.all(pending)
    return response
  }
  return { request, operations, entries }
}

function parseLinks(response) {
  return [...(response.headers.get('link') || '').matchAll(/<([^>]+)>; rel="([^"]+)"; type="([^"]+)"/g)]
    .map(([, href, rel, type]) => ({ href, rel, type }))
}

test('RFC 9727 catalog provides resolvable API anchors, specs, docs and status with the right media types', async (t) => {
  const { request, operations } = setup(t)
  const response = await request('/.well-known/api-catalog')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^application\/linkset\+json; profile="https:\/\/www.rfc-editor.org\/info\/rfc9727"$/)
  const { linkset } = await response.json()
  assert.equal(operations.length, 0, 'Static discovery must not touch customer or order data')
  assert.equal(linkset.length, 3)
  for (const entry of linkset) {
    assert.equal(new URL(entry.anchor).origin, canonical)
    const anchor = await request(new URL(entry.anchor).pathname)
    assert.equal(anchor.status, 200, entry.anchor)
    for (const rel of ['service-desc', 'service-doc', 'status']) {
      assert.ok(Array.isArray(entry[rel]) && entry[rel].length > 0)
      for (const target of entry[rel]) {
        assert.equal(new URL(target.href).origin, canonical)
        const linked = await request(new URL(target.href).pathname)
        assert.equal(linked.status, 200)
        assert.equal(linked.headers.get('content-type').split(';')[0], target.type)
      }
    }
  }
  const head = await request('/.well-known/api-catalog', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.ok(parseLinks(head).some((link) => link.rel === 'api-catalog'))
})

test('OpenAPI paths describe real, credential-free read operations without claiming payment support', async (t) => {
  const { request } = setup(t)
  const response = await request('/openapi.json')
  assert.equal(response.status, 200)
  const spec = await response.json()
  assert.equal(spec.openapi, '3.1.0')
  assert.equal(spec.servers[0].url, canonical)
  assert.deepEqual(spec.security, [])
  assert.equal(Object.keys(spec.paths).length, 5)
  const ids = new Set()
  for (const [path, item] of Object.entries(spec.paths)) {
    assert.deepEqual(Object.keys(item), ['get'], path)
    assert.ok(item.get.responses['200'])
    assert.ok(!ids.has(item.get.operationId))
    ids.add(item.get.operationId)
    const operation = await request(path.replace('{id}', 'test-pc'))
    assert.equal(operation.status, 200, path)
    assert.ok(item.get.responses['200'].content[operation.headers.get('content-type').split(';')[0]])
  }
  for (const path of ['/products', '/products/test-pc']) {
    const markdown = await request(path, { accept: 'text/markdown' })
    assert.match(markdown.headers.get('content-type'), /^text\/markdown/)
  }
  const missing = await request('/products/missing', { accept: 'text/markdown' })
  assert.equal(missing.status, 404)
  assert.ok(spec.paths['/products/{id}'].get.responses['404'].content['text/markdown'])
  const notices = await (await request('/api/public-notices?limit=20')).json()
  assert.ok(Array.isArray(notices.notices))
  const availability = await (await request('/api/device-availability?deviceIds=%5B%22test-pc%22%5D')).json()
  const required = spec.components.schemas.DeviceAvailability.required
  for (const name of required) assert.ok(name in availability.availability['test-pc'], name)
  assert.equal(await (await request('/healthz')).text(), 'ok')
  assert.doesNotMatch(JSON.stringify(spec), /x-payment-info|agent_auth|payment-processor|oauth2|bearerAuth/)
  assert.ok(!spec.paths['/api/rental-request'])
  assert.ok(!spec.paths['/register'])
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (value.$ref) {
      assert.match(value.$ref, /^#\/components\/schemas\//)
      assert.ok(spec.components.schemas[value.$ref.split('/').at(-1)], value.$ref)
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(spec)
})

test('discovery Link headers survive both format cache hits, HEAD, aliases and session bypass', async (t) => {
  const { request, entries } = setup(t)
  for (const accept of ['text/html', 'text/markdown']) {
    for (const options of [{ accept }, { accept }, { accept, method: 'HEAD' }, { accept, cookie: 'session=invalid' }, { accept, origin: 'https://www.geekslope.de5.net' }]) {
      const response = await request('/', options)
      assert.equal(response.status, 200)
      const links = parseLinks(response)
      assert.equal(links.length, 5)
      for (const relation of ['api-catalog', 'service-desc', 'service-doc', 'describedby']) assert.ok(links.some((link) => link.rel === relation))
      for (const link of links) {
        assert.equal(new URL(link.href).origin, canonical)
        const resource = await request(new URL(link.href).pathname)
        assert.equal(resource.status, 200)
        assert.equal(resource.headers.get('content-type').split(';')[0], link.type)
      }
      assert.ok(response.headers.get('content-security-policy'))
      assert.equal(response.headers.get('x-frame-options'), 'DENY')
      if (options.cookie) assert.equal(response.headers.get('cache-control'), 'private, no-store')
    }
  }
  assert.ok(entries.size >= 2)
})

test('auth.md is self-contained and accurately describes existing human-controlled provisioning', async (t) => {
  const { request, operations } = setup(t)
  for (const path of ['/auth.md', '/api-docs.md']) {
    const response = await request(path, { cookie: 'session=private-test' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300')
    const text = await response.text()
    if (path === '/auth.md') {
      assert.match(text, /^# .*auth\.md/m)
      assert.match(text, /human-assisted customer registration/)
      assert.match(text, /POST \/register/)
      assert.match(text, /HttpOnly session cookie/)
      assert.match(text, /no published OAuth issuer/)
    }
    assert.doesNotMatch(text, /session=private-test|Bearer ey|sk_live_|SETTINGS_ENCRYPTION_KEY/)
    assert.ok(response.headers.get('content-security-policy'))
  }
  assert.equal(operations.length, 0)
})

test('unimplemented OAuth, agent registration and payment protocols are not advertised as working', async (t) => {
  const { request } = setup(t)
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server', '/.well-known/acp.json', '/.well-known/ucp', '/.well-known/agent-card.json', '/.well-known/agent.json', '/agent/auth']) {
    const response = await request(path)
    assert.equal(response.status, 404, path)
    assert.match(await response.text(), /noindex/)
  }
  const balance = await (await request('/api/account-balance?email=someone@example.test')).json()
  assert.equal(balance.requiresLogin, true)
})
