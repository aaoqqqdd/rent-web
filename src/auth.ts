// 官网侧登录 / 会话。复用 rent 的共享 D1（binding: RENT）：
//   - users               —— 校验邮箱/手机号 + 密码（PBKDF2，算法与 rent 完全一致）
//   - auth_sessions       —— 会话表（token 只存 SHA-256 摘要），rent 与官网共用同一套
//   - sso_handoff_tokens  —— 一次性跨域握手 token：官网签发、rent 的 /sso/consume 消费
//   - security_rate_limits —— 登录限流（与 rent 共用；缺表时放行）
// 官网只写 auth_sessions / sso_handoff_tokens，不碰 users 等业务表。

import type { Context } from 'hono'
import type { Env } from './index'

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
