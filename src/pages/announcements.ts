import { esc } from '../layout'
import type { PublicNotice } from '../db'

function noticeDate(value: string): string {
    if (!value) return ''
    const date = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'))
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function noticeCard(notice: PublicNotice): string {
    return `<a class="notice-card" href="/announcements/${encodeURIComponent(notice.id)}">
  <span class="notice-card-kind">${notice.kind === 'coupon' ? '优惠活动' : '网站通告'}</span>
  <h2>${esc(notice.title)}</h2>
  <time datetime="${esc(notice.createdAt)}">${esc(noticeDate(notice.createdAt))}</time>
  <p>${esc(notice.message)}</p>
  <span class="text-link">查看详情 <svg class="notice-arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"></path></svg></span>
</a>`
}

export function renderAnnouncements(notices: PublicNotice[]): string {
    return `<section class="page-hero compact">
  <div class="wrap">
    <div class="kicker">最新消息</div>
    <h1>通告与优惠</h1>
    <p>这里会同步展示网站最新通告和当前有效的优惠码。</p>
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${notices.length ? `<div class="notice-grid">${notices.map(noticeCard).join('')}</div>` : '<div class="empty-state"><strong>暂时没有最新通告</strong><p>有新的服务消息或优惠活动时，会在这里显示。</p></div>'}
  </div>
</section>`
}

export function renderAnnouncementDetail(notice: PublicNotice | null): string {
    if (!notice) return '<section class="section"><div class="wrap"> <div class="empty-state"><strong>通告不存在或已失效</strong><p>这条消息可能已经撤回，或优惠码已过期。</p><a class="btn btn-primary" href="/announcements">返回通告列表</a></div></div></section>'
    return `<section class="page-hero compact">
  <div class="wrap">
    <div class="kicker">${notice.kind === 'coupon' ? '优惠活动' : '网站通告'}</div>
    <h1>${esc(notice.title)}</h1>
    <p>${esc(noticeDate(notice.createdAt))}</p>
  </div>
</section>
<section class="section">
  <div class="wrap notice-detail-wrap">
    <article class="notice-detail">
      <div class="notice-detail-message">${esc(notice.message)}</div>
      ${notice.kind === 'coupon' && notice.couponCode ? `<div class="coupon-callout"><span>结账时输入优惠码</span><strong>${esc(notice.couponCode)}</strong><em>立减 ${esc(notice.couponDiscount || '')}</em><a class="coupon-callout-link" href="/products">去挑选设备 <svg class="notice-arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"></path></svg></a></div>` : ''}
    </article>
    <a class="text-link" href="/announcements"><svg class="notice-arrow-icon notice-arrow-back" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"></path></svg>返回通告列表</a>
  </div>
</section>`
}
