// GeekSlope 市场官网 —— 独立 Cloudflare Worker。
// 与 rent 主应用完全分开部署（wrangler name: geekslope-web）。
// 只读复用 rent 的 D1 库（binding: RENT）来实时展示产品价格 / 配置 / 联系方式。

import { Hono, type Context } from 'hono'
import { STYLES } from './theme'
import { renderPage, FAVICON_SVG } from './layout'
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
import { registerCustomer } from './auth'

export interface Env {
  RENT: D1Database
  APP_URL?: string
  MONTHLY_MULTIPLIER?: string
  CONTACT_PHONE?: string
  CONTACT_EMAIL?: string
  TURNSTILE_SITE_KEY?: string
  // Turnstile 服务端密钥（`wrangler secret put TURNSTILE_SECRET_KEY`）。
  // 未配置时 /register 跳过人机校验（与 rent 公开接口行为一致）。
  TURNSTILE_SECRET_KEY?: string
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

/** 边缘缓存包装：命中直接返回，未命中构建后写回 caches.default。 */
async function cachedHtml(
  c: Context<{ Bindings: Env }>,
  ttl: number,
  build: () => Promise<string>,
): Promise<Response> {
  const cache = caches.default
  const key = new Request(new URL(c.req.url).toString(), { method: 'GET' })
  const hit = await cache.match(key)
  if (hit) return hit
  const html = await build()
  const res = new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${ttl}`,
    },
  })
  c.executionCtx.waitUntil(cache.put(key, res.clone()))
  return res
}

app.get('/styles.css', (c) => {
  return c.body(STYLES, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': `public, max-age=${CSS_TTL}`,
  })
})

app.get('/healthz', (c) => c.text('ok'))

app.get('/favicon.ico', (c) =>
  c.body(FAVICON_SVG, 200, {
    'content-type': 'image/svg+xml',
    'cache-control': `public, max-age=${CSS_TTL}`,
  }),
)

app.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nAllow: /\nSitemap: ${appUrl(c.env)}/sitemap.xml\n`),
)

app.get('/', (c) =>
  cachedHtml(c, HTML_TTL, async () => {
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
    })
  }),
)

app.get('/products', (c) =>
  cachedHtml(c, HTML_TTL, async () => {
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
    })
  }),
)

app.get('/apply', (c) =>
  cachedHtml(c, HTML_TTL, async () => {
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
    })
  }),
)

app.get('/login', (c) =>
  cachedHtml(c, HTML_TTL, async () => {
    const contact = await getSiteContact(c.env)
    const tab = c.req.query('tab') === 'login' ? 'login' : 'register'
    return renderPage({
      title: `注册 / 登录 — ${contact.name}`,
      description: '注册 GeekSlope 账号，或用已有邮箱和密码登录，管理你的租赁订单、付款与合同签署。',
      body: renderLogin({
        appUrl: appUrl(c.env),
        turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
        tab,
      }),
      contact,
      appUrl: appUrl(c.env),
      path: '/login',
    })
  }),
)

// rent 主应用里 /register 是独立注册页；这里统一收敛到本站的 /login 页注册面板。
app.get('/register', (c) => c.redirect('/login', 302))

// 注册接口：直接写 rent 的 D1 users 表（见 ./auth.ts）。不走边缘缓存。
app.post('/register', async (c) => {
  let body: Record<string, unknown> = {}
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ ok: false, code: 'invalid', message: '请求格式错误。' }, 400)
  }
  const ip = (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0] ||
    'unknown'
  ).trim()
  const result = await registerCustomer(c.env, body, ip)
  const status = result.ok ? 200 : result.code === 'error' ? 500 : result.code === 'rate_limited' ? 429 : 400
  return c.json(result, status)
})

app.get('/rental-guide', (c) =>
  cachedHtml(c, CSS_TTL, async () => {
    const contact = await getSiteContact(c.env)
    return renderPage({
      title: `租赁说明 — ${contact.name}`,
      description: '三步完成租赁：选择设备、提交申请、确认配送。含常见问题解答。',
      body: renderRentalGuide(appUrl(c.env)),
      contact,
      appUrl: appUrl(c.env),
      path: '/rental-guide',
    })
  }),
)

app.get('/about', (c) =>
  cachedHtml(c, CSS_TTL, async () => {
    const contact = await getSiteContact(c.env)
    return renderPage({
      title: `关于我们 — ${contact.name}`,
      description: '专业电脑出租平台，为学生和个人用户提供高品质设备租赁服务。',
      body: renderAbout(contact),
      contact,
      appUrl: appUrl(c.env),
      path: '/about',
    })
  }),
)

app.notFound(async (c) => {
  const contact = await getSiteContact(c.env)
  return c.html(
    renderPage({
      title: `页面走丢了 — ${contact.name}`,
      description: '',
      body: renderNotFound(),
      contact,
      appUrl: appUrl(c.env),
      path: '*',
    }),
    404,
  )
})

export default app
