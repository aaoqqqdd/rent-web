import { esc } from '../escape'
import type { SiteContact } from '../db'
import { renderBrand } from './brand'
import { FOOTER_BRAND_ICONS as icons } from './footer-icons'

export function publicHttpsUrl(value: string | undefined): string {
  try {
    const url = new URL(value || '')
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

function socialIcon(label: string, qrLabel: string, icon: string, urlValue?: string, qrValue?: string, fallbackQr = ''): string {
  const url = publicHttpsUrl(urlValue)
  const qr = publicHttpsUrl(qrValue) || fallbackQr
  const badge = `class="foot-social-icon" aria-label="${esc(label)}" title="${esc(label)}"`
  if (qr) return `<details class="foot-social-qr" name="footer-social"><summary ${badge}>${icon}</summary><div class="foot-social-panel"><img src="${esc(qr)}" alt="${esc(qrLabel)}" width="160" height="160" loading="lazy"><p>${esc(label)}</p>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">访问主页 ↗</a>` : ''}</div></details>`
  if (url) return `<a ${badge} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon}</a>`
  return `<div ${badge} role="img">${icon}</div>`
}

function paymentIcons(): string {
  const gift = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 11h18M12 6v15"/><path d="M12 6H8.5A2.5 2.5 0 1 1 11 3.5L12 6Zm0 0h3.5A2.5 2.5 0 1 0 13 3.5L12 6Z"/></svg>'
  const wallet = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v6h5"/><circle cx="16.5" cy="15" r=".7" fill="currentColor"/></svg>'
  const badges = [
    ['Visa', icons.visa, 'visa'],
    ['Mastercard', '<svg viewBox="0 0 40 24" aria-hidden="true"><circle cx="15" cy="12" r="10" fill="#eb001b"/><circle cx="25" cy="12" r="10" fill="#f79e1b"/><path d="M20 3.34a10 10 0 0 1 0 17.32 10 10 0 0 1 0-17.32" fill="#ff5f00"/></svg>', 'mastercard'],
    ['American Express', icons.americanexpress, 'amex'],
    ['Apple Pay', icons.applepay, 'apple-pay'],
    ['Google Pay', icons.googlepay, 'google-pay'],
  ].map(([label, icon, modifier]) => `<div class="foot-payment-badge foot-payment-${modifier}" role="img" aria-label="${label}" title="${label}">${icon}</div>`).join('')
  return `<div class="foot-payments" role="group" aria-label="支持的支付方式"><div class="foot-payment-icons">${badges}<div class="foot-payment-badge foot-payment-local" role="img" aria-label="礼品卡" title="礼品卡">${gift}<small>礼品卡</small></div><div class="foot-payment-badge foot-payment-local" role="img" aria-label="账户余额" title="账户余额">${wallet}<small>余额</small></div></div></div>`
}

export function renderSiteFooter(contact: SiteContact): string {
  const year = new Date().getFullYear()
  return /* html */ `
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${renderBrand(contact.name, contact.logo)}</a>
        <p data-i18n="footerIntro">为学习、工作、创作和临时项目提供可靠的电脑租赁。先看实时设备，再按实际使用时间申请。</p>
        <div style="width:280px;height:28px;overflow:hidden;margin-top:12px;">
          <iframe width="380" height="38" style="border:0;transform:scale(0.7368);transform-origin:top left;" src="https://climate.stripe.com/badge/EEGS4u?theme=dark&size=small&locale=zh-Hans"></iframe>
        </div>
        ${paymentIcons()}
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
        <a href="/referral">推广计划</a>
        <a href="/rental-guide#faq" data-i18n="faq">常见问题</a>
        <a href="/about" data-i18n="navAbout">关于我们</a>
        <a href="/about#contact" data-i18n="contactUs">联系我们</a>
      </div>
      <div class="foot-col foot-legal">
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
        <div class="foot-socials" role="group" aria-label="社交平台">
          ${socialIcon('微信', '微信二维码', icons.wechat, contact.wechatUrl, contact.wechatQrUrl, '/images/wechat-qr.jpg')}
          ${socialIcon('小红书', '小红书二维码', icons.xiaohongshu, contact.xiaohongshuUrl, contact.xiaohongshuQrUrl)}
          ${socialIcon('抖音', '抖音二维码', icons.tiktok, contact.douyinUrl, contact.douyinQrUrl)}
        </div>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${year} ${esc(contact.name)}. 保留所有权利。</span>
      <span>
        <a href="/cookie-policy" data-i18n="cookiePolicy">Cookie 政策</a>
        <a href="/about#contact" data-i18n="getHelp">获取帮助</a>
      </span>
    </div>
  </div>
</footer>`
}
