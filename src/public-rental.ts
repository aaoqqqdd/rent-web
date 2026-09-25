import type { Context } from 'hono'
import { getRentalConfig } from './db'
import { combinePersonName, enforceRateLimit, ensurePersonNameColumns, generateTemporaryPassword, registerCustomer, sanitizePlainText } from './auth'
import { isMelbourneAddress } from './address'
import type { Env } from './index'
import { linkSquareGiftCardToCustomer } from './squareGiftCard'
import { markDeliveryQuoteUsed, validateDeliveryQuote } from './delivery'

type RentalContext = Context<{ Bindings: Env }>

const MAX_CART_ITEMS = 10
const AU_STATES = new Set(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COUPON_CODE_RE = /^[A-Z0-9_-]{1,40}$/
const LONG_TERM_RENTAL_DAYS = 30

interface RentalTerm {
  startDate: string
  endDate: string
  startPeriod: 'AM' | 'PM'
  endPeriod: 'AM' | 'PM'
}

function depositAuthorizationWindowDays(cardBrand: unknown): 7 | 30 {
  const brand = String(cardBrand || '').trim().toLowerCase()
  return brand === 'visa' || brand === 'mastercard' ? 30 : 7
}

function depositPaymentModeForRental(rentalPeriod: number, depositCardProvided: boolean, cardBrand: unknown): 'PAID' | 'PREAUTH' | 'SETUP_INTENT' {
  if (!depositCardProvided) return 'PAID'
  return rentalPeriod >= LONG_TERM_RENTAL_DAYS || rentalPeriod > depositAuthorizationWindowDays(cardBrand) ? 'SETUP_INTENT' : 'PREAUTH'
}

function cents(value: number): number {
  return Math.round(Number(value) * 100)
}

function json(c: RentalContext, status: number, payload: Record<string, unknown>): Response {
  return c.json(payload, status as never, { 'Cache-Control': 'no-store' })
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function normalizeCouponCode(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase()
  return COUPON_CODE_RE.test(normalized) ? normalized : ''
}

function parseDeviceIds(body: Record<string, unknown>): string[] {
  let values: unknown[] = []
  if (Array.isArray(body.deviceIds)) values = body.deviceIds
  else if (typeof body.deviceIds === 'string') {
    try {
      const parsed = JSON.parse(body.deviceIds)
      values = Array.isArray(parsed) ? parsed : body.deviceIds.split(',')
    } catch {
      values = body.deviceIds.split(',')
    }
  }
  if (!values.length && body.deviceId) values = [body.deviceId]
  return values.map((value) => String(value || '').trim()).filter((value, index, all) => value && all.indexOf(value) === index)
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function rentalDays(startDate: string, endDate: string, startPeriod: string, endPeriod: string): { halfDays: number; days: number } {
  const dateDays = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000)
  const halfDays = dateDays * 2 + (endPeriod === 'PM' ? 1 : 0) - (startPeriod === 'PM' ? 1 : 0)
  return { halfDays, days: Math.ceil(halfDays / 2) }
}

function parseDeviceTerms(body: Record<string, unknown>, deviceIds: string[]): Record<string, RentalTerm> {
  let raw: Record<string, unknown> = {}
  if (body.deviceTerms && typeof body.deviceTerms === 'object' && !Array.isArray(body.deviceTerms)) raw = body.deviceTerms as Record<string, unknown>
  if (typeof body.deviceTerms === 'string') {
    try {
      const parsed = JSON.parse(body.deviceTerms)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>
    } catch { /* fall back to the legacy shared term fields */ }
  }
  const fallback = {
    startDate: String(body.startDate || '').trim(),
    endDate: String(body.endDate || '').trim(),
    startPeriod: body.startPeriod === 'PM' ? 'PM' as const : 'AM' as const,
    endPeriod: body.endPeriod === 'PM' ? 'PM' as const : 'AM' as const,
  }
  return Object.fromEntries(deviceIds.map((deviceId) => {
    const value = raw[deviceId] && typeof raw[deviceId] === 'object' ? raw[deviceId] as Record<string, unknown> : {}
    return [deviceId, {
      startDate: String(value.startDate || fallback.startDate).trim(),
      endDate: String(value.endDate || fallback.endDate).trim(),
      startPeriod: value.startPeriod === 'PM' ? 'PM' : fallback.startPeriod,
      endPeriod: value.endPeriod === 'PM' ? 'PM' : fallback.endPeriod,
    } satisfies RentalTerm]
  }))
}

function calculateRentalFee(device: Record<string, unknown>, days: number): number {
  const daily = Math.max(0, numberValue(device.pricePerDay, device.price_per_day))
  const weeklyDiscount = Math.min(100, Math.max(0, numberValue(device.weeklyDiscountPercent, device.weekly_discount_percent)))
  const monthlyDiscount = Math.min(100, Math.max(0, numberValue(device.monthlyDiscountPercent, device.monthly_discount_percent)))
  const monthlyDays = Math.floor(days / 30) * 30
  const weeklyDays = Math.floor((days - monthlyDays) / 7) * 7
  const dailyDays = days - monthlyDays - weeklyDays
  return Number((monthlyDays * daily * (1 - monthlyDiscount / 100) + weeklyDays * daily * (1 - weeklyDiscount / 100) + dailyDays * daily).toFixed(2))
}

function couponMatchesDevice(coupon: Record<string, unknown>, device: Record<string, unknown>): boolean {
  const text = [device.name, device.brand, device.model, device.cpu, device.ram, device.storage, device.gpu, device.os, device.description]
    .filter(Boolean).join(' ').toLowerCase()
  return (!coupon.device_id || String(coupon.device_id) === String(device.id))
    && (!coupon.brand || String(device.brand || '').trim().toLowerCase() === String(coupon.brand).trim().toLowerCase())
    && (!coupon.config_keyword || text.includes(String(coupon.config_keyword).trim().toLowerCase()))
}

function couponDiscount(coupon: Record<string, unknown>, base: number): number {
  const raw = String(coupon.discount_type || '') === 'percent'
    ? base * numberValue(coupon.discount_value) / 100
    : numberValue(coupon.discount_value)
  const capped = coupon.max_discount_amount ? Math.min(raw, numberValue(coupon.max_discount_amount)) : raw
  return Number(Math.min(base, Math.max(0, capped)).toFixed(2))
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function halfDayIndex(date: string, period: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000) * 2 + (period === 'PM' ? 1 : 0)
}

function melbourneMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  return (hour === 24 ? 0 : hour) * 60 + minute
}

function rentalPeriodPassed(date: string, period: 'AM' | 'PM', today: string): boolean {
  return date === today && melbourneMinutesNow() >= (period === 'AM' ? 12 * 60 : 23 * 60)
}

function periodsOverlap(startDate: string, startPeriod: string, endDate: string, endPeriod: string, otherStartDate: string, otherStartPeriod: string, otherEndDate: string, otherEndPeriod: string): boolean {
  const start = halfDayIndex(startDate, startPeriod)
  const end = halfDayIndex(endDate, endPeriod)
  const otherStart = halfDayIndex(otherStartDate, otherStartPeriod)
  const otherEnd = halfDayIndex(otherEndDate, otherEndPeriod)
  return start < otherEnd && otherStart < end
}

function termUsesPeriod(term: RentalTerm, date: string, period: 'AM' | 'PM'): boolean {
  const start = halfDayIndex(term.startDate, term.startPeriod)
  const end = halfDayIndex(term.endDate, term.endPeriod)
  const current = halfDayIndex(date, period)
  return start <= current && current < end
}

async function checkCouponCustomerEligibility(c: RentalContext, coupon: Record<string, unknown>, customerId: string): Promise<string | null> {
  try {
    const recipients = await c.env.RENT.prepare(
      'SELECT customer_id FROM marketing_campaign_recipients WHERE upper(coupon_code) = upper(?) LIMIT 2',
    ).bind(String(coupon.code || '')).all<{ customer_id?: unknown }>()
    const targetedCustomers = recipients.results || []
    if (targetedCustomers.length && !targetedCustomers.some((recipient) => String(recipient.customer_id || '') === customerId)) return '该优惠码仅限指定客户使用。'
    if (Number(coupon.new_customer_only)) {
      const paid = await c.env.RENT.prepare("SELECT id FROM orders WHERE userId = ? AND payment_status = 'PAID' LIMIT 1").bind(customerId).first()
      if (paid) return '该优惠码仅限新客户使用。'
    }
    if (Number(coupon.max_uses_per_customer) > 0) {
      const used = await c.env.RENT.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND customer_id = ? AND status IN ('RESERVED', 'REDEEMED')").bind(coupon.id, customerId).first<{ count: number }>()
      if (Number(used?.count || 0) >= Number(coupon.max_uses_per_customer)) return '您已达到该优惠码的最多使用次数。'
    }
  } catch {
    // 兼容尚未部署优惠码扩展表的旧数据库。
  }
  return null
}

/** 官网申请提交时立即为押金做预授权（PREAUTH 模式），审核通过后只扣租金，不再动押金。
 * 与主站 src/actions/stripePayments.ts 的 createDepositAuthorization 保持一致的窗口 / 降级规则。 */
async function authorizeDepositForOrder(c: RentalContext, orderId: string, userId: string, depositAmount: number, paymentMethodId: string, cardBrand: string, rentalPeriodDays: number, customerId: string): Promise<void> {
  const authorizationWindowDays = depositAuthorizationWindowDays(cardBrand)
  const requiresExtendedWindow = authorizationWindowDays === 30 && rentalPeriodDays > 7
  const createParams = new URLSearchParams({
    amount: String(cents(depositAmount)),
    currency: 'aud',
    customer: customerId,
    payment_method: paymentMethodId,
    // 手动扣款（预授权）不是所有账户默认启用的自动支付方式（Klarna / Afterpay / Link 等）都支持，
    // 不显式限定为 card 会导致 Stripe 报 "not eligible for the requested card features"。
    'payment_method_types[0]': 'card',
    capture_method: 'manual',
    description: `订单 ${orderId} 押金预授权`,
    'metadata[order_id]': orderId,
    'metadata[type]': 'deposit_authorization',
    'metadata[deposit_amount]': String(cents(depositAmount)),
    'metadata[card_brand]': cardBrand || 'unknown',
    'metadata[authorization_window_days]': String(authorizationWindowDays),
  })
  // 先创建（不 confirm），再单独 confirm——这样"先尝试延长授权、失败后退回标准授权"这两次
  // 尝试落在同一个 PaymentIntent 上，不会在 Stripe 后台留下一个作废的重复对象。
  const created = await stripeRequest(c, 'payment_intents', createParams, `web-deposit-auth-${orderId}`)
  const confirmParams = () => new URLSearchParams({ off_session: 'true', 'expand[]': 'latest_charge' })
  let intent: Record<string, any>
  try {
    const params = confirmParams()
    if (requiresExtendedWindow) params.set('payment_method_options[card][request_extended_authorization]', 'if_available')
    intent = await stripeRequest(c, `payment_intents/${created.id}/confirm`, params, `web-deposit-auth-confirm-${orderId}`)
  } catch (error) {
    if (!requiresExtendedWindow) {
      await stripeRequest(c, `payment_intents/${created.id}/cancel`, new URLSearchParams()).catch(() => { })
      throw new Error(error instanceof Error ? error.message : '押金预授权失败，请更换信用卡后重试。')
    }
    try {
      intent = await stripeRequest(c, `payment_intents/${created.id}/confirm`, confirmParams(), `web-deposit-auth-confirm-standard-${orderId}`)
    } catch (retryError) {
      await stripeRequest(c, `payment_intents/${created.id}/cancel`, new URLSearchParams()).catch(() => { })
      throw new Error(retryError instanceof Error ? retryError.message : '押金预授权失败，请更换信用卡后重试。')
    }
  }
  if (!['requires_capture', 'succeeded'].includes(String(intent.status))) throw new Error('押金预授权未完成，请更换信用卡后重试。')

  if (requiresExtendedWindow) {
    const cardDetails = intent.latest_charge?.payment_method_details?.card
    const captureBefore = Number(cardDetails?.capture_before || 0)
    const extendedEnabled = String(cardDetails?.extended_authorization?.status || '').toLowerCase() === 'enabled'
    const requiredCaptureBefore = Math.floor(Date.now() / 1000) + rentalPeriodDays * 86400
    if (!extendedEnabled || captureBefore < requiredCaptureBefore) {
      if (intent.status === 'requires_capture') await stripeRequest(c, `payment_intents/${intent.id}/cancel`, new URLSearchParams())
      await c.env.RENT.prepare("UPDATE orders SET deposit_payment_mode = 'SETUP_INTENT', stripe_deposit_payment_intent_id = NULL, deposit_status = 'NOT_REQUIRED', deposit_held_amount = 0 WHERE id = ?").bind(orderId).run()
      return
    }
  }

  await c.env.RENT.batch([
    c.env.RENT.prepare(`INSERT OR IGNORE INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, stripe_payment_intent_id)
      VALUES (?, ?, ?, 'card', ?, ?, 0, 'AUD', 'pending', ?)`)
      .bind(id('p'), orderId, userId, depositAmount, depositAmount, intent.id),
    c.env.RENT.prepare("UPDATE orders SET deposit_payment_mode = 'PREAUTH', stripe_deposit_payment_intent_id = ?, deposit_status = 'HELD', deposit_paid_at = COALESCE(deposit_paid_at, CURRENT_TIMESTAMP), deposit_held_amount = ? WHERE id = ?")
      .bind(intent.id, depositAmount, orderId),
  ])
}

async function verifyTurnstile(c: RentalContext, token: string): Promise<boolean> {
  const secret = String(c.env.TURNSTILE_SECRET_KEY || '')
  if (!secret) return true
  if (!token) return false
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: c.req.header('CF-Connecting-IP') }),
    })
    return Boolean((await response.json() as { success?: boolean }).success)
  } catch {
    return false
  }
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Array.from(atob(value), (character) => character.charCodeAt(0)))
}

async function stripeConfig(c: RentalContext): Promise<{ publishableKey: string; secretKey: string }> {
  if (c.env.STRIPE_SECRET_KEY && c.env.STRIPE_PUBLISHABLE_KEY) {
    return { publishableKey: c.env.STRIPE_PUBLISHABLE_KEY, secretKey: c.env.STRIPE_SECRET_KEY }
  }
  const encryptionKey = String(c.env.SETTINGS_ENCRYPTION_KEY || '')
  if (!encryptionKey) throw new Error('Stripe 尚未配置，请联系客服。')
  const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'stripeConfig'").first<{ value: string }>()
  if (!row?.value) throw new Error('Stripe 尚未配置，请联系客服。')
  const stored = JSON.parse(row.value) as { publishableKey?: string; secretKey?: string }
  if (!stored.publishableKey || !stored.secretKey) throw new Error('Stripe 配置不完整，请联系客服。')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encryptionKey))
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
  const [ivText, cipherText] = stored.secretKey.split('.')
  if (!ivText || !cipherText) throw new Error('Stripe 配置无效，请联系客服。')
  const secretKey = new TextDecoder().decode(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivText) }, key, base64ToBytes(cipherText),
  ))
  return { publishableKey: stored.publishableKey, secretKey }
}

async function paymentSettings(c: RentalContext): Promise<{ stripe: boolean; square: boolean; balancePayment: boolean; processingFeeRate: number }> {
  const fallback = { stripe: true, square: false, balancePayment: true, processingFeeRate: 0.025 }
  try {
    const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'paymentMethods'").first<{ value: string }>()
    if (!row?.value) return fallback
    const value = JSON.parse(row.value) as Record<string, unknown>
    return {
      stripe: value.stripe !== false,
      square: value.square === true,
      balancePayment: value.balancePayment !== false,
      processingFeeRate: Number.isFinite(Number(value.processingFeeRate))
        ? Math.min(1, Math.max(0, Number(value.processingFeeRate)))
        : fallback.processingFeeRate,
    }
  } catch {
    return fallback
  }
}

async function stripeRequest(c: RentalContext, path: string, params?: URLSearchParams, idempotencyKey?: string): Promise<Record<string, any>> {
  const config = await stripeConfig(c)
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${config.secretKey}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: params?.toString(),
  })
  const result = await response.json() as Record<string, any>
  if (!response.ok) throw new Error(result.error?.message || 'Stripe 请求失败')
  return result
}

async function verifySetupIntent(c: RentalContext, setupIntentId: string): Promise<{ paymentMethodId: string; cardBrand: string; customerId: string }> {
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) throw new Error('信用卡验证信息无效，请重新验证。')
  const intent = await stripeRequest(c, `setup_intents/${setupIntentId}`)
  const paymentMethodId = typeof intent.payment_method === 'string' ? intent.payment_method : String(intent.payment_method?.id || '')
  if (intent.status !== 'succeeded' || !/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) throw new Error('请先完成信用卡验证。')
  const paymentMethod = await stripeRequest(c, `payment_methods/${paymentMethodId}`)
  const customerId = typeof paymentMethod.customer === 'string' ? paymentMethod.customer : String(paymentMethod.customer?.id || '')
  return { paymentMethodId, cardBrand: String(paymentMethod.card?.brand || ''), customerId }
}

/** SetupIntent 创建时没有关联 Customer，off_session 复用前必须先把 PaymentMethod 附加到一个 Customer 上，
 * 否则 Stripe 会拒绝："The provided PaymentMethod cannot be attached. To reuse a PaymentMethod, you must
 * attach it to a Customer first." */
async function ensureStripeCustomer(c: RentalContext, existingCustomerId: string, paymentMethodId: string, name: string, email: string): Promise<string> {
  if (existingCustomerId) return existingCustomerId
  const customer = await stripeRequest(c, 'customers', new URLSearchParams({ name, email, 'metadata[source]': 'geekslope-web-rental-application' }), `rental-customer-${paymentMethodId}`)
  const customerId = String(customer.id)
  await stripeRequest(c, `payment_methods/${paymentMethodId}/attach`, new URLSearchParams({ customer: customerId }))
  return customerId
}

/** SetupIntent 在申请页创建时还不知道申请人资料，因此先不绑定 Customer。
 * 提交申请前再绑定，确保后续 off_session 的租金 / 押金支付可以复用该卡。 */
async function ensurePaymentMethodCustomer(c: RentalContext, paymentMethodId: string, user: Record<string, unknown>): Promise<string> {
  const paymentMethod = await stripeRequest(c, `payment_methods/${paymentMethodId}`)
  const existingCustomer = typeof paymentMethod.customer === 'string' ? paymentMethod.customer : String(paymentMethod.customer?.id || '')
  if (existingCustomer) return existingCustomer

  const customerParams = new URLSearchParams({
    email: String(user.email || ''),
    name: String(user.name || ''),
    phone: String(user.phone || ''),
    'metadata[source]': 'geekslope-web-rental-application',
    'metadata[user_id]': String(user.id || ''),
  })
  const customer = await stripeRequest(c, 'customers', customerParams, `web-rental-customer-${String(user.id || crypto.randomUUID())}`)
  const customerId = String(customer.id || '')
  if (!/^cus_[A-Za-z0-9_]+$/.test(customerId)) throw new Error('Stripe 客户资料创建失败，请重试。')
  await stripeRequest(c, `payment_methods/${paymentMethodId}/attach`, new URLSearchParams({ customer: customerId }), `web-rental-payment-method-attach-${paymentMethodId}`)
  return customerId
}

export async function createRentalSetupIntent(c: RentalContext): Promise<Record<string, unknown>> {
  const settings = await paymentSettings(c)
  if (!settings.stripe) throw new Error('信用卡支付当前未启用。')
  const params = new URLSearchParams({ usage: 'off_session', 'automatic_payment_methods[enabled]': 'true', 'metadata[source]': 'geekslope-web-rental-application' })
  const intent = await stripeRequest(c, 'setup_intents', params, `rental-setup-${crypto.randomUUID()}`)
  const config = await stripeConfig(c)
  return { clientSecret: intent.client_secret, publishableKey: config.publishableKey, feeRate: settings.processingFeeRate }
}

export async function lookupAccountBalance(c: RentalContext, email: string): Promise<Record<string, unknown>> {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) return { ok: true, available: false, accountEligible: false, balance: 0 }
  try {
    const user = await c.env.RENT.prepare('SELECT role, status, account_type, balance FROM users WHERE lower(email) = lower(?) LIMIT 1').bind(normalized).first<Record<string, unknown>>()
    const settings = await paymentSettings(c)
    const eligible = Boolean(user) && settings.balancePayment && String(user?.role || 'CUSTOMER') === 'CUSTOMER' && String(user?.status || 'active') === 'active' && String(user?.account_type || 'formal') === 'formal'
    const balance = eligible ? numberValue(user?.balance) : 0
    return { ok: true, available: eligible && balance > 0, accountEligible: eligible, balance }
  } catch {
    return { ok: true, available: false, accountEligible: false, balance: 0 }
  }
}

async function createAdminNotifications(c: RentalContext, orderId: string, message: string): Promise<void> {
  try {
    const admins = await c.env.RENT.prepare("SELECT id FROM users WHERE role = 'ADMIN' AND status != 'inactive'").all<{ id: string }>()
    await c.env.RENT.batch((admins.results || []).map((admin) => c.env.RENT.prepare(
      `INSERT INTO notifications (id, recipient_id, type, title, message, order_id) VALUES (?, ?, 'rental_application', ?, ?, ?)`,
    ).bind(id('notice'), admin.id, '官网新租赁申请待确认', message, orderId)))
  } catch { /* notifications must not undo a successfully created order */ }
}

export async function previewRentalCoupon(c: RentalContext, deviceIds: string[], days: number, code: string, terms?: unknown, customerEmail = ''): Promise<Record<string, unknown>> {
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim()
  if (!(await enforceRateLimit(c.env, 'web-coupon-preview', ip, 20, 60))) return { ok: false, message: '优惠码校验请求过于频繁，请稍后重试。' }
  const couponCode = normalizeCouponCode(code)
  if (!deviceIds.length || !couponCode) return { ok: false, message: '请先选择设备、有效租期并输入优惠码。' }
  const devices: Record<string, unknown>[] = []
  for (const deviceId of deviceIds.slice(0, MAX_CART_ITEMS)) {
    const device = await c.env.RENT.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first<Record<string, unknown>>()
    if (!device) return { ok: false, message: '购物车中有设备不存在或已下架。' }
    devices.push(device)
  }
  const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(couponCode).first<Record<string, unknown>>()
  if (!coupon) return { ok: false, message: '优惠码无效、已过期或已达到使用次数上限。' }
  try {
    const recipients = await c.env.RENT.prepare(
      'SELECT email FROM marketing_campaign_recipients WHERE upper(coupon_code) = upper(?) LIMIT 2',
    ).bind(couponCode).all<{ email?: unknown }>()
    const targetedCustomers = recipients.results || []
    const normalizedEmail = String(customerEmail || '').trim().toLowerCase()
    if (targetedCustomers.length && (!EMAIL_RE.test(normalizedEmail) || !targetedCustomers.some((recipient) => String(recipient.email || '').trim().toLowerCase() === normalizedEmail))) {
      return { ok: false, message: '该优惠码仅限指定客户使用，请填写收件邮箱后重试。' }
    }
  } catch {
    // Older deployments may not have the marketing recipient table yet.
  }
  const hasPerDeviceTerms = terms !== undefined && terms !== null && terms !== ''
  const termMap = hasPerDeviceTerms ? parseDeviceTerms({ deviceTerms: terms }, deviceIds) : {}
  const fees = devices.map((device, index) => {
    if (!hasPerDeviceTerms) return calculateRentalFee(device, days)
    const term = termMap[deviceIds[index]]
    const period = validDate(term.startDate) && validDate(term.endDate) ? rentalDays(term.startDate, term.endDate, term.startPeriod, term.endPeriod) : { days: 0 }
    return calculateRentalFee(device, period.days)
  })
  if (hasPerDeviceTerms && fees.some((_, index) => {
    const term = termMap[deviceIds[index]]
    const period = validDate(term.startDate) && validDate(term.endDate) ? rentalDays(term.startDate, term.endDate, term.startPeriod, term.endPeriod) : { days: 0 }
    return period.days < 1 || period.days > 365
  })) return { ok: false, message: '请为每台设备选择有效租期。' }
  if (!hasPerDeviceTerms && (days < 1 || days > 365)) return { ok: false, message: '请选择有效租期。' }
  const eligible = devices.map((device, index) => couponMatchesDevice(coupon, device) ? index : -1).filter((index) => index >= 0)
  if (!eligible.length) return { ok: false, message: '该优惠码不适用于购物车中的设备。' }
  const base = eligible.reduce((sum, index) => sum + fees[index], 0)
  if (coupon.minimum_order_amount && base < numberValue(coupon.minimum_order_amount)) return { ok: false, message: `订单金额未达到该优惠码要求的最低消费 AUD$${numberValue(coupon.minimum_order_amount).toFixed(2)}。` }
  const discount = couponDiscount(coupon, base)
  const rent = fees.reduce((sum, fee) => sum + fee, 0)
  const deposit = devices.reduce((sum, device) => sum + numberValue(device.depositAmount, device.deposit_amount), 0)
  return { ok: true, rent: Number(rent.toFixed(2)), discount, deposit: Number(deposit.toFixed(2)), total: Number((rent + deposit - discount).toFixed(2)), message: `已优惠 AUD$${discount.toFixed(2)}` }
}

export async function handleRentalRequest(c: RentalContext, body: Record<string, unknown>): Promise<Response> {
  const ip = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || 'unknown').trim()
  if (!(await enforceRateLimit(c.env, 'web-rental-request', ip, 10, 600))) return json(c, 429, { ok: false, message: '提交请求过于频繁，请稍后重试。' })
  if (!(await verifyTurnstile(c, String(body['cf-turnstile-response'] || '')))) return json(c, 400, { ok: false, message: '人机验证失败，请重试。' })

  const deviceIds = parseDeviceIds(body)
  if (!deviceIds.length) return json(c, 400, { ok: false, message: '购物车中没有可提交的设备。' })
  if (deviceIds.length > MAX_CART_ITEMS) return json(c, 400, { ok: false, message: `单次最多提交 ${MAX_CART_ITEMS} 台设备。` })
  const deviceTerms = parseDeviceTerms(body, deviceIds)
  const deliveryMethod = body.deliveryMethod === 'Delivery' ? 'Delivery' : 'Pickup'
  const deliveryQuoteId = String(body.deliveryQuoteId || '').trim()
  const firstName = sanitizePlainText(body.firstName, 100)
  const lastName = sanitizePlainText(body.lastName, 100)
  const contactName = combinePersonName(firstName, lastName)
  const contactEmail = String(body.contactEmail || '').trim().toLowerCase().slice(0, 200)
  const contactPhone = String(body.contactPhone || '').trim().slice(0, 40)
  const rawCouponCode = String(body.couponCode || '').trim()
  const couponCode = normalizeCouponCode(rawCouponCode)
  const requestedPaymentMethod = String(body.paymentMethod || '').trim()
  const paymentMethod = requestedPaymentMethod === 'balance' ? 'balance' : 'card'
  const paymentProvider = requestedPaymentMethod === 'square' ? 'square' : paymentMethod === 'card' ? 'stripe' : 'internal'
  const refundMethod = 'original'
  const agreed = ['1', 'on', 'true', 'yes'].includes(String(body.agree || '').toLowerCase())
  if (rawCouponCode && !couponCode) return json(c, 400, { ok: false, message: '优惠码格式无效。' })
  if (!EMAIL_RE.test(contactEmail)) return json(c, 400, { ok: false, message: '邮箱格式不正确。' })
  if (!firstName || !lastName || !contactPhone) return json(c, 400, { ok: false, message: '请填写名、姓和联系电话。' })
  if (!agreed) return json(c, 400, { ok: false, message: '请先阅读并同意服务条款与隐私政策。' })
  let stripePaymentMethodId = ''
  let stripeCardBrand = ''
  const setupIntentId = String(body.stripeSetupIntentId || '').trim()
  const depositCardPayment = paymentProvider === 'stripe' || paymentProvider === 'square'
  if (depositCardPayment) {
    if (!setupIntentId) return json(c, 400, { ok: false, message: '请先填写并验证信用卡信息。' })
    try {
      const verified = await verifySetupIntent(c, setupIntentId)
      stripePaymentMethodId = verified.paymentMethodId
      stripeCardBrand = verified.cardBrand
    } catch (error) {
      return json(c, 400, { ok: false, message: error instanceof Error ? error.message : '信用卡验证失败，请重试。' })
    }
  }

  const config = await getRentalConfig(c.env)
  const settings = await paymentSettings(c)
  if (paymentProvider === 'square' && !settings.square) return json(c, 400, { ok: false, message: '礼品卡支付当前未启用。' })
  if (paymentMethod === 'balance' && !settings.balancePayment) return json(c, 400, { ok: false, message: '账户余额支付当前未启用。' })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const unavailableDates = new Set(config.unavailableDates)

  let location = ''
  if (deliveryMethod === 'Pickup') {
    location = String(body.pickupLocation || '').trim() || config.pickupLocations[0] || '墨尔本 CBD 门店（下单后客服确认具体地址）'
    if (config.pickupLocations.length && !config.pickupLocations.includes(location)) return json(c, 400, { ok: false, message: '请选择有效的自取地点。' })
  } else {
    const street = String(body.deliveryStreet || '').trim().slice(0, 160)
    const suburb = String(body.deliverySuburb || '').trim().slice(0, 80)
    const state = String(body.deliveryState || '').trim().toUpperCase()
    const postcode = String(body.deliveryPostcode || '').trim()
    if (!street || !suburb || !AU_STATES.has(state) || !/^\d{4}$/.test(postcode)) return json(c, 400, { ok: false, message: '请填写完整有效的澳洲送货地址。' })
    if (!isMelbourneAddress(suburb, state, `${street}, ${suburb} ${state} ${postcode}`, config.deliveryAreas)) return json(c, 400, { ok: false, message: '送货地址仅限墨尔本及当前配置的服务区域，其他城市或郊区请选到店自取。' })
    location = `${street}, ${suburb} ${state} ${postcode}, Australia`
  }

  const devices: Record<string, unknown>[] = []
  const rentalPlans = new Map<string, { term: RentalTerm; period: { halfDays: number; days: number } }>()
  for (const deviceId of deviceIds) {
    const term = deviceTerms[deviceId]
    if (!term || !validDate(term.startDate) || !validDate(term.endDate)) return json(c, 400, { ok: false, message: '请为每台设备填写有效的取货和归还日期。' })
    const period = rentalDays(term.startDate, term.endDate, term.startPeriod, term.endPeriod)
    if (term.startDate < today || term.endDate < today || period.halfDays <= 0) return json(c, 400, { ok: false, message: '请选择有效的未来租期，归还时间必须晚于取货时间。' })
    if (rentalPeriodPassed(term.startDate, term.startPeriod, today) || rentalPeriodPassed(term.endDate, term.endPeriod, today)) {
      return json(c, 400, { ok: false, message: '所选取货或归还时段已截止（上午 12:00、下午 23:00），请改选下一可用时段。' })
    }
    if (period.days < config.minimumRentalDays) return json(c, 400, { ok: false, message: `每台设备的最短租赁时间为 ${config.minimumRentalDays} 天。` })
    const device = await c.env.RENT.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first<Record<string, unknown>>()
    const lifecycle = String(device?.lifecycle_status || device?.lifecycleStatus || '').toUpperCase()
    const available = device && (String(device.status || '').toLowerCase() === 'available' || lifecycle === 'READY' || lifecycle === 'RESERVED')
    if (!available) return json(c, 409, { ok: false, message: `${String(device?.name || '该设备')} 当前仅可预约/需询价，暂不支持在线提交，请移除后联系设备顾问。` })
    const deviceUnavailableDates = new Set<string>()
    const deviceUnavailableSlots = new Set<string>()
    try {
      const unavailable = await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ?').bind(deviceId).all<{ unavailable_date?: unknown }>()
      for (const row of unavailable.results || []) deviceUnavailableDates.add(String(row.unavailable_date || ''))
      const slots = await c.env.RENT.prepare('SELECT unavailable_date, time_slot FROM device_unavailable_time_slots WHERE device_id = ?').bind(deviceId).all<{ unavailable_date?: unknown; time_slot?: unknown }>()
      for (const row of slots.results || []) deviceUnavailableSlots.add(`${String(row.unavailable_date || '').slice(0, 10)}:${String(row.time_slot || '')}`)
    } catch {
      // 兼容尚未部署设备级不可用规则表的旧数据库。
    }
    let blockedDate = ''
    for (let day = Date.parse(`${term.startDate}T00:00:00Z`); day <= Date.parse(`${term.endDate}T00:00:00Z`); day += 86400000) {
      const date = new Date(day).toISOString().slice(0, 10)
      if (unavailableDates.has(date) || deviceUnavailableDates.has(date)) { blockedDate = date; break }
    }
    const blockedPeriod = (date: string, period: 'AM' | 'PM') => {
      const globalSlots = config.unavailableTimeSlots[date] || []
      const group = period === 'AM' ? ['morning_service', 'morning'] : ['afternoon', 'evening_service']
      return group.every((slot) => globalSlots.includes(slot) || deviceUnavailableSlots.has(`${date}:${slot}`))
    }
    for (let day = Date.parse(`${term.startDate}T00:00:00Z`); day <= Date.parse(`${term.endDate}T00:00:00Z`); day += 86400000) {
      const date = new Date(day).toISOString().slice(0, 10)
      for (const period of ['AM', 'PM'] as const) {
        if (!termUsesPeriod(term, date, period)) continue
        if (blockedPeriod(date, period)) return json(c, 409, { ok: false, message: `${String(device.name || '设备')} 在所选上午/下午时段不可用。` })
      }
    }
    if (blockedDate) return json(c, 409, { ok: false, message: `${String(device.name || '设备')} 在所选日期不可用。` })
    try {
      const conflicts = await c.env.RENT.prepare("SELECT startDate, endDate, startPeriod, endPeriod FROM orders WHERE deviceId = ? AND status NOT IN ('completed', 'cancelled') AND startDate IS NOT NULL AND endDate IS NOT NULL").bind(deviceId).all<{ startDate?: unknown; endDate?: unknown; startPeriod?: unknown; endPeriod?: unknown }>()
      const conflictStart = shiftDate(term.startDate, -config.bufferDays)
      const conflictEnd = shiftDate(term.endDate, config.bufferDays)
      const conflictRows = conflicts.results || []
      const conflict = conflictRows.some((row) => periodsOverlap(
        conflictStart, config.bufferDays ? 'AM' : term.startPeriod, conflictEnd, config.bufferDays ? 'PM' : term.endPeriod,
        String(row.startDate || '').slice(0, 10), String(row.startPeriod || 'AM'), String(row.endDate || '').slice(0, 10), String(row.endPeriod || 'AM'),
      ))
      if (conflict) return json(c, 409, { ok: false, message: `${String(device?.name || '设备')} 在所选日期或时段已有订单。` })
    } catch {
      // 提交时仍保留日期范围校验，兼容旧数据库的订单字段。
      const conflictStart = shiftDate(term.startDate, -config.bufferDays)
      const conflictEnd = shiftDate(term.endDate, config.bufferDays)
      const conflict = await c.env.RENT.prepare("SELECT id FROM orders WHERE deviceId = ? AND status NOT IN ('completed', 'cancelled') AND startDate < ? AND endDate > ? LIMIT 1").bind(deviceId, conflictEnd, conflictStart).first()
      if (conflict) return json(c, 409, { ok: false, message: `${String(device?.name || '设备')} 在所选日期已有订单。` })
    }
    devices.push(device as Record<string, unknown>)
    rentalPlans.set(deviceId, { term, period })
  }

  let deliveryFee = 0
  if (deliveryMethod === 'Delivery') {
    const quote = await validateDeliveryQuote(c, deliveryQuoteId, location, deviceIds.length)
    if (!quote.ok) return json(c, 400, { ok: false, message: quote.message })
    deliveryFee = quote.price
  }

  const fees = devices.map((device) => calculateRentalFee(device, rentalPlans.get(String(device.id))!.period.days))
  const discounts = devices.map(() => 0)
  let coupon: Record<string, unknown> | null = null
  if (couponCode) {
    coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(couponCode).first<Record<string, unknown>>()
    if (!coupon) return json(c, 400, { ok: false, message: '优惠码无效、已过期或已达到使用次数上限。' })
    const eligible = devices.map((device, index) => couponMatchesDevice(coupon!, device) ? index : -1).filter((index) => index >= 0)
    if (!eligible.length) return json(c, 400, { ok: false, message: '该优惠码不适用于购物车中的设备。' })
    const base = eligible.reduce((sum, index) => sum + fees[index], 0)
    if (coupon.minimum_order_amount && base < numberValue(coupon.minimum_order_amount)) return json(c, 400, { ok: false, message: `订单金额未达到该优惠码要求的最低消费 AUD$${numberValue(coupon.minimum_order_amount).toFixed(2)}。` })
    const totalDiscount = couponDiscount(coupon, base)
    let remaining = totalDiscount
    eligible.forEach((index, position) => {
      discounts[index] = position === eligible.length - 1 ? remaining : Number(Math.min(fees[index], totalDiscount * fees[index] / base).toFixed(2))
      remaining = Number((remaining - discounts[index]).toFixed(2))
    })
  }

  let user = await c.env.RENT.prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1').bind(contactEmail).first<Record<string, unknown>>()
  let accountCreated = false
  let temporaryPassword = ''
  if (user) {
    if (String(user.role || 'CUSTOMER') !== 'CUSTOMER' || String(user.status || 'active') !== 'active' || String(user.account_type || 'formal') !== 'formal') return json(c, 403, { ok: false, message: '该账号当前无法下单，请联系客服。' })
  } else {
    temporaryPassword = generateTemporaryPassword()
    const result = await registerCustomer(c.env, { name: contactName, firstName, lastName, email: contactEmail, phone: contactPhone, password: temporaryPassword, passwordConfirm: temporaryPassword, agree: '1', turnstileToken: body['cf-turnstile-response'] }, ip)
    if (!result.ok) return json(c, result.code === 'rate_limited' ? 429 : 400, { ok: false, message: result.message })
    user = await c.env.RENT.prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1').bind(contactEmail).first<Record<string, unknown>>()
    accountCreated = true
  }
  if (!user?.id) return json(c, 500, { ok: false, message: '账号创建失败，请稍后重试。' })
  const personNameColumns = await ensurePersonNameColumns(c.env)
  if (personNameColumns.firstName && personNameColumns.lastName) {
    await c.env.RENT.prepare('UPDATE users SET first_name = ?, last_name = ?, name = ? WHERE id = ?')
      .bind(firstName, lastName, contactName, user.id).run()
  }
  if (coupon) {
    const eligibilityError = await checkCouponCustomerEligibility(c, coupon, String(user.id))
    if (eligibilityError) return json(c, 400, { ok: false, message: eligibilityError })
  }
  const accountEligible = String(user.account_type || 'formal') === 'formal' && String(user.role || 'CUSTOMER') === 'CUSTOMER'
  const totalBeforePayment = fees.reduce((sum, fee, index) => sum + fee + numberValue(devices[index].depositAmount, devices[index].deposit_amount) - discounts[index], deliveryFee)
  if (paymentMethod === 'balance' && (!accountEligible || numberValue(user.balance) < totalBeforePayment)) return json(c, 400, { ok: false, message: '账户余额不足以支付这笔申请。' })
  let squareGiftCardId = ''
  if (paymentProvider === 'square') {
    const squareGiftCardNonce = String(body.squareGiftCardNonce || '').trim()
    if (!squareGiftCardNonce) return json(c, 400, { ok: false, message: '请填写礼品卡并完成安全验证。' })
    try {
      squareGiftCardId = await linkSquareGiftCardToCustomer(c, user, squareGiftCardNonce)
    } catch (error) {
      console.error('Website Square gift card link failed:', error instanceof Error ? error.message : error)
      return json(c, 400, { ok: false, message: '礼品卡验证或保存失败，请检查卡号后重试。' })
    }
  }
  let stripeCustomerId = ''
  if (depositCardPayment) {
    try {
      stripeCustomerId = await ensurePaymentMethodCustomer(c, stripePaymentMethodId, {
        id: user.id,
        email: contactEmail,
        name: contactName,
        phone: contactPhone,
      })
    } catch (error) {
      console.error('Website Stripe customer setup failed:', error)
      return json(c, 402, { ok: false, message: '信用卡无法用于押金预授权，请重新验证信用卡后重试。' })
    }
  }

  const batch = id('web')
  const orderIds: string[] = []
  const sharedDeliveryFee = devices.length ? Number((deliveryFee / devices.length).toFixed(2)) : 0
  let depositAuthError = ''
  try {
    for (let index = 0; index < devices.length; index += 1) {
      const device = devices[index]
      const rentalPlan = rentalPlans.get(String(device.id))!
      const orderId = id('o')
      const orderNo = `OD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
      const deposit = numberValue(device.depositAmount, device.deposit_amount)
      const orderDeliveryFee = index === devices.length - 1
        ? Number((deliveryFee - sharedDeliveryFee * Math.max(0, devices.length - 1)).toFixed(2))
        : sharedDeliveryFee
      const total = Number((fees[index] + deposit + orderDeliveryFee - discounts[index]).toFixed(2))
      const note = `【官网申请 ${batch}】联系人：${contactName} / 电话：${contactPhone} / ${deliveryMethod === 'Delivery' ? '送货至' : '自取点'}：${location}${body.rentalNote ? `\n客户备注：${String(body.rentalNote).trim().slice(0, 350)}` : ''}`.slice(0, 500)
      await c.env.RENT.prepare(
        `INSERT INTO orders (id, orderNo, userId, deviceId, startDate, endDate, startPeriod, endPeriod, rentalPeriod, status, paymentMethod, totalAmount, depositAmount, contractId, pickupTimeSlot, returnTimeSlot, pickupLocation, returnLocation, deliveryMethod, deliveryFee, rentalNote, coupon_code, discount_amount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, '', ?, ?, ?, '到店归还', ?, ?, ?, ?, ?, ?)`,
      ).bind(orderId, orderNo, user.id, device.id, rentalPlan.term.startDate, rentalPlan.term.endDate, rentalPlan.term.startPeriod, rentalPlan.term.endPeriod, rentalPlan.period.days, paymentMethod === 'balance' ? 'balance' : 'card', total, deposit, null, null, location, deliveryMethod, orderDeliveryFee, note, discounts[index] > 0 ? couponCode : null, discounts[index], new Date().toISOString()).run()
      orderIds.push(orderId)
      // payment_provider 在共享主站中区分 Stripe 卡与礼品卡；旧数据库没有该列时，
      // 保留 card / balance 的历史兼容路径，但不能静默丢弃客户明确选择的 Square。
      try {
        await c.env.RENT.prepare('UPDATE orders SET payment_provider = ?, refundMethod = ?, stripe_payment_method_id = ?, stripe_setup_intent_id = ?, deposit_payment_mode = ? WHERE id = ?')
          .bind(paymentProvider, refundMethod, stripePaymentMethodId || null, setupIntentId || null, depositPaymentModeForRental(rentalPlan.period.days, depositCardPayment, stripeCardBrand), orderId).run()
      } catch (error) {
        if (paymentProvider === 'square') throw error
        await c.env.RENT.prepare('UPDATE orders SET refundMethod = ?, stripe_payment_method_id = ?, stripe_setup_intent_id = ?, deposit_payment_mode = ? WHERE id = ?')
          .bind(refundMethod, stripePaymentMethodId || null, setupIntentId || null, depositPaymentModeForRental(rentalPlan.period.days, depositCardPayment, stripeCardBrand), orderId).run()
      }
      if (paymentProvider === 'square') {
        await c.env.RENT.prepare('UPDATE orders SET square_gift_card_id = ? WHERE id = ?').bind(squareGiftCardId, orderId).run()
      }
      const depositMode = depositPaymentModeForRental(rentalPlan.period.days, depositCardPayment, stripeCardBrand)
      // 短租：提交申请时就用已验证的卡对押金做预授权，审核通过后只需要扣租金。
      // 长租（SetupIntent 模式）不在这里扣款，损坏或逾期时才按实际费用从保存的卡扣。
      if (depositMode === 'PREAUTH' && deposit > 0) {
        try {
          await authorizeDepositForOrder(c, orderId, String(user.id), deposit, stripePaymentMethodId, stripeCardBrand, rentalPlan.period.days, stripeCustomerId)
        } catch (error) {
          depositAuthError = error instanceof Error ? error.message : '押金预授权失败，请更换信用卡后重试。'
          break
        }
      }
    }
  } catch (error) {
    if (orderIds.length) await c.env.RENT.batch(orderIds.map((orderId) => c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(orderId)))
    console.error('Website rental order insertion failed:', error)
    return json(c, 500, { ok: false, message: '订单创建失败，请稍后重试。' })
  }
  if (depositAuthError) {
    if (orderIds.length) await c.env.RENT.batch(orderIds.map((orderId) => c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(orderId)))
    return json(c, 402, { ok: false, message: depositAuthError })
  }
  try {
    await markDeliveryQuoteUsed(c, deliveryQuoteId)
  } catch (error) {
    console.error('Delivery quote finalization failed', error)
  }
  const totalRent = fees.reduce((sum, fee) => sum + fee, 0)
  const totalDeposit = devices.reduce((sum, device) => sum + numberValue(device.depositAmount, device.deposit_amount), 0)
  const totalDiscount = discounts.reduce((sum, discount) => sum + discount, 0)
  await createAdminNotifications(c, orderIds[0], `官网新申请：${contactName} 申请 ${devices.length} 台设备，各设备租期按申请内容分别记录。租金 AUD$${totalRent.toFixed(2)}${deliveryFee ? `，配送费 AUD$${deliveryFee.toFixed(2)}` : ''}${totalDiscount ? `，优惠 AUD$${totalDiscount.toFixed(2)}` : ''}。`)
  const firstOrder = await c.env.RENT.prepare('SELECT orderNo, deposit_payment_mode FROM orders WHERE id = ?').bind(orderIds[0]).first<{ orderNo?: string; deposit_payment_mode?: string }>()
  const paymentBreakdown = paymentProvider === 'stripe'
    ? firstOrder?.deposit_payment_mode === 'PREAUTH'
      ? `本次共两笔：押金 AUD$${totalDeposit.toFixed(2)} 已在信用卡上预授权；租金${deliveryFee ? `及配送费合计 AUD$${(totalRent + deliveryFee - totalDiscount).toFixed(2)}` : ` AUD$${(totalRent - totalDiscount).toFixed(2)}`} 将在审核通过后自动从同一张卡扣取。`
      : `本次共两笔：押金 AUD$${totalDeposit.toFixed(2)} 已通过 SetupIntent 保存卡片；租金${deliveryFee ? `及配送费合计 AUD$${(totalRent + deliveryFee - totalDiscount).toFixed(2)}` : ` AUD$${(totalRent - totalDiscount).toFixed(2)}`} 将在审核通过后自动从同一张卡扣取。`
    : paymentProvider === 'square'
      ? firstOrder?.deposit_payment_mode === 'PREAUTH'
        ? `礼品卡将在审核通过并签约后用于支付租金及服务费；押金 AUD$${totalDeposit.toFixed(2)} 已在另一张信用卡上预授权。`
        : `礼品卡将在审核通过并签约后用于支付租金及服务费；押金 AUD$${totalDeposit.toFixed(2)} 已通过信用卡验证并保存，归还验收后按规则结算。`
      : ''
  return json(c, 200, { ok: true, orderId: orderIds[0], orderIds, orderCount: orderIds.length, accountCreated, temporaryPassword: temporaryPassword || null, orderNo: firstOrder?.orderNo || null, rentalPeriod: rentalPlans.get(deviceIds[0])?.period.days || 0, message: `${accountCreated ? '账号已注册，' : ''}${orderIds.length} 台设备的申请已提交。${paymentBreakdown || '管理员确认后会联系你安排签约与付款。'}` })
}

export async function parseRequestBody(c: RentalContext): Promise<Record<string, unknown> | null> {
  try {
    const contentType = c.req.header('content-type') || ''
    return contentType.includes('application/json') ? await c.req.json() as Record<string, unknown> : Object.fromEntries(Object.entries(await c.req.parseBody()).map(([key, value]) => [key, String(value)]))
  } catch {
    return null
  }
}
