import type { Context } from 'hono'
import { getRentalConfig } from './db'
import { isStrongPassword, registerCustomer, verifyPassword } from './auth'
import { isMelbourneAddress } from './address'
import type { Env } from './index'

type RentalContext = Context<{ Bindings: Env }>

const MAX_CART_ITEMS = 10
const AU_STATES = new Set(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LONG_TERM_RENTAL_DAYS = 30

function depositAuthorizationWindowDays(cardBrand: unknown): 7 | 30 {
  const brand = String(cardBrand || '').trim().toLowerCase()
  return brand === 'visa' || brand === 'mastercard' ? 30 : 7
}

function depositPaymentModeForRental(rentalPeriod: number, cardPayment: boolean, cardBrand: unknown): 'PAID' | 'PREAUTH' | 'SETUP_INTENT' {
  if (!cardPayment) return 'PAID'
  return rentalPeriod >= LONG_TERM_RENTAL_DAYS || rentalPeriod > depositAuthorizationWindowDays(cardBrand) ? 'SETUP_INTENT' : 'PREAUTH'
}

function json(c: RentalContext, status: number, payload: Record<string, unknown>): Response {
  return c.json(payload, status as never)
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

async function checkCouponCustomerEligibility(c: RentalContext, coupon: Record<string, unknown>, customerId: string): Promise<string | null> {
  try {
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

async function paymentSettings(c: RentalContext): Promise<{ stripe: boolean; balancePayment: boolean; processingFeeRate: number }> {
  const fallback = { stripe: true, balancePayment: true, processingFeeRate: 0.025 }
  try {
    const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'paymentMethods'").first<{ value: string }>()
    if (!row?.value) return fallback
    const value = JSON.parse(row.value) as Record<string, unknown>
    return {
      stripe: value.stripe !== false,
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

async function verifySetupIntent(c: RentalContext, setupIntentId: string): Promise<{ paymentMethodId: string; cardBrand: string }> {
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) throw new Error('信用卡验证信息无效，请重新验证。')
  const intent = await stripeRequest(c, `setup_intents/${setupIntentId}`)
  const paymentMethodId = typeof intent.payment_method === 'string' ? intent.payment_method : String(intent.payment_method?.id || '')
  if (intent.status !== 'succeeded' || !/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) throw new Error('请先完成信用卡验证。')
  const paymentMethod = await stripeRequest(c, `payment_methods/${paymentMethodId}`)
  return { paymentMethodId, cardBrand: String(paymentMethod.card?.brand || '') }
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

export async function previewRentalCoupon(c: RentalContext, deviceIds: string[], days: number, code: string): Promise<Record<string, unknown>> {
  if (!deviceIds.length || !Number.isInteger(days) || days < 1 || days > 365 || !code) return { ok: false, message: '请先选择有效租期并输入优惠码。' }
  const devices: Record<string, unknown>[] = []
  for (const deviceId of deviceIds.slice(0, MAX_CART_ITEMS)) {
    const device = await c.env.RENT.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first<Record<string, unknown>>()
    if (!device) return { ok: false, message: '购物车中有设备不存在或已下架。' }
    devices.push(device)
  }
  const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(code.trim().toUpperCase().slice(0, 40)).first<Record<string, unknown>>()
  if (!coupon) return { ok: false, message: '优惠码无效、已过期或已达到使用次数上限。' }
  const fees = devices.map((device) => calculateRentalFee(device, days))
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
  if (!(await verifyTurnstile(c, String(body['cf-turnstile-response'] || '')))) return json(c, 400, { ok: false, message: '人机验证失败，请重试。' })

  const deviceIds = parseDeviceIds(body)
  if (!deviceIds.length) return json(c, 400, { ok: false, message: '购物车中没有可提交的设备。' })
  if (deviceIds.length > MAX_CART_ITEMS) return json(c, 400, { ok: false, message: `单次最多提交 ${MAX_CART_ITEMS} 台设备。` })
  const startDate = String(body.startDate || '').trim()
  const endDate = String(body.endDate || '').trim()
  const startPeriod = body.startPeriod === 'PM' ? 'PM' : 'AM'
  const endPeriod = body.endPeriod === 'PM' ? 'PM' : 'AM'
  const deliveryMethod = body.deliveryMethod === 'Delivery' ? 'Delivery' : 'Pickup'
  const contactName = String(body.contactName || '').trim().slice(0, 120)
  const contactEmail = String(body.contactEmail || '').trim().toLowerCase().slice(0, 200)
  const contactPhone = String(body.contactPhone || '').trim().slice(0, 40)
  const password = String(body.password || '')
  const passwordConfirm = String(body.passwordConfirm || '')
  const couponCode = String(body.couponCode || '').trim().toUpperCase().slice(0, 40)
  const paymentMethod = body.paymentMethod === 'balance' ? 'balance' : 'card'
  const refundMethod = body.refundMethod === 'balance' ? 'balance' : 'original'
  const agreed = ['1', 'on', 'true', 'yes'].includes(String(body.agree || '').toLowerCase())
  if (!validDate(startDate) || !validDate(endDate)) return json(c, 400, { ok: false, message: '请填写有效的开始日期和结束日期。' })
  if (!EMAIL_RE.test(contactEmail)) return json(c, 400, { ok: false, message: '邮箱格式不正确。' })
  if (!contactName || !contactPhone) return json(c, 400, { ok: false, message: '请填写姓名和联系电话。' })
  if (!password || password !== passwordConfirm || !isStrongPassword(password)) return json(c, 400, { ok: false, message: '请填写一致的密码（至少 8 位，且包含字母、数字和符号）。' })
  if (!agreed) return json(c, 400, { ok: false, message: '请先阅读并同意服务条款与隐私政策。' })
  let stripePaymentMethodId = ''
  let stripeCardBrand = ''
  const setupIntentId = String(body.stripeSetupIntentId || '').trim()
  if (paymentMethod === 'card') {
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
  if (paymentMethod === 'balance' && !settings.balancePayment) return json(c, 400, { ok: false, message: '账户余额支付当前未启用。' })
  const period = rentalDays(startDate, endDate, startPeriod, endPeriod)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (startDate < today || endDate < today || period.halfDays <= 0) return json(c, 400, { ok: false, message: '请选择有效的未来租期，归还时间必须晚于取货时间。' })
  if (period.days < config.minimumRentalDays) return json(c, 400, { ok: false, message: `最短租赁时间为 ${config.minimumRentalDays} 天。` })
  const unavailableDates = new Set(config.unavailableDates)
  for (let day = Date.parse(`${startDate}T00:00:00Z`); day < Date.parse(`${endDate}T00:00:00Z`); day += 86400000) {
    const date = new Date(day).toISOString().slice(0, 10)
    if (unavailableDates.has(date)) return json(c, 409, { ok: false, message: '所选租期包含不可用日期，请重新选择。' })
  }

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
  for (const deviceId of deviceIds) {
    const device = await c.env.RENT.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first<Record<string, unknown>>()
    const lifecycle = String(device?.lifecycle_status || device?.lifecycleStatus || '').toUpperCase()
    const available = device && (String(device.status || '').toLowerCase() === 'available' || lifecycle === 'READY' || lifecycle === 'RESERVED')
    if (!available) return json(c, 409, { ok: false, message: '购物车中有设备当前无法租赁，请移除后重试。' })
    try {
      const unavailable = await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ?').bind(deviceId).all<{ unavailable_date?: unknown }>()
      const unavailableDates = new Set((unavailable.results || []).map((row) => String(row.unavailable_date || '')))
      for (let day = Date.parse(`${startDate}T00:00:00Z`); day < Date.parse(`${endDate}T00:00:00Z`); day += 86400000) {
        if (unavailableDates.has(new Date(day).toISOString().slice(0, 10))) return json(c, 409, { ok: false, message: `${String(device.name || '设备')} 在所选日期不可用。` })
      }
    } catch { /* older deployments may not have per-device unavailable dates */ }
    const conflictStart = shiftDate(startDate, -config.bufferDays)
    const conflictEnd = shiftDate(endDate, config.bufferDays)
    const conflict = await c.env.RENT.prepare("SELECT id FROM orders WHERE deviceId = ? AND status NOT IN ('completed', 'cancelled') AND startDate < ? AND endDate > ? LIMIT 1").bind(deviceId, conflictEnd, conflictStart).first()
    if (conflict) return json(c, 409, { ok: false, message: `${String(device?.name || '设备')} 在所选日期已有订单。` })
    devices.push(device as Record<string, unknown>)
  }

  const fees = devices.map((device) => calculateRentalFee(device, period.days))
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
  if (user) {
    const storedHash = String(user.password_hash || user.passwordHash || user.password || '')
    if (!await verifyPassword(password, storedHash)) return json(c, 409, { ok: false, message: '该邮箱已注册，请使用注册时的密码。' })
    if (String(user.role || 'CUSTOMER') !== 'CUSTOMER' || String(user.status || 'active') !== 'active' || String(user.account_type || 'formal') !== 'formal') return json(c, 403, { ok: false, message: '该账号当前无法下单，请联系客服。' })
  } else {
    const result = await registerCustomer(c.env, { name: contactName, email: contactEmail, phone: contactPhone, password, passwordConfirm, agree: '1', turnstileToken: body['cf-turnstile-response'] }, ip)
    if (!result.ok) return json(c, result.code === 'rate_limited' ? 429 : 400, { ok: false, message: result.message })
    user = await c.env.RENT.prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1').bind(contactEmail).first<Record<string, unknown>>()
    accountCreated = true
  }
  if (!user?.id) return json(c, 500, { ok: false, message: '账号创建失败，请稍后重试。' })
  if (coupon) {
    const eligibilityError = await checkCouponCustomerEligibility(c, coupon, String(user.id))
    if (eligibilityError) return json(c, 400, { ok: false, message: eligibilityError })
  }
  const accountEligible = String(user.account_type || 'formal') === 'formal' && String(user.role || 'CUSTOMER') === 'CUSTOMER'
  const totalBeforePayment = fees.reduce((sum, fee, index) => sum + fee + numberValue(devices[index].depositAmount, devices[index].deposit_amount) - discounts[index], 0)
  if (refundMethod === 'balance' && !accountEligible) return json(c, 400, { ok: false, message: '当前账号不可使用余额退还押金，请改选原路退回。' })
  if (paymentMethod === 'balance' && (!accountEligible || numberValue(user.balance) < totalBeforePayment)) return json(c, 400, { ok: false, message: '账户余额不足以支付这笔申请。' })

  const batch = id('web')
  const orderIds: string[] = []
  try {
    for (let index = 0; index < devices.length; index += 1) {
      const device = devices[index]
      const orderId = id('o')
      const orderNo = `OD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
      const deposit = numberValue(device.depositAmount, device.deposit_amount)
      const total = Number((fees[index] + deposit - discounts[index]).toFixed(2))
      const note = `【官网申请 ${batch}】联系人：${contactName} / 电话：${contactPhone} / ${deliveryMethod === 'Delivery' ? '送货至' : '自取点'}：${location}${body.rentalNote ? `\n客户备注：${String(body.rentalNote).trim().slice(0, 350)}` : ''}`.slice(0, 500)
      await c.env.RENT.prepare(
        `INSERT INTO orders (id, orderNo, userId, deviceId, startDate, endDate, startPeriod, endPeriod, rentalPeriod, status, paymentMethod, totalAmount, depositAmount, contractId, pickupLocation, returnLocation, deliveryMethod, deliveryFee, rentalNote, coupon_code, discount_amount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, '', ?, '到店归还', ?, 0, ?, ?, ?, ?)`,
      ).bind(orderId, orderNo, user.id, device.id, startDate, endDate, startPeriod, endPeriod, period.days, paymentMethod === 'balance' ? 'balance' : 'bank_transfer', total, deposit, location, deliveryMethod, note, discounts[index] > 0 ? couponCode : null, discounts[index], new Date().toISOString()).run()
      await c.env.RENT.prepare('UPDATE orders SET refundMethod = ?, stripe_payment_method_id = ?, stripe_setup_intent_id = ?, deposit_payment_mode = ? WHERE id = ?')
        .bind(refundMethod, stripePaymentMethodId || null, setupIntentId || null, depositPaymentModeForRental(period.days, paymentMethod === 'card', stripeCardBrand), orderId).run()
      orderIds.push(orderId)
    }
  } catch (error) {
    if (orderIds.length) await c.env.RENT.batch(orderIds.map((orderId) => c.env.RENT.prepare('DELETE FROM orders WHERE id = ?').bind(orderId)))
    console.error('Website rental order insertion failed:', error)
    return json(c, 500, { ok: false, message: '订单创建失败，请稍后重试。' })
  }
  const totalRent = fees.reduce((sum, fee) => sum + fee, 0)
  const totalDiscount = discounts.reduce((sum, discount) => sum + discount, 0)
  await createAdminNotifications(c, orderIds[0], `官网新申请：${contactName} 申请 ${devices.length} 台设备，${startDate} ${startPeriod} 至 ${endDate} ${endPeriod}。租金 AUD$${totalRent.toFixed(2)}${totalDiscount ? `，优惠 AUD$${totalDiscount.toFixed(2)}` : ''}。`)
  const firstOrder = await c.env.RENT.prepare('SELECT orderNo FROM orders WHERE id = ?').bind(orderIds[0]).first<{ orderNo?: string }>()
  return json(c, 200, { ok: true, orderId: orderIds[0], orderIds, orderCount: orderIds.length, accountCreated, orderNo: firstOrder?.orderNo || null, rentalPeriod: period.days, message: `${accountCreated ? '账号已注册，' : ''}${orderIds.length} 台设备的申请已提交。管理员确认后会联系你安排签约与付款。` })
}

export async function parseRequestBody(c: RentalContext): Promise<Record<string, unknown> | null> {
  try {
    const contentType = c.req.header('content-type') || ''
    return contentType.includes('application/json') ? await c.req.json() as Record<string, unknown> : Object.fromEntries(Object.entries(await c.req.parseBody()).map(([key, value]) => [key, String(value)]))
  } catch {
    return null
  }
}
