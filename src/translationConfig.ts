/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

export type TranslationProvider = 'deepl' | 'google'
interface StoredTranslationConfig {
  enabled?: boolean; provider?: TranslationProvider; deeplPlan?: 'free' | 'pro'
  deeplApiKey?: string; googleApiKey?: string; dailyByteLimit?: number
}

async function readConfig(c: Context): Promise<StoredTranslationConfig> {
  const row = await c.env.RENT.prepare("SELECT value FROM systemSettings WHERE key = 'translationConfig' AND deleted_at IS NULL").first() as { value: string } | null
  if (!row) return {}
  return JSON.parse(row.value)
}

async function cryptKey(c: Context) {
  const master = String(c.env.SETTINGS_ENCRYPTION_KEY || '')
  if (!master) throw new Error('尚未配置 SETTINGS_ENCRYPTION_KEY')
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master)), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
const encode = (data: Uint8Array) => btoa(Array.from(data, byte => String.fromCharCode(byte)).join(''))
const decode = (data: string) => new Uint8Array(Array.from(atob(data), char => char.charCodeAt(0)))
async function encrypt(c: Context, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return `${encode(iv)}.${encode(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptKey(c), new TextEncoder().encode(value))))}`
}
async function decrypt(c: Context, value?: string) {
  if (!value) return ''
  try {
    const [iv, data] = value.split('.')
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await cryptKey(c), decode(data)))
  } catch { return '' }
}

export async function getTranslationConfig(c: Context) {
  const config = await readConfig(c)
  return {
    enabled: config.enabled === true,
    provider: config.provider === 'google' ? 'google' as const : 'deepl' as const,
    deeplPlan: config.deeplPlan === 'pro' ? 'pro' as const : 'free' as const,
    dailyByteLimit: config.dailyByteLimit ?? 100000,
    deeplApiKey: await decrypt(c, config.deeplApiKey),
    googleApiKey: await decrypt(c, config.googleApiKey),
  }
}

export async function getTranslationConfigSummary(c: Context) {
  const config = await getTranslationConfig(c)
  const mask = (key: string) => key ? `••••${key.slice(-4)}` : ''
  return { enabled: config.enabled, provider: config.provider, deeplPlan: config.deeplPlan, dailyByteLimit: config.dailyByteLimit,
    deeplConfigured: Boolean(config.deeplApiKey), googleConfigured: Boolean(config.googleApiKey),
    deeplApiKeyMasked: mask(config.deeplApiKey), googleApiKeyMasked: mask(config.googleApiKey) }
}

export async function saveTranslationConfig(c: Context, input: Record<string, unknown>) {
  const current = await readConfig(c)
  const provider = input.provider ?? current.provider ?? 'deepl'
  const deeplPlan = input.deeplPlan ?? current.deeplPlan ?? 'free'
  const dailyByteLimit = Number(input.dailyByteLimit ?? current.dailyByteLimit ?? 100000)
  if (!['deepl', 'google'].includes(String(provider)) || !['free', 'pro'].includes(String(deeplPlan))) throw new Error('翻译服务商配置无效')
  if (!Number.isSafeInteger(dailyByteLimit) || dailyByteLimit < 0 || dailyByteLimit > 10000000) throw new Error('每日翻译字节上限须为 0 至 10000000')
  const next: StoredTranslationConfig = { ...current, enabled: input.enabled === undefined ? current.enabled === true : input.enabled === true,
    provider: provider as TranslationProvider, deeplPlan: deeplPlan as 'free' | 'pro', dailyByteLimit }
  for (const name of ['deeplApiKey', 'googleApiKey'] as const) {
    const value = String(input[name] || '').trim()
    if (value.length > 500 || /[\r\n]/.test(value)) throw new Error('翻译 API Key 格式无效')
    if (input[name === 'deeplApiKey' ? 'clearDeepl' : 'clearGoogle'] === true) delete next[name]
    else if (value) next[name] = await encrypt(c, value)
  }
  if (next.enabled && !next[provider === 'deepl' ? 'deeplApiKey' : 'googleApiKey']) throw new Error('请填写当前翻译服务商的 API Key')
  await c.env.RENT.prepare(`INSERT INTO systemSettings (key, value, updatedAt) VALUES ('translationConfig', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP, deleted_at = NULL`).bind(JSON.stringify(next)).run()
}
