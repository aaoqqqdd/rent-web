/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// Shared JSON contract: keep this module identical in rent and rent-web.
export const CLIENT_ACCESS_KEY = 'clientAccess'
export const DEFAULT_MAINTENANCE_MESSAGE = '网站维护中，请稍后再试。'
export const CLIENT_FEATURES = [
  ['newRentals', '浏览设备与新租赁'],
  ['rentalProgram', '设备出租计划'],
  ['referralProgram', '推荐计划'],
  ['walletTopUp', '钱包充值'],
  ['giftCards', '礼品卡服务'],
  ['feedback', '客户反馈'],
  ['publicNotices', '官网通告'],
  ['marketingSubscription', '营销邮件订阅'],
  ['registration', '新用户注册'],
] as const
export type ClientFeature = typeof CLIENT_FEATURES[number][0]
export type ClientAccess = {
  console: { enabled: boolean; message: string }
  web: { enabled: boolean; message: string }
  features: Record<ClientFeature, boolean>
}
export function normalizeClientAccess(value: unknown): ClientAccess {
  const input = value && typeof value === 'object' ? value as Record<string, any> : {}
  const surface = (key: 'console' | 'web') => ({
    enabled: input[key]?.enabled !== false,
    message: typeof input[key]?.message === 'string' ? input[key].message.trim().slice(0, 500) : '',
  })
  return { console: surface('console'), web: surface('web'), features: Object.fromEntries(CLIENT_FEATURES.map(([key]) => [key, input.features?.[key] !== false])) as ClientAccess['features'] }
}
export async function readClientAccess(db: { prepare(sql: string): { bind(...values: any[]): { first(): Promise<any> } } }): Promise<ClientAccess> {
  // Read on every request, before HTML caches. An OFF switch must not wait for a TTL.
  const row = await db.prepare('SELECT value FROM systemSettings WHERE key = ? AND deleted_at IS NULL').bind(CLIENT_ACCESS_KEY).first()
  if (!row) return normalizeClientAccess(null)
  return normalizeClientAccess(JSON.parse(String(row.value)))
}
export function clientFeatureForPath(path: string, surface: 'console' | 'web'): ClientFeature | null {
  if (/^\/register(?:\/|$)/.test(path)) return 'registration'
  if (surface === 'console') {
    if (/^\/customer\/rental-program\/settlements(?:\/|$)/.test(path)) return null
    if (/^\/customer\/(?:rental-program|c2c)(?:\/|$)/.test(path)) return 'rentalProgram'
    if (/^\/customer\/referral(?:\/|$)/.test(path)) return 'referralProgram'
    if (/^\/customer\/(?:devices(?:\/|$)|rent\/)/.test(path) || /^\/(?:public\/rental-request|rental-links?\/|rent\/)/.test(path)) return 'newRentals'
    if (/^\/customer\/balance\/top-up(?:\/|$)/.test(path)) return 'walletTopUp'
    if (path === '/customer/profile/marketing-subscription') return 'marketingSubscription'
    if (/^\/feedback(?:\/|$)/.test(path)) return 'feedback'
  } else {
    if (/^\/(?:products|apply|checkout)(?:\/|$)/.test(path) || /^\/api\/(?:rental-request|rental-setup-intent|device-availability|rental-coupon-preview|delivery\/quote|address\/autocomplete)$/.test(path)) return 'newRentals'
    if (/^\/referral(?:\/|$)/.test(path)) return 'referralProgram'
    if (/^\/gift-cards(?:\/|$)/.test(path) || path === '/api/square-gift-card-preview') return 'giftCards'
    if (/^\/announcements(?:\/|$)/.test(path) || path === '/api/public-notices') return 'publicNotices'
  }
  return null
}
export function clientPathEnabled(policy: ClientAccess, href: string, surface: 'console' | 'web'): boolean {
  let path: string
  try { path = new URL(href, 'https://client.invalid').pathname } catch { return true }
  if (!policy[surface].enabled && !(surface === 'console' ? consoleEssentialPath(path) : webEssentialPath(path))) return false
  if (surface === 'web' && path === '/login' && new URL(href,'https://client.invalid').searchParams.get('tab') === 'register') return policy.features.registration
  const feature = clientFeatureForPath(path, surface)
  return !feature || policy.features[feature]
}
export function consoleEssentialPath(path: string): boolean {
  return /^\/(?:login|logout|forgot-password|reset-password|verify-email|sso|admin|webhooks)(?:\/|$)/.test(path)
    || /^\/customer\/(?:profile|security|orders|rentals|guest)(?:\/|$)/.test(path)
    || path === '/customer/balance'
    || /^\/customer\/rental-program\/settlements(?:\/|$)/.test(path)
    || /^\/(?:contract|contracts|orders|payment)(?:\/|$)/.test(path)
}
export function webEssentialPath(path: string): boolean {
  return /^\/(?:login|logout|sso)(?:\/|$)/.test(path) || path === '/api/session'
    // Operational endpoints keep their own authentication; never interrupt in-flight deliveries.
    || /^\/api\/delivery\/(?:bookings|webhooks\/zoom2u)$/.test(path)
}
export function clientMaintenanceHtml(message = '', featureClosed = false, surface: 'web' | 'console' = 'web'): string {
  const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
  const title = featureClosed ? '此功能暂未开放' : '网站维护中'
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{margin:0;background:#f5f7fa;color:#172438;font:16px/1.7 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{box-sizing:border-box;width:min(560px,calc(100% - 40px));padding:48px 36px;border:1px solid #e1e7ef;background:white;border-radius:24px}small{letter-spacing:.16em;color:#54708e}h1{font-size:32px;line-height:1.25}p{white-space:pre-wrap;overflow-wrap:anywhere;color:#536176}a{color:#244e82;display:inline-block;padding:12px 0;margin-right:24px}</style></head><body><main><small>GEEKSLOPE · SERVICE STATUS</small><h1>${title}</h1><p>${esc(message || (featureClosed ? '请稍后再来。' : DEFAULT_MAINTENANCE_MESSAGE))}</p>${surface === 'console' ? '<a href="/customer/orders">我的订单</a><a href="/customer/security">安全设置</a>' : ''}<a href="/login">登录</a></main><script>(function(){var lang='';try{lang=localStorage.getItem('rent-language')||localStorage.getItem('geekslope-language')||''}catch(e){}if(!lang)lang=navigator.language||'';if(!/^en/i.test(lang))return;document.documentElement.lang='en';document.title=${JSON.stringify(featureClosed ? 'Feature unavailable' : 'Under maintenance')};document.querySelector('h1').textContent=document.title;document.querySelector('a[href="/login"]').textContent='Sign in';var orders=document.querySelector('a[href="/customer/orders"]');if(orders)orders.textContent='My orders';var security=document.querySelector('a[href="/customer/security"]');if(security)security.textContent='Account security';${message ? '' : `document.querySelector('p').textContent=${JSON.stringify(featureClosed ? 'Please check back later.' : 'We are carrying out maintenance. Please try again later.')};`}})();</script></body></html>`
}
