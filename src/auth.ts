// 官网账户层：注册直接写共享 users 表；登录 / 会话复用共享 D1。
// 注册写库层。营销站的 /login 页「注册」表单直接写 rent 的 D1 `users` 表，
// 口令哈希 / ID 规则 / 字段与 rent 主应用完全一致（见 ../rent：src/lib/password.ts、
// src/lib/userId.ts、src/db/repositories.ts insertUser），注册后即可用同一套
// 邮箱 + 密码在 rent 登录。登录态仍由 rent 持有，本站只负责建号。

import type { Context } from 'hono'
import type { Env } from './index'

const PBKDF2_ITERATIONS = 100000

/** 与 rent src/lib/password.ts generateSalt 一致：16 字节随机 → hex。 */
function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 与 rent hashPassword 逐字节一致：`pbkdf2$100000$<salt>$<hash>`，rent 登录可直接校验。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  const hash = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`
}

/** 与 rent isStrongPassword 一致：>=8 位且同时含字母、数字、符号，无空白。 */
export function isStrongPassword(password: unknown): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/.test(String(password ?? ''))
}

/**
 * 纯文本字段清洗：直接删除尖括号与控制字符（单遍、幂等），再 trim + 截断。
 * 这些值只入库、不作 HTML 渲染；删字符而非匹配标签，避免 `<sc<script>ript>`
 * 一类嵌套残留（CodeQL: incomplete multi-character sanitization）。
 */
export function sanitizePlainText(value: unknown, maxLength = 500): string {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength)
}

/** 与 rent generateUserId('CUSTOMER') 一致：`US-` + 8 位数字。 */
function generateUserId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `US-${Array.from(bytes, (b) => String(b % 10)).join('')}`
}

async function generateUniqueUserId(env: Env): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const id = generateUserId()
    const existing = await env.RENT.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!existing) return id
  }
  throw new Error('无法生成唯一用户 ID，请稍后重试')
}

/** 同 rent 全局限流：共用 D1 的 security_rate_limits 表，按小时窗口计数。 */
async function underRateLimit(env: Env, clientKey: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    await env.RENT.prepare(
      `CREATE TABLE IF NOT EXISTS security_rate_limits (
         scope TEXT NOT NULL, client_key TEXT NOT NULL, bucket INTEGER NOT NULL,
         request_count INTEGER NOT NULL DEFAULT 1,
         PRIMARY KEY(scope, client_key, bucket))`,
    ).run()
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
    const key = clientKey.slice(0, 200)
    await env.RENT.prepare(
      `INSERT INTO security_rate_limits (scope, client_key, bucket, request_count)
       VALUES ('web-register', ?, ?, 1)
       ON CONFLICT(scope, client_key, bucket) DO UPDATE SET request_count = request_count + 1`,
    ).bind(key, bucket).run()
    const row = await env.RENT.prepare(
      `SELECT request_count FROM security_rate_limits WHERE scope = 'web-register' AND client_key = ? AND bucket = ?`,
    ).bind(key, bucket).first<{ request_count: number }>()
    return Number(row?.request_count ?? 0) <= limit
  } catch {
    return true // 限流表不可用时不拦截注册
  }
}

export async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY || ''
  if (!secret) return true // 未配置 secret 时放行（与 rent 公开接口一致）
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    })
    const data = (await res.json()) as { success?: boolean }
    return Boolean(data.success)
  } catch {
    return false
  }
}

export interface RegisterInput {
  name?: unknown
  email?: unknown
  phone?: unknown
  password?: unknown
  passwordConfirm?: unknown
  /** 邀请码（选填），对应 rent /register 的 `referrer` 字段。 */
  referral?: unknown
  agree?: unknown
  turnstileToken?: unknown
}

/** 与 rent 一致：邀请码大写、截断 10 位。 */
function normalizeReferral(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().slice(0, 10)
}

/**
 * 镜像 rent lockReferralRelationship 的核心：写 referral_codes + referrals + 审计日志。
 * 奖励发放（referral_rewards）仍由 rent 在被推荐人首单时处理。相关表不存在时静默跳过。
 */
async function lockReferral(env: Env, referrerId: string, refereeId: string, code: string): Promise<void> {
  if (!referrerId || referrerId === refereeId) return
  try {
    const referrer = await env.RENT.prepare('SELECT referral_code FROM users WHERE id = ?').bind(referrerId).first<{ referral_code: string | null }>()
    if (!referrer) return
    const referralCode = (code || referrer.referral_code || '').trim().toUpperCase()
    let codeId: string | null = null
    if (referralCode) {
      await env.RENT.prepare(
        `INSERT OR IGNORE INTO referral_codes (id, customer_id, code, status) VALUES (?, ?, ?, 'ACTIVE')`,
      ).bind(`rfc-${crypto.randomUUID()}`, referrerId, referralCode).run()
      const row = await env.RENT.prepare(
        `SELECT id FROM referral_codes WHERE code = ? AND status = 'ACTIVE'`,
      ).bind(referralCode).first<{ id: string }>()
      codeId = row?.id ?? null
    }
    const existing = await env.RENT.prepare('SELECT id FROM referrals WHERE referee_customer_id = ?').bind(refereeId).first()
    if (existing) return
    const id = `ref-${crypto.randomUUID()}`
    const refNo = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    await env.RENT.batch([
      env.RENT.prepare(
        `INSERT INTO referrals (id, referral_number, referrer_customer_id, referee_customer_id, referral_code_id, status, attributed_at, registered_at)
         VALUES (?, ?, ?, ?, ?, 'REGISTERED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ).bind(id, refNo, referrerId, refereeId, codeId),
      env.RENT.prepare(
        `INSERT INTO referral_audit_logs (id, referral_id, action, metadata) VALUES (?, ?, 'REGISTERED', ?)`,
      ).bind(`rfa-${crypto.randomUUID()}`, id, JSON.stringify({ source: 'web-registration' })),
    ])
  } catch {
    /* 推荐计划相关表缺失 / 并发时跳过，不影响注册 */
  }
}

export interface RegisterResult {
  ok: boolean
  message: string
  /** 机器可读结果码，前端据此决定跳转登录还是留在表单。 */
  code: 'created' | 'exists' | 'invalid' | 'rate_limited' | 'turnstile' | 'error'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 注册一个 CUSTOMER 账号，直接写 rent 的 D1。字段与 rent /register 落库结果等价：
 * users(id, name, email, phone, password_hash, password_salt='v2', role='CUSTOMER',
 * status='active', balance=0, commission_balance=0, created_at, updated_at) +
 * 协议确认列（尽力而为）。users_old 镜像由 D1 触发器自动完成。
 */
export async function registerCustomer(env: Env, input: RegisterInput, ip: string): Promise<RegisterResult> {
  const name = sanitizePlainText(input.name, 100)
  const email = sanitizePlainText(input.email, 254).toLowerCase()
  const phone = sanitizePlainText(input.phone, 40)
  const password = String(input.password ?? '')
  const passwordConfirm = String(input.passwordConfirm ?? '')

  if (!name || !email || !password || !passwordConfirm) {
    return { ok: false, code: 'invalid', message: '请填写姓名、邮箱和密码。' }
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, code: 'invalid', message: '邮箱格式不正确。' }
  }
  if (password !== passwordConfirm) {
    return { ok: false, code: 'invalid', message: '两次输入的密码不一致。' }
  }
  if (!isStrongPassword(password)) {
    return { ok: false, code: 'invalid', message: '密码至少 8 位，且同时包含字母、数字和符号。' }
  }
  if (!input.agree) {
    return { ok: false, code: 'invalid', message: '请先阅读并同意服务条款与隐私政策。' }
  }

  if (!(await verifyTurnstile(env, String(input.turnstileToken ?? ''), ip))) {
    return { ok: false, code: 'turnstile', message: '人机验证未通过，请重试。' }
  }

  if (!(await underRateLimit(env, ip || 'unknown', 5, 3600))) {
    return { ok: false, code: 'rate_limited', message: '注册请求过于频繁，请稍后再试。' }
  }

  const referralCode = normalizeReferral(input.referral)

  try {
    const existing = await env.RENT.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return { ok: false, code: 'exists', message: '该邮箱已注册，请直接登录。' }
    }

    // 邀请码：与 rent 一致，按 users.referral_code 匹配，无效则拒绝注册。
    let referrerId: string | null = null
    if (referralCode) {
      const referrer = await env.RENT.prepare(
        'SELECT id FROM users WHERE UPPER(referral_code) = ?',
      ).bind(referralCode).first<{ id: string }>()
      if (!referrer) {
        return { ok: false, code: 'invalid', message: '邀请码无效。' }
      }
      referrerId = referrer.id
    }

    const id = await generateUniqueUserId(env)
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    await env.RENT.prepare(
      `INSERT INTO users
         (id, name, email, phone, password_hash, password_salt, role, status, balance, commission_balance, referrer_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'v2', 'CUSTOMER', 'active', 0, 0, ?, ?, ?)`,
    )
      .bind(id, name, email, phone || null, passwordHash, referrerId, now, now)
      .run()

    if (referrerId) await lockReferral(env, referrerId, id, referralCode)

    // 协议确认记录：列可能不存在（旧库），尽力而为，失败不影响注册结果。
    try {
      const acceptedIp = (ip || '').slice(0, 64) || null
      await env.RENT.prepare(
        `UPDATE users SET
           user_agreement_accepted = 1, user_agreement_version = '1.0',
           user_agreement_accepted_at = ?, user_agreement_accepted_ip = ?,
           service_terms_accepted = 1, service_terms_version = '1.0',
           service_terms_accepted_at = ?, service_terms_accepted_ip = ?,
           privacy_policy_accepted = 1, privacy_policy_version = '1.0',
           privacy_policy_accepted_at = ?
         WHERE id = ?`,
      )
        .bind(now, acceptedIp, now, acceptedIp, now, id)
        .run()
    } catch {
      /* 协议确认列不存在时跳过 */
    }

    return { ok: true, code: 'created', message: '账号创建成功，请使用该邮箱和密码登录。' }
  } catch (err) {
    console.error('web register failed:', err instanceof Error ? err.message : String(err))
    return { ok: false, code: 'error', message: '注册失败，请稍后重试或直接联系客服。' }
  }
}
// 官网侧登录 / 会话。复用 rent 的共享 D1（binding: RENT）：
//   - users               —— 校验邮箱/手机号 + 密码（PBKDF2，算法与 rent 完全一致）
//   - auth_sessions       —— 会话表（token 只存 SHA-256 摘要），rent 与官网共用同一套
//   - sso_handoff_tokens  —— 一次性跨域握手 token：官网签发、rent 的 /sso/consume 消费
//   - security_rate_limits —— 登录限流（与 rent 共用；缺表时放行）
// 官网只写 auth_sessions / sso_handoff_tokens，不碰 users 等业务表。

const SESSION_COOKIE = 'session'
const SESSION_MAX_AGE = 60 * 60 * 12 // 12h，与 rent 非「记住我」默认一致
const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30 // 30d
const HANDOFF_TTL_SECONDS = 60 // 一次性握手 token 存活 60s，用一次即废

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return out
}

export function hasSessionCookie(header: string | null): boolean {
  return Boolean(parseCookies(header)[SESSION_COOKIE])
}

let schemaReady: Promise<void> | null = null
function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = env.RENT.batch([
      env.RENT.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      env.RENT.prepare(`CREATE TABLE IF NOT EXISTS sso_handoff_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
    ])
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null
        throw err
      })
  }
  return schemaReady
}

// 密码校验：逐字节移植自 rent/src/lib/password.ts，务必与 rent 保持一致。
// 新格式 `pbkdf2$<iterations>$<salt>$<hash>`；旧格式 `<salt>$<hash>`，hash = SHA-256(password + salt)。
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    const [, iterationText, salt, expected] = storedHash.split('$')
    const iterations = Number(iterationText)
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100000 || !salt || !expected) return false
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
      key,
      256,
    )
    const actual = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
    if (actual.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
    return diff === 0
  }
  const parts = storedHash.split('$')
  if (parts.length !== 2) return false
  const [salt, hash] = parts
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + salt))
  const actual = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return actual === hash
}

// D1 分桶限流，移植自 rent/src/auth/session.ts。限流表缺失时放行，避免误伤登录。
export async function enforceRateLimit(
  env: Env,
  scope: string,
  clientKey: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const key = clientKey.slice(0, 200)
  try {
    await env.RENT.prepare(
      `INSERT INTO security_rate_limits (scope, client_key, bucket, request_count) VALUES (?, ?, ?, 1)
       ON CONFLICT(scope, client_key, bucket) DO UPDATE SET request_count = request_count + 1`,
    )
      .bind(scope, key, bucket)
      .run()
    const row = await env.RENT.prepare(
      'SELECT request_count FROM security_rate_limits WHERE scope = ? AND client_key = ? AND bucket = ?',
    )
      .bind(scope, key, bucket)
      .first<{ request_count: number }>()
    return Number(row?.request_count || 0) <= limit
  } catch {
    return true
  }
}

// 邮箱或手机号 + 密码 → 已激活的正式用户。访客 / 已删除账户一律拒绝。
export async function verifyCredentials(env: Env, account: string, password: string): Promise<SessionUser | null> {
  const acc = account.trim().slice(0, 254)
  if (!acc || !password) return null
  let row: Record<string, unknown> | null = null
  try {
    row = await env.RENT.prepare(
      `SELECT id, name, email, role, status, account_type, password, password_hash, password_salt
       FROM users WHERE lower(email) = lower(?) OR phone = ? LIMIT 1`,
    )
      .bind(acc, acc)
      .first<Record<string, unknown>>()
  } catch {
    return null
  }
  if (!row) return null
  if (String(row.status ?? '') !== 'active') return null
  if (String(row.account_type ?? 'formal') !== 'formal') return null
  const rawHash = String(row.password_hash ?? row.password ?? '')
  if (!rawHash || rawHash === 'disabled') return null
  const salt = String(row.password_salt ?? '')
  const stored = rawHash.startsWith('pbkdf2$') ? rawHash : `${salt}$${rawHash}`
  if (!(await verifyPassword(password, stored))) return null
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    role: String(row.role ?? ''),
  }
}

// 读官网当前会话对应的用户。token 非法 / 过期 / 用户停用都返回 null。
export async function currentUser(c: Context<{ Bindings: Env }>): Promise<SessionUser | null> {
  const token = parseCookies(c.req.header('cookie') ?? null)[SESSION_COOKIE] || ''
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return null
  try {
    await ensureSchema(c.env)
    const row = await c.env.RENT.prepare(
      `SELECT u.id, u.name, u.email, u.role
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
         AND u.status = 'active' AND u.account_type = 'formal' LIMIT 1`,
    )
      .bind(await sha256Hex(token))
      .first<Record<string, unknown>>()
    if (!row) return null
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      email: String(row.email ?? ''),
      role: String(row.role ?? ''),
    }
  } catch {
    return null
  }
}

export async function createSession(env: Env, userId: string, remember: boolean): Promise<{ token: string; maxAge: number }> {
  await ensureSchema(env)
  const token = randomToken()
  const maxAge = remember ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()
  await env.RENT.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), userId, expiresAt)
    .run()
  return { token, maxAge }
}

// 登出：撤销该用户在所有设备 / 两个站点上的会话（单处登出 = 处处登出）。
export async function destroySession(c: Context<{ Bindings: Env }>): Promise<void> {
  const token = parseCookies(c.req.header('cookie') ?? null)[SESSION_COOKIE] || ''
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return
  try {
    await ensureSchema(c.env)
    const hash = await sha256Hex(token)
    const row = await c.env.RENT.prepare('SELECT user_id FROM auth_sessions WHERE token_hash = ?')
      .bind(hash)
      .first<{ user_id: string }>()
    if (row?.user_id) {
      await c.env.RENT.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(String(row.user_id)).run()
    } else {
      await c.env.RENT.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(hash).run()
    }
  } catch {
    /* 忽略：登出尽力而为 */
  }
}

// 签发一次性跨域握手 token，交给 rent 的 /sso/consume 换取 rent 域的会话 cookie。
export async function issueHandoffToken(env: Env, userId: string): Promise<string> {
  await ensureSchema(env)
  const token = randomToken()
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString()
  await env.RENT.prepare('INSERT INTO sso_handoff_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), userId, expiresAt)
    .run()
  return token
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
