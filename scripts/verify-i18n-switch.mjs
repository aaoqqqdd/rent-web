// Language-switch + interaction regression test (Lead).
// node scripts/verify-i18n-switch.mjs
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:8811'
const stamp = Date.now()
const PORT = 9500 + Math.floor(Math.random() * 300)
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`) }

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio', '--remote-allow-origins=*', `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/switch-test-${stamp}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore'] })
process.on('exit', () => chrome.kill('SIGKILL'))

let ws, id = 0
const pending = new Map()
const handlers = new Map()
async function connect() {
  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) {
        const info = await res.json()
        ws = new WebSocket(info.webSocketDebuggerUrl)
        await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }) })
        ws.addEventListener('message', (ev) => {
          const msg = JSON.parse(ev.data)
          if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); return }
          for (const h of handlers.get(msg.method) ?? []) h(msg.params, msg.sessionId)
        })
        return
      }
    } catch {}
    await sleep(100)
  }
  throw new Error('no chrome')
}
function send(method, params = {}, sessionId) {
  const mid = ++id
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }))
  return new Promise((res, rej) => pending.set(mid, { res, rej }))
}
const on = (m, h) => { handlers.set(m, [...(handlers.get(m) ?? []), h]); return () => handlers.set(m, (handlers.get(m) ?? []).filter((x) => x !== h)) }
async function ev(sessionId, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''))
  return r.result?.value
}
async function navigate(sessionId, url) {
  const loaded = new Promise((r) => { const off = on('Page.loadEventFired', () => { off(); r() }) })
  await send('Page.navigate', { url }, sessionId)
  await Promise.race([loaded, sleep(8000)])
  await sleep(800)
}

const errors = []
const main = async () => {
  await connect()
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  on('Runtime.exceptionThrown', (p, s) => { if (s === sessionId) errors.push(p.exceptionDetails?.text + ' ' + (p.exceptionDetails?.exception?.description ?? '')) })
  on('Runtime.consoleAPICalled', (p, s) => { if (s === sessionId && p.type === 'error') errors.push(p.args?.map((a) => a.value ?? '').join(' ')) })
  await send('Page.enable', {}, sessionId)
  await send('Runtime.enable', {}, sessionId)
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId)

  // start in Chinese
  await navigate(sessionId, `${BASE}/?cachebust=sw1-${stamp}`)
  await ev(sessionId, `localStorage.setItem('geekslope-language','zh')`)
  await navigate(sessionId, `${BASE}/?cachebust=sw2-${stamp}`)
  const zh = await ev(sessionId, `(() => {
    const visible = (n) => { const p = n.parentElement; return p && !p.closest('script,style,[data-no-translate]') && p.offsetParent !== null; };
    let han = 0, stops = 0, semis = 0;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!visible(n)) continue; const t = n.nodeValue || ''; han += (t.match(/[\\u3400-\\u9fff]/g)||[]).length; stops += (t.match(/。/g)||[]).length; semis += (t.match(/；/g)||[]).length; }
    return { lang: document.documentElement.lang, h1: (document.querySelector('h1')||{}).textContent, han, stops, semis, title: document.title };
  })()`)
  check('zh: html lang zh-CN', zh.lang === 'zh-CN', zh.lang)
  check('zh: Chinese full stops preserved', zh.stops > 0, `。=${zh.stops} ；=${zh.semis}`)
  check('zh: h1 is Chinese', /[\u3400-\u9fff]/.test(zh.h1 || ''), zh.h1?.slice(0, 40))

  // menu open / Escape
  await ev(sessionId, `document.querySelector('.menu-toggle').click()`)
  const menuOpen = await ev(sessionId, `({ open: document.getElementById('site-nav').classList.contains('is-open'), expanded: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), focused: document.activeElement?.tagName })`)
  check('mobile menu opens', menuOpen.open === true && menuOpen.expanded === 'true', JSON.stringify(menuOpen))
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId)
  await sleep(200)
  const menuClosed = await ev(sessionId, `({ open: document.getElementById('site-nav').classList.contains('is-open'), expanded: document.querySelector('.menu-toggle').getAttribute('aria-expanded') })`)
  check('mobile menu closes on Escape', menuClosed.open === false && menuClosed.expanded === 'false', JSON.stringify(menuClosed))

  // switch to English
  await ev(sessionId, `document.querySelector('[data-language="en"]').click()`)
  await sleep(700)
  const en = await ev(sessionId, `(() => {
    const visible = (n) => { const p = n.parentElement; return p && !p.closest('script,style,[data-no-translate]') && p.offsetParent !== null; };
    let han = 0; const left = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!visible(n)) continue; const t = (n.nodeValue || '').trim(); if (/[\\u3400-\\u9fff]/.test(t)) { han += 1; left.push(t.slice(0,30)); } }
    return { lang: document.documentElement.lang, h1: (document.querySelector('h1')||{}).textContent, han, left, title: document.title, og: document.querySelector('meta[property="og:locale"]')?.content };
  })()`)
  check('switch EN: html lang en-AU', en.lang === 'en-AU', en.lang)
  check('switch EN: h1 translated', !/[\u3400-\u9fff]/.test(en.h1 || ''), en.h1?.slice(0, 50))
  check('switch EN: no Chinese visible text left', en.han === 0, JSON.stringify(en.left))
  check('switch EN: og:locale en_AU', en.og === 'en_AU', en.og)
  check('switch EN: title translated', !/[\u3400-\u9fff]/.test(en.title), en.title)

  // toast + dialog in EN then switch to zh
  const toastEn = await ev(sessionId, `(() => { window.GeekSlopeUI.toast('网络错误，请稍后重试。', { type: 'error' }); const n = document.querySelector('.gs-toast p'); return n && n.textContent; })()`)
  check('toast EN renders English', toastEn && !/[\u3400-\u9fff]/.test(toastEn), toastEn)
  const dialogEn = await ev(sessionId, `(() => { window.GeekSlopeUI.confirm({ title: '退出登录？', message: '退出后，官网与用户中心的登录状态都会结束。如需继续使用，请重新登录。', variant: 'danger' }); return { t: document.getElementById('gs-dialog-title').textContent, m: document.getElementById('gs-dialog-message').textContent }; })()`)
  check('dialog EN renders English', !/[\u3400-\u9fff]/.test(dialogEn.t + dialogEn.m), JSON.stringify(dialogEn).slice(0, 120))

  // switch back to Chinese with dialog still open
  await ev(sessionId, `document.querySelector('[data-language="zh"]').click()`)
  await sleep(700)
  const zhAgain = await ev(sessionId, `(() => {
    const visible = (n) => { const p = n.parentElement; return p && !p.closest('script,style,[data-no-translate]') && p.offsetParent !== null; };
    let stops = 0, han = 0, latinH1 = false;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!visible(n)) continue; const t = n.nodeValue || ''; stops += (t.match(/。/g)||[]).length; han += (t.match(/[\\u3400-\\u9fff]/g)||[]).length; }
    const h1 = (document.querySelector('h1')||{}).textContent || '';
    return { lang: document.documentElement.lang, h1, stops, han, title: document.title,
      dialog: document.getElementById('gs-dialog-title').textContent + '|' + document.getElementById('gs-dialog-message').textContent,
      toast: (document.querySelector('.gs-toast p')||{}).textContent };
  })()`)
  check('switch back ZH: html lang zh-CN', zhAgain.lang === 'zh-CN', zhAgain.lang)
  check('switch back ZH: h1 restored to Chinese', zhAgain.h1 === zh.h1, `${zhAgain.h1?.slice(0, 30)} vs ${zh.h1?.slice(0, 30)}`)
  check('switch back ZH: full stops restored', zhAgain.stops === zh.stops, `${zhAgain.stops} vs ${zh.stops}`)
  check('switch back ZH: dialog re-rendered Chinese', /[\u3400-\u9fff]/.test(zhAgain.dialog), zhAgain.dialog?.slice(0, 60))
  check('switch back ZH: toast re-rendered Chinese', !zhAgain.toast || /[\u3400-\u9fff]/.test(zhAgain.toast), zhAgain.toast)

  // dynamic text after switch: change an existing node's text while in ZH
  const dynamic = await ev(sessionId, `(() => {
    const el = document.getElementById('gs-dialog-message');
    el.textContent = '全新的中文提示。';
    return new Promise((resolve) => setTimeout(() => resolve(el.textContent), 300));
  })()`)
  check('dynamic Chinese text not reverted (zh)', dynamic === '全新的中文提示。', dynamic)

  // close dialog and reload in EN to confirm persistence
  await ev(sessionId, `document.querySelector('[data-language="en"]').click()`)
  await sleep(500)
  await navigate(sessionId, `${BASE}/?cachebust=sw3-${stamp}`)
  const persisted = await ev(sessionId, `({ lang: document.documentElement.lang, stored: localStorage.getItem('geekslope-language'), h1: (document.querySelector('h1')||{}).textContent })`)
  check('language persists across reload', persisted.lang === 'en-AU' && persisted.stored === 'en', JSON.stringify(persisted).slice(0, 120))

  // auto-detect (English browser) must NOT be persisted
  await ev(sessionId, `localStorage.removeItem('geekslope-language')`)
  await navigate(sessionId, `${BASE}/?cachebust=sw4-${stamp}`)
  const auto = await ev(sessionId, `({ stored: localStorage.getItem('geekslope-language'), lang: document.documentElement.lang })`)
  check('auto-detect not persisted to localStorage', auto.stored === null, JSON.stringify(auto))

  check('no JS errors', errors.length === 0, JSON.stringify(errors.slice(0, 4)))
  await send('Browser.close').catch(() => {})
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => chrome.kill('SIGKILL'))
