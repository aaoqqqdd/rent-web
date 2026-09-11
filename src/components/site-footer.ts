import { esc } from '../escape'
import type { SiteContact } from '../db'
import { renderBrand } from './brand'

export function renderSiteFooter(contact: SiteContact): string {
    const year = new Date().getFullYear()
    return /* html */ `
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${renderBrand(contact.name, contact.logo)}</a>
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
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${year} ${esc(contact.name)}. 保留所有权利。</span>
      <span>
        <a href="/cookie-policy" data-i18n="cookiePolicy">Cookie 政策</a>
        <a href="/contact" data-i18n="getHelp">获取帮助</a>
      </span>
    </div>
  </div>
</footer>`
}