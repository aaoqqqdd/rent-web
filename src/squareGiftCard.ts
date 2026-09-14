import type { Context } from 'hono'
import type { Env } from './index'

type SquareEnvironment = 'sandbox' | 'production'
type SquareStoredConfig = {
  applicationId?: string
  locationId?: string
  accessToken?: string
  environment?: SquareEnvironment
}

type RentalContext = Context<{ Bindings: Env }>

const SQUARE_VERSION = '2026-08-19'

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  return new Uint8Array(Array.from(binary, (character) => character.charCodeAt(0)))
}

async function encryptionKey(c: RentalContext): Promise<CryptoKey> {
  const masterKey = String(c.env.SETTINGS_ENCRYPTION_KEY || '')
  if (!masterKey) throw new Error('尚未配置 SETTINGS_ENCRYPTION_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(masterKey))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
}

async function decrypt(c: RentalContext, value: string): Promise<string> {
  const [iv, ciphertext] = String(value || '').split('.')
  if (!iv || !ciphertext) throw new Error('Square 配置已损坏')
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    await encryptionKey(c),
    base64ToBytes(ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}

async function readStoredConfig(c: RentalContext): Promise<SquareStoredConfig | null> {
  const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'squareConfig'").first<{ value?: string }>()
  if (!row?.value) return null
  try { return JSON.parse(row.value) as SquareStoredConfig } catch { return null }
}

function squareBaseUrl(environment: SquareEnvironment): string {
  return environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com'
}

async function runtimeConfig(c: RentalContext): Promise<{ applicationId: string; locationId: string; accessToken: string; environment: SquareEnvironment }> {
  const stored = await readStoredConfig(c)
  if (!stored?.applicationId || !stored.locationId || !stored.accessToken) throw new Error('管理员尚未完整配置 Square')
  return {
    applicationId: stored.applicationId,
    locationId: stored.locationId,
    accessToken: await decrypt(c, stored.accessToken),
    environment: stored.environment === 'production' ? 'production' : 'sandbox',
  }
}

async function squareRequest(c: RentalContext, path: string, body?: unknown, method = 'POST'): Promise<any> {
  const config = await runtimeConfig(c)
  const response = await fetch(`${squareBaseUrl(config.environment)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: 'application/json',
      'Square-Version': SQUARE_VERSION,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as any
  if (!response.ok) {
    const detail = result?.errors?.map((item: any) => item.detail || item.code).filter(Boolean).join('; ')
    throw new Error(detail || 'Square API 请求失败')
  }
  return result
}

function splitName(firstName: unknown, lastName: unknown, name: unknown): { given_name: string; family_name?: string } {
  const first = String(firstName || '').trim()
  const last = String(lastName || '').trim()
  if (first) return { given_name: first, ...(last ? { family_name: last } : {}) }
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return { given_name: parts.shift() || '客户', ...(parts.length ? { family_name: parts.join(' ') } : {}) }
}

async function ensureSquareCustomer(c: RentalContext, user: Record<string, unknown>): Promise<string> {
  const storedId = String(user.square_customer_id || user.squareCustomerId || '').trim()
  if (storedId) {
    const current = await squareRequest(c, `/v2/customers/${encodeURIComponent(storedId)}`, undefined, 'GET').catch(() => null)
    if (current?.customer?.id || current?.id) return storedId
  }

  const email = String(user.email || '').trim().toLowerCase()
  if (email) {
    const searched = await squareRequest(c, '/v2/customers/search', {
      query: { filter: { email_address: { exact: email } } },
      limit: 10,
    })
    const customers = Array.isArray(searched?.customers) ? searched.customers : []
    const match = customers.find((item: any) => String(item.reference_id || '') === String(user.id || '')) || customers[0]
    if (match?.id) {
      const customerId = String(match.id)
      await c.env.RENT.prepare('UPDATE users SET square_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(customerId, user.id).run()
      return customerId
    }
  }

  const name = splitName(user.first_name, user.last_name, user.name)
  const created = await squareRequest(c, '/v2/customers', {
    idempotency_key: `rent-user-${String(user.id || '').slice(0, 32)}`,
    ...name,
    ...(email ? { email_address: email } : {}),
    ...(user.phone ? { phone_number: String(user.phone).trim() } : {}),
    reference_id: String(user.id || ''),
  })
  const customerId = String(created?.customer?.id || created?.id || '')
  if (!customerId) throw new Error('Square 客户资料创建失败')
  await c.env.RENT.prepare('UPDATE users SET square_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(customerId, user.id).run()
  return customerId
}

export async function getPublicSquareGiftCardConfig(c: RentalContext): Promise<{ applicationId: string; locationId: string; environment: SquareEnvironment } | null> {
  try {
    const paymentMethods = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'paymentMethods'").first<{ value?: string }>()
    const settings = paymentMethods?.value ? JSON.parse(paymentMethods.value) as Record<string, unknown> : {}
    if (settings.square !== true) return null
    const config = await runtimeConfig(c)
    return { applicationId: config.applicationId, locationId: config.locationId, environment: config.environment }
  } catch {
    return null
  }
}

/** Convert Square's browser nonce into a gift card ID, then link that card to the customer. */
export async function linkSquareGiftCardToCustomer(c: RentalContext, user: Record<string, unknown>, nonce: string): Promise<string> {
  const cleanNonce = String(nonce || '').trim()
  if (cleanNonce.length < 10 || cleanNonce.length > 500) throw new Error('Square 礼品卡凭据无效')

  const retrieved = await squareRequest(c, '/v2/gift-cards/from-nonce', { nonce: cleanNonce })
  const giftCard = retrieved?.gift_card || retrieved?.giftCard
  const giftCardId = String(giftCard?.id || '').trim()
  if (!giftCardId || giftCardId.length > 200 || /[\u0000-\u001f\u007f]/.test(giftCardId)) throw new Error('Square 未返回有效的礼品卡')

  const customerId = await ensureSquareCustomer(c, user)
  const linkedCustomerIds = Array.isArray(giftCard.customer_ids) ? giftCard.customer_ids.map((id: unknown) => String(id)) : []
  if (!linkedCustomerIds.includes(customerId)) {
    await squareRequest(c, `/v2/gift-cards/${encodeURIComponent(giftCardId)}/link-customer`, { customer_id: customerId })
  }
  return giftCardId
}
