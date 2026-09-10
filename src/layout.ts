// 页面外壳：<head>、顶栏、页脚。所有页面通过 renderPage() 拼装。

import type { SiteContact } from './db'

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 角标：蓝色 chevron + 白色斜杠（48×48，透明底）。
const MARK_PATHS = /* html */ `
  <path d="M27 15 L44 41 L35.5 41 L27 28 L18.5 41 L10 41 Z" fill="#2563EB"/>
  <path d="M9 41 L17 41 L34 7 L26 7 Z" fill="#FFFFFF"/>`

// 横幅：角标 + GeekSlope 字标，作为一个整体缩放。顶栏 / 页脚用。
const BANNER = /* html */ `
<svg viewBox="0 0 236 48" fill="none" aria-label="GeekSlope" role="img" class="brand-banner">
  ${MARK_PATHS}
  <text x="60" y="34" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="29" font-weight="700" letter-spacing="0.4" fill="#EAF0F6">GeekSlope</text>
</svg>`

// 圆形徽标（favicon / 分享图）。
const BADGE = /* svg */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0A0A0F"/><g transform="translate(16 16) scale(0.6667)">${MARK_PATHS}</g></svg>`

export const FAVICON_SVG = BADGE
const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(BADGE)}`

interface Nav {
  appUrl: string
}

function header(nav: Nav): string {
  return /* html */ `
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${BANNER}</a>
    <nav class="nav">
      <a href="/products">产品目录</a>
      <a href="/rental-guide">租赁说明</a>
      <a href="/about">关于我们</a>
    </nav>
    <a class="btn btn-primary" href="/apply">立即租赁</a>
  </div>
</header>`
}

function footer(contact: SiteContact, appUrl: string): string {
  const year = new Date().getFullYear()
  return /* html */ `
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="/">${BANNER}</a>
        <p>专业电脑出租平台，为学生和个人用户提供高品质设备租赁服务。灵活租期，品质保障。</p>
      </div>
      <div class="foot-col">
        <h4>产品</h4>
        <a href="/products">游戏笔记本</a>
        <a href="/products">轻薄本</a>
        <a href="/products">台式工作站</a>
        <a href="/products">全部产品</a>
      </div>
      <div class="foot-col">
        <h4>服务</h4>
        <a href="/rental-guide">租赁说明</a>
        <a href="/rental-guide#faq">常见问题</a>
        <a href="/about">关于我们</a>
        <a href="/about#contact">联系我们</a>
      </div>
      <div class="foot-col">
        <h4>联系我们</h4>
        <span>${esc(contact.phone)}</span>
        <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>
        <span>${esc(contact.address)}</span>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${year} ${esc(contact.name)}. 保留所有权利。</span>
      <span>
        <a href="${esc(appUrl)}/terms">服务条款</a>
        <a href="${esc(appUrl)}/privacy">隐私政策</a>
      </span>
    </div>
  </div>
</footer>`
}

export interface PageOptions {
  title: string
  description: string
  body: string
  contact: SiteContact
  appUrl: string
  path: string
}

export function renderPage(opts: PageOptions): string {
  return /* html */ `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<link rel="canonical" href="${esc(opts.appUrl)}">
<link rel="icon" href="${FAVICON_DATA_URI}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
${header({ appUrl: opts.appUrl })}
<main>
${opts.body}
</main>
${footer(opts.contact, opts.appUrl)}
</body>
</html>`
}
