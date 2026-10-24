// Responsive/UX geometry probe (Lead, metrics only — no image review).
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:8811'
const stamp = Date.now()
const PORT = 9700 + Math.floor(Math.random() * 200)
const out = []
const check = (name, ok, detail = '') => { out.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`) }

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--mute-audio', '--remote-allow-origins=*', `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/resp-probe-${stamp}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore'] })
process.on('exit', () => chrome.kill('SIGKILL'))

let ws, seq = 0
const pending = new Map(); const handlers = new Map()
async function connect() {
  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) {
        const info = await res.json(); ws = new WebSocket(info.webSocketDebuggerUrl)
        await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }) })
        ws.addEventListener('message', (e) => {
          const m = JSON.parse(e.data)
          if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result); return }
          for (const h of handlers.get(m.method) ?? []) h(m.params, m.sessionId)
        })
        return
      }
    } catch {}
    await sleep(100)
  }
  throw new Error('no chrome')
}
const send = (method, params = {}, sessionId) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((r, j) => pending.set(id, { r, j })) }
const on = (m, h) => { handlers.set(m, [...(handlers.get(m) ?? []), h]); return () => handlers.set(m, (handlers.get(m) ?? []).filter((x) => x !== h)) }
async function ev(sid, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid)
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''))
  return r.result?.value
}
async function nav(sid, url) {
  const loaded = new Promise((r) => { const off = on('Page.loadEventFired', () => { off(); r() }) })
  await send('Page.navigate', { url }, sid); await Promise.race([loaded, sleep(9000)]); await sleep(900)
}
const GEOM = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const header = document.querySelector('.site-header');
  const ann = document.querySelector('[data-site-announcement]');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const toastTop = getComputedStyle(document.documentElement).getPropertyValue('--gs-overlay-top').trim();
  const offenders = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el); if (s.position === 'fixed') return false;
    return r.right > vw + 1 || r.left < -1;
  }).slice(0, 8).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 50) }));
  const fixed = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed' && !el.hidden).map((el) => { const r = el.getBoundingClientRect(); return { cls: String(el.className).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; });
  return { vw, vh, scrollWidth: document.documentElement.scrollWidth, headerBottom, annHeight: ann && !ann.hidden ? ann.getBoundingClientRect().height : 0, toastTop, offenders, fixed };
})()`

const run = async () => {
  await connect()
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId: sid } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sid); await send('Runtime.enable', {}, sid)

 for (const vp of [{ n: 'phone', w: 390, h: 844 }, { n: 'landscape', w: 844, h: 390 }, { n: 'tablet', w: 1024, h: 768 }, { n: 'desktop', w: 1440, h: 900 }]) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 900 }, sid)
    for (const route of ['/', '/products', '/rental-guide', '/login', '/order-lookup']) {
      await nav(sid, `${BASE}${route}${route.includes('?') ? '&' : '?'}probe=${stamp}-${vp.n}`)
      const g = await ev(sid, GEOM)
      check(`${vp.n} ${route}: no horizontal overflow`, g.scrollWidth <= g.vw + 1, `${g.scrollWidth}/${g.vw} ${JSON.stringify(g.offenders)}`)
      if (g.offenders.length) check(`${vp.n} ${route}: offender list`, false, JSON.stringify(g.offenders))
    }

    // cart-filled checkout: time picker, address search, submit reachability
    await nav(sid, `${BASE}/?probe=${stamp}-${vp.n}`)
    await ev(sid, `localStorage.setItem('geekslope-cart-v1', JSON.stringify({ items: ['d-rog'], term: null, terms: {} })); localStorage.setItem('geekslope-language','zh')`)
    await nav(sid, `${BASE}/checkout?probe=${stamp}-${vp.n}`)
    const checkout = await ev(sid, `(() => {
      const vw = innerWidth, vh = innerHeight;
      const pickers = [...document.querySelectorAll('.time-picker')].map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right), left: Math.round(r.left) }; });
      const slots = [...document.querySelectorAll('.time-picker-slot')].map((el) => Math.round(el.getBoundingClientRect().height));
      const submit = document.querySelector('#apply-form button[type="submit"], #apply-form .submit-btn');
      const sr = submit ? submit.getBoundingClientRect() : null;
      const search = document.getElementById('delivery-address-search');
      const srch = search ? search.getBoundingClientRect() : null;
      return { vw, vh, scrollWidth: document.documentElement.scrollWidth, pickers, minSlot: slots.length ? Math.min(...slots) : null,
        submitW: sr ? Math.round(sr.width) : null, submitH: sr ? Math.round(sr.height) : null,
        searchFont: search ? getComputedStyle(search).fontSize : null, searchH: srch ? Math.round(srch.height) : null };
    })()`)
    check(`${vp.n} checkout: no horizontal overflow`, checkout.scrollWidth <= checkout.vw + 1, `${checkout.scrollWidth}/${checkout.vw}`)
    check(`${vp.n} checkout: time picker fits`, checkout.pickers.every((p) => p.right <= checkout.vw + 1 && p.left >= -1), JSON.stringify(checkout.pickers))
    if (vp.w <= 620) {
      check(`${vp.n} checkout: time slot height >= 40`, (checkout.minSlot ?? 0) >= 40, String(checkout.minSlot))
      check(`${vp.n} checkout: input font >= 16px`, parseFloat(checkout.searchFont || '0') >= 16, checkout.searchFont)
      check(`${vp.n} checkout: submit target >= 44`, (checkout.submitH ?? 0) >= 44 && (checkout.submitW ?? 0) > 120, `${checkout.submitW}x${checkout.submitH}`)
    }

    // toast + dialog geometry with announcement visible
    const overlay = await ev(sid, `(async () => {
      window.GeekSlopeUI.toast('测试通知：这是一条较长的提示信息，用来检查是否会遮挡顶部导航。', { type: 'info' });
      await new Promise((r) => setTimeout(r, 100));
      const toast = document.querySelector('.gs-toast').getBoundingClientRect();
      const header = document.querySelector('.site-header').getBoundingClientRect();
      const ann = document.querySelector('[data-site-announcement]');
      const annBox = ann && !ann.hidden ? ann.getBoundingClientRect() : null;
      window.GeekSlopeUI.confirm({ title: { zh: '确认提交租赁申请？', en: 'Submit?' }, message: { zh: '提交后将验证并预授权押金。', en: 'Deposit will be pre-authorised.' }, variant: 'warning' });
      await new Promise((r) => setTimeout(r, 200));
      const dlg = document.getElementById('gs-confirm-dialog').getBoundingClientRect();
      return { vw: innerWidth, vh: innerHeight, toastTop: Math.round(toast.top), headerBottom: Math.round(header.bottom), annBottom: annBox ? Math.round(annBox.bottom) : null,
        toastH: Math.round(toast.height), dlg: { top: Math.round(dlg.top), bottom: Math.round(dlg.bottom), w: Math.round(dlg.width), h: Math.round(dlg.height) } };
    })()`)
    check(`${vp.n} toast sits below header/announcement`, overlay.toastTop >= Math.max(overlay.headerBottom, overlay.annBottom ?? 0) - 1, JSON.stringify({ toastTop: overlay.toastTop, headerBottom: overlay.headerBottom, annBottom: overlay.annBottom }))
    check(`${vp.n} dialog fits viewport`, overlay.dlg.top >= 0 && overlay.dlg.bottom <= overlay.vh + 1 && overlay.dlg.w <= overlay.vw + 1, JSON.stringify(overlay.dlg))
  }

  await send('Browser.close').catch(() => {})
  const failed = out.filter((r) => !r.ok)
  console.log(`\n${out.length - failed.length}/${out.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}
run().catch((e) => { console.error(e); process.exit(1) }).finally(() => chrome.kill('SIGKILL'))
