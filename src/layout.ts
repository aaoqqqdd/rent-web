// 页面外壳：<head>、顶栏、页脚。所有页面通过 renderPage() 拼装。

import type { SiteContact } from './db'
import { STYLE_VERSION } from './theme'
import type { SessionUser } from './auth'

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const MARK_PATHS = /* html */ `
  <path d="M27 15 L44 41 L35.5 41 L27 28 L18.5 41 L10 41 Z" fill="#7C6CFF"/>
  <path d="M9 41 L17 41 L34 7 L26 7 Z" fill="#FFFFFF"/>`

function banner(contact: SiteContact): string {
  const logo = /^https?:\/\//i.test(contact.logo) ? contact.logo : ''
  if (logo) return `<img src="${esc(logo)}" alt="${esc(contact.name)}" class="brand-banner">`
  return /* html */ `
<svg viewBox="0 0 236 48" fill="none" aria-label="${esc(contact.name)}" role="img" class="brand-banner">
  ${MARK_PATHS}
  <text x="60" y="34" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="29" font-weight="700" letter-spacing="0.4" fill="#EAF0F6">${esc(contact.name)}</text>
</svg>`
}

const BADGE = /* svg */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0A0A0F"/><g transform="translate(16 16) scale(0.6667)">${MARK_PATHS}</g></svg>`

export const FAVICON_SVG = BADGE
const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(BADGE)}`

interface Nav {
  appUrl: string
  path: string
  user?: SessionUser | null
}

function header(nav: Nav, contact: SiteContact): string {
  const active = (path: string): string => nav.path === path || nav.path.startsWith(`${path}/`) ? ' aria-current="page"' : ''
  const cta = nav.user
    ? /* html */ `<span class="nav-account">
        <a class="btn btn-primary" href="/sso/start">进入用户中心</a>
        <a class="nav-logout" href="/logout" title="退出登录（同时退出 rent）">退出</a>
      </span>`
    : /* html */ `<a class="btn btn-primary" href="/login">登录 / 注册</a>`
  return /* html */ `
<a class="skip-link" href="#main-content" data-i18n="skip">跳到主要内容</a>
<header class="site-header">
  <div class="wrap">
    <div class="header-brand-group">
      <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${banner(contact)}</a>
      <span class="header-location">MELBOURNE · LOCAL RENTAL</span>
    </div>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="打开菜单" data-i18n-attr="aria-label:menuOpen">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="site-nav" aria-label="主导航">
      <a href="/products"${active('/products')} data-i18n="navProducts">设备库</a>
      <a href="/rental-guide"${active('/rental-guide')} data-i18n="navGuide">如何租</a>
      <a href="/about"${active('/about')} data-i18n="navAbout">关于我们</a>
      <a href="/contact"${active('/contact')} data-i18n="navContact">联系</a>
      <a href="/order-lookup"${active('/order-lookup')} data-i18n="navLookup">查订单</a>
    </nav>
    <div class="header-actions">
      <a class="header-cart" href="/apply" aria-label="购物车，0 件设备"${active('/apply')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6.1M10 20h.01M17 20h.01"></path></svg>
        <span data-i18n="cart">购物车</span><b class="cart-count" data-cart-count hidden>0</b>
      </a>
      ${cta}
      <div class="language-switcher" role="group" aria-label="Language" data-i18n-attr="aria-label:language"><button type="button" data-language="zh">中</button><button type="button" data-language="en">EN</button></div>
    </div>
  </div>
</header>`
}

// 网站相关的法律 / 合规链接，全部由本站从 D1 渲染（见 src/pages/legal.ts、
// index.ts 的 LEGAL_PAGES）。文案与 rent 后台维护的文档标题保持一致。
const LEGAL_LINKS: Array<[string, string]> = [
  ['/service-terms', '服务条款'],
  ['/privacy', '隐私政策'],
  ['/user-terms', '用户协议'],
  ['/cookies', 'Cookie 政策'],
  ['/refund-policy', '取消与退款政策'],
  ['/consumer-rights', '消费者权利'],
  ['/complaints', '投诉与争议'],
  ['/acceptable-use', '可接受使用'],
  ['/software-terms', '软件协议'],
]

function footer(contact: SiteContact): string {
  const year = new Date().getFullYear()
  const legalNav = LEGAL_LINKS.map(([href, text]) => `<a href="${href}">${text}</a>`).join('')
  return /* html */ `
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${banner(contact)}</a>
        <p data-i18n="footerIntro">为学习、工作、创作和临时项目提供可靠的电脑租赁。先看实时设备，再按实际使用时间申请。</p>
      </div>
      <div class="foot-col">
        <h4 data-i18n="footerProducts">产品</h4>
        <a href="/products?category=gaming" data-i18n="gaming">游戏笔记本</a>
        <a href="/products?category=ultrabook" data-i18n="ultrabook">轻薄商务本</a>
        <a href="/products?category=workstation" data-i18n="workstation">台式工作站</a>
        <a href="/products" data-i18n="allProducts">全部产品</a>
      </div>
      <div class="foot-col">
        <h4 data-i18n="footerServices">服务</h4>
        <a href="/rental-guide" data-i18n="rentalGuide">租赁说明</a>
        <a href="/rental-guide#faq" data-i18n="faq">常见问题</a>
        <a href="/about" data-i18n="navAbout">关于我们</a>
        <a href="/contact" data-i18n="contactUs">联系我们</a>
      </div>
      <div class="foot-col foot-legal-column">
        <h4 data-i18n="terms">条款</h4>
        <a href="/terms" data-i18n="userTerms">用户协议</a>
        <a href="/service-terms" data-i18n="serviceTerms">服务条款</a>
        <a href="/refund-policy" data-i18n="refundPolicy">退款政策</a>
        <a href="/privacy" data-i18n="privacy">隐私政策</a>
      </div>
      <div class="foot-col">
        <h4 data-i18n="footerContact">联系我们</h4>
        <a href="tel:${esc(contact.phone.replace(/[^+\d]/g, ''))}">${esc(contact.phone)}</a>
        <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>
        <span>${esc(contact.address)}</span>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${year} ${esc(contact.name)}. 保留所有权利。</span>
      <nav class="foot-legal" aria-label="网站法律信息">${legalNav}</nav>
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
  siteUrl?: string
  robots?: string
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>
  user?: SessionUser | null
}

export function renderPage(opts: PageOptions): string {
  const siteUrl = (opts.siteUrl || opts.appUrl).replace(/\/$/, '')
  const canonicalPath = opts.path === '*' ? '/' : opts.path
  const canonicalUrl = siteUrl + canonicalPath
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: opts.contact.name,
    url: siteUrl,
    email: opts.contact.email,
    telephone: opts.contact.phone,
  }
  if (/^https?:\/\//i.test(opts.contact.logo)) organization.logo = opts.contact.logo
  const pageSchemas = Array.isArray(opts.structuredData)
    ? opts.structuredData
    : opts.structuredData ? [opts.structuredData] : []
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: opts.contact.name, inLanguage: 'zh-CN', publisher: { '@id': `${siteUrl}/#organization` } },
      ...pageSchemas,
    ],
  }).replace(/</g, '\\u003c')
  return /* html */ `<!doctype html>
<html lang="zh-CN" data-language-root>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="robots" content="${esc(opts.robots || 'index, follow, max-image-preview:large')}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:site_name" content="${esc(opts.contact.name)}">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(opts.title)}">
<meta name="twitter:description" content="${esc(opts.description)}">
<meta name="theme-color" content="#080A10">
<link rel="canonical" href="${esc(canonicalUrl)}">
<link rel="icon" href="${FAVICON_DATA_URI}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="/styles.css?v=${STYLE_VERSION}">
<script type="application/ld+json">${structuredData}</script>
</head>
<body>
${header({ appUrl: opts.appUrl, path: opts.path, user: opts.user }, opts.contact)}
<main id="main-content">
${opts.body}
</main>
${footer(opts.contact)}
<script>
(() => {
  var translations = {
    skip: ['跳到主要内容', 'Skip to main content'], menuOpen: ['打开菜单', 'Open menu'], language: ['语言', 'Language'],
    navProducts: ['设备库', 'Devices'], navGuide: ['如何租', 'How it works'], navAbout: ['关于我们', 'About us'], navContact: ['联系', 'Contact'], navLookup: ['查订单', 'Order lookup'],
    cart: ['购物车', 'Cart'], account: ['账号中心', 'Account'], footerIntro: ['为学习、工作、创作和临时项目提供可靠的电脑租赁。先看实时设备，再按实际使用时间申请。', 'Reliable computer rentals for study, work, creative projects and short-term needs. Browse live inventory and apply for the time you need.'],
    footerProducts: ['产品', 'Products'], gaming: ['游戏笔记本', 'Gaming laptops'], ultrabook: ['轻薄商务本', 'Ultrabooks'], workstation: ['台式工作站', 'Workstations'], allProducts: ['全部产品', 'All products'],
    footerServices: ['服务', 'Services'], rentalGuide: ['租赁说明', 'Rental guide'], faq: ['常见问题', 'FAQ'], contactUs: ['联系我们', 'Contact us'], terms: ['条款', 'Legal'], userTerms: ['用户协议', 'User terms'], serviceTerms: ['服务条款', 'Service terms'], refundPolicy: ['退款政策', 'Refund policy'], privacy: ['隐私政策', 'Privacy'], footerContact: ['联系我们', 'Contact'], getHelp: ['获取帮助', 'Get help']
  };
  function setLanguage(language) {
    var english = language === 'en';
    document.documentElement.lang = english ? 'en-AU' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n'); var value = translations[key];
      if (value) node.textContent = value[english ? 1 : 0];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      String(node.getAttribute('data-i18n-attr') || '').split(',').forEach(function (item) { var parts = item.split(':'); var value = translations[parts[1]]; if (value) node.setAttribute(parts[0], value[english ? 1 : 0]); });
    });
    document.querySelectorAll('[data-language]').forEach(function (button) { button.classList.toggle('is-active', button.getAttribute('data-language') === (english ? 'en' : 'zh')); });
    try { localStorage.setItem('geekslope-language', english ? 'en' : 'zh'); } catch (_) {}
  }
  var savedLanguage = 'zh';
  try { savedLanguage = localStorage.getItem('geekslope-language') === 'en' ? 'en' : 'zh'; } catch (_) {}
  document.querySelectorAll('[data-language]').forEach(function (button) { button.addEventListener('click', function () { setLanguage(button.getAttribute('data-language') || 'zh'); }); });
  setLanguage(savedLanguage);
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? '打开菜单' : '关闭菜单');
      nav.classList.toggle('is-open', !open);
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  // 顶栏滚动收缩：纯 DOM 状态切换，不依赖任何库，随时可用。
  var siteHeader = document.querySelector('.site-header');
  var onScroll = function () { if (siteHeader) siteHeader.classList.toggle('is-scrolled', window.scrollY > 18); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // 动效自托管（原来挂在 gsap CDN 上：一旦那个脚本加载失败——网络、广告拦截、
  // 校园/公司网络限制——全站动效会无声地整体消失。改成原生 CSS 动画 +
  // IntersectionObserver，零外部依赖，永远不会因为第三方资源加载失败而丢失）。
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    var revealItems = document.querySelectorAll('.feature, .card:not(.cart-checkout-item), .scenario, .step, .info-card, .service-standard-grid article, .faq-list details, .contact-option');
    if (revealItems.length) {
      revealItems.forEach(function (item) { item.classList.add('reveal'); });
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            entry.target.classList.add('is-in');
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        revealItems.forEach(function (item) { observer.observe(item); });
      } else {
        revealItems.forEach(function (item) { item.classList.add('is-in'); });
      }
    }
  }

  var CART_KEY = 'geekslope-cart-v1';
  function readCart() {
    try {
      var value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value.filter(function (id, index) {
        return typeof id === 'string' && id && value.indexOf(id) === index;
      }).slice(0, 10) : [];
    } catch (_) { return []; }
  }
  function writeCart(ids) {
    var clean = ids.filter(function (id, index) { return typeof id === 'string' && id && ids.indexOf(id) === index; }).slice(0, 10);
    try { localStorage.setItem(CART_KEY, JSON.stringify(clean)); } catch (_) {}
    renderCart(clean);
    window.dispatchEvent(new CustomEvent('geekslope:cart-change', { detail: { ids: clean } }));
    return clean;
  }
  function renderCart(ids) {
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = String(ids.length);
      badge.hidden = ids.length === 0;
    });
    var cartLink = document.querySelector('.header-cart');
    if (cartLink) cartLink.setAttribute('aria-label', '购物车，' + ids.length + ' 件设备');
    document.querySelectorAll('[data-cart-add]').forEach(function (button) {
      var added = ids.indexOf(button.getAttribute('data-device-id') || '') >= 0;
      button.classList.toggle('is-added', added);
      button.textContent = added ? '已加入购物车' : '加入购物车';
      button.setAttribute('aria-pressed', String(added));
    });
  }
  function addToCart(id) {
    var ids = readCart();
    if (ids.indexOf(id) < 0) ids.push(id);
    return writeCart(ids);
  }
  function removeFromCart(id) { return writeCart(readCart().filter(function (item) { return item !== id; })); }
  window.GeekSlopeCart = { read: readCart, write: writeCart, add: addToCart, remove: removeFromCart, clear: function () { return writeCart([]); } };
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-cart-add]');
    if (!button) return;
    var id = button.getAttribute('data-device-id') || '';
    if (!id) return;
    var wasAdded = readCart().indexOf(id) >= 0;
    addToCart(id);
    if (!wasAdded && !reduceMotion) {
      var card = button.closest('.card');
      var badge = document.querySelector('[data-cart-count]');
      if (card) { card.classList.remove('is-bumped'); void card.offsetWidth; card.classList.add('is-bumped'); }
      if (badge) { badge.classList.remove('is-popped'); void badge.offsetWidth; badge.classList.add('is-popped'); }
    }
  });
  renderCart(readCart());
  // .cart-checkout-item 的入场动画（含 nth-child 错落延迟）直接写在 CSS 里，
  // 每次 renderCart() 重建行列表都会自动重放，无需额外触发。
})();
</script>
</body>
</html>`
}
