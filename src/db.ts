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

const CATEGORY_LABEL: Record<Product['category'], string> = {
  gaming: '游戏笔记本',
  ultrabook: '轻薄商务本',
  workstation: '台式工作站',
}

function categorize(row: Record<string, unknown>): Product['category'] {
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
    weeklyDiscountPercent: num(row.weeklyDiscountPercent ?? row.weekly_discount_percent),
    monthlyDiscountPercent: num(row.monthlyDiscountPercent ?? row.monthly_discount_percent),
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

/** 「最低 $X/day」——用于标题与 hero 文案。无数据时返回 0。 */
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
  return Number((pricePerDay * 30 * (1 - Math.min(100, Math.max(0, discountPercent)) / 100) / 30).toFixed(2))
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
