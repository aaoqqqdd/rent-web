// Cloudflare Turnstile 配置：与 rent 主应用**同源**。管理员在 rent 后台
// `/admin/api-settings` 配置一次，写进共享 D1 的 `systemSettings.turnstileConfig`
// （site key 明文、secret key 用 SETTINGS_ENCRYPTION_KEY 加密），官网直接读取，
// 不需要再给 geekslope-web 单独 `wrangler secret put`。
//
// 读取策略与 src/delivery.ts 的 deliveryConfig 一致：
//   1. 后台配置成对可用（site key + 可解密的 secret）→ 用后台配置；
//   2. 否则回退环境变量 TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY；
//   3. 两者都没有 → 视为未配置：不渲染 widget，服务端校验放行（保持旧部署可用）。
// 后台配置存在但解不开时不会「混搭」环境变量，避免 site/secret 不配对导致校验
// 永远失败；此时会打日志，并且不渲染 widget（不制造「有验证框但没校验」的假象）。

import type { Context } from 'hono'
import type { Env } from './index'
import { cleanSetting, decryptSetting, readJsonSetting } from './settings'

type RentalContext = Context<{ Bindings: Env }>

const CONFIG_KEY = 'turnstileConfig'
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileConfig {
  siteKey: string
  secretKey: string
  /** database：来自 rent 后台；env：环境变量回退；none：完全未配置（校验放行）。 */
  source: 'database' | 'env' | 'none'
}

function envConfig(env: Env): TurnstileConfig {
  const siteKey = cleanSetting(env.TURNSTILE_SITE_KEY, 200)
  const secretKey = cleanSetting(env.TURNSTILE_SECRET_KEY, 200)
  return { siteKey, secretKey, source: siteKey || secretKey ? 'env' : 'none' }
}

/**
 * 读取运行时配置：后台（D1）优先，其次环境变量。读取 / 解析 / 解密失败都不抛错。
 */
export async function getTurnstileConfig(c: RentalContext): Promise<TurnstileConfig> {
  const stored = await readJsonSetting(c, CONFIG_KEY)
  if (stored) {
    const siteKey = cleanSetting(stored.siteKey, 200)
    const encryptedSecret = cleanSetting(stored.secretKey, 4000)
    if (siteKey && encryptedSecret) {
      const secretKey = await decryptSetting(c, encryptedSecret)
      if (secretKey) return { siteKey, secretKey, source: 'database' }
      console.error(
        '[turnstile] systemSettings.turnstileConfig exists but the secret cannot be decrypted. ' +
        'Check that SETTINGS_ENCRYPTION_KEY matches the rent deployment; falling back to environment variables.',
      )
    }
  }
  return envConfig(c.env)
}

/** 渲染 widget 只需要可公开的 site key。 */
export async function getTurnstileSiteKey(c: RentalContext): Promise<string> {
  return (await getTurnstileConfig(c)).siteKey
}

/**
 * 服务端校验。与 rent 的行为一致：
 * - 未配置（后台和环境变量都没有 secret）→ 放行，保证旧部署 / 本地开发可用；
 * - 已配置但请求没带 token / token 无效 / Cloudflare 不可用 → 拒绝。
 */
export async function verifyTurnstile(c: RentalContext, token: string, ip: string): Promise<boolean> {
  const { secretKey } = await getTurnstileConfig(c)
  if (!secretKey) return true
  const response = cleanSetting(token, 4000)
  if (!response) return false
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response, remoteip: ip }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return Boolean(data.success)
  } catch {
    return false
  }
}
