import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { buildSync } from 'esbuild'

function bundled(path) {
  const output = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
}
const { ACCOUNT_STATUS_SCRIPT } = await bundled('src/components/account-status.ts')
const { renderPage } = await bundled('src/layout.ts')
const { default: worker } = await bundled('src/index.ts')
const DASHBOARD = 'https://dashboard.geekslope.de5.net'

function browser({ initialSite = false, site = false, dashboard = false } = {}) {
  const login = { hidden: initialSite }, account = { hidden: !initialSite, href: initialSite ? '/sso/start' : DASHBOARD }, logout = { hidden: !initialSite }
  const events = new Map(), requests = []
  const status = { site, dashboard }
  const document = {
    visibilityState: 'visible',
    querySelector: () => ({
      getAttribute: key => key === 'data-dashboard-url' ? DASHBOARD : String(initialSite),
      querySelector: key => ({ '[data-account-login]': login, '[data-account-dashboard]': account, '[data-confirm-logout]': logout })[key],
    }),
    addEventListener: (name, callback) => events.set(name, callback),
  }
  runInNewContext(ACCOUNT_STATUS_SCRIPT, {
    document, window: { addEventListener: (name, callback) => events.set(name, callback) }, URL, AbortSignal,
    async fetch(url, options) {
      requests.push({ url, options })
      const value = url === '/api/session' ? status.site : status.dashboard
      if (value === 'error') throw new Error('Network unavailable')
      return { ok: true, json: async () => ({ authenticated: value }) }
    },
  })
  return { login, account, logout, requests, status, async refresh(event = 'pageshow') { await events.get(event)(); await new Promise(resolve => setImmediate(resolve)) } }
}

test('dashboard-only login shows direct dashboard entry without a website cookie', async () => {
  const b = browser({ dashboard: true })
  await b.refresh()
  assert.equal(b.login.hidden, true)
  assert.equal(b.account.hidden, false)
  assert.equal(b.account.href, DASHBOARD)
  assert.equal(b.logout.hidden, true)
  for (const { options } of b.requests) {
    assert.equal(options.credentials, 'include')
    assert.equal(options.cache, 'no-store')
  }
})

test('logged-out visitors retain the login and registration entry', async () => {
  const b = browser()
  await b.refresh()
  assert.equal(b.login.hidden, false)
  assert.equal(b.account.hidden, true)
})

test('website-only sessions enter dashboard through existing SSO', async () => {
  const b = browser({ initialSite: true, site: true })
  await b.refresh()
  assert.equal(b.login.hidden, true)
  assert.equal(b.account.href, '/sso/start')
  assert.equal(b.logout.hidden, false)
})

test('returning from dashboard login or logout refreshes the header', async () => {
  const b = browser()
  await b.refresh()
  b.status.dashboard = true
  await b.refresh('visibilitychange')
  assert.equal(b.account.hidden, false)
  b.status.dashboard = false
  await b.refresh('visibilitychange')
  assert.equal(b.account.hidden, true)
  assert.equal(b.login.hidden, false)
})

test('revoked website sessions and browser back navigation restore the guest entry', async () => {
  const b = browser({ initialSite: true })
  await b.refresh()
  assert.equal(b.login.hidden, false)
  assert.equal(b.logout.hidden, true)
})

test('unavailable session checks preserve known state and never invent a login', async () => {
  const guest = browser({ site: 'error', dashboard: 'error' })
  await guest.refresh()
  assert.equal(guest.login.hidden, false)
  const signedIn = browser({ initialSite: true, site: 'error', dashboard: 'error' })
  await signedIn.refresh()
  assert.equal(signedIn.account.hidden, false)
  assert.equal(signedIn.account.href, '/sso/start')
})

const user = { id: 'user', name: 'Example', email: 'example@example.test', role: 'CUSTOMER' }
const token = 'a'.repeat(43)
function env(authenticated = false) {
  return {
    APP_URL: DASHBOARD, RENT: {
      prepare(sql) { return { bind() { return this }, async first() { return sql.includes('FROM auth_sessions s JOIN users') && authenticated ? user : null }, async run() { return { success: true } } } },
      async batch() { return [] },
    }
  }
}

test('website session endpoint validates cookies and returns no account details', async () => {
  for (const [cookie, active, expected] of [['', true, false], ['session=invalid', true, false], [`session=${token}`, false, false], [`session=${token}`, true, true]]) {
    const response = await worker.fetch(new Request('https://geekslope.de5.net/api/session', { headers: { cookie } }), env(active))
    assert.deepEqual(await response.json(), { authenticated: expected })
    assert.match(response.headers.get('cache-control'), /private, no-store/)
    assert.equal(response.headers.get('vary'), 'Cookie')
    assert.ok(response.headers.get('content-security-policy').includes(DASHBOARD))
  }
})

test('logged-in website users bypass login and guests start on the login tab', async () => {
  const response = await worker.fetch(new Request('https://geekslope.de5.net/login', { headers: { cookie: `session=${token}` } }), env(true))
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), '/sso/start')
  assert.match(response.headers.get('cache-control'), /no-store/)
  const guest = await worker.fetch(new Request('https://geekslope.de5.net/login'), env())
  assert.match(await guest.text(), /class="auth-tab is-active" data-tab="login"/)
  const registration = await worker.fetch(new Request('https://geekslope.de5.net/login?tab=register'), env())
  assert.match(await registration.text(), /class="auth-tab is-active" data-tab="register"/)
})

test('both header states render valid scripts and translated dashboard copy', () => {
  for (const sessionUser of [null, user]) {
    const html = renderPage({ title: 'Test', description: '', body: '', path: '/', appUrl: DASHBOARD, contact: { name: 'GeekSlope', email: '', phone: '', logo: '' }, user: sessionUser })
    for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      if (script.trim().startsWith('{')) continue
      assert.doesNotThrow(() => new Function(script))
    }
    assert.match(html, /进入 Dashboard/)
    assert.match(html, /Go to Dashboard/)
    assert.match(html, /href="\/login\?tab=login"/)
  }
})
