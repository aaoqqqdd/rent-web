// 注册写库层。营销站的 /login 页「注册」表单直接写 rent 的 D1 `users` 表，
// 口令哈希 / ID 规则 / 字段与 rent 主应用完全一致（见 ../rent：src/lib/password.ts、
// src/lib/userId.ts、src/db/repositories.ts insertUser），注册后即可用同一套
// 邮箱 + 密码在 rent 登录。登录态仍由 rent 持有，本站只负责建号。

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

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
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
