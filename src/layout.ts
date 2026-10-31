// 页面外壳：<head>、顶栏、页脚。所有页面通过 renderPage() 拼装。

import type { SiteContact } from './db'
import { STYLE_VERSION } from './theme'
import { ENGLISH_COPY, ENGLISH_PATTERNS } from './i18n'
import type { SessionUser } from './auth'
import { esc } from './escape'
import { renderSiteHeader } from './components/site-header'
import { ACCOUNT_STATUS_SCRIPT } from './components/account-status'
import { renderSiteFooter } from './components/site-footer'
import { renderFeedbackUi, FEEDBACK_SCRIPT } from './components/feedback'
import { FAVICON_SVG } from './components/brand'
import { SITE_URL } from './seo'

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
  const siteUrl = (opts.siteUrl || SITE_URL).replace(/\/$/, '')
  const canonicalPath = opts.path === '*' ? '/' : opts.path
  const canonicalUrl = siteUrl + canonicalPath
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: opts.contact.name,
    url: siteUrl,
    areaServed: { '@type': 'City', name: 'Melbourne', containedInPlace: { '@type': 'State', name: 'Victoria, Australia' } },
    knowsLanguage: ['zh-CN', 'en-AU'],
    // The D1 fallback contact details are placeholders, not business facts.
    ...(opts.contact.email !== 'hello@geekslope.com' ? { email: opts.contact.email } : {}),
    ...(opts.contact.phone !== '400-888-0000' ? { telephone: opts.contact.phone } : {}),
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', availableLanguage: ['Chinese', 'English'], url: `${siteUrl}/about#contact` },
  }
  if (/^https?:\/\//i.test(opts.contact.logo)) organization.logo = opts.contact.logo
  const pageSchemas = Array.isArray(opts.structuredData)
    ? opts.structuredData
    : opts.structuredData ? [opts.structuredData] : []
  const webpageId = `${canonicalUrl}#webpage`
  const webpage = {
    '@type': 'WebPage', '@id': webpageId, url: canonicalUrl,
    name: opts.title, description: opts.description, inLanguage: 'zh-CN',
    isPartOf: { '@id': `${siteUrl}/#website` },
    about: { '@id': `${siteUrl}/#organization` },
  }
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: opts.contact.name, inLanguage: 'zh-CN', publisher: { '@id': `${siteUrl}/#organization` } },
      ...(pageSchemas.some((schema) => schema['@id'] === webpageId) ? [] : [webpage]),
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
<!-- Google Tag Manager -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WNG9QDTP');
</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9RVM8D3FG2"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-9RVM8D3FG2');
</script>
<script>
(() => {
  // Resolve the presentation language before CSS/paint so html[lang] and
  // html[data-lang] are already correct on the first frame. Auto-detection is
  // deliberately NOT written back to localStorage; only an explicit toggle
  // persists a choice (see setLanguage(..., persist)).
  var language = 'zh';
  try {
    var stored = localStorage.getItem('geekslope-language');
    if (stored === 'en' || stored === 'zh') {
      language = stored;
    } else {
      var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
      language = /^en(?:-|$)/i.test(String(languages[0] || '')) ? 'en' : 'zh';
    }
  } catch (_) {}
  var root = document.documentElement;
  root.setAttribute('data-lang', language);
  root.lang = language === 'en' ? 'en-AU' : 'zh-CN';
})();
</script>
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="robots" content="${esc(opts.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')}">
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
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WNG9QDTP"
height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
${renderSiteHeader({ path: opts.path, user: opts.user, appUrl: opts.appUrl }, opts.contact)}
<div data-site-announcement hidden>
<aside class="site-announcement" data-notice-banner="policy" hidden aria-label="协议更新">
  <div class="wrap site-announcement-inner">
    <span class="site-announcement-label">协议更新</span>
    <a class="site-announcement-link" data-site-announcement-link href="/announcements">
      <strong data-site-announcement-title></strong><span data-site-announcement-action>查看详情 <span aria-hidden="true">→</span></span>
    </a>
  </div>
</aside>
<aside class="site-announcement" data-notice-banner="coupon" hidden aria-label="优惠码">
  <div class="wrap site-announcement-inner">
    <span class="site-announcement-label">优惠码</span>
    <a class="site-announcement-link" data-site-announcement-link href="/products">
      <strong data-site-announcement-title></strong><span data-site-announcement-action>去挑选设备 <span aria-hidden="true">→</span></span>
    </a>
  </div>
</aside>
</div>
<main id="main-content">
${opts.body}
</main>
${renderFeedbackUi()}
${renderSiteFooter(opts.contact)}
<script>${ACCOUNT_STATUS_SCRIPT}</script>
<script>
(() => {
  var englishCopy = ${englishCopy};
  var englishPatterns = ${englishPatterns}.map(function (entry) { return [new RegExp(entry[0]), entry[1]]; });
  var textState = new WeakMap();
  var attrState = new WeakMap();
  var i18nTextNodes = new WeakMap();
  var originalTitle = document.title;
  var originalDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  var currentLanguage = 'zh';
  var activeNotices = [];
  var SKIP_SELECTOR = 'script,style,[data-no-translate],[data-i18n],[data-i18n-attr]';
  var TRANSLATED_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt', 'value', 'aria-valuetext', 'aria-roledescription', 'label'];
  // NOTE: this whole block lives inside a TS template literal; every regex
  // backslash and escape (\\n, \\s, \\p{Script=Han}, \\/) must be doubled in the
  // source or it is eaten before it reaches the browser.
  function hasHan(value) { return /\\p{Script=Han}/u.test(String(value || '')); }
  // 正则模式里捕获组可能来自数据库（例如配送区域列表），只做安全的少量地名 / 标点归一化，
  // 不做通用短语替换，避免出现 “Delivery 时段 / Services 费” 这种中英混杂。
  function normalizePatternResult(value) {
    return String(value || '')
      .replaceAll('墨尔本 CBD 及周边地区', 'Melbourne CBD and nearby areas')
      .replaceAll('墨尔本 CBD', 'Melbourne CBD')
      .replaceAll('墨尔本', 'Melbourne')
      .replaceAll('、', ', ');
  }
  function englishFor(value) {
    var lookup = String(value || '').replace(/\\s+/g, ' ').trim();
    if (!lookup) return null;
    var translated = englishCopy[lookup];
    if (translated == null) {
      for (var i = 0; i < englishPatterns.length; i += 1) {
        if (englishPatterns[i][0].test(lookup)) { translated = normalizePatternResult(lookup.replace(englishPatterns[i][0], englishPatterns[i][1])); break; }
      }
    }
    if (translated == null) return null;
    return translated;
  }
  function t(value) {
    if (currentLanguage !== 'en') return value;
    var translated = englishFor(value);
    return translated == null ? value : translated;
  }
  function currentCopy(zh, en) { return currentLanguage === 'en' ? en : zh; }
  function cleanEnglishPunctuation(value) { return String(value || '').replace(/。/g, ''); }
  function sentenceBreak(value, node) {
    var text = String(value || '');
    if (text.indexOf('；') < 0) return text;
    if (node && node.parentElement) node.parentElement.classList.add('has-sentence-break');
    return text.replace(/；/g, '\\n');
  }
  function clearSentenceBreaks() {
    document.querySelectorAll('.has-sentence-break').forEach(function (element) { element.classList.remove('has-sentence-break'); });
  }
  function translateTextNode(node) {
    if (!node || !node.parentElement || node.parentElement.closest(SKIP_SELECTOR)) return;
    var current = node.nodeValue || '';
    var state = textState.get(node);
    if (!state || state.lastWritten !== current) {
      state = { source: current, lastWritten: current };
      textState.set(node, state);
    }
    var source = state.source;
    var trimmed = source.trim();
    if (!trimmed) return;
    var start = source.indexOf(trimmed);
    var next;
    if (currentLanguage === 'en') {
      var english = englishFor(trimmed);
      if (english == null) {
        next = source;
      } else {
        next = source.slice(0, start) + sentenceBreak(cleanEnglishPunctuation(english), node) + source.slice(start + trimmed.length);
      }
    } else {
      next = source;
    }
    if (node.nodeValue !== next) node.nodeValue = next;
    state.lastWritten = next;
  }
  function translateElement(element) {
    if (!element || element.closest(SKIP_SELECTOR)) return;
    var states = attrState.get(element);
    if (!states) { states = {}; attrState.set(element, states); }
    TRANSLATED_ATTRIBUTES.forEach(function (attribute) {
      var current = element.getAttribute(attribute);
      if (current == null) return;
      var state = states[attribute];
      if (!state || state.lastWritten !== current) {
        state = { source: current, lastWritten: current };
        states[attribute] = state;
      }
      if (currentLanguage !== 'en' && state.source === current) return;
      if (!hasHan(state.source)) return;
      var translated = currentLanguage === 'en' ? englishFor(state.source) : state.source;
      if (translated == null) return;
      var next = currentLanguage === 'en' ? cleanEnglishPunctuation(translated) : translated;
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
      state.lastWritten = next;
    });
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
    navProducts: ['产品目录', 'Products'], navGiftCards: ['礼品卡', 'Gift cards'], navGuide: ['租赁说明', 'Rental guide'], navAbout: ['关于我们', 'About us'], navLookup: ['订单查询', 'Order Details'],
    cart: ['购物车', 'Cart'], account: ['账号中心', 'Account'], footerIntro: ['为学习、工作、创作和临时项目提供可靠的电脑租赁。先看实时设备，再按实际使用时间申请。', 'Reliable computer rentals for study, work, creative projects and short-term needs. Browse live inventory and apply for the time you need.'],
    footerProducts: ['产品', 'Products'], gaming: ['游戏笔记本', 'Gaming laptops'], ultrabook: ['轻薄商务本', 'Ultrabooks'], workstation: ['台式工作站', 'Workstations'], allProducts: ['全部产品', 'All products'], giftCards: ['礼品卡', 'Gift cards'],
    footerServices: ['服务', 'Services'], rentalGuide: ['租赁说明', 'Rental guide'], faq: ['常见问题', 'FAQ'], contactUs: ['联系我们', 'Contact us'], terms: ['条款', 'Legal'], userTerms: ['用户协议', 'User terms'], serviceTerms: ['服务条款', 'Service terms'], refundPolicy: ['退款政策', 'Refund policy'], privacy: ['隐私政策', 'Privacy'], cookiePolicy: ['Cookie 政策', 'Cookie policy'], footerContact: ['联系我们', 'Contact'], getHelp: ['获取帮助', 'Get help'],
    giftCardEyebrow: ['GEEKSLOPE · 礼品卡', 'GEEKSLOPE · Gift cards'], giftCardIntro: ['购买一张 GeekSlope Square eGift Card，用于设备租赁；也可以随时查询余额或给现有礼品卡加值。', 'Buy a GeekSlope Square eGift Card for device rentals, or check and reload an existing card anytime.'], giftCardOpen: ['打开礼品卡页面', 'Open gift card page'], giftCardRent: ['查看租赁设备', 'View rental devices'],
    giftCardKicker: ['SQUARE EGIFT CARD', 'SQUARE EGIFT CARD'], giftCardHeading: ['三个入口，一个礼品卡页面', 'Three actions, one gift card page'], giftCardDescription: ['Square 托管支付、收件人与礼品卡交付。点击任一入口后，会在 Square 页面完成对应操作。', 'Square handles payment, recipient details and delivery. Select an action to continue on Square.'],
    giftCardBuy: ['购买礼品卡', 'Buy a gift card'], giftCardCheck: ['查询余额', 'Check balance'], giftCardAdd: ['给礼品卡加值', 'Add money'],
    giftCardBuyText: ['选择金额、填写收件人和祝福语，付款后由 Square 发送数字礼品卡。', 'Choose an amount, add the recipient and message, then Square sends the digital gift card after payment.'],
    giftCardCheckText: ['打开礼品卡页面，输入 16 位卡号和 PIN（如有）查看实时余额。', 'Open the gift card page and enter the 16-digit card number and PIN, if applicable, to view the live balance.'],
    giftCardAddText: ['已有礼品卡？在 Square 页面选择 Reload card，为卡片增加新的金额。', 'Already have a card? Select Reload card on Square to add more value.'],
    giftCardNoteKicker: ['HOW IT WORKS', 'HOW IT WORKS'], giftCardNoteTitle: ['礼品卡可以用于 GeekSlope 租赁', 'Use your gift card for GeekSlope rentals'],
    giftCardNoteText: ['购买完成后，请保留礼品卡邮件中的卡号。下单或付款时选择礼品卡即可使用；余额不足时，可按页面提示完成差额支付。如需将礼品卡用于租赁，请在提交申请前联系客服确认使用方式。', 'Keep the card number from the gift card email. Select the gift card when ordering or paying; if the balance is not enough, follow the prompts to pay the remainder. If you want to use the card for a rental, contact us before submitting your application to confirm the available payment method.']
  };
  function renderCouponCallouts() {
    document.querySelectorAll('[data-coupon-callout]').forEach(function (callout) {
      var english = currentLanguage === 'en';
      var prefix = callout.querySelector('[data-coupon-prefix]');
      var benefit = callout.querySelector('[data-coupon-benefit]');
      var cta = callout.querySelector('[data-coupon-cta]');
      if (prefix) prefix.textContent = callout.getAttribute(english ? 'data-coupon-prefix-en' : 'data-coupon-prefix-zh') || '';
      if (benefit) benefit.textContent = callout.getAttribute(english ? 'data-coupon-benefit-en' : 'data-coupon-benefit-zh') || '';
      if (cta) cta.textContent = callout.getAttribute(english ? 'data-coupon-cta-en' : 'data-coupon-cta-zh') || '';
    });
  }
  function renderCouponMessages() {
    document.querySelectorAll('[data-coupon-message]').forEach(function (message) {
      message.textContent = message.getAttribute(currentLanguage === 'en' ? 'data-coupon-message-en' : 'data-coupon-message-zh') || '';
    });
  }
  function renderNoticeTexts() {
    var english = currentLanguage === 'en';
    document.querySelectorAll('[data-notice-title]').forEach(function (node) {
      node.textContent = node.getAttribute(english ? 'data-notice-title-en' : 'data-notice-title-zh') || '';
    });
    document.querySelectorAll('[data-notice-message]').forEach(function (node) {
      var text = node.getAttribute(english ? 'data-notice-message-en' : 'data-notice-message-zh') || '';
      node.innerHTML = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/&lt;strong&gt;([^<]+)&lt;\\/strong&gt;/g, '<strong>$1</strong>')
        .replace(/\\n/g, '<br>');
    });
  }
  function setI18nText(element, value) {
    var saved = i18nTextNodes.get(element);
    if (!saved || !element.contains(saved.node)) {
      var textNode = Array.prototype.slice.call(element.childNodes).find(function (node) { return node.nodeType === Node.TEXT_NODE && /\\S/.test(node.nodeValue || ''); });
      if (!textNode) { element.textContent = value; return; }
      var source = textNode.nodeValue || '';
      saved = { node: textNode, prefix: (source.match(/^\\s*/) || [''])[0], suffix: (source.match(/\\s*$/) || [''])[0] };
      i18nTextNodes.set(element, saved);
    }
    saved.node.nodeValue = saved.prefix + value + saved.suffix;
  }
  function announcementTitle(notice, english) {
    if (notice.kind === 'coupon' && notice.couponCode) {
      var benefit = english ? (notice.couponBenefitEn || notice.couponBenefitZh || '') : (notice.couponBenefitZh || '');
      return (english ? '🎉 New offer live! Enter promo code ' : '🎉 新优惠上线！使用优惠码 ') + notice.couponCode + (benefit ? ' ' + benefit : '');
    }
    return english && notice.titleEn ? notice.titleEn
      : (!notice.isAdminAnnouncement && english ? (englishFor(notice.title || '最新通告') || 'Latest update') : (notice.title || '最新通告'));
  }
  function renderNoticeBanners() {
    var announcement = document.querySelector('[data-site-announcement]');
    if (!announcement) return;
    announcement.querySelectorAll('[data-notice-banner]').forEach(function (banner) {
      var isCoupon = banner.getAttribute('data-notice-banner') === 'coupon';
      var notice = activeNotices.find(function (item) {
        return isCoupon ? item.kind === 'coupon' && item.couponCode
          : item.kind === 'announcement' && item.isAdminAnnouncement === false;
      });
      banner.hidden = !notice;
      if (!notice) return;
      banner.querySelector('[data-site-announcement-title]').textContent = announcementTitle(notice, currentLanguage === 'en');
      banner.querySelector('[data-site-announcement-link]').href = isCoupon
        ? '/products?coupon=' + encodeURIComponent(notice.couponCode)
        : '/announcements/' + encodeURIComponent(notice.id);
      banner.querySelector('[data-site-announcement-action]').firstChild.textContent = currentCopy(isCoupon ? '去挑选设备 ' : '查看详情 ', isCoupon ? 'Browse devices ' : 'View details ');
    });
    announcement.hidden = !announcement.querySelector('[data-notice-banner]:not([hidden])');
  }
  function showAnnouncementNotice(notice) {
    if (!notice || !window.GeekSlopeUI || document.querySelector('dialog[open]')) return;
    var seenKey = 'geekslope-announcement-seen';
    var version = JSON.stringify(notice);
    try { if (sessionStorage.getItem(seenKey) === version) return; } catch (_) {}
    var message = notice.message || '';
    var messageEn = notice.messageEn || message;
    // Public policy notices may contain <strong> markers; the feedback layer uses plain text.
    var plainText = function (text) { return String(text).replace(/<\\/?strong>/gi, ''); };
    window.GeekSlopeUI.confirm({
      title: { zh: announcementTitle(notice, false), en: announcementTitle(notice, true) },
      message: { zh: plainText(message), en: plainText(messageEn) },
      confirmText: { zh: '查看详情', en: 'View details' },
      cancelText: { zh: '关闭通知', en: 'Close notification' }
    }).then(function (confirmed) {
      if (confirmed) window.location.href = '/announcements/' + encodeURIComponent(notice.id);
    });
    // Keep navigation within this visit quiet; updated notices can still appear.
    try { sessionStorage.setItem(seenKey, version); } catch (_) {}
  }
  function updateMeta(english) {
    var title = english ? (englishFor(originalTitle) || originalTitle) : originalTitle;
    var description = english ? (englishFor(originalDescription) || originalDescription) : originalDescription;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', english ? 'en_AU' : 'zh_CN');
  }
  function renderMenuToggle() {
    var toggle = document.querySelector('.menu-toggle');
    if (!toggle) return;
    var open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-label', currentCopy(open ? '关闭菜单' : '打开菜单', open ? 'Close menu' : 'Open menu'));
  }
  function renderCart(ids) {
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = String(ids.length);
      badge.hidden = ids.length === 0;
    });
    var cartLink = document.querySelector('.header-cart');
    if (cartLink) {
      cartLink.setAttribute('aria-label', ids.length === 1
        ? currentCopy('购物车，1 件设备', 'Cart, 1 device')
        : currentCopy('购物车，' + ids.length + ' 件设备', 'Cart, ' + ids.length + ' devices'));
    }
    document.querySelectorAll('[data-cart-add]').forEach(function (button) {
      var added = ids.indexOf(button.getAttribute('data-device-id') || '') >= 0;
      button.classList.toggle('is-added', added);
      button.textContent = currentCopy(added ? '已加入购物车' : '加入购物车', added ? 'Added to cart' : 'Add to cart');
      button.setAttribute('aria-pressed', String(added));
    });
  }
  function setLanguage(language, persist) {
    var english = language === 'en';
    currentLanguage = english ? 'en' : 'zh';
    var root = document.documentElement;
    root.lang = english ? 'en-AU' : 'zh-CN';
    root.setAttribute('data-lang', currentLanguage);
    clearSentenceBreaks();
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n'); var value = translations[key];
      if (value) setI18nText(node, value[english ? 1 : 0]);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      String(node.getAttribute('data-i18n-attr') || '').split(',').forEach(function (item) { var parts = item.split(':'); var value = translations[parts[1]]; if (value) node.setAttribute(parts[0], value[english ? 1 : 0]); });
    });
    document.querySelectorAll('[data-language]').forEach(function (button) { button.classList.toggle('is-active', button.getAttribute('data-language') === (english ? 'en' : 'zh')); });
    translateTree(document.body);
    renderNoticeBanners();
    renderCouponCallouts();
    renderCouponMessages();
    renderNoticeTexts();
    renderMenuToggle();
    renderCart(readCart());
    updateMeta(english);
    if (persist) { try { localStorage.setItem('geekslope-language', english ? 'en' : 'zh'); } catch (_) {} }
    window.dispatchEvent(new CustomEvent('geekslope:language-change', { detail: { language: currentLanguage } }));
  }
  var initialLanguage = 'zh';
  var dataLanguage = document.documentElement.getAttribute('data-lang');
  if (dataLanguage === 'en' || dataLanguage === 'zh') {
    initialLanguage = dataLanguage;
  } else {
    try {
      var storedLanguage = localStorage.getItem('geekslope-language');
      if (storedLanguage === 'en' || storedLanguage === 'zh') {
        initialLanguage = storedLanguage;
      } else {
        var browserLanguages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
        initialLanguage = /^en(?:-|$)/i.test(String(browserLanguages[0] || '')) ? 'en' : 'zh';
      }
    } catch (_) {}
  }
  function ensureLanguageButtons() {
    document.querySelectorAll('[data-language]').forEach(function (button) {
      if (button.dataset.languageBound === 'true') return;
      button.dataset.languageBound = 'true';
      button.addEventListener('click', function () { setLanguage(button.getAttribute('data-language') || 'zh', true); });
    });
  }
  var CART_KEY = 'geekslope-cart-v1';
  function cleanIds(ids) {
    var clean = ids.filter(function (id, index) { return typeof id === 'string' && id && ids.indexOf(id) === index; }).slice(0, 10);
    var validProductIds = window.__GeekSlopeCartValidProductIds;
    return Array.isArray(validProductIds) ? clean.filter(function (id) { return validProductIds.indexOf(id) >= 0; }) : clean;
  }
  function readCartState() {
    try {
      var value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (Array.isArray(value)) return { ids: cleanIds(value), term: null, terms: {} };
      return { ids: cleanIds(Array.isArray(value.items) ? value.items : []), term: value.term && typeof value.term === 'object' ? value.term : null, terms: value.terms && typeof value.terms === 'object' ? value.terms : {} };
    } catch (_) { return { ids: [], term: null, terms: {} }; }
  }
  function readCart() { return readCartState().ids; }
  function writeCart(ids, term, terms) {
    var clean = cleanIds(ids);
    var previous = readCartState();
    var state = { items: clean, term: term === undefined ? previous.term : term, terms: terms === undefined ? previous.terms : terms };
    try { localStorage.setItem(CART_KEY, JSON.stringify(state)); } catch (_) {}
    renderCart(clean);
    window.dispatchEvent(new CustomEvent('geekslope:cart-change', { detail: { ids: clean, term: state.term, terms: state.terms } }));
    return clean;
  }
  function addToCart(id, term) {
    var state = readCartState();
    var ids = state.ids;
    if (ids.indexOf(id) < 0) ids.push(id);
    var terms = state.terms || {};
    if (term !== undefined) terms[id] = term;
    return writeCart(ids, undefined, terms);
  }
  function removeFromCart(id) { return writeCart(readCart().filter(function (item) { return item !== id; })); }
  function setCartTerm(term) { return writeCart(readCart(), term); }
  window.GeekSlopeCart = { read: readCart, readState: readCartState, write: writeCart, add: addToCart, remove: removeFromCart, setTerm: setCartTerm, clear: function () { return writeCart([]); } };

  window.GeekSlopeI18n = { language: function () { return currentLanguage; }, t: t, apply: translateTree, englishFor: englishFor };
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === 'characterData') translateTextNode(mutation.target);
      else if (mutation.type === 'attributes') translateElement(mutation.target);
      else mutation.addedNodes.forEach(translateTree);
    });
  }).observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: TRANSLATED_ATTRIBUTES, subtree: true });
  ensureLanguageButtons();
  // The initial pass must not persist auto-detected language; only explicit
  // switcher clicks do (persist=true).
  setLanguage(initialLanguage, false);

  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  var siteHeader = document.querySelector('.site-header');
  var announcement = document.querySelector('[data-site-announcement]');
  function closeMenu(restoreFocus) {
    if (!toggle || !nav) return;
    if (toggle.getAttribute('aria-expanded') !== 'true') return;
    toggle.setAttribute('aria-expanded', 'false');
    renderMenuToggle();
    nav.classList.remove('is-open');
    if (restoreFocus) toggle.focus();
  }
  function openMenu() {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', 'true');
    renderMenuToggle();
    nav.classList.add('is-open');
    var firstLink = nav.querySelector('a');
    if (firstLink) firstLink.focus();
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeMenu(false); else openMenu();
    });
    nav.addEventListener('click', function (event) { if (event.target.closest('a')) closeMenu(false); });
    // 点击菜单外 / 按 Esc / 视口变宽时收起菜单（移动端常见预期，也避免焦点留在隐藏元素里）。
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) { event.preventDefault(); closeMenu(true); }
    });
    if (window.matchMedia) {
      var wideViewport = window.matchMedia('(min-width: 1181px)');
      var onViewportChange = function (event) { if (event.matches) closeMenu(false); };
      if (wideViewport.addEventListener) wideViewport.addEventListener('change', onViewportChange);
      else if (wideViewport.addListener) wideViewport.addListener(onViewportChange);
    }
  }
  // Toast 区域要贴在「sticky header + 通告条」正下方，否则手机上会盖住通告。
  function syncOverlayOffset() {
    var offset = (siteHeader ? siteHeader.offsetHeight : 0) + (announcement && !announcement.hidden ? announcement.offsetHeight : 0) + 14;
    document.documentElement.style.setProperty('--gs-overlay-top', offset + 'px');
  }
  syncOverlayOffset();
  window.addEventListener('resize', syncOverlayOffset, { passive: true });
  window.addEventListener('geekslope:language-change', syncOverlayOffset);
  var onScroll = function () { if (siteHeader) siteHeader.classList.toggle('is-scrolled', window.scrollY > 18); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (announcement) {
    fetch('/api/public-notices?limit=100', { headers: { accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        activeNotices = data && Array.isArray(data.notices) ? data.notices : [];
        renderNoticeBanners();
        syncOverlayOffset();
        showAnnouncementNotice(activeNotices.find(function (notice) {
          return notice.kind === 'announcement' && notice.isAdminAnnouncement === true;
        }));
      })
      .catch(function () {});
  }
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
})();
</script>
${FEEDBACK_SCRIPT}
<script>
var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
(function () {
  // Lazy-load live chat after the page is interactive so it never competes
  // with first paint (CSP allowlists the Tawk hosts; no crossorigin attr).
  var loaded = false;
  function loadTawk() {
    if (loaded) return;
    loaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.tawk.to/6aa7f5bf739506344185fac9/1k2g1fsvm';
    script.charset = 'UTF-8';
    document.head.appendChild(script);
  }
  function schedule() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(loadTawk, { timeout: 3000 });
    else window.setTimeout(loadTawk, 600);
  }
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
</script>
</body>
</html>`
}
