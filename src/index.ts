// GeekSlope 市场官网 —— 独立 Cloudflare Worker。
// 与 rent 主应用完全分开部署（wrangler name: geekslope-web）。
// 只读复用 rent 的 D1 库（binding: RENT）来实时展示产品价格 / 配置 / 联系方式。

import { Hono, type Context } from 'hono'
import { STYLES } from './theme'
import { renderPage } from './layout'
import {
  getRentalConfig,
  getSiteContact,
  listProducts,
  minDailyRate,
  pickFeatured,
} from './db'
import { renderHome } from './pages/home'
import { renderProducts } from './pages/products'
import { renderApply } from './pages/apply'
import { renderLogin } from './pages/login'
import { renderAbout, renderNotFound, renderRentalGuide } from './pages/content'
import {
  clearedSessionCookie,
  createSession,
  currentUser,
  destroySession,
  enforceRateLimit,
  hasSessionCookie,
  issueHandoffToken,
  sessionCookie,
  verifyCredentials,
  type SessionUser,
} from './auth'

export interface Env {
  RENT: D1Database
  APP_URL?: string
  MONTHLY_MULTIPLIER?: string
  CONTACT_PHONE?: string
  CONTACT_EMAIL?: string
  TURNSTILE_SITE_KEY?: string
}

const HTML_TTL = 60 // 秒。产品价格改动后最多 60s 生效。
const CSS_TTL = 86400

const app = new Hono<{ Bindings: Env }>()

function appUrl(env: Env): string {
  return (env.APP_URL || 'https://rent.example.com').replace(/\/$/, '')
}

function multiplier(env: Env): number {
  const n = parseFloat(env.MONTHLY_MULTIPLIER || '')
  return Number.isFinite(n) && n > 0 ? n : 20
}

/**
 * 边缘缓存包装：命中直接返回，未命中构建后写回 caches.default。
 * 携带 session cookie 的请求（已登录用户）一律绕过缓存 —— 顶栏会渲染登录态，
 * 缓存了带登录态的 HTML 会串号。登出访客（绝大多数流量）照常享受边缘缓存。
 */
async function cachedHtml(
  c: Context<{ Bindings: Env }>,
  ttl: number,
  build: (user: SessionUser | null) => Promise<string>,
): Promise<Response> {
  const authed = hasSessionCookie(c.req.header('cookie') ?? null)
  const cache = caches.default
  const key = new Request(new URL(c.req.url).toString(), { method: 'GET' })
  if (!authed) {
    const hit = await cache.match(key)
    if (hit) return hit
  }
  const user = authed ? await currentUser(c) : null
  const html = await build(user)
  const res = new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': authed ? 'private, no-store' : `public, max-age=${ttl}`,
    },
  })
  if (!authed) c.executionCtx.waitUntil(cache.put(key, res.clone()))
  return res
}

app.get('/styles.css', (c) => {
  return c.body(STYLES, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': `public, max-age=${CSS_TTL}`,
  })
})

app.get('/healthz', (c) => c.text('ok'))

const FAVICON =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<path d="M4 26 16 4l4 8-8 14z" fill="#00e6ff"/>` +
  `<path d="M15 26 24 9l4 8-5 9z" fill="#00c79f"/></svg>`

app.get('/favicon.ico', (c) =>
  c.body(FAVICON, 200, {
    'content-type': 'image/svg+xml',
    'cache-control': `public, max-age=${CSS_TTL}`,
  }),
)

app.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nAllow: /\nSitemap: ${appUrl(c.env)}/sitemap.xml\n`),
)

app.get('/', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
    ])
    const body = renderHome({
      featured: pickFeatured(products),
      minRate: minDailyRate(products),
      appUrl: appUrl(c.env),
      multiplier: multiplier(c.env),
    })
    return renderPage({
      title: `${contact.name} — 电脑租赁 | 学生与个人用户的高品质设备`,
      description:
        'GeekSlope 为学生和个人用户提供高品质电脑租赁服务。灵活租期，快速配送，专业售后。',
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/',
      user,
    })
  }),
)

app.get('/products', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
    ])
    const body = renderProducts({
      products,
      appUrl: appUrl(c.env),
      multiplier: multiplier(c.env),
    })
    return renderPage({
      title: `产品目录 — ${contact.name}`,
      description: '游戏笔记本、轻薄商务本、台式工作站，按日或按月租用，价格实时同步。',
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/products',
      user,
    })
  }),
)

app.get('/apply', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact, config] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
      getRentalConfig(c.env),
    ])
    const selectedId = c.req.query('device') || ''
    const body = renderApply({
      products,
      selectedId,
      config,
      appUrl: appUrl(c.env),
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
    })
    return renderPage({
      title: `立即租赁 — ${contact.name}`,
      description: '填写租期与取还方式，在线生成并签署租赁合同。',
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/apply',
      user,
    })
  }),
)

app.get('/rental-guide', (c) =>
  cachedHtml(c, CSS_TTL, async (user) => {
    const contact = await getSiteContact(c.env)
    return renderPage({
      title: `租赁说明 — ${contact.name}`,
      description: '三步完成租赁：选择设备、提交申请、确认配送。含常见问题解答。',
      body: renderRentalGuide(appUrl(c.env)),
      contact,
      appUrl: appUrl(c.env),
      path: '/rental-guide',
      user,
    })
  }),
)

app.get('/about', (c) =>
  cachedHtml(c, CSS_TTL, async (user) => {
    const contact = await getSiteContact(c.env)
    return renderPage({
      title: `关于我们 — ${contact.name}`,
      description: '专业电脑出租平台，为学生和个人用户提供高品质设备租赁服务。',
      body: renderAbout(contact),
      contact,
      appUrl: appUrl(c.env),
      path: '/about',
      user,
    })
  }),
)

// ---------- 账户 / 单点登录（官网登录后，rent 同步为已登录） ----------

const LOGIN_NOTICES: Record<string, string> = {
  'logged-out': '你已退出登录。',
  'session-expired': '登录状态已过期，请重新登录。',
}

async function renderLoginPage(
  c: Context<{ Bindings: Env }>,
  opts: { error?: string; notice?: string; account?: string; status?: number },
): Promise<Response> {
  const contact = await getSiteContact(c.env)
  const html = renderPage({
    title: `登录 — ${contact.name}`,
    description: '登录 GeekSlope 账户，查看订单、合同与付款。',
    body: renderLogin({ appUrl: appUrl(c.env), error: opts.error, notice: opts.notice, account: opts.account }),
    contact,
    appUrl: appUrl(c.env),
    path: '/login',
    user: null,
  })
  return c.html(html, (opts.status ?? 200) as any, { 'cache-control': 'private, no-store' })
}

app.get('/login', async (c) => {
  if (await currentUser(c)) return c.redirect('/sso/start')
  return renderLoginPage(c, { notice: LOGIN_NOTICES[c.req.query('notice') ?? ''] })
})

app.post('/login', async (c) => {
  const form = await c.req.parseBody()
  const account = String(form.account ?? '').trim()
  const password = String(form.password ?? '')
  const remember = form.remember === '1' || form.remember === 'on'
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown')
    .trim()
    .slice(0, 64)

  const origin = c.req.header('Origin')
  if (origin && new URL(origin).host !== new URL(c.req.url).host) {
    return renderLoginPage(c, { error: '请求来源无效，请重试。', status: 403 })
  }
  if (!account || !password) return renderLoginPage(c, { error: '请输入账号和密码。', account, status: 400 })
  if (!(await enforceRateLimit(c.env, 'web-login', ip, 10, 600))) {
    return renderLoginPage(c, { error: '尝试次数过多，请 10 分钟后再试。', account, status: 429 })
  }

  const user = await verifyCredentials(c.env, account, password)
  if (!user) return renderLoginPage(c, { error: '账号或密码错误。', account, status: 401 })

  const { token, maxAge } = await createSession(c.env, user.id, remember)
  const res = c.redirect('/sso/start')
  res.headers.set('Set-Cookie', sessionCookie(token, maxAge, new URL(c.req.url).protocol === 'https:'))
  return res
})

// 官网已登录 → 签发一次性握手 token → 跳到 rent 的 /sso/consume，在 rent 域也建立会话。
app.get('/sso/start', async (c) => {
  const user = await currentUser(c)
  if (!user) return c.redirect('/login?notice=session-expired')
  const handoff = await issueHandoffToken(c.env, user.id)
  return c.redirect(`${appUrl(c.env)}/sso/consume?t=${encodeURIComponent(handoff)}`)
})

const doLogout = async (c: Context<{ Bindings: Env }>) => {
  await destroySession(c) // 撤销该用户所有会话：官网 + rent 一起登出
  const res = c.redirect('/login?notice=logged-out')
  res.headers.set('Set-Cookie', clearedSessionCookie())
  return res
}
app.get('/logout', doLogout)
app.post('/logout', doLogout)

app.notFound((c) => {
  return c.html(
    renderPage({
      title: '页面走丢了 — GeekSlope',
      description: '',
      body: renderNotFound(),
      contact: {
        name: 'GeekSlope',
        phone: '400-888-0000',
        email: 'hello@geekslope.com',
        address: '送货：墨尔本 CBD 及内城区 · 其他郊区到店自取',
      },
      appUrl: appUrl(c.env),
      path: '*',
      user: null,
    }),
    404,
  )
})

export default app
