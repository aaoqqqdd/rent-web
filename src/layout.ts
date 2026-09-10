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

const LOGO = /* html */ `
<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <path d="M4 26 16 4l4 8-8 14z" fill="#00e6ff"/>
  <path d="M15 26 24 9l4 8-5 9z" fill="#00c79f"/>
</svg>`

interface Nav {
  appUrl: string
}

function header(nav: Nav): string {
  return /* html */ `
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${LOGO}<span>GeekSlope</span></a>
    <nav class="nav">
      <a href="/products">产品目录</a>
      <a href="/rental-guide">租赁说明</a>
      <a href="/about">关于我们</a>
    </nav>
    <a class="btn btn-primary" href="${esc(nav.appUrl)}/login">登录 / 注册</a>
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
        <a class="brand" href="/">${LOGO}<span>GeekSlope</span></a>
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M4 26 16 4l4 8-8 14z' fill='%2300e6ff'/%3E%3Cpath d='M15 26 24 9l4 8-5 9z' fill='%2300c79f'/%3E%3C/svg%3E">
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
