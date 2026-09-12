// 实时数据访问层。营销站只读 rent 的 D1 库（binding: RENT）：
//   - devices        —— 产品名称 / 配置 / 日租价 / 押金 / 状态
//   - systemSettings  —— companyDetails、租赁规则与公开法务文档
// 所有查询都用 COALESCE / try-catch 兜底，任一字段缺失或表结构变动都不影响页面出图。

import type { Env } from './index'

export interface Product {
  id: string
  name: string
  brand: string
  model: string
  cpu: string
  ram: string
  storage: string
  gpu: string
  os: string
  pricePerDay: number
  weeklyDiscountPercent: number
  monthlyDiscountPercent: number
  depositAmount: number
  description: string
  available: boolean
  category: 'gaming' | 'ultrabook' | 'workstation'
  categoryLabel: string
  specs: string[]
}

export interface DeviceAvailability {
  unavailableDates: string[]
  rentalRanges: Array<{ startDate: string; endDate: string }>
}

export interface SiteContact {
  name: string
  phone: string
  email: string
  address: string
  contact: string
  website: string
  logo: string
}

export type LegalDocumentKey =
  | 'userTerms'
  | 'rentalTerms'
  | 'serviceTerms'
  | 'privacyPolicy'
  | 'softwareTerms'
  | 'copyrightNotice'
  | 'cookiePolicy'
  | 'complaintsPolicy'
  | 'acceptableUsePolicy'
  | 'consumerRights'

export interface LegalDocumentData {
  content: string
  metadata: { version: string; lastUpdatedDate: string }
  companyDetails: Record<string, unknown>
  bankDetails: Record<string, unknown>
}

export interface PublicNotice {
  id: string
  kind: 'announcement' | 'coupon'
  title: string
  message: string
  createdAt: string
  couponCode?: string
  expiresAt?: string
  couponDiscount?: string
  couponDiscountType?: 'percent' | 'fixed'
  couponDeviceId?: string
  couponBrand?: string
  couponConfigKeyword?: string
  couponBenefitZh?: string
  couponBenefitEn?: string
}

const CATEGORY_LABEL: Record<Product['category'], string> = {
  gaming: '游戏笔记本',
  ultrabook: '轻薄商务本',
  workstation: '台式工作站',
}

function categorize(row: Record<string, unknown>): Product['category'] {
  const stored = String(row.category ?? '').trim().toLowerCase()
  if (/gaming|game|游戏|电竞/.test(stored)) return 'gaming'
  if (/ultrabook|laptop|notebook|business|商务|轻薄|笔记本/.test(stored)) return 'ultrabook'
  if (/workstation|desktop|tower|台式|工作站/.test(stored)) return 'workstation'
  const hay = `${row.name ?? ''} ${row.model ?? ''} ${row.description ?? ''}`.toLowerCase()
  const gpu = String(row.gpu ?? '').toLowerCase()
  if (/desktop|workstation|tower|台式|工作站|mac ?mini|mac ?studio|imac/.test(hay)) return 'workstation'
  if (gpu && /rtx|gtx|geforce|radeon|arc a\d|rx \d{3,}/.test(gpu)) return 'gaming'
  return 'ultrabook'
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function deviceDiscount(row: Record<string, unknown>, snakeName: string, camelName: string): number {
  // rent 的 0124 migration 使用 snake_case；camelCase 仅作为旧部署兼容。
  return num(row[snakeName] ?? row[camelName])
}

function toProduct(row: Record<string, unknown>): Product {
  const category = categorize(row)
  const specs = [row.gpu, row.cpu, row.ram && `${row.ram} RAM`, row.storage]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  const statusRaw = String(row.status ?? '').toLowerCase()
  const lifecycleRaw = String(row.lifecycle_status ?? '').toUpperCase()
  // 现货 = 生命周期就绪（READY/RESERVED）；无 lifecycle 字段时退回旧 status。
  const inStock = lifecycleRaw
    ? lifecycleRaw === 'READY' || lifecycleRaw === 'RESERVED'
    : statusRaw === 'available'
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? '设备'),
    brand: String(row.brand ?? ''),
    model: String(row.model ?? ''),
    cpu: String(row.cpu ?? ''),
    ram: String(row.ram ?? ''),
    storage: String(row.storage ?? ''),
    gpu: String(row.gpu ?? ''),
    os: String(row.os ?? ''),
    pricePerDay: num(row.pricePerDay ?? row.price_per_day),
    weeklyDiscountPercent: deviceDiscount(row, 'weekly_discount_percent', 'weeklyDiscountPercent'),
    monthlyDiscountPercent: deviceDiscount(row, 'monthly_discount_percent', 'monthlyDiscountPercent'),
    depositAmount: num(row.depositAmount ?? row.deposit_amount),
    description: String(row.description ?? ''),
    available: inStock,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    specs,
  }
}

/** 全部在售（非退役）设备，按日租价升序。 */
export async function listProducts(env: Env): Promise<Product[]> {
  try {
    const { results } = await env.RENT.prepare('SELECT * FROM devices').all<Record<string, unknown>>()
    return (results ?? [])
      .filter((row) => {
        const lifecycle = String(row.lifecycle_status ?? row.lifecycleStatus ?? '').toUpperCase()
        const status = String(row.status ?? '').toLowerCase()
        return lifecycle !== 'RETIRED' && status !== 'retired'
      })
      .map(toProduct)
      .sort((a, b) => a.pricePerDay - b.pricePerDay)
  } catch {
    return []
  }
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** 公开下单页需要的设备档期；只返回不可用日期和占用区间，不暴露订单信息。 */
export async function getDeviceAvailability(
  env: Env,
  deviceIds: string[],
  bufferDays = 0,
): Promise<Record<string, DeviceAvailability>> {
  const ids = [...new Set(deviceIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 10)
  const result: Record<string, DeviceAvailability> = Object.fromEntries(
    ids.map((id) => [id, { unavailableDates: [], rentalRanges: [] }]),
  )
  await Promise.all(ids.map(async (deviceId) => {
    const availability = result[deviceId]
    try {
      const rows = await env.RENT.prepare(
        'SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ? ORDER BY unavailable_date',
      ).bind(deviceId).all<{ unavailable_date?: unknown }>()
      availability.unavailableDates = (rows.results ?? [])
        .map((row) => String(row.unavailable_date ?? '').slice(0, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    } catch {
      // 兼容尚未部署设备不可用日期表的旧数据库。
    }
    try {
      const rows = await env.RENT.prepare(
        "SELECT startDate, endDate FROM orders WHERE deviceId = ? AND status NOT IN ('completed', 'cancelled') AND startDate IS NOT NULL AND endDate IS NOT NULL ORDER BY startDate",
      ).bind(deviceId).all<{ startDate?: unknown; endDate?: unknown }>()
      availability.rentalRanges = (rows.results ?? [])
        .map((row) => ({
          startDate: String(row.startDate ?? '').slice(0, 10),
          endDate: String(row.endDate ?? '').slice(0, 10),
        }))
        .filter(({ startDate, endDate }) => /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate < endDate)
        .map(({ startDate, endDate }) => ({
          startDate: shiftDate(startDate, -Math.max(0, Math.floor(bufferDays))),
          endDate: shiftDate(endDate, Math.max(0, Math.floor(bufferDays))),
        }))
    } catch {
      // 兼容旧数据库；提交时仍会在可用的表结构上再次校验。
    }
  }))
  return result
}

/** 公开展示的最新通告与有效优惠码，不包含收件人、使用次数等内部字段。 */
const PUBLIC_UPDATE_TYPES = new Set(['agreement_update', 'policy_update', 'legal_update'])

function decodeNoticeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
}

/**
 * 协议更新通知在后台是按客户来信生成的模板（含收件人称呼、公司签名行等），
 * 直接展示在公开通告页会露出 "PC Rental | |" 这类占位符残留。这里从原始
 * 模板中只提取被更新的协议名称，重新拼出面向全体访客的公告文案。
 */
function buildPolicyUpdateNotice(raw: string): { title: string; message: string } {
  const decoded = decodeNoticeEntities(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  const match = decoded.match(/协议内容[：:]\s*([^。\n]+)/)
  const policyName = (match?.[1] || '相关条款').trim()
  const title = `${policyName}协议内容已更新`
  const message = [
    `我们已更新《${policyName}》。`,
    '',
    `最新版本已发布于本网站的相关页面，并自公布之日起生效。继续使用我们的服务，即表示您已阅读并同意更新后的《${policyName}》。`,
    '',
    '如果您不同意更新后的内容，请停止使用相关服务，并可通过联系我们获取进一步协助。',
  ].join('\n')
  return { title, message }
}

export async function listPublicNotices(env: Env, limit = 20): Promise<PublicNotice[]> {
  const notices: PublicNotice[] = []
  try {
    const queryLimit = Math.max(1, Math.min(100, limit))
    const seenNoticeKeys = new Set<string>()
    let result: { results?: Record<string, unknown>[] }
    try {
      result = await env.RENT.prepare(
        `SELECT MIN(id) AS id, type, title, message, created_at, MAX(expires_at) AS expires_at
         FROM notifications
         WHERE ((type = 'announcement' AND sender_id IS NOT NULL)
                OR type IN ('agreement_update', 'policy_update', 'legal_update'))
           AND deleted_at IS NULL
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         GROUP BY type, title, message, created_at
         ORDER BY created_at DESC
         LIMIT ?`,
      ).bind(Math.min(500, queryLimit * 20)).all<Record<string, unknown>>()
    } catch {
      // 0125 尚未应用时，回退到没有 expires_at 的旧通知表结构。
      result = await env.RENT.prepare(
        `SELECT MIN(id) AS id, type, title, message, created_at
         FROM notifications
           WHERE type IN ('announcement', 'agreement_update', 'policy_update', 'legal_update')
             AND deleted_at IS NULL
         GROUP BY type, title, message, created_at
         ORDER BY created_at DESC
         LIMIT ?`,
      ).bind(Math.min(500, queryLimit * 20)).all<Record<string, unknown>>()
    }
    for (const row of result.results ?? []) {
      const type = String(row.type ?? 'announcement')
      const isPublicUpdate = PUBLIC_UPDATE_TYPES.has(type)
      const policyInfo = isPublicUpdate ? buildPolicyUpdateNotice(String(row.message ?? '')) : null
      const title = policyInfo ? policyInfo.title : String(row.title ?? '最新通告')
      const message = policyInfo ? policyInfo.message : String(row.message ?? '')
      // Notifications are stored once per recipient. Collapse the normalized
      // copies so the public site shows one update instead of one card per user.
      const timeKey = String(row.created_at ?? '').replace('T', ' ').slice(0, 16)
      const key = `${type}|${title}|${message}|${isPublicUpdate ? timeKey : String(row.created_at ?? '')}`
      if (seenNoticeKeys.has(key)) continue
      seenNoticeKeys.add(key)
      notices.push({
        id: `announcement:${String(row.id ?? '')}`,
        kind: 'announcement',
        title,
        message,
        createdAt: String(row.created_at ?? ''),
        expiresAt: row.expires_at ? String(row.expires_at) : undefined,
      })
    }
  } catch {
    // 通知表尚未初始化时，优惠码和其他官网内容仍应正常展示。
  }
  try {
    let result: { results?: Record<string, unknown>[] }
    try {
      result = await env.RENT.prepare(
        `SELECT id, code, discount_type, discount_value, starts_at, expires_at,
                minimum_order_amount, device_id, brand, config_keyword, created_at,
                max_uses, used_count
         FROM coupons
         WHERE active = 1
           AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
           AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
           AND (max_uses IS NULL OR used_count < max_uses)
         ORDER BY created_at DESC`,
      ).all<Record<string, unknown>>()
    } catch {
      // 0050 的基础优惠码表没有后续 scope 字段，仍可安全展示基础优惠信息。
      result = await env.RENT.prepare(
        `SELECT id, code, discount_type, discount_value, starts_at, expires_at,
                created_at, max_uses, used_count
         FROM coupons
         WHERE active = 1
           AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
           AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
           AND (max_uses IS NULL OR used_count < max_uses)
         ORDER BY created_at DESC`,
      ).all<Record<string, unknown>>()
    }
    for (const row of result.results ?? []) {
      const code = String(row.code ?? '').trim().toUpperCase()
      if (!code) continue
      const discountType = String(row.discount_type ?? '') === 'percent' ? '百分比折扣' : '固定金额折扣'
      const discountValue = Number(row.discount_value ?? 0)
      const discount = discountType === '百分比折扣' ? `${discountValue}%` : `AUD$${discountValue.toFixed(2)}`
      const couponBenefitZh = discountType === '百分比折扣'
        ? `立减 ${discountValue}%`
        : `立减 ${discount}`
      const couponBenefitEn = discountType === '百分比折扣'
        ? `${discountValue}% off rental orders`
        : `${discount} off rental orders`
      const conditions = [
        row.minimum_order_amount ? `最低消费 AUD$${Number(row.minimum_order_amount).toFixed(2)}` : '',
        row.device_id ? '指定设备适用' : '',
        row.brand ? `品牌：${String(row.brand)}` : '',
        row.config_keyword ? `配置：${String(row.config_keyword)}` : '',
      ].filter(Boolean)
      notices.push({
        id: `coupon:${String(row.id ?? code)}`,
        kind: 'coupon',
        title: `优惠码 ${code}`,
        message: `新优惠码：${code}，${discountType}${discount}。${conditions.length ? `使用条件：${conditions.join('；')}。` : ''}${row.expires_at ? `有效期至 ${String(row.expires_at)}。` : ''}`,
        createdAt: String(row.created_at ?? row.starts_at ?? ''),
        couponCode: code,
        couponDiscount: discount,
        couponDiscountType: String(row.discount_type ?? '') === 'percent' ? 'percent' : 'fixed',
        couponDeviceId: row.device_id ? String(row.device_id) : undefined,
        couponBrand: row.brand ? String(row.brand) : undefined,
        couponConfigKeyword: row.config_keyword ? String(row.config_keyword) : undefined,
        couponBenefitZh,
        couponBenefitEn,
        expiresAt: row.expires_at ? String(row.expires_at) : undefined,
      })
    }
  } catch {
    // 兼容 coupons 表或较早表结构尚未部署的环境。
  }
  // 创建优惠码时，rent 还会给客户发送一条 announcement 通知；优惠码本身
  // 已由 coupons 表生成可直接选设备的卡片，避免同一优惠在横幅里重复显示为
  // 可查看详情的普通通告。
  const couponCodes = notices.filter((notice) => notice.kind === 'coupon').map((notice) => notice.couponCode || '')
  return notices.filter((notice) => !(
    notice.kind === 'announcement'
    && notice.title.includes('优惠')
    && (/优惠码|新优惠/.test(notice.message) || couponCodes.some((code) => code && notice.message.toUpperCase().includes(code)))
  ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, Math.min(100, limit)))
}

export async function getPublicNotice(env: Env, id: string): Promise<PublicNotice | null> {
  if (!id.startsWith('announcement:') && !id.startsWith('coupon:')) return null
  const notices = await listPublicNotices(env, 100)
  return notices.find((notice) => notice.id === id) ?? null
}

export function couponAppliesToProduct(notice: PublicNotice, product: Product): boolean {
  if (notice.kind !== 'coupon') return true
  const text = [product.name, product.brand, product.model, product.cpu, product.ram, product.storage, product.gpu, product.os, product.description]
    .filter(Boolean).join(' ').toLowerCase()
  return (!notice.couponDeviceId || notice.couponDeviceId === product.id)
    && (!notice.couponBrand || notice.couponBrand.trim().toLowerCase() === product.brand.trim().toLowerCase())
    && (!notice.couponConfigKeyword || text.includes(notice.couponConfigKeyword.trim().toLowerCase()))
}

/** 首页「为你精选」——每个类别取一台代表机型（优先当前可租），最多 3 张。 */
export function pickFeatured(products: Product[]): Product[] {
  const order: Product['category'][] = ['gaming', 'ultrabook', 'workstation']
  const chosen: Product[] = []
  for (const cat of order) {
    const inCat = products.filter((p) => p.category === cat)
    const pick = inCat.find((p) => p.available) ?? inCat[0]
    if (pick) chosen.push(pick)
  }
  if (chosen.length < 3) {
    for (const p of products) {
      if (chosen.length >= 3) break
      if (!chosen.includes(p)) chosen.push(p)
    }
  }
  return chosen.slice(0, 3)
}

/** 周租/月租优惠折算后的最低有效日租价——用于首页起价文案。无数据时返回 0。 */
export function minDailyRate(products: Product[]): number {
  const rates = products.flatMap((p) => [
    p.pricePerDay,
    weeklyDailyRate(p.pricePerDay, p.weeklyDiscountPercent),
    monthlyDailyRate(p.pricePerDay, p.monthlyDiscountPercent),
  ]).filter((n) => n > 0)
  return rates.length ? Math.min(...rates) : 0
}

/** 联系方式：systemSettings.companyDetails，环境变量可覆盖，最后回落到参考稿默认值。 */
export async function getSiteContact(env: Env): Promise<SiteContact> {
  const fallback: SiteContact = {
    name: 'GeekSlope',
    phone: '400-888-0000',
    email: 'hello@geekslope.com',
    address: '送货：墨尔本 CBD 及周边地区 · 其他郊区到店自取',
    contact: '',
    website: '',
    logo: '',
  }
  try {
    const row = await env.RENT.prepare(
      `SELECT value FROM systemSettings WHERE key = 'companyDetails'`,
    ).first<{ value: string }>()
    if (row?.value) {
      const parsed = JSON.parse(row.value) as Record<string, string>
      if (parsed.name) fallback.name = parsed.name
      if (parsed.phone) fallback.phone = parsed.phone
      if (parsed.email) fallback.email = parsed.email
      if (parsed.address) fallback.address = parsed.address
      if (parsed.contact) fallback.contact = parsed.contact
      if (parsed.website) fallback.website = parsed.website
      if (parsed.logo) fallback.logo = parsed.logo
    }
  } catch {
    /* 表缺失或 JSON 损坏时用 fallback */
  }
  if (env.CONTACT_PHONE) fallback.phone = env.CONTACT_PHONE
  if (env.CONTACT_EMAIL) fallback.email = env.CONTACT_EMAIL
  return fallback
}

export function weeklyDailyRate(pricePerDay: number, discountPercent: number): number {
  return Number((pricePerDay * (1 - Math.min(100, Math.max(0, discountPercent)) / 100)).toFixed(2))
}

export function weeklyRentalRate(pricePerDay: number, discountPercent: number): number {
  return Number((weeklyDailyRate(pricePerDay, discountPercent) * 7).toFixed(2))
}

export function monthlyDailyRate(pricePerDay: number, discountPercent: number): number {
  return Number((pricePerDay * (1 - Math.min(100, Math.max(0, discountPercent)) / 100)).toFixed(2))
}

export function monthlyRentalRate(pricePerDay: number, discountPercent: number): number {
  return Math.round(pricePerDay * 30 * (1 - Math.min(100, Math.max(0, discountPercent)) / 100))
}

export interface RentalConfig {
  minimumRentalDays: number
  bufferDays: number
  unavailableDates: string[]
  unavailableTimeSlots: Record<string, string[]>
  pickupLocations: string[]
  deliveryAreas: string[]
  deliveryNote: string
}

/** 下单与说明页需要的租赁规则。均来自 systemSettings，缺失时给安全默认值。 */
export async function getRentalConfig(env: Env): Promise<RentalConfig> {
  const cfg: RentalConfig = {
    minimumRentalDays: 1,
    bufferDays: 0,
    unavailableDates: [],
    unavailableTimeSlots: {},
    pickupLocations: [],
    deliveryAreas: ['墨尔本 CBD', 'Docklands', 'Southbank', 'South Yarra', 'Carlton', 'East Melbourne'],
    deliveryNote: '送货上门仅限墨尔本 CBD 及周边地区，运费由客服在审核时确认。',
  }
  try {
    const rows = await env.RENT.prepare(
      `SELECT key, value FROM systemSettings WHERE key IN ('rentalRules', 'companyDetails')`,
    ).all<{ key: string; value: string }>()
    for (const row of rows.results ?? []) {
      const parsed = JSON.parse(row.value || '{}') as Record<string, unknown>
      if (row.key === 'rentalRules') {
        if (Number(parsed.minimumRentalDays) > 0) {
          cfg.minimumRentalDays = Math.floor(Number(parsed.minimumRentalDays))
        }
        if (Number(parsed.bufferDays) >= 0) {
          cfg.bufferDays = Math.floor(Number(parsed.bufferDays))
        }
        if (Array.isArray(parsed.unavailableDates)) {
          cfg.unavailableDates = [...new Set(
            parsed.unavailableDates
              .map((value) => String(value).trim())
              .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
          )]
        }
        if (parsed.unavailableTimeSlots && typeof parsed.unavailableTimeSlots === 'object' && !Array.isArray(parsed.unavailableTimeSlots)) {
          cfg.unavailableTimeSlots = Object.fromEntries(
            Object.entries(parsed.unavailableTimeSlots)
              .filter(([date, slots]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(slots))
              .map(([date, slots]) => [date, (slots as unknown[]).map((slot) => String(slot)).filter(Boolean)]),
          )
        }
      }
      if (row.key === 'companyDetails' && Array.isArray(parsed.pickupLocations)) {
        cfg.pickupLocations = [...new Set(
          parsed.pickupLocations.map((value) => String(value).trim()).filter(Boolean),
        )]
      }
      if (row.key === 'companyDetails' && Array.isArray(parsed.deliveryAreas)) {
        cfg.deliveryAreas = [...new Set(
          parsed.deliveryAreas.map((value) => String(value).trim()).filter(Boolean),
        )]
      }
      if (row.key === 'companyDetails' && typeof parsed.deliveryNote === 'string' && parsed.deliveryNote.trim()) {
        cfg.deliveryNote = parsed.deliveryNote.trim()
      }
    }
  } catch {
    /* 用默认值 */
  }
  return cfg
}

/** 公开法务文档及其模板变量，数据结构与 rent 的公开法务页面保持一致。 */
export async function getLegalDocument(
  env: Env,
  documentKey: LegalDocumentKey,
  metadataKey: string,
): Promise<LegalDocumentData> {
  const data: LegalDocumentData = {
    content: '',
    metadata: { version: '1.0', lastUpdatedDate: '' },
    companyDetails: {},
    bankDetails: {},
  }
  try {
    const rows = await env.RENT.prepare(
      `SELECT key, value FROM systemSettings
       WHERE key IN (?, 'legalMetadata', 'companyDetails', 'bankDetails')`,
    )
      .bind(documentKey)
      .all<{ key: string; value: string }>()

    for (const row of rows.results ?? []) {
      if (row.key === documentKey) {
        data.content = String(row.value ?? '').trim()
        continue
      }
      const parsed = JSON.parse(row.value || '{}') as Record<string, unknown>
      if (row.key === 'companyDetails') data.companyDetails = parsed
      if (row.key === 'bankDetails') data.bankDetails = parsed
      if (row.key === 'legalMetadata') {
        const metadata = parsed[metadataKey]
        if (metadata && typeof metadata === 'object') {
          const record = metadata as Record<string, unknown>
          data.metadata = {
            version: String(record.version || '1.0'),
            lastUpdatedDate: String(record.lastUpdatedDate || ''),
          }
        }
      }
    }
  } catch {
    /* 表缺失、JSON 损坏或查询失败时由页面显示中性兜底。 */
  }
  return data
}
