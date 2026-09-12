// GeekSlope 市场官网 —— 独立 Cloudflare Worker。
// 与 rent 主应用完全分开部署（wrangler name: geekslope-web）。
// 只读复用 rent 的 D1 库（binding: RENT）来实时展示产品价格 / 配置 / 联系方式。

import { Hono, type Context } from 'hono'
import { STYLES, STYLE_VERSION } from './theme'
import { renderPage, FAVICON_SVG } from './layout'
import {
  getRentalConfig,
  getDeviceAvailability,
  getLegalDocument,
  getSiteContact,
  getPublicNotice,
  couponAppliesToProduct,
  listProducts,
  listPublicNotices,
  minDailyRate,
  pickFeatured,
} from './db'
import type { LegalDocumentKey } from './db'
import { renderHome } from './pages/home'
import { renderProducts } from './pages/products'
import { renderProductDetail } from './pages/product-detail'
import { renderApply, renderCartPage } from './pages/apply'
import { renderLogin } from './pages/login'
import { renderAbout, renderNotFound, renderOrderLookup, renderRentalGuide } from './pages/content'
import { renderLegalDocument } from './pages/legal'
import { renderAnnouncementDetail, renderAnnouncements } from './pages/announcements'
import { createRentalSetupIntent, handleRentalRequest, lookupAccountBalance, parseRequestBody, previewRentalCoupon } from './public-rental'
import { autocompleteMelbourneAddresses } from './address'
import { listOrdersForUser, lookupOrderByCredentials } from './orders'
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
  verifyTurnstile,
  type SessionUser,
  registerCustomer,
} from './auth'

export interface Env {
  RENT: D1Database
  APP_URL?: string
  CONTACT_PHONE?: string
  CONTACT_EMAIL?: string
  TURNSTILE_SITE_KEY?: string
  SETTINGS_ENCRYPTION_KEY?: string
  STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_SECRET_KEY?: string
  // Turnstile 服务端密钥（`wrangler secret put TURNSTILE_SECRET_KEY`）。
  // 未配置时 /register 跳过人机校验（与 rent 公开接口行为一致）。
  TURNSTILE_SECRET_KEY?: string
}

const HTML_TTL = 60 // 秒。产品价格改动后最多 60s 生效。
const CSS_TTL = 86400
const HTML_CACHE_VERSION = '20260912-clean-guide-links-v1'

const app = new Hono<{ Bindings: Env }>()

// 旧发布链接曾用 release 参数绕过浏览器缓存。现在缓存已按部署版本隔离，
// 收到这类历史链接时直接回到干净 URL，避免参数继续留在地址栏。
app.use('*', async (c, next) => {
  const url = new URL(c.req.url)
  if (c.req.method === 'GET' && url.searchParams.has('release')) {
    url.searchParams.delete('release')
    const query = url.searchParams.toString()
    return c.redirect(`${url.pathname}${query ? `?${query}` : ''}`, 302)
  }
  await next()
})

function appUrl(env: Env): string {
  return (env.APP_URL || 'https://rent.ydnw6zt6vj.workers.dev').replace(/\/$/, '')
}

function siteUrl(requestUrl: string): string {
  return new URL(requestUrl).origin
}

function xmlEsc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * 边缘缓存包装：命中直接返回，未命中构建后写回 caches.default。
 * 携带 session cookie 的请求（已登录用户）一律绕过缓存 —— 顶栏会渲染登录态，
 * 缓存了带登录态的 HTML 会串号。登出访客（绝大多数流量）照常享受边缘缓存。
 */
async function cachedHtml(
  c: Context<{ Bindings: Env }>,
  ttl: number,
  build: (user: SessionUser | null) => Promise<string | { html: string; status: number }>,
): Promise<Response> {
  const authed = hasSessionCookie(c.req.header('cookie') ?? null)
  const cache = caches.default
  // 样式指纹同时作为 HTML 缓存命名空间。改版部署后立即使用新缓存，
  // 避免 caches.default 在 TTL 内继续返回上一版本的导航和页面结构。
  const cacheUrl = new URL(c.req.url)
  cacheUrl.searchParams.set('__site_v', `${HTML_CACHE_VERSION}-${STYLE_VERSION}`)
  const key = new Request(cacheUrl.toString(), { method: 'GET' })
  if (!authed) {
    const hit = await cache.match(key)
    if (hit) {
      const headers = new Headers(hit.headers)
      headers.set('cache-control', 'no-cache, must-revalidate')
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers })
    }
  }
  const user = authed ? await currentUser(c) : null
  const built = await build(user)
  const html = typeof built === 'string' ? built : built.html
  const status = typeof built === 'string' ? 200 : built.status
  const res = new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': authed ? 'private, no-store' : 'no-cache, must-revalidate',
    },
  })
  if (!authed && status === 200) {
    const cachedRes = new Response(html, {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': `public, max-age=${ttl}`,
      },
    })
    c.executionCtx.waitUntil(cache.put(key, cachedRes))
  }
  return res
}

app.get('/styles.css', (c) => {
  return c.body(STYLES, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': `public, max-age=${CSS_TTL}`,
  })
})

app.get('/healthz', (c) => c.text('ok'))

app.get('/api/public-notices', async (c) => {
  const requestedLimit = Number(c.req.query('limit') || 20)
  const notices = await listPublicNotices(c.env, Number.isFinite(requestedLimit) ? requestedLimit : 20)
  return c.json({ notices }, 200, { 'cache-control': 'no-store, max-age=0' })
})

app.get('/api/device-availability', async (c) => {
  let deviceIds: string[] = []
  try {
    const parsed = JSON.parse(String(c.req.query('deviceIds') || '[]'))
    deviceIds = Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean).slice(0, 10) : []
  } catch {
    deviceIds = String(c.req.query('deviceIds') || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 10)
  }
  const config = await getRentalConfig(c.env)
  const availability = await getDeviceAvailability(c.env, deviceIds, config.bufferDays)
  return c.json({ availability }, 200, { 'cache-control': 'no-store, max-age=0' })
})

app.get('/api/address/autocomplete', async (c) => {
  const query = String(c.req.query('q') || '').trim()
  if (query.length < 3) return c.json({ suggestions: [] }, 200, { 'cache-control': 'no-store' })
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim()
  if (!(await enforceRateLimit(c.env, 'web-address-autocomplete', ip, 30, 60))) return c.json({ error: '地址查询过于频繁，请稍后再试。' }, 429)
  const config = await getRentalConfig(c.env)
  const suggestions = await autocompleteMelbourneAddresses(query, config.deliveryAreas)
  return c.json({ suggestions, message: suggestions.length ? undefined : '没有找到墨尔本地址，请继续输入或手工填写。' }, 200, { 'cache-control': 'no-store' })
})

app.get('/api/coupons/rental-cart-preview', async (c) => {
  let deviceIds: string[] = []
  try {
    const parsed = JSON.parse(String(c.req.query('deviceIds') || '[]'))
    deviceIds = Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : []
  } catch {
    deviceIds = String(c.req.query('deviceIds') || '').split(',').map((value) => value.trim()).filter(Boolean)
  }
  let terms: unknown = undefined
  try { terms = JSON.parse(String(c.req.query('terms') || 'null')) } catch { terms = undefined }
  const result = await previewRentalCoupon(c, [...new Set(deviceIds)], Number(c.req.query('days') || 0), String(c.req.query('code') || ''), terms)
  return c.json(result, result.ok ? 200 : 400)
})

app.post('/api/rental-setup-intent', async (c) => {
  try {
    return c.json(await createRentalSetupIntent(c))
  } catch (error) {
    return c.json({ ok: false, message: error instanceof Error ? error.message : '信用卡验证暂不可用，请稍后重试。' }, 400)
  }
})

app.get('/api/account-balance', async (c) => c.json(await lookupAccountBalance(c, String(c.req.query('email') || '')), 200, { 'Cache-Control': 'no-store' }))

app.post('/api/rental-request', async (c) => {
  const body = await parseRequestBody(c)
  if (!body) return c.json({ ok: false, message: '请求格式无效。' }, 400)
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim()
  if (!(await enforceRateLimit(c.env, 'web-rental-request', ip, 6, 900))) return c.json({ ok: false, message: '提交请求过于频繁，请稍后再试。' }, 429)
  return handleRentalRequest(c, body)
})

app.get('/favicon.ico', (c) =>
  c.body(FAVICON_SVG, 200, {
    'content-type': 'image/svg+xml',
    'cache-control': `public, max-age=${CSS_TTL}`,
  }),
)

app.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nAllow: /\nSitemap: ${siteUrl(c.req.url)}/sitemap.xml\n`),
)

app.get('/sitemap.xml', async (c) => {
  const base = siteUrl(c.req.url)
  const products = await listProducts(c.env)
  const paths = ['/', '/products', '/rental-guide', '/about', '/announcements', '/terms', '/service-terms', '/privacy', '/software-terms', '/refund-policy', '/cookies', '/complaints', '/acceptable-use', '/consumer-rights', '/rental-terms']
  const productPaths = products.filter((product) => product.id).map((product) => `/products/${encodeURIComponent(product.id)}`)
  const urls = [...paths, ...productPaths].map((path) => `<url><loc>${xmlEsc(base + path)}</loc></url>`).join('')
  return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, 200, {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=3600',
  })
})

app.get('/', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact, config] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
      getRentalConfig(c.env),
    ])
    const body = renderHome({
      featured: pickFeatured(products),
      products,
      minRate: minDailyRate(products),
      config,
    })
    return renderPage({
      title: `${contact.name}｜墨尔本电脑租赁、游戏本与工作站短租`,
      description: `${contact.name} 提供墨尔本游戏本、商务本和工作站租赁。实时查看配置、日租价与库存，支持本地配送或自取，确认档期后再签约付款。`,
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/',
      siteUrl: siteUrl(c.req.url),
      structuredData: {
        '@type': 'Service',
        '@id': `${siteUrl(c.req.url)}/#computer-rental`,
        name: '墨尔本电脑租赁服务',
        serviceType: '电脑、游戏本与工作站租赁',
        areaServed: { '@type': 'City', name: 'Melbourne' },
        provider: { '@id': `${siteUrl(c.req.url)}/#organization` },
      },
      user,
    })
  }),
)

app.get('/announcements', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [contact, notices] = await Promise.all([
      getSiteContact(c.env),
      listPublicNotices(c.env),
    ])
    return renderPage({
      title: `通告与优惠 — ${contact.name}`,
      description: '查看网站最新通告和当前有效的租赁优惠码。',
      body: renderAnnouncements(notices),
      contact,
      appUrl: appUrl(c.env),
      path: '/announcements',
      siteUrl: siteUrl(c.req.url),
      user,
    })
  }),
)

app.get('/announcements/:id', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [contact, notice] = await Promise.all([
      getSiteContact(c.env),
      getPublicNotice(c.env, c.req.param('id')),
    ])
    const status = notice ? 200 : 404
    return {
      status,
      html: renderPage({
        title: notice ? `${notice.title} — ${contact.name}` : `通告不存在 — ${contact.name}`,
        description: notice ? notice.message.slice(0, 160) : '这条通告不存在或已经失效。',
        body: renderAnnouncementDetail(notice),
        contact,
        appUrl: appUrl(c.env),
        path: `/announcements/${encodeURIComponent(c.req.param('id'))}`,
        siteUrl: siteUrl(c.req.url),
        robots: notice ? 'index, follow' : 'noindex, follow',
        user,
      }),
    }
  }),
)

app.get('/products', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact, notices] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
      c.req.query('coupon') ? listPublicNotices(c.env, 100) : Promise.resolve([]),
    ])
    const couponCode = (c.req.query('coupon') || '').trim().toUpperCase()
    const coupon = notices.find((notice) => notice.kind === 'coupon' && notice.couponCode === couponCode)
    const visibleProducts = coupon ? products.filter((product) => couponAppliesToProduct(coupon, product)) : products
    const body = renderProducts({
      products: visibleProducts,
      couponCode: coupon?.couponCode,
    })
    return renderPage({
      title: `墨尔本电脑租赁设备库 — ${contact.name}`,
      description: '搜索墨尔本可租的游戏笔记本、轻薄商务本和台式工作站，比较 CPU、显卡、内存、日租价、押金与实时库存。',
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/products',
      siteUrl: siteUrl(c.req.url),
      structuredData: {
        '@type': 'CollectionPage',
        '@id': `${siteUrl(c.req.url)}/products#webpage`,
        url: `${siteUrl(c.req.url)}/products`,
        name: '墨尔本电脑租赁设备库',
        isPartOf: { '@id': `${siteUrl(c.req.url)}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: visibleProducts.length,
          itemListElement: visibleProducts.filter((product) => product.id).map((product, index) => ({
            '@type': 'ListItem', position: index + 1, name: product.name,
            url: `${siteUrl(c.req.url)}/products/${encodeURIComponent(product.id)}`,
          })),
        },
      },
      user,
    })
  }),
)

app.get('/products/:id', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact, config] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
      getRentalConfig(c.env),
    ])
    const product = products.find((item) => item.id === c.req.param('id'))
    if (!product) {
      return {
        status: 404,
        html: renderPage({
          title: `设备未找到 — ${contact.name}`,
          description: '这台设备不存在或已经下架。',
          body: renderNotFound(),
          contact,
          appUrl: appUrl(c.env),
          path: c.req.path,
          siteUrl: siteUrl(c.req.url),
          robots: 'noindex, follow',
          user,
        }),
      }
    }
    return renderPage({
      title: `${product.name} 电脑租赁价格与配置 — ${contact.name}`,
      description: `在墨尔本租赁 ${product.name}${product.model ? ` ${product.model}` : ''}。查看 CPU、显卡、内存、存储、日租价、押金、库存和取还说明。`,
      body: renderProductDetail({ product, config }),
      contact,
      appUrl: appUrl(c.env),
      path: `/products/${encodeURIComponent(product.id)}`,
      siteUrl: siteUrl(c.req.url),
      structuredData: [
        {
          '@type': 'Product',
          '@id': `${siteUrl(c.req.url)}/products/${encodeURIComponent(product.id)}#product`,
          name: product.name,
          description: product.description || `${product.name} 电脑租赁`,
          category: product.categoryLabel,
          ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
          ...(product.model ? { model: product.model } : {}),
          ...(product.pricePerDay > 0 ? {
            offers: {
              '@type': 'Offer', url: `${siteUrl(c.req.url)}/products/${encodeURIComponent(product.id)}`,
              priceCurrency: 'AUD', price: product.pricePerDay,
              availability: product.available ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
              businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
              priceSpecification: { '@type': 'UnitPriceSpecification', price: product.pricePerDay, priceCurrency: 'AUD', unitText: 'DAY' },
              seller: { '@id': `${siteUrl(c.req.url)}/#organization` },
            }
          } : {}),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: `${siteUrl(c.req.url)}/` },
            { '@type': 'ListItem', position: 2, name: '设备库', item: `${siteUrl(c.req.url)}/products` },
            { '@type': 'ListItem', position: 3, name: product.name, item: `${siteUrl(c.req.url)}/products/${encodeURIComponent(product.id)}` },
          ],
        },
      ],
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
    const body = renderCartPage(products, config, c.req.query('device') || '')
    return renderPage({
      title: `购物车 — ${contact.name}`,
      description: '确认要租赁的设备，再进入结账页面填写租期与联系信息。',
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/apply',
      siteUrl: siteUrl(c.req.url),
      robots: 'noindex, follow',
      user,
    })
  }),
)

app.get('/checkout', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [products, contact, config] = await Promise.all([
      listProducts(c.env),
      getSiteContact(c.env),
      getRentalConfig(c.env),
    ])
    const body = renderApply({
      products,
      selectedId: c.req.query('device') || '',
      config,
      appUrl: appUrl(c.env),
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
    })
    return renderPage({
      title: `结账 — ${contact.name}`,
      description: '填写租期、取还方式与联系信息，提交设备租赁申请。',
      body,
      contact,
      appUrl: appUrl(c.env),
      path: '/checkout',
      siteUrl: siteUrl(c.req.url),
      robots: 'noindex, follow',
      user,
    })
  }),
)

const LOGIN_NOTICES: Record<string, string> = {
  'logged-out': '你已退出登录。',
  'session-expired': '登录状态已过期，请重新登录。',
}

async function renderLoginPage(
  c: Context<{ Bindings: Env }>,
  opts: { error?: string; notice?: string; account?: string; status?: number; tab?: 'register' | 'login' },
): Promise<Response> {
  const contact = await getSiteContact(c.env)
  const tab = opts.tab ?? (c.req.query('tab') === 'login' ? 'login' : 'register')
  const html = renderPage({
    title: `注册 / 登录 — ${contact.name}`,
    description: `注册 ${contact.name} 账号，或用已有邮箱和密码登录，管理你的租赁订单、付款与合同签署。`,
    body: renderLogin({
      appUrl: appUrl(c.env),
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
      tab,
      error: opts.error,
      notice: opts.notice,
      account: opts.account,
    }),
    contact,
    appUrl: appUrl(c.env),
    path: '/login',
    siteUrl: siteUrl(c.req.url),
    robots: 'noindex, follow',
    user: null,
  })
  return c.html(html, (opts.status ?? 200) as 200, { 'cache-control': 'private, no-store' })
}

app.get('/login', (c) => c.redirect(`${appUrl(c.env)}/login`, 302))

// rent 主应用里 /register 是独立注册页；这里统一收敛到本站的 /login 页注册面板。
app.get('/register', (c) => c.redirect(`${appUrl(c.env)}/login`, 302))

const LEGAL_PAGES: Array<{
  paths: string[]
  title: string
  documentKey: LegalDocumentKey
  metadataKey: string
  variablePrefix: string
  code: string
  rentalTemplate?: boolean
}> = [
    { paths: ['/terms', '/user-terms'], title: '用户协议', documentKey: 'userTerms', metadataKey: 'user', variablePrefix: 'user_agreement', code: 'LEGAL / USER TERMS' },
    { paths: ['/service-terms'], title: '服务条款', documentKey: 'serviceTerms', metadataKey: 'service', variablePrefix: 'service_terms', code: 'LEGAL / SERVICE TERMS' },
    { paths: ['/privacy'], title: '隐私政策', documentKey: 'privacyPolicy', metadataKey: 'privacy', variablePrefix: 'privacy_policy', code: 'LEGAL / PRIVACY' },
    { paths: ['/software-terms'], title: '软件使用协议', documentKey: 'softwareTerms', metadataKey: 'software', variablePrefix: 'software_terms', code: 'LEGAL / SOFTWARE' },
    { paths: ['/refund-policy', '/copyright'], title: '退款政策', documentKey: 'copyrightNotice', metadataKey: 'copyright', variablePrefix: 'refund_policy', code: 'LEGAL / REFUND POLICY' },
    { paths: ['/cookies', '/cookie-policy'], title: 'Cookie 政策', documentKey: 'cookiePolicy', metadataKey: 'cookie', variablePrefix: 'cookie_policy', code: 'LEGAL / COOKIE POLICY' },
    { paths: ['/complaints', '/dispute-resolution'], title: '投诉与争议解决政策', documentKey: 'complaintsPolicy', metadataKey: 'complaints', variablePrefix: 'complaints_policy', code: 'LEGAL / COMPLAINTS' },
    { paths: ['/acceptable-use', '/aup'], title: '可接受使用政策', documentKey: 'acceptableUsePolicy', metadataKey: 'aup', variablePrefix: 'acceptable_use_policy', code: 'LEGAL / ACCEPTABLE USE' },
    { paths: ['/consumer-rights'], title: '澳大利亚消费者法下的权利', documentKey: 'consumerRights', metadataKey: 'consumer', variablePrefix: 'consumer_rights', code: 'LEGAL / CONSUMER RIGHTS' },
    { paths: ['/rental-terms', '/rental-agreement'], title: '设备租赁协议', documentKey: 'rentalTerms', metadataKey: 'rental', variablePrefix: 'rental_agreement', code: 'LEGAL / RENTAL AGREEMENT', rentalTemplate: true },
  ]

for (const page of LEGAL_PAGES) {
  app.on('GET', page.paths, (c) =>
    cachedHtml(c, HTML_TTL, async (user) => {
      const [document, contact] = await Promise.all([
        getLegalDocument(c.env, page.documentKey, page.metadataKey),
        getSiteContact(c.env),
      ])
      return renderPage({
        title: `${page.title} — ${contact.name}`,
        description: `${contact.name} ${page.title}`,
        body: renderLegalDocument({ ...page, document, contact }),
        contact,
        appUrl: appUrl(c.env),
        path: page.paths[0],
        siteUrl: siteUrl(c.req.url),
        user,
      })
    }),
  )
}

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
  cachedHtml(c, HTML_TTL, async (user) => {
    const [contact, config] = await Promise.all([
      getSiteContact(c.env),
      getRentalConfig(c.env),
    ])
    return renderPage({
      title: `电脑租赁流程、押金与配送说明 — ${contact.name}`,
      description: '了解设备租赁的申请、审核、签约付款、配送自取、押金结算与归还验机流程。',
      body: renderRentalGuide(config),
      contact,
      appUrl: appUrl(c.env),
      path: '/rental-guide',
      siteUrl: siteUrl(c.req.url),
      structuredData: {
        '@type': 'WebPage',
        '@id': `${siteUrl(c.req.url)}/rental-guide#webpage`,
        url: `${siteUrl(c.req.url)}/rental-guide`,
        name: '电脑租赁流程、押金与配送说明',
        isPartOf: { '@id': `${siteUrl(c.req.url)}/#website` },
      },
      user,
    })
  }),
)

app.get('/about', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const [contact, config] = await Promise.all([
      getSiteContact(c.env),
      getRentalConfig(c.env),
    ])
    return renderPage({
      title: `关于 ${contact.name}｜墨尔本电脑租赁与本地支持`,
      description: `${contact.name} 为墨尔本学习、工作和创作项目提供透明、灵活的电脑租赁与本地支持，可在线咨询设备配置与档期。`,
      body: renderAbout(contact, config, appUrl(c.env), c.req.query('subject') || ''),
      contact,
      appUrl: appUrl(c.env),
      path: '/about',
      siteUrl: siteUrl(c.req.url),
      structuredData: {
        '@type': 'AboutPage',
        '@id': `${siteUrl(c.req.url)}/about#webpage`,
        url: `${siteUrl(c.req.url)}/about`,
        name: `关于 ${contact.name}`,
        isPartOf: { '@id': `${siteUrl(c.req.url)}/#website` },
        about: { '@id': `${siteUrl(c.req.url)}/#organization` },
      },
      user,
    })
  }),
)

app.get('/contact', (c) => {
  const search = new URL(c.req.url).search
  return c.redirect(`/about${search}#contact`, 301)
})

app.get('/order-lookup', (c) =>
  cachedHtml(c, HTML_TTL, async (user) => {
    const contact = await getSiteContact(c.env)
    const orders = user ? await listOrdersForUser(c.env, user.id, appUrl(c.env)) : []
    return renderPage({ title: `订单查询 — ${contact.name}`, description: '查看电脑租赁订单当前状态、合同、密码和取还详情。', body: renderOrderLookup(appUrl(c.env), orders, c.env.TURNSTILE_SITE_KEY || ''), contact, appUrl: appUrl(c.env), path: '/order-lookup', siteUrl: siteUrl(c.req.url), robots: 'noindex, nofollow', user })
  }),
)

app.post('/api/order-lookup', async (c) => {
  const origin = c.req.header('Origin')
  if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ ok: false, message: '请求来源无效。' }, 403)
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim()
  if (!(await enforceRateLimit(c.env, 'web-order-lookup', ip, 6, 900))) return c.json({ ok: false, message: '查询请求过于频繁，请 15 分钟后再试。' }, 429)
  let body: Record<string, unknown> = {}
  try { body = (await c.req.json()) as Record<string, unknown> } catch { return c.json({ ok: false, message: '请求格式无效。' }, 400) }
  const orderNo = String(body.orderNo || '').trim()
  const email = String(body.email || '').trim()
  if (!orderNo || !email) return c.json({ ok: false, message: '请输入订单编号和申请邮箱。' }, 400)
  if (!(await verifyTurnstile(c.env, String(body.turnstileToken || body['cf-turnstile-response'] || ''), ip))) return c.json({ ok: false, message: '人机验证未通过，请重试。' }, 400)
  try {
    const result = await lookupOrderByCredentials(c.env, orderNo, email, appUrl(c.env))
    if (!result) return c.json({ ok: false, message: '没有找到匹配的订单，请检查订单编号和邮箱。' }, 404)
    return c.json({ ok: true, ...result }, 200, { 'Cache-Control': 'no-store' })
  } catch (error) {
    console.error('web public order lookup failed:', error instanceof Error ? error.message : String(error))
    return c.json({ ok: false, message: '订单查询暂不可用，请稍后重试。' }, 503)
  }
})

// ---------- 账户 / 单点登录（官网登录后，rent 同步为已登录） ----------

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
    return renderLoginPage(c, { error: '请求来源无效，请重试。', status: 403, tab: 'login' })
  }
  if (!account || !password) return renderLoginPage(c, { error: '请输入账号和密码。', account, status: 400, tab: 'login' })
  if (!(await enforceRateLimit(c.env, 'web-login', ip, 10, 600))) {
    return renderLoginPage(c, { error: '尝试次数过多，请 10 分钟后再试。', account, status: 429, tab: 'login' })
  }

  const user = await verifyCredentials(c.env, account, password)
  if (!user) return renderLoginPage(c, { error: '账号或密码错误。', account, status: 401, tab: 'login' })

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
      siteUrl: siteUrl(c.req.url),
      robots: 'noindex, nofollow',
      user: null,
    }),
    404,
  )
})

export default app
