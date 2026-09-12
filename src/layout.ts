// 页面外壳：<head>、顶栏、页脚。所有页面通过 renderPage() 拼装。

import type { SiteContact } from './db'
import { STYLE_VERSION } from './theme'
import { ENGLISH_COPY, ENGLISH_PATTERNS } from './i18n'
import type { SessionUser } from './auth'
import { esc } from './escape'
import { renderSiteHeader } from './components/site-header'
import { renderSiteFooter } from './components/site-footer'
import { FAVICON_SVG } from './components/brand'

export { FAVICON_SVG }

export { esc }

const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`

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
  const englishCopy = JSON.stringify(ENGLISH_COPY).replace(/</g, '\\u003c')
  const englishPatterns = JSON.stringify(ENGLISH_PATTERNS).replace(/</g, '\\u003c')
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
${renderSiteHeader({ path: opts.path, user: opts.user, appUrl: opts.appUrl }, opts.contact)}
<aside class="site-announcement" data-site-announcement hidden data-no-translate aria-label="最新通告">
  <div class="wrap site-announcement-inner">
    <span class="site-announcement-label">最新消息</span>
    <a class="site-announcement-link" data-site-announcement-link href="/announcements">
      <strong data-site-announcement-title></strong><span>查看详情 <span aria-hidden="true">→</span></span>
    </a>
  </div>
</aside>
<main id="main-content">
${opts.body}
</main>
${renderSiteFooter(opts.contact)}
<script>
(() => {
  var englishCopy = ${englishCopy};
  var englishPatterns = ${englishPatterns}.map(function (entry) { return [new RegExp(entry[0]), entry[1]]; });
  var originalText = new WeakMap();
  var originalAttributes = new WeakMap();
  var originalTitle = document.title;
  var originalDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  var currentLanguage = 'zh';
  function englishFor(value) {
    var lookup = String(value || '').replace(/\\s+/g, ' ').trim();
    var translated = englishCopy[lookup] || '';
    for (var i = 0; !translated && i < englishPatterns.length; i += 1) {
      if (englishPatterns[i][0].test(lookup)) translated = lookup.replace(englishPatterns[i][0], englishPatterns[i][1]);
    }
    if (!translated) return value;
    // A pattern's captured group (eg. a policy name inside a dynamic notice) is
    // copied into the replacement as-is; translate any Chinese it still carries.
    translated = translated.replace(/\\p{Script=Han}+/gu, function (segment) { return englishCopy[segment] || segment; });
    return translated
      .replaceAll('墨尔本 CBD 及周边地区', 'Melbourne CBD and nearby areas')
      .replaceAll('墨尔本 CBD', 'Melbourne CBD')
      .replaceAll('墨尔本', 'Melbourne');
  }
  function translateTextNode(node) {
    if (!node || !node.parentElement || node.parentElement.closest('script,style,[data-no-translate]')) return;
    var current = node.nodeValue || '';
    if (/\\p{Script=Han}/u.test(current)) originalText.set(node, current);
    var source = originalText.get(node) || current;
    var trimmed = source.trim();
    if (!trimmed) return;
    var translated = currentLanguage === 'en' ? englishFor(trimmed) : trimmed;
    var next = source.slice(0, source.indexOf(trimmed)) + translated + source.slice(source.indexOf(trimmed) + trimmed.length);
    if (node.nodeValue !== next) node.nodeValue = next;
  }
  function translateElement(element) {
    if (!element || element.closest('script,style,[data-no-translate]')) return;
    var saved = originalAttributes.get(element) || {};
    ['placeholder', 'aria-label', 'title'].forEach(function (attribute) {
      var current = element.getAttribute(attribute);
      if (current && /\\p{Script=Han}/u.test(current)) saved[attribute] = current;
      var source = saved[attribute];
      if (source) element.setAttribute(attribute, currentLanguage === 'en' ? englishFor(source) : source);
    });
    originalAttributes.set(element, saved);
  }
  function translateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateElement(root);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node); else translateElement(node);
    }
  }
  var translations = {
    skip: ['跳到主要内容', 'Skip to main content'], menuOpen: ['打开菜单', 'Open menu'], language: ['语言', 'Language'],
    navProducts: ['产品目录', 'Products'], navGuide: ['租赁说明', 'Rental guide'], navAbout: ['关于我们', 'About us'], navContact: ['联系我们', 'Contact us'], navLookup: ['订单查询', 'Order Details'],
    cart: ['购物车', 'Cart'], account: ['账号中心', 'Account'], footerIntro: ['为学习、工作、创作和临时项目提供可靠的电脑租赁。先看实时设备，再按实际使用时间申请。', 'Reliable computer rentals for study, work, creative projects and short-term needs. Browse live inventory and apply for the time you need.'],
    footerProducts: ['产品', 'Products'], gaming: ['游戏笔记本', 'Gaming laptops'], ultrabook: ['轻薄商务本', 'Ultrabooks'], workstation: ['台式工作站', 'Workstations'], allProducts: ['全部产品', 'All products'],
    footerServices: ['服务', 'Services'], rentalGuide: ['租赁说明', 'Rental guide'], faq: ['常见问题', 'FAQ'], contactUs: ['联系我们', 'Contact us'], terms: ['条款', 'Legal'], userTerms: ['用户协议', 'User terms'], serviceTerms: ['服务条款', 'Service terms'], refundPolicy: ['退款政策', 'Refund policy'], privacy: ['隐私政策', 'Privacy'], footerContact: ['联系我们', 'Contact'], getHelp: ['获取帮助', 'Get help']
  };
  function setLanguage(language) {
    var english = language === 'en';
    currentLanguage = english ? 'en' : 'zh';
    document.documentElement.lang = english ? 'en-AU' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n'); var value = translations[key];
      if (value) node.textContent = value[english ? 1 : 0];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      String(node.getAttribute('data-i18n-attr') || '').split(',').forEach(function (item) { var parts = item.split(':'); var value = translations[parts[1]]; if (value) node.setAttribute(parts[0], value[english ? 1 : 0]); });
    });
    document.querySelectorAll('[data-language]').forEach(function (button) { button.classList.toggle('is-active', button.getAttribute('data-language') === (english ? 'en' : 'zh')); });
    translateTree(document.body);
    document.title = english ? englishFor(originalTitle) : originalTitle;
    var descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.setAttribute('content', english ? englishFor(originalDescription) : originalDescription);
    try { localStorage.setItem('geekslope-language', english ? 'en' : 'zh'); } catch (_) {}
    window.dispatchEvent(new CustomEvent('geekslope:language-change', { detail: { language: currentLanguage } }));
  }
  var savedLanguage = '';
  try {
    var storedLanguage = localStorage.getItem('geekslope-language');
    if (storedLanguage === 'en' || storedLanguage === 'zh') savedLanguage = storedLanguage;
  } catch (_) {}
  if (!savedLanguage) {
    var browserLanguages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    savedLanguage = browserLanguages.some(function (language) { return /^en(?:-|$)/i.test(String(language)); }) ? 'en' : 'zh';
  }
  document.querySelectorAll('[data-language]').forEach(function (button) { button.addEventListener('click', function () { setLanguage(button.getAttribute('data-language') || 'zh'); }); });
  setLanguage(savedLanguage);
  new MutationObserver(function (mutations) {
    if (currentLanguage !== 'en') return;
    mutations.forEach(function (mutation) {
      if (mutation.type === 'characterData') translateTextNode(mutation.target);
      mutation.addedNodes.forEach(translateTree);
    });
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
  window.GeekSlopeI18n = { language: function () { return currentLanguage; }, t: function (value) { return currentLanguage === 'en' ? englishFor(value) : value; }, apply: translateTree };
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', window.GeekSlopeI18n.t(open ? '打开菜单' : '关闭菜单'));
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

  var announcement = document.querySelector('[data-site-announcement]');
  if (announcement) {
    fetch('/api/public-notices?limit=1', { headers: { accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        var notice = data && data.notices && data.notices[0];
        if (!notice) return;
        var title = announcement.querySelector('[data-site-announcement-title]');
        var link = announcement.querySelector('[data-site-announcement-link]');
        if (!title || !link) return;
        var isCoupon = notice.kind === 'coupon' && notice.couponCode;
        title.textContent = isCoupon
          ? '🎉 新优惠上线！使用优惠码 ' + notice.couponCode + ' ' + (notice.couponBenefitZh || '')
          : (notice.title || '最新通告');
        link.href = isCoupon
          ? '/products?coupon=' + encodeURIComponent(notice.couponCode)
          : '/announcements/' + encodeURIComponent(notice.id);
        var action = link.querySelector('span');
        if (action) action.firstChild.textContent = isCoupon ? '去挑选设备 ' : '查看详情 ';
        announcement.hidden = false;
      })
      .catch(function () {});
  }

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
  function cleanIds(ids) {
    return ids.filter(function (id, index) { return typeof id === 'string' && id && ids.indexOf(id) === index; }).slice(0, 10);
  }
  function readCartState() {
    try {
      var value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (Array.isArray(value)) return { ids: cleanIds(value), term: null };
      return { ids: cleanIds(Array.isArray(value.items) ? value.items : []), term: value.term && typeof value.term === 'object' ? value.term : null };
    } catch (_) { return { ids: [], term: null }; }
  }
  function readCart() { return readCartState().ids; }
  function writeCart(ids, term) {
    var clean = cleanIds(ids);
    var state = { items: clean, term: term === undefined ? readCartState().term : term };
    try { localStorage.setItem(CART_KEY, JSON.stringify(state)); } catch (_) {}
    renderCart(clean);
    window.dispatchEvent(new CustomEvent('geekslope:cart-change', { detail: { ids: clean, term: state.term } }));
    return clean;
  }
  function renderCart(ids) {
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = String(ids.length);
      badge.hidden = ids.length === 0;
    });
    var cartLink = document.querySelector('.header-cart');
    if (cartLink) cartLink.setAttribute('aria-label', window.GeekSlopeI18n.t('购物车，' + ids.length + ' 件设备'));
    document.querySelectorAll('[data-cart-add]').forEach(function (button) {
      var added = ids.indexOf(button.getAttribute('data-device-id') || '') >= 0;
      button.classList.toggle('is-added', added);
      button.textContent = window.GeekSlopeI18n.t(added ? '已加入购物车' : '加入购物车');
      button.setAttribute('aria-pressed', String(added));
    });
  }
  function addToCart(id, term) {
    var state = readCartState();
    var ids = state.ids;
    if (ids.indexOf(id) < 0) ids.push(id);
    return writeCart(ids, term === undefined ? state.term : term);
  }
  function removeFromCart(id) { return writeCart(readCart().filter(function (item) { return item !== id; })); }
  function setCartTerm(term) { return writeCart(readCart(), term); }
  window.GeekSlopeCart = { read: readCart, readState: readCartState, write: writeCart, add: addToCart, remove: removeFromCart, setTerm: setCartTerm, clear: function () { return writeCart([]); } };
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
