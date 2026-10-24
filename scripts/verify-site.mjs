// Lead verification harness (CDP). Does not touch teammates' files.
// Usage: node scripts/verify-site.mjs --base http://127.0.0.1:8811 --out .audit/verify-shots
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = opt('base', 'http://127.0.0.1:8811')
const OUT = opt('out', '.audit/verify-shots')
// A fixed debug port can attach to another session's Chrome (different app on
// another port). Pick a free random port and assert the final URL per page.
const PORT = Number(opt('port', String(9400 + Math.floor(Math.random() * 500))))
const LANG = opt('lang', 'en')
const stamp = Date.now()
mkdirSync(OUT, { recursive: true })

const consoleErrors = []

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
        return
      }
      if (msg.method) for (const handler of this.handlers.get(msg.method) ?? []) handler(msg.params, msg.sessionId)
    })
    ws.addEventListener('close', () => { for (const { reject } of this.pending.values()) reject(new Error('CDP closed')) })
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    this.ws.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  on(method, handler) {
    const list = this.handlers.get(method) ?? []
    list.push(handler)
    this.handlers.set(method, list)
    return () => this.handlers.set(method, (this.handlers.get(method) ?? []).filter((h) => h !== handler))
  }
}

async function connect() {
  for (let i = 0; i < 200; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) {
        const info = await res.json()
        const ws = new WebSocket(info.webSocketDebuggerUrl)
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve, { once: true })
          ws.addEventListener('error', reject, { once: true })
        })
        return new CDP(ws)
      }
    } catch { /* not ready */ }
    await sleep(100)
  }
  throw new Error('could not connect to Chrome DevTools')
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description ?? ''))
  return result.result?.value
}

const ROUTES = ['/', '/products', '/products/d-rog', '/checkout', '/apply', '/login', '/rental-guide', '/about', '/order-lookup', '/announcements', '/gift-cards', '/terms']
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true, dpr: 3 },
  { name: 'tablet', width: 768, height: 1024, mobile: true, dpr: 2 },
  { name: 'desktop', width: 1280, height: 800, mobile: false, dpr: 1 },
]

const INSPECT_JS = `(() => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.hidden; };
  const overflow = [...document.querySelectorAll('body *')].filter((el) => {
    if (!visible(el)) return false;
    if (getComputedStyle(el).position === 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.right > vw + 1 || r.left < -1;
  }).slice(0, 20).map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 70), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; });
  const smallTargets = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')].filter((el) => {
    if (!visible(el) || el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    return r.width < 40 || r.height < 40;
  }).slice(0, 20).map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), text: (el.textContent || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; });
  const smallInputs = [...document.querySelectorAll('input, select, textarea')].filter((el) => visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => ({ id: el.id, type: el.type, font: getComputedStyle(el).fontSize }));
  const han = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue || '').trim();
    if (!text) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,[data-no-translate]')) continue;
    if (/[\\u3400-\\u9fff]/.test(text)) han.push(text.slice(0, 90));
  }
  const attrs = [];
  for (const el of document.querySelectorAll('[placeholder], [aria-label], [title], [alt]')) {
    for (const attr of ['placeholder', 'aria-label', 'title', 'alt']) {
      const value = el.getAttribute(attr);
      if (value && /[\\u3400-\\u9fff]/.test(value)) attrs.push(attr + '=' + value.slice(0, 70));
    }
  }
  return {
    vw, scrollWidth: doc.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: doc.scrollWidth > vw + 1,
    overflow, smallTargets, smallInputs, han, attrs, lang: document.documentElement.lang,
    title: document.title, ogLocale: document.querySelector('meta[property="og:locale"]')?.content,
    hanCount: document.body.innerText ? (document.body.innerText.match(/[\\u3400-\\u9fff]/g) || []).length : 0,
    fullStopCount: document.body.innerText ? (document.body.innerText.match(/。/g) || []).length : 0,
    semicolonCount: document.body.innerText ? (document.body.innerText.match(/；/g) || []).length : 0,
  };
})()`

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--mute-audio', '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/cdp-verify-${stamp}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] })
  process.on('exit', () => chrome.kill('SIGKILL'))
  const cdp = await connect()
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  cdp.on('Runtime.consoleAPICalled', (params, sid) => {
    if (sid !== sessionId) return
    if (params.type === 'error' || params.type === 'warning') consoleErrors.push({ type: params.type, text: params.args?.map((a) => a.value ?? a.description).join(' ') })
  })
  cdp.on('Runtime.exceptionThrown', (params, sid) => {
    if (sid !== sessionId) return
    consoleErrors.push({ type: 'exception', text: (params.exceptionDetails?.text ?? '') + ' ' + (params.exceptionDetails?.exception?.description ?? '') })
  })
  cdp.on('Log.entryAdded', (params, sid) => {
    if (sid !== sessionId) return
    if (params.entry.level === 'error') consoleErrors.push({ type: 'log', text: params.entry.text, url: params.entry.url })
  })
  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Log.enable', {}, sessionId)
  const results = []
  try {
    for (const vp of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, mobile: vp.mobile }, sessionId)
      for (const route of ROUTES) {
        const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}__verify=${stamp}-${vp.name}-${LANG}`
        const load = new Promise((resolve) => {
          const off = cdp.on('Page.loadEventFired', () => { off(); resolve() })
        })
        await cdp.send('Page.navigate', { url }, sessionId)
        await Promise.race([load, sleep(8000)])
        // pin language for the verification run, then reload so SSR + client both settle
        await evaluate(cdp, sessionId, `localStorage.setItem('geekslope-language', ${JSON.stringify(LANG)})`)
        await cdp.send('Page.reload', {}, sessionId)
        await sleep(1200)
        const state = await evaluate(cdp, sessionId, INSPECT_JS)
        const finalUrl = await evaluate(cdp, sessionId, 'location.href')
        if (!String(finalUrl).startsWith(BASE)) throw new Error(`navigated away: ${url} -> ${finalUrl}`)
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
        const safe = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]/g, '_')
        const file = `${OUT}/${safe}-${vp.name}-${LANG}.png`
        writeFileSync(file, Buffer.from(shot.data, 'base64'))
        results.push({ viewport: vp.name, route, lang: LANG, finalUrl, ...state, screenshot: file })
      }
    }
  } finally {
    await cdp.send('Browser.close').catch(() => {})
    chrome.kill('SIGKILL')
  }
  writeFileSync(`${OUT}/report-${LANG}.json`, JSON.stringify({ base: BASE, lang: LANG, results, consoleErrors }, null, 2))
  console.table(results.map((r) => ({ viewport: r.viewport, route: r.route, overflow: r.horizontalOverflow, han: r.han.length, hanChars: r.hanCount, attrs: r.attrs.length, smallInputs: r.smallInputs.length, smallTargets: r.smallTargets.length })))
  const bad = results.filter((r) => r.horizontalOverflow || r.han.length || r.attrs.length || r.smallInputs.length)
  if (bad.length) {
    console.log('\n--- details ---')
    for (const r of bad) {
      console.log(`\n[${r.viewport}] ${r.route} scrollWidth=${r.scrollWidth}/${r.vw}`)
      if (r.han.length) console.log('  han:', JSON.stringify(r.han.slice(0, 10)))
      if (r.attrs.length) console.log('  attrs:', JSON.stringify(r.attrs.slice(0, 10)))
      if (r.smallInputs.length) console.log('  smallInputs:', JSON.stringify(r.smallInputs.slice(0, 6)))
      if (r.horizontalOverflow) console.log('  overflow:', JSON.stringify(r.overflow.slice(0, 6)))
    }
  }
  if (consoleErrors.length) console.log('\nconsole errors:', JSON.stringify(consoleErrors.slice(0, 12), null, 2))
  console.log(`\nwrote report-${LANG}.json + ${results.length} screenshots to ${OUT}`)
}

main().catch((error) => { console.error(error); process.exit(1) })
