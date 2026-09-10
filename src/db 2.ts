// 实时数据访问层。营销站只读 rent 的 D1 库（binding: RENT）：
//   - devices        —— 产品名称 / 配置 / 日租价 / 押金 / 状态
//   - systemSettings  —— companyDetails（公司名、电话、邮箱、地址）
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
    depositAmount: num(row.depositAmount ?? row.deposit_amount),
    description: String(row.description ?? ''),
    available: inStock,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    specs,
  }
}

const DEVICE_COLUMNS =
  'id, name, brand, model, cpu, ram, storage, gpu, os, pricePerDay, depositAmount, description, status, lifecycle_status'

/** 全部在售（非退役）设备，按日租价升序。 */
export async function listProducts(env: Env): Promise<Product[]> {
  try {
    const { results } = await env.RENT.prepare(
      `SELECT ${DEVICE_COLUMNS} FROM devices
       WHERE COALESCE(lifecycle_status, status, '') NOT IN ('RETIRED', 'retired')
       ORDER BY pricePerDay ASC`,
    ).all<Record<string, unknown>>()
    return (results ?? []).map(toProduct)
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
  const rates = products.map((p) => p.pricePerDay).filter((n) => n > 0)
  return rates.length ? Math.min(...rates) : 0
}

/** 联系方式：systemSettings.companyDetails，环境变量可覆盖，最后回落到参考稿默认值。 */
export async function getSiteContact(env: Env): Promise<SiteContact> {
  const fallback: SiteContact = {
    name: 'GeekSlope',
    phone: '400-888-0000',
    email: 'hello@geekslope.com',
    address: '送货：墨尔本 CBD 及内城区 · 其他郊区到店自取',
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
    }
  } catch {
    /* 表缺失或 JSON 损坏时用 fallback */
  }
  if (env.CONTACT_PHONE) fallback.phone = env.CONTACT_PHONE
  if (env.CONTACT_EMAIL) fallback.email = env.CONTACT_EMAIL
  return fallback
}

export function monthlyRate(pricePerDay: number, multiplier: number): number {
  return Math.round(pricePerDay * multiplier)
}
