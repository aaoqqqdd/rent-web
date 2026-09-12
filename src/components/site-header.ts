import { esc } from '../escape'
import type { SiteContact } from '../db'
import type { SessionUser } from '../auth'
import { renderBrand } from './brand'

export interface HeaderOptions {
    path: string
    user?: SessionUser | null
    appUrl: string
}

export function renderSiteHeader(options: HeaderOptions, contact: SiteContact): string {
    const active = (path: string): string => options.path === path || options.path.startsWith(`${path}/`) ? ' aria-current="page"' : ''
    const accountAction = options.user
        ? /* html */ `<span class="nav-account"><a class="btn btn-primary header-account" href="/sso/start">进入用户中心</a><a class="nav-logout" href="/logout">退出</a></span>`
        : /* html */ `<a class="btn btn-primary header-account" href="${esc(options.appUrl)}/login">登录 / 注册</a>`
    return /* html */ `
<a class="skip-link" href="#main-content" data-i18n="skip">跳到主要内容</a>
<header class="site-header">
  <div class="wrap">
    <div class="header-brand-group">
      <a class="brand" href="/" aria-label="${esc(contact.name)} 首页">${renderBrand(contact.name, contact.logo)}</a>
      <span class="header-location">MELBOURNE · LOCAL RENTAL</span>
    </div>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="打开菜单" data-i18n-attr="aria-label:menuOpen">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="site-nav" aria-label="主导航">
      <a href="/products"${active('/products')} data-i18n="navProducts">产品目录</a>
      <a href="/rental-guide"${active('/rental-guide')} data-i18n="navGuide">租赁说明</a>
      <a href="/about"${active('/about')} data-i18n="navAbout">关于我们</a>
      <a href="/about#contact"${active('/about')} data-i18n="navContact">联系我们</a>
      <a href="/order-lookup"${active('/order-lookup')} data-i18n="navLookup">订单查询</a>
    </nav>
    <div class="header-actions">
      <a class="header-cart" href="/apply" aria-label="购物车，0 件设备"${active('/apply')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6.1M10 20h.01M17 20h.01"></path></svg>
        <span data-i18n="cart">购物车</span><b class="cart-count" data-cart-count hidden>0</b>
      </a>
      ${accountAction}
      <div class="language-switcher" role="group" aria-label="Language" data-i18n-attr="aria-label:language"><button type="button" data-language="zh">中</button><button type="button" data-language="en">EN</button></div>
    </div>
  </div>
</header>`
}