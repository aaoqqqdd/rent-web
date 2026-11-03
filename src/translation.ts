/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { getTranslationConfig, type TranslationProvider } from './translationConfig'

export class TranslationError extends Error {
  constructor(public status: 400 | 409 | 413 | 429 | 502 | 503, message: string) { super(message) }
}
const bytes = (text: string) => new TextEncoder().encode(text).length
const languages = new Set(['auto', 'zh', 'en', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'pt', 'nl', 'pl', 'ru', 'ar'])
function language(value: unknown, fallback: string) {
  const code = String(value ?? fallback).toLowerCase().replace('_', '-').split('-')[0]
  if (!languages.has(code)) throw new TranslationError(400, '不支持的翻译语言')
  return code
}

/** Bounded reads apply to chunked request bodies and provider responses alike. */
export async function readTranslationJson(body: ReadableStream<Uint8Array> | null, limit = 16384): Promise<unknown> {
  if (!body) throw new TranslationError(400, '翻译请求格式无效')
  const reader = body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) { await reader.cancel(); throw new TranslationError(413, '翻译内容过长') }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const merged = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(merged)) } catch { throw new TranslationError(400, '翻译请求格式无效') }
}

function decodeGoogleText(text: string) {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || original
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : original
  })
}

async function requestTranslations(config: Awaited<ReturnType<typeof getTranslationConfig>>, provider: TranslationProvider, texts: string[], source: string, target: string): Promise<string[]> {
  const deepl = provider === 'deepl'
  const apiKey = deepl ? config.deeplApiKey : config.googleApiKey
  if (!apiKey) throw new TranslationError(503, '翻译服务尚未配置')
  const url = deepl ? `https://${config.deeplPlan === 'free' ? 'api-free' : 'api'}.deepl.com/v2/translate` : 'https://translation.googleapis.com/language/translate/v2'
  const payload = deepl
    ? { text: texts, target_lang: target === 'en' ? 'EN-GB' : target.toUpperCase(), ...(source === 'auto' ? {} : { source_lang: source.toUpperCase() }) }
    : { q: texts, target, format: 'text', ...(source === 'auto' ? {} : { source }) }
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(deepl ? { Authorization: `DeepL-Auth-Key ${apiKey}` } : { 'X-Goog-Api-Key': apiKey }) },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000), redirect: 'error' })
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`) }
    const body = await readTranslationJson(response.body, 128 * 1024) as { translations?: Array<{ text: string }>; data?: { translations?: Array<{ translatedText: string }> } }
    const result = deepl ? body.translations?.map(row => row.text) : body.data?.translations?.map(row => typeof row.translatedText === 'string' ? decodeGoogleText(row.translatedText) : row.translatedText)
    if (!result || result.length !== texts.length || result.some(text => typeof text !== 'string' || !text.trim() || bytes(text) > 20000)) throw new Error('Invalid response')
    return result
  } catch {
    // Upstream errors can contain credentials or submitted text; never return/log them.
    console.error('Translation provider request failed:', provider)
    throw new TranslationError(502, '翻译失败，请稍后重试')
  }
}

type CacheRow = { cache_key: string; translated_text: string | null; translated_bytes: number }

export async function translateTexts(c: Context, input: unknown, requestedProvider?: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TranslationError(400, '翻译请求格式无效')
  const data = input as Record<string, unknown>
  const texts = data.texts
  if (!Array.isArray(texts) || !texts.length || texts.length > 20 || texts.some(text => typeof text !== 'string' || !text.trim() || bytes(text) > 4096)) throw new TranslationError(400, '每次可翻译 1 至 20 段文本，每段最多 4096 字节')
  if (texts.reduce((sum, text) => sum + bytes(text), 0) > 10000) throw new TranslationError(413, '翻译内容过长')
  const source = language(data.sourceLang, 'auto'), target = language(data.targetLang, 'en')
  if (target === 'auto') throw new TranslationError(400, '请选择翻译目标语言')
  const config = await getTranslationConfig(c)
  const provider = requestedProvider ?? data.provider ?? config.provider
  if (provider !== 'deepl' && provider !== 'google') throw new TranslationError(400, '翻译服务商配置无效')
  if (source === target) return { ok: true, provider, sourceLang: source, targetLang: target, translations: texts.map(text => ({ text, cached: true, sourceBytes: bytes(text), translatedBytes: bytes(text) })) }
  const unique = [...new Set(texts as string[])]
  const entries = await Promise.all(unique.map(async text => ({ text, key: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([provider, source, target, text])))), byte => byte.toString(16).padStart(2, '0')).join('') })))
  const db = c.env.RENT
  const cached = await db.prepare(`SELECT cache_key, translated_text, translated_bytes FROM translation_cache WHERE cache_key IN (${entries.map(() => '?').join(',')})`).bind(...entries.map(entry => entry.key)).all()
  const found = new Map<string, CacheRow>((cached.results as CacheRow[]).map(row => [row.cache_key, row]))
  const missing = entries.filter(entry => found.get(entry.key)?.translated_text == null)
  if (missing.length && !config.enabled) throw new TranslationError(503, '翻译服务尚未启用')
  if (missing.length && !(provider === 'deepl' ? config.deeplApiKey : config.googleApiKey)) throw new TranslationError(503, '翻译服务尚未配置')
  const token = crypto.randomUUID(), now = Date.now()
  const claimed: typeof entries = []
  try {
    if (missing.length) {
      const claims = await db.batch(missing.map(entry => db.prepare(`INSERT INTO translation_cache (cache_key, provider, source_lang, target_lang, source_text, source_bytes, lock_token, lock_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET lock_token = excluded.lock_token, lock_until = excluded.lock_until
        WHERE translation_cache.translated_text IS NULL AND translation_cache.lock_until < ?`)
        .bind(entry.key, provider, source, target, entry.text, bytes(entry.text), token, now + 60000, now)))
      let busy = false
      for (let index = 0; index < missing.length; index++) {
        const entry = missing[index]
        if (Number(claims[index].meta?.changes || 0) > 0) claimed.push(entry)
        else {
          const row = await db.prepare('SELECT cache_key, translated_text, translated_bytes FROM translation_cache WHERE cache_key = ?').bind(entry.key).first() as CacheRow | null
          if (row?.translated_text != null) found.set(entry.key, row)
          else busy = true
        }
      }
      if (busy) throw new TranslationError(409, '翻译处理中，请稍后重试')
    }
    if (claimed.length) {
      const sourceBytes = claimed.reduce((sum, entry) => sum + bytes(entry.text), 0)
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const budget = await db.prepare(`INSERT INTO translation_daily_usage (usage_date, source_bytes) SELECT ?, ? WHERE ? <= ?
        ON CONFLICT(usage_date) DO UPDATE SET source_bytes = source_bytes + excluded.source_bytes WHERE source_bytes + excluded.source_bytes <= ?
        RETURNING source_bytes`).bind(day, sourceBytes, sourceBytes, config.dailyByteLimit, config.dailyByteLimit).first()
      if (!budget) throw new TranslationError(429, '已达到每日翻译字节上限')
      // Reserve bytes before the paid call. Failed/uncertain calls still count toward the cap.
      const translations = await requestTranslations(config, provider, claimed.map(entry => entry.text), source, target)
      await db.batch(claimed.map((entry, index) => db.prepare(`UPDATE translation_cache SET translated_text = ?, translated_bytes = ?, lock_token = '', lock_until = 0, updated_at = CURRENT_TIMESTAMP WHERE cache_key = ? AND lock_token = ?`)
        .bind(translations[index], bytes(translations[index]), entry.key, token)))
      claimed.forEach((entry, index) => found.set(entry.key, { cache_key: entry.key, translated_text: translations[index], translated_bytes: bytes(translations[index]) }))
    }
  } finally {
    if (claimed.length) await db.batch(claimed.map(entry => db.prepare("DELETE FROM translation_cache WHERE cache_key = ? AND lock_token = ? AND translated_text IS NULL").bind(entry.key, token)))
  }
  const byText = new Map(entries.map(entry => [entry.text, entry.key]))
  return { ok: true, provider, sourceLang: source, targetLang: target, translations: (texts as string[]).map(text => {
    const key = byText.get(text)!, row = found.get(key)!
    return { text: row.translated_text!, cached: !claimed.some(entry => entry.key === key), sourceBytes: bytes(text), translatedBytes: row.translated_bytes }
  }) }
}

export async function handleTranslation(c: Context, body?: unknown) {
  c.header('Cache-Control', 'no-store')
  try {
    let input = body
    if (input === undefined) {
      // rent's body-size middleware may already have read a chunked body into Hono's cache.
      if (c.req.raw.bodyUsed) {
        const buffered = await c.req.arrayBuffer()
        if (buffered.byteLength > 16384) throw new TranslationError(413, '翻译内容过长')
        try { input = JSON.parse(new TextDecoder().decode(buffered)) } catch { throw new TranslationError(400, '翻译请求格式无效') }
      } else input = await readTranslationJson(c.req.raw.body)
    }
    return c.json(await translateTexts(c, input, c.req.param('provider')))
  } catch (error) {
    if (error instanceof TranslationError) return c.json({ ok: false, message: error.message }, error.status)
    console.error('Translation cache or configuration unavailable')
    return c.json({ ok: false, message: '翻译服务暂不可用' }, 503)
  }
}
