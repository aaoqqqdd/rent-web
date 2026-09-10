// 页面外壳：<head>、顶栏、页脚。所有页面通过 renderPage() 拼装。

import type { SiteContact } from './db'
import { STYLE_VERSION } from './theme'

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
}

function header(nav: Nav, contact: SiteContact): string {
  const active = (path: string): string => nav.path === path || nav.path.startsWith(`${path}/`) ? ' aria-current="page"' : ''
  return /* html */ `
<a class="skip-link" href="#main-content">跳到主要内容</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${banner(contact)}</a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="打开菜单">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="site-nav" aria-label="主导航">
      <a href="/products"${active('/products')}>设备库</a>
      <a href="/rental-guide"${active('/rental-guide')}>如何租</a>
      <a href="/about"${active('/about')}>关于我们</a>
      <a href="/contact"${active('/contact')}>联系</a>
    </nav>
    <a class="header-cart" href="/apply" aria-label="购物车，0 件设备"${active('/apply')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6.1M10 20h.01M17 20h.01"></path></svg>
      <span>购物车</span><b class="cart-count" data-cart-count hidden>0</b>
    </a>
    <a class="btn btn-primary header-account" href="/login"${active('/login')}>账号中心</a>
  </div>
</header>`
}

function footer(contact: SiteContact): string {
  const year = new Date().getFullYear()
  return /* html */ `
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${banner(contact)}</a>
        <p>专业电脑出租平台，为学生和个人用户提供高品质设备租赁服务。灵活租期，品质保障。</p>
      </div>
      <div class="foot-col">
        <h4>产品</h4>
        <a href="/products?category=gaming">游戏笔记本</a>
        <a href="/products?category=ultrabook">轻薄商务本</a>
        <a href="/products?category=workstation">台式工作站</a>
        <a href="/products">全部产品</a>
      </div>
      <div class="foot-col">
        <h4>服务</h4>
        <a href="/rental-guide">租赁说明</a>
        <a href="/rental-guide#faq">常见问题</a>
        <a href="/about">关于我们</a>
        <a href="/contact">联系我们</a>
      </div>
      <div class="foot-col">
        <h4>联系我们</h4>
        <a href="tel:${esc(contact.phone.replace(/[^+\d]/g, ''))}">${esc(contact.phone)}</a>
        <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>
        <span>${esc(contact.address)}</span>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${year} ${esc(contact.name)}. 保留所有权利。</span>
      <span>
        <a href="/service-terms">服务条款</a>
        <a href="/privacy">隐私政策</a>
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
  siteUrl?: string
}

export function renderPage(opts: PageOptions): string {
  const siteUrl = (opts.siteUrl || opts.appUrl).replace(/\/$/, '')
  const canonicalPath = opts.path === '*' ? '/' : opts.path
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
<meta property="og:url" content="${esc(siteUrl + canonicalPath)}">
<meta name="theme-color" content="#080A10">
<link rel="canonical" href="${esc(siteUrl + canonicalPath)}">
<link rel="icon" href="${FAVICON_DATA_URI}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="/styles.css?v=${STYLE_VERSION}">
</head>
<body>
${header({ appUrl: opts.appUrl, path: opts.path }, opts.contact)}
<main id="main-content">
${opts.body}
</main>
${footer(opts.contact)}
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
<script>
(() => {
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
    if (!wasAdded && window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var card = button.closest('.card');
      var badge = document.querySelector('[data-cart-count]');
      if (card) window.gsap.fromTo(card, { scale: 0.985 }, { scale: 1, duration: 0.5, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform' });
      if (badge) window.gsap.fromTo(badge, { scale: 0.45, y: 5, autoAlpha: 0 }, { scale: 1, y: 0, autoAlpha: 1, duration: 0.42, ease: 'back.out(1.8)', overwrite: 'auto', clearProps: 'transform,opacity,visibility' });
    }
  });
  renderCart(readCart());
  if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.gsap.from('.cart-checkout-item', { y: 14, autoAlpha: 0, duration: 0.5, stagger: 0.055, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  }
})();
</script>
</body>
</html>`
}
