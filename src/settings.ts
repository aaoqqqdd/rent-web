// 共享的「后台系统设置」读取 / 解密工具。
//
// rent 后台（/admin/api-settings）把第三方 API 配置写在共享 D1 的
// `systemSettings` 表里：site key / publishable key 等可公开字段明文保存，
// secret 用 AES-GCM 加密（密钥 = SHA-256(SETTINGS_ENCRYPTION_KEY)），
// 格式为 `base64(iv).base64(ciphertext)`。rent-web 与 rent 使用同一个
// SETTINGS_ENCRYPTION_KEY，因此可以直接解密同一行配置。
//
// 约定：读取类失败一律「软失败」（返回 null / 空串），由调用方决定回退策略；
// 公开页面不能因为一个可选配置读不到就 500。

import type { Context } from 'hono'
import type { Env } from './index'

export type SettingsContext = Context<{ Bindings: Env }>

/** 清理配置字符串：去空白、限长。 */
export function cleanSetting(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  return new Uint8Array(Array.from(binary, (character) => character.charCodeAt(0)))
}

async function encryptionKey(c: SettingsContext): Promise<CryptoKey> {
  const master = cleanSetting(c.env.SETTINGS_ENCRYPTION_KEY, 500)
  if (!master) throw new Error('SETTINGS_ENCRYPTION_KEY is not configured')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
}

/** 解密后台保存的 secret；密钥缺失 / 换过 key / 数据损坏都返回空串。 */
export async function decryptSetting(c: SettingsContext, value: unknown): Promise<string> {
  const stored = cleanSetting(value, 4000)
  if (!stored) return ''
  try {
    const [iv, ciphertext] = stored.split('.')
    if (!iv || !ciphertext) return ''
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) },
      await encryptionKey(c),
      base64ToBytes(ciphertext),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return ''
  }
}

/** 读取以 JSON 保存的 systemSettings 行；表缺失 / JSON 损坏都返回 null。 */
export async function readJsonSetting(c: SettingsContext, key: string): Promise<Record<string, unknown> | null> {
  try {
    const row = await c.env.RENT.prepare('SELECT value FROM systemSettings WHERE key = ?')
      .bind(key)
      .first<{ value?: string }>()
    if (!row?.value) return null
    const parsed: unknown = JSON.parse(row.value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}
