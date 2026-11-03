/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context, Next } from 'hono'
import type { Env } from './index'
import { currentUser } from './auth'
import { readClientAccess, clientFeatureForPath, clientPathEnabled, webEssentialPath, clientMaintenanceHtml, DEFAULT_MAINTENANCE_MESSAGE } from './clientAccess'

export async function clientAccessMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const path = c.req.path
  if (['/healthz','/styles.css','/favicon.ico','/robots.txt'].includes(path)) return next()
  const essential = webEssentialPath(path)
  let policy
  try { policy = await readClientAccess(c.env.RENT) }
  catch (error) {
    console.error('Client access settings unavailable',error)
    if (essential) return next()
    c.header('cache-control','private, no-store'); c.header('retry-after','300')
    return path.startsWith('/api/') ? c.json({ok:false,message:DEFAULT_MAINTENANCE_MESSAGE},503) : c.html(clientMaintenanceHtml(),503)
  }
  const feature = clientFeatureForPath(path,'web')
  const restricted = !policy.web.enabled || Object.values(policy.features).some(value=>!value)
  const admin = restricted && (await currentUser(c))?.role === 'ADMIN'
  if (!admin && !essential && (!policy.web.enabled || (feature && !policy.features[feature]))) {
    c.header('cache-control','private, no-store'); c.header('retry-after','300'); c.header('vary','Cookie')
    const featureClosed = policy.web.enabled
    return path.startsWith('/api/')
      ? c.json({ok:false,message:featureClosed ? '此功能暂未开放' : policy.web.message || DEFAULT_MAINTENANCE_MESSAGE},503)
      : c.html(clientMaintenanceHtml(featureClosed ? '' : policy.web.message,featureClosed),503)
  }
  await next()
  // Run after cache reads too, so previously cached navigation cannot revive a closed feature.
  if (!admin && restricted && c.res.headers.get('content-type')?.includes('text/html')) {
    const rewriter = new HTMLRewriter().on('a[href],form[action]',{element(element) {
      const target = element.getAttribute('href') || element.getAttribute('action') || ''
      let url: URL
      try { url = new URL(target,c.req.url) } catch { return }
      const appOrigin = new URL(c.env.APP_URL || 'https://dashboard.geekslope.de5.net').origin
      const surface = url.origin === appOrigin ? 'console' : 'web'
      if ((url.origin === new URL(c.req.url).origin || url.origin === appOrigin) && !clientPathEnabled(policy,target,surface)) element.remove()
    }})
    if (!policy.features.publicNotices) rewriter.on('[data-site-announcement], #gs-announcement-dialog',{element(element){element.remove()}})
    if (!policy.features.registration) rewriter.on('[data-tab="register"], [data-tab-link="register"], [data-panel="register"]',{element(element){element.remove()}})
    if (!policy.features.registration) rewriter.on('[data-panel="login"]',{element(element){element.setAttribute('class','auth-panel')}}).on('[data-tab="login"]',{element(element){element.setAttribute('class','auth-tab is-active')}})
    c.res = rewriter.transform(c.res)
    c.res.headers.set('cache-control','private, no-store')
  }
}
