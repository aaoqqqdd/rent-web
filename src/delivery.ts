import type { Context } from 'hono'
import { getSiteContact } from './db'
import type { Env } from './index'
import { deliveryStatusInfo } from './deliveryStatus'

type DeliveryContext = Context<{ Bindings: Env }>

const ZOOM2U_BASE_URL = 'https://api.zoom2u.com'
const QUOTE_TTL_MS = 10 * 60 * 1000
const MAX_PAYLOAD_LENGTH = 12_000

interface AddressInput {
  street: string
  suburb: string
  state: string
  postcode: string
}

interface DeliveryQuoteRequest {
  address: AddressInput
  contactName: string
  contactEmail: string
  contactPhone: string
  deviceCount: number
  readyDateTime?: string
}

interface ZoomLocation {
  ContactName: string
  Email: string
  Phone: string
  FullAddress: string
  Notes: string
}

interface ZoomQuoteOption {
  deliverySpeed?: unknown
  price?: unknown
  deliveredBy?: unknown
  earliestPickupEta?: unknown
  earliestDropEta?: unknown
}

interface StoredDeliveryQuote {
  id: string
  provider: string
  price: number
  deliveryAddress: string
  deviceCount: number
  expiresAt: number
  usedAt: number | null
}

interface StoredDeliveryBooking {
  id: string
  orderId: string
  direction: 'outbound' | 'return'
  providerReference: string
  trackingUrl: string
  status: string
}

interface DeliveryRuntimeConfig {
  apiToken: string
  webhookSecret: string
  adminToken: string
  apiBaseUrl: string
  pickupAddress: string
  pickupContactName: string
  pickupEmail: string
  pickupPhone: string
  pickupNotes: string
  deliverySpeed: string
  vehicleType: string
  packageType: string
}

type StoredDeliveryConfig = Partial<Record<keyof DeliveryRuntimeConfig, string>>

const encode = (bytes: Uint8Array) => { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary) }
const decode = (value: string) => new Uint8Array(Array.from(atob(value), char => char.charCodeAt(0)))

async function deliveryEncryptionKey(env: Env): Promise<CryptoKey> {
  const master = clean(env.SETTINGS_ENCRYPTION_KEY, 500)
  if (!master) throw new Error('SETTINGS_ENCRYPTION_KEY is not configured')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
}

async function decryptStoredDeliveryValue(env: Env, value: string | undefined): Promise<string> {
  if (!value) return ''
  try {
    const [iv, ciphertext] = value.split('.')
    if (!iv || !ciphertext) return ''
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await deliveryEncryptionKey(env), decode(ciphertext))
    return new TextDecoder().decode(plain)
  } catch {
    return ''
  }
}

async function readStoredDeliveryConfig(env: Env): Promise<StoredDeliveryConfig> {
  try {
    const row = await env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'deliveryConfig'").first() as Record<string, unknown> | null
    return row?.value ? JSON.parse(String(row.value)) as StoredDeliveryConfig : {}
  } catch {
    return {}
  }
}

async function getDeliveryRuntimeConfig(c: DeliveryContext): Promise<DeliveryRuntimeConfig> {
  const stored = await readStoredDeliveryConfig(c.env)
  const [apiToken, webhookSecret, adminToken] = await Promise.all([
    decryptStoredDeliveryValue(c.env, stored.apiToken),
    decryptStoredDeliveryValue(c.env, stored.webhookSecret),
    decryptStoredDeliveryValue(c.env, stored.adminToken),
  ])
  return {
    apiToken: apiToken || clean(c.env.ZOOM2U_API_TOKEN, 500),
    webhookSecret: webhookSecret || clean(c.env.ZOOM2U_WEBHOOK_SECRET, 500),
    adminToken: adminToken || clean(c.env.DELIVERY_ADMIN_TOKEN, 500),
    apiBaseUrl: clean(stored.apiBaseUrl || c.env.ZOOM2U_API_BASE_URL || ZOOM2U_BASE_URL, 180).replace(/\/$/, ''),
    pickupAddress: clean(stored.pickupAddress || c.env.ZOOM2U_PICKUP_ADDRESS, 300),
    pickupContactName: clean(stored.pickupContactName || c.env.ZOOM2U_PICKUP_CONTACT_NAME, 120),
    pickupEmail: clean(stored.pickupEmail || c.env.ZOOM2U_PICKUP_EMAIL, 160),
    pickupPhone: clean(stored.pickupPhone || c.env.ZOOM2U_PICKUP_PHONE, 80),
    pickupNotes: clean(stored.pickupNotes || c.env.ZOOM2U_PICKUP_NOTES, 300),
    deliverySpeed: clean(stored.deliverySpeed || c.env.ZOOM2U_DELIVERY_SPEED || 'Same day', 32),
    vehicleType: clean(stored.vehicleType || c.env.ZOOM2U_VEHICLE_TYPE || 'Car', 16),
    packageType: clean(stored.packageType || c.env.ZOOM2U_PACKAGE_TYPE || 'Box', 16),
  }
}

function clean(value: unknown, max = 240): string {
  return String(value ?? '').trim().slice(0, max)
}

async function sameSecret(left: string, right: string): Promise<boolean> {
  if (!left || !right) return false
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ])
  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let difference = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0)
  return difference === 0
}

function jsonPayload(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, MAX_PAYLOAD_LENGTH)
  } catch {
    return '{}'
  }
}

function fullAddress(address: AddressInput): string {
  return `${address.street}, ${address.suburb} ${address.state} ${address.postcode}, Australia`
}

function normalizeAddress(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim()
}

function configuredSpeed(config: DeliveryRuntimeConfig): string {
  const speed = clean(config.deliverySpeed, 32)
  return ['Same day', '3 hour', 'VIP'].includes(speed) ? speed : 'Same day'
}

function configuredVehicle(config: DeliveryRuntimeConfig): string {
  const vehicle = clean(config.vehicleType, 16)
  return ['Bike', 'Car', 'Van'].includes(vehicle) ? vehicle : 'Car'
}

function configuredPackage(config: DeliveryRuntimeConfig): string {
  const packageType = clean(config.packageType, 16)
  return ['Documents', 'Bag', 'Box', 'Custom'].includes(packageType) ? packageType : 'Box'
}

function zoomHeaders(config: DeliveryRuntimeConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function ensureDeliveryTables(env: Env): Promise<void> {
  await env.RENT.prepare(
    `CREATE TABLE IF NOT EXISTS delivery_quotes (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      price REAL NOT NULL,
      delivery_address TEXT NOT NULL,
      device_count INTEGER NOT NULL DEFAULT 1,
      delivery_speed TEXT NOT NULL,
      delivered_by TEXT,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      provider_payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ).run()
  await env.RENT.prepare(
    `CREATE TABLE IF NOT EXISTS delivery_bookings (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_reference TEXT NOT NULL,
      purchase_order_number TEXT NOT NULL UNIQUE,
      tracking_url TEXT,
      status TEXT NOT NULL,
      price REAL,
      proof_of_delivery_url TEXT,
      signature_url TEXT,
      provider_payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()
}

function pickQuoteOption(payload: unknown, speed: string): ZoomQuoteOption | null {
  const options = Array.isArray(payload) ? payload : [payload]
  const valid = options.filter((item): item is ZoomQuoteOption => Boolean(item && typeof item === 'object'))
  return valid.find((item) => String(item.deliverySpeed || '') === speed) || valid[0] || null
}

function quoteMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const message = clean((payload as Record<string, unknown>).message, 180)
    if (message) return message
  }
  return '配送商暂时无法为这个地址报价，请稍后重试或联系客服确认。'
}

function pickupLocation(config: DeliveryRuntimeConfig, contact: Awaited<ReturnType<typeof getSiteContact>>): ZoomLocation | null {
  const address = clean(config.pickupAddress, 300) || clean(contact.address, 300)
  if (!address) return null
  return {
    ContactName: clean(config.pickupContactName, 120) || clean(contact.name, 120) || 'GeekSlope',
    Email: clean(config.pickupEmail, 160) || clean(contact.email, 160),
    Phone: clean(config.pickupPhone, 80) || clean(contact.phone, 80),
    FullAddress: address,
    Notes: clean(config.pickupNotes, 300),
  }
}

function dropoffLocation(input: DeliveryQuoteRequest, address: string): ZoomLocation {
  return {
    ContactName: clean(input.contactName, 120) || 'GeekSlope customer',
    Email: clean(input.contactEmail, 160),
    Phone: clean(input.contactPhone, 80),
    FullAddress: address,
    Notes: 'Computer rental delivery. Please obtain handover confirmation.',
  }
}

function readyDateTime(value: string | undefined): string | undefined {
  const candidate = clean(value, 64)
  if (!candidate) return undefined
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined
}

function quoteRequestBody(
  config: DeliveryRuntimeConfig,
  input: DeliveryQuoteRequest,
  address: string,
  contact: Awaited<ReturnType<typeof getSiteContact>>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    PackageDescription: `${Math.max(1, input.deviceCount)} computer rental package${input.deviceCount > 1 ? 's' : ''}`,
    DeliverySpeed: configuredSpeed(config),
    VehicleType: configuredVehicle(config),
    PackageType: configuredPackage(config),
    Pickup: pickupLocation(config, contact),
    Dropoff: dropoffLocation(input, address),
  }
  const ready = readyDateTime(input.readyDateTime)
  if (ready) body.ReadyDateTime = ready
  if (!body.Pickup) delete body.Pickup
  return body
}

export async function deliveryQuotesEnabled(c: DeliveryContext): Promise<boolean> {
  return Boolean((await getDeliveryRuntimeConfig(c)).apiToken)
}

export async function deliveryAdminTokenConfigured(c: DeliveryContext): Promise<boolean> {
  return Boolean((await getDeliveryRuntimeConfig(c)).adminToken)
}

export async function verifyDeliveryAdminToken(c: DeliveryContext, token: string): Promise<boolean> {
  return sameSecret(clean(token, 600), (await getDeliveryRuntimeConfig(c)).adminToken)
}

export async function quoteDelivery(c: DeliveryContext, input: DeliveryQuoteRequest): Promise<{
  ok: true
  quoteId: string
  price: number
  currency: 'AUD'
  deliverySpeed: string
  deliveredBy: string | null
  expiresAt: string
} | { ok: false; message: string; code?: string }> {
  const config = await getDeliveryRuntimeConfig(c)
  if (!config.apiToken) return { ok: false, message: '在线配送报价尚未启用。', code: 'not_configured' }

  const contact = await getSiteContact(c.env)
  const address = fullAddress(input.address)
  const response = await fetch(`${config.apiBaseUrl}/api/v1/delivery/quote`, {
    method: 'POST',
    headers: zoomHeaders(config),
    body: JSON.stringify(quoteRequestBody(config, input, address, contact)),
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    console.error('Zoom2u quote failed', response.status, jsonPayload(payload))
    return { ok: false, message: quoteMessage(payload), code: 'provider_error' }
  }
  const option = pickQuoteOption(payload, configuredSpeed(config))
  const price = Number(option?.price)
  if (!option || !Number.isFinite(price) || price < 0) {
    console.error('Zoom2u quote response did not contain a price', jsonPayload(payload))
    return { ok: false, message: '配送商返回了无效报价，请联系客服确认。', code: 'invalid_provider_response' }
  }

  const now = Date.now()
  const quoteId = `dq-${crypto.randomUUID().replaceAll('-', '')}`
  const expiresAt = now + QUOTE_TTL_MS
  try {
    await ensureDeliveryTables(c.env)
    await c.env.RENT.prepare('DELETE FROM delivery_quotes WHERE expires_at < ? OR used_at IS NOT NULL').bind(now).run()
    await c.env.RENT.prepare(
      `INSERT INTO delivery_quotes (id, provider, price, delivery_address, device_count, delivery_speed, delivered_by, expires_at, provider_payload, created_at)
       VALUES (?, 'zoom2u', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      quoteId,
      Number(price.toFixed(2)),
      address,
      Math.max(1, Math.min(10, Math.floor(input.deviceCount || 1))),
      clean(option.deliverySpeed, 32) || configuredSpeed(config),
      clean(option.deliveredBy, 64) || null,
      expiresAt,
      jsonPayload(payload),
      new Date(now).toISOString(),
    ).run()
  } catch (error) {
    console.error('Delivery quote persistence failed', error)
    return { ok: false, message: '配送报价暂时无法保存，请稍后重试。', code: 'storage_error' }
  }
  return {
    ok: true,
    quoteId,
    price: Number(price.toFixed(2)),
    currency: 'AUD',
    deliverySpeed: clean(option.deliverySpeed, 32) || configuredSpeed(config),
    deliveredBy: clean(option.deliveredBy, 64) || null,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export async function validateDeliveryQuote(
  c: DeliveryContext,
  quoteId: string,
  address: string,
  deviceCount: number,
): Promise<{ ok: true; price: number } | { ok: false; message: string }> {
  if (!(await deliveryQuotesEnabled(c))) return { ok: true, price: 0 }
  if (!/^dq-[a-f0-9]{32}$/.test(quoteId)) return { ok: false, message: '配送报价已失效，请重新获取报价。' }
  try {
    await ensureDeliveryTables(c.env)
    const row = await c.env.RENT.prepare(
      `SELECT id, provider, price, delivery_address AS deliveryAddress, device_count AS deviceCount, expires_at AS expiresAt, used_at AS usedAt
       FROM delivery_quotes WHERE id = ? LIMIT 1`,
    ).bind(quoteId).first<Record<string, unknown>>()
    const quote: StoredDeliveryQuote | null = row ? {
      id: String(row.id),
      provider: String(row.provider),
      price: Number(row.price),
      deliveryAddress: String(row.deliveryAddress),
      deviceCount: Number(row.deviceCount),
      expiresAt: Number(row.expiresAt),
      usedAt: row.usedAt === null || row.usedAt === undefined ? null : Number(row.usedAt),
    } : null
    if (!quote || quote.provider !== 'zoom2u' || quote.usedAt || quote.expiresAt <= Date.now()) return { ok: false, message: '配送报价已过期，请重新获取报价。' }
    if (normalizeAddress(quote.deliveryAddress) !== normalizeAddress(address) || quote.deviceCount !== deviceCount) {
      return { ok: false, message: '配送地址或设备数量发生变化，请重新获取报价。' }
    }
    if (!Number.isFinite(quote.price) || quote.price < 0) return { ok: false, message: '配送报价无效，请重新获取报价。' }
    return { ok: true, price: Number(quote.price.toFixed(2)) }
  } catch (error) {
    console.error('Delivery quote validation failed', error)
    return { ok: false, message: '配送报价暂时无法验证，请稍后重试。' }
  }
}

export async function markDeliveryQuoteUsed(c: DeliveryContext, quoteId: string): Promise<void> {
  if (!(await deliveryQuotesEnabled(c)) || !quoteId) return
  await c.env.RENT.prepare('UPDATE delivery_quotes SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(Date.now(), quoteId).run()
}

function bookingPayload(
  config: DeliveryRuntimeConfig,
  order: Record<string, unknown>,
  direction: 'outbound' | 'return',
  pickup: ZoomLocation,
  dropoff: ZoomLocation,
  readyDateTimeValue: string | undefined,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    PurchaseOrderNumber: `${clean(order.orderNo, 80)}-${direction}`,
    PackageDescription: `${clean(order.deviceName, 100) || 'Computer rental device'} rental delivery`,
    DeliverySpeed: configuredSpeed(config),
    VehicleType: configuredVehicle(config),
    PackageType: configuredPackage(config),
    Pickup: pickup,
    Dropoff: dropoff,
  }
  const ready = readyDateTime(readyDateTimeValue)
  if (ready) body.ReadyDateTime = ready
  return body
}

export async function createDeliveryBooking(
  c: DeliveryContext,
  orderId: string,
  direction: 'outbound' | 'return',
  requestedReadyDateTime?: string,
): Promise<{ ok: true; booking: StoredDeliveryBooking; price: number | null } | { ok: false; message: string }> {
  const config = await getDeliveryRuntimeConfig(c)
  if (!config.apiToken) return { ok: false, message: 'Zoom2u 配送尚未配置。' }
  if (!orderId || !['outbound', 'return'].includes(direction)) return { ok: false, message: '配送订单参数无效。' }
  const contact = await getSiteContact(c.env)
  const pickupBase = pickupLocation(config, contact)
  if (!pickupBase) return { ok: false, message: '请先配置 ZOOM2U_PICKUP_ADDRESS。' }
  try {
    await ensureDeliveryTables(c.env)
    const existing = await c.env.RENT.prepare(
      `SELECT id, order_id AS orderId, direction, provider_reference AS providerReference, tracking_url AS trackingUrl, status
       FROM delivery_bookings WHERE order_id = ? AND direction = ? LIMIT 1`,
    ).bind(orderId, direction).first<Record<string, unknown>>()
    if (existing) {
      const statusInfo = deliveryStatusInfo(existing.status)
      if (statusInfo.special) return { ok: false, message: `配送订单当前为 ${statusInfo.label}：${statusInfo.description}` }
      return { ok: true, booking: {
      id: String(existing.id), orderId: String(existing.orderId), direction: String(existing.direction) as 'outbound' | 'return',
      providerReference: String(existing.providerReference), trackingUrl: String(existing.trackingUrl || ''), status: String(existing.status),
      }, price: null }
    }

    const order = await c.env.RENT.prepare(
      `SELECT o.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone, d.name AS device_name
       FROM orders o LEFT JOIN users u ON u.id = o.userId LEFT JOIN devices d ON d.id = o.deviceId
       WHERE o.id = ? LIMIT 1`,
    ).bind(orderId).first<Record<string, unknown>>()
    if (!order) return { ok: false, message: '找不到对应订单。' }
    if (String(order.deliveryMethod || order.delivery_method || '') !== 'Delivery') return { ok: false, message: '该订单不是送货订单。' }
    const orderStatus = String(order.status || '').toLowerCase()
    const allowedStatuses = direction === 'outbound'
      ? ['paid', 'pending_pickup', 'active']
      : ['active', 'extended', 'overdue', 'suspended', 'pending_return']
    if (!allowedStatuses.includes(orderStatus)) return { ok: false, message: '当前订单状态不允许创建该配送订单。' }
    const customerAddress = clean(order.pickupLocation || order.pickup_location, 300)
    if (!customerAddress) return { ok: false, message: '订单缺少送货地址。' }
    const customer: ZoomLocation = {
      ContactName: clean(order.user_name, 120) || 'GeekSlope customer',
      Email: clean(order.user_email, 160),
      Phone: clean(order.user_phone, 80),
      FullAddress: customerAddress,
      Notes: direction === 'outbound' ? 'Computer rental delivery. Please obtain handover confirmation.' : 'Computer rental return. Please collect the device and accessories.',
    }
    const pickup = direction === 'outbound' ? pickupBase : customer
    const dropoff = direction === 'outbound' ? customer : pickupBase
    const scheduled = requestedReadyDateTime || `${String(direction === 'outbound' ? order.startDate : order.endDate).slice(0, 10)}T09:00:00+10:00`
    const body = bookingPayload(config, { ...order, deviceName: order.device_name }, direction, pickup, dropoff, scheduled)
    const response = await fetch(`${config.apiBaseUrl}/api/v1/delivery/create`, {
      method: 'POST', headers: zoomHeaders(config), body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload) {
      console.error('Zoom2u booking failed', response.status, jsonPayload(payload))
      return { ok: false, message: quoteMessage(payload) }
    }
    const reference = clean(payload.reference, 120)
    if (!reference) return { ok: false, message: '配送商没有返回订单编号，请联系客服处理。' }
    const bookingId = `db-${crypto.randomUUID().replaceAll('-', '')}`
    const now = new Date().toISOString()
    const booking: StoredDeliveryBooking = {
      id: bookingId, orderId, direction, providerReference: reference,
      trackingUrl: clean(payload['tracking-link'] || payload.trackingLink, 500), status: deliveryStatusInfo(clean(payload.status, 80) || 'Unassigned').key,
    }
    await c.env.RENT.prepare(
      `INSERT INTO delivery_bookings (id, order_id, direction, provider, provider_reference, purchase_order_number, tracking_url, status, price, provider_payload, created_at, updated_at)
       VALUES (?, ?, ?, 'zoom2u', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      bookingId, orderId, direction, reference, `${clean(order.orderNo, 80)}-${direction}`,
      booking.trackingUrl || null, booking.status, Number.isFinite(Number(payload.price)) ? Number(payload.price) : null,
      jsonPayload(payload), now, now,
    ).run()
    await notifyRentDeliveryStatus(c, bookingId)
    return { ok: true, booking, price: Number.isFinite(Number(payload.price)) ? Number(payload.price) : null }
  } catch (error) {
    console.error('Delivery booking failed', error)
    return { ok: false, message: '配送订单暂时无法创建，请稍后重试。' }
  }
}

export async function handleZoom2uWebhook(c: DeliveryContext): Promise<Response> {
  const expected = (await getDeliveryRuntimeConfig(c)).webhookSecret
  if (!expected) return c.json({ ok: false, message: 'Webhook 未配置。' }, 503)
  const actual = clean(c.req.header('Authorization'), 600)
  if (!(await sameSecret(actual, expected)) && !(await sameSecret(actual, `Basic ${expected}`))) return c.json({ ok: false }, 401)
  const payload = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const data = payload?.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : payload || {}
  const purchaseOrderNumber = clean(data.PurchaseOrderNumber || data.purchaseOrderNumber, 120)
  const reference = clean(data.reference, 120)
  if (!purchaseOrderNumber && !reference) return c.json({ ok: true }, 200)
  try {
    await ensureDeliveryTables(c.env)
    const booking = await c.env.RENT.prepare(
      `SELECT id FROM delivery_bookings WHERE purchase_order_number = ? OR provider_reference = ? LIMIT 1`,
    ).bind(purchaseOrderNumber, reference).first<{ id?: string }>()
    if (!booking?.id) return c.json({ ok: true }, 200)
    const nextStatus = deliveryStatusInfo(clean(data.status, 100) || clean(payload?.type, 100) || 'Updated')
    await c.env.RENT.prepare(
      `UPDATE delivery_bookings
       SET status = ?, tracking_url = COALESCE(?, tracking_url), proof_of_delivery_url = COALESCE(?, proof_of_delivery_url), signature_url = COALESCE(?, signature_url), provider_payload = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(
      nextStatus.key, clean(data['tracking-link'] || data.trackingLink || data.tracking_url, 500) || null,
      clean(data.proofOfDeliveryPhotoUrl, 500) || null, clean(data.signatureUrl, 500) || null,
      jsonPayload(payload), new Date().toISOString(), booking.id,
    ).run()
    await notifyRentDeliveryStatus(c, booking.id)
    return c.json({ ok: true }, 200)
  } catch (error) {
    console.error('Zoom2u webhook persistence failed', error)
    return c.json({ ok: false }, 500)
  }
}

async function notifyRentDeliveryStatus(c: DeliveryContext, bookingId: string): Promise<void> {
  const service = c.env.RENT_SERVICE
  if (!service) return
  try {
    const adminToken = (await getDeliveryRuntimeConfig(c)).adminToken
    if (!adminToken) return
    const response = await service.fetch(new Request('https://rent.internal/internal/delivery-status-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ bookingId }),
    }))
    if (!response.ok) console.error('Rent delivery status email request failed', response.status)
  } catch (error) {
    console.error('Rent delivery status email request failed', error instanceof Error ? error.message : String(error))
  }
}
