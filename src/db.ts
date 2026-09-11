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

// ── 法律 / 合规文档 ──────────────────────────────────────────────────
// 全部存于 rent 的 systemSettings 表，管理员在 rent 后台维护（迁移 0114 / 0115
// 植入澳大利亚合规默认文本）。营销站只读渲染：取 HTML → 填充 {company_*} 与版本
// 占位符 → 轻量清洗后原样输出。文档为空（尚未发布）时返回 null，由路由回落。

export interface LegalDoc {
  html: string
  version: string
  lastUpdated: string
}

export interface LegalDocQuery {
  key: string // systemSettings 键，如 'serviceTerms'
  metaKey: string // legalMetadata 下的键，如 'service'
  varPrefix: string // 生成 `${prefix}_version` / `${prefix}_last_updated_date`
}

interface CompanyDetails {
  name: string
  abn: string
  address: string
  phone: string
  email: string
  website: string
}

function parseJsonObject(v: unknown): Record<string, unknown> {
  try {
    const o = JSON.parse(String(v ?? '') || '{}')
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function escVal(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 只取展示所需的公司字段，缺失回落到 GeekSlope 默认值。 */
function readCompanyDetails(row: { value: string } | undefined): CompanyDetails {
  const p = parseJsonObject(row?.value)
  return {
    name: String(p.name ?? 'GeekSlope'),
    abn: String(p.abn ?? ''),
    address: String(p.address ?? ''),
    phone: String(p.phone ?? ''),
    email: String(p.email ?? 'hello@geekslope.com'),
    website: String(p.website ?? ''),
  }
}

/** 极简 HTML 清洗：去掉脚本类标签、事件属性与 javascript: 链接。 */
function scrubHtml(html: string): string {
  let current = html
  let previous: string
  do {
    previous = current
    current = current
      .replace(/<\s*(script|iframe|object|embed|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|iframe|object|embed|style)\b[^>]*\/?\s*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/((?:href|src)\s*=\s*)("|')\s*javascript:[^"']*\2/gi, '$1$2#$2')
  } while (current !== previous)
  return current
}

/**
 * 读取单个法律文档并完成占位符填充。返回 null 表示管理员尚未发布该文档。
 */
export async function getLegalDoc(env: Env, q: LegalDocQuery): Promise<LegalDoc | null> {
  let rawHtml = ''
  let company = readCompanyDetails(undefined)
  let meta = { version: '1.0', lastUpdatedDate: '' }
  try {
    const { results } = await env.RENT.prepare(
      `SELECT key, value FROM systemSettings WHERE key IN (?, 'legalMetadata', 'companyDetails')`,
    )
      .bind(q.key)
      .all<{ key: string; value: string }>()
    const byKey = new Map((results ?? []).map((r) => [r.key, r]))
    rawHtml = String(byKey.get(q.key)?.value ?? '').trim()
    company = readCompanyDetails(byKey.get('companyDetails'))
    const m = parseJsonObject(byKey.get('legalMetadata')?.value)[q.metaKey]
    if (m && typeof m === 'object') {
      const mm = m as Record<string, unknown>
      meta = {
        version: String(mm.version ?? '1.0'),
        lastUpdatedDate: String(mm.lastUpdatedDate ?? ''),
      }
    }
  } catch {
    return null
  }
  if (!rawHtml) return null

  if (env.CONTACT_PHONE) company.phone = env.CONTACT_PHONE
  if (env.CONTACT_EMAIL) company.email = env.CONTACT_EMAIL

  const vars: Record<string, string> = {
    company_name: company.name,
    company_abn: company.abn,
    company_address: company.address,
    company_phone: company.phone,
    company_email: company.email,
    company_website: company.website,
    [`${q.varPrefix}_version`]: meta.version,
    [`${q.varPrefix}_last_updated_date`]: meta.lastUpdatedDate,
    last_updated_date: meta.lastUpdatedDate,
  }
  const filled = Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\$\\{${k}\\}|\\{${k}\\}`, 'g'), escVal(v)),
    rawHtml,
  )
  return { html: scrubHtml(filled), version: meta.version, lastUpdated: meta.lastUpdatedDate }
}

export interface RentalConfig {
  minimumRentalDays: number
  pickupLocations: string[]
}

/** 下单表单需要的规则：最短租期、可选自取点。均来自 systemSettings，缺失时给安全默认值。 */
export async function getRentalConfig(env: Env): Promise<RentalConfig> {
  const cfg: RentalConfig = { minimumRentalDays: 1, pickupLocations: [] }
  try {
    const rows = await env.RENT.prepare(
      `SELECT key, value FROM systemSettings WHERE key IN ('rentalRules', 'companyDetails')`,
    ).all<{ key: string; value: string }>()
    for (const row of rows.results ?? []) {
      const parsed = JSON.parse(row.value || '{}') as Record<string, unknown>
      if (row.key === 'rentalRules' && Number(parsed.minimumRentalDays) > 0) {
        cfg.minimumRentalDays = Math.floor(Number(parsed.minimumRentalDays))
      }
      if (row.key === 'companyDetails' && Array.isArray(parsed.pickupLocations)) {
        cfg.pickupLocations = (parsed.pickupLocations as unknown[]).map((s) => String(s)).filter(Boolean)
      }
    }
  } catch {
    /* 用默认值 */
  }
  return cfg
}
