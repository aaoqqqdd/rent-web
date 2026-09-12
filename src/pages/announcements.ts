import { esc } from '../layout'
import type { PublicNotice } from '../db'

function noticeDate(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function noticeMessage(value: string): string {
    return esc(value)
        .replace(/&lt;strong&gt;([^<]+)&lt;\/strong&gt;/g, '<strong>$1</strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
}

function noticeCard(notice: PublicNotice): string {
    const isCoupon = notice.kind === 'coupon' && Boolean(notice.couponCode)
    const href = isCoupon ? `/products?coupon=${encodeURIComponent(notice.couponCode || '')}` : `/announcements/${encodeURIComponent(notice.id)}`
    const title = isCoupon ? `🎉 新优惠上线！使用优惠码 ${notice.couponCode} ${notice.couponBenefitZh || ''}` : notice.title
    return `<a class="notice-card" href="${href}">
  <span class="notice-card-kind">${notice.kind === 'coupon' ? '优惠活动' : '网站通告'}</span>
  <h2>${esc(title)}</h2>
  <time datetime="${esc(notice.createdAt)}">${esc(noticeDate(notice.createdAt))}</time>
  <p>${esc(notice.message)}</p>
  <span class="text-link">${isCoupon ? '去挑选设备' : '查看详情'} <span aria-hidden="true">→</span></span>
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
      <div class="notice-detail-message">${noticeMessage(notice.message)}</div>
      ${notice.kind === 'coupon' && notice.couponCode ? `<div class="coupon-callout" data-coupon-prefix-zh="🎉 新优惠上线！使用优惠码" data-coupon-prefix-en="🎉 New offer live! Enter promo code" data-coupon-benefit-zh="${esc(notice.couponBenefitZh || '')}" data-coupon-benefit-en="${esc(notice.couponBenefitEn || '')}" data-coupon-cta-zh="去挑选设备" data-coupon-cta-en="Browse devices"><span data-coupon-prefix>🎉 新优惠上线！使用优惠码</span><strong>${esc(notice.couponCode)}</strong><em data-coupon-benefit>${esc(notice.couponBenefitZh || '')}</em><a class="coupon-callout-link" href="/products?coupon=${encodeURIComponent(notice.couponCode)}"><span data-coupon-cta>去挑选设备</span> <span aria-hidden="true">→</span></a></div>` : ''}
    </article>
    <a class="text-link" href="/announcements">← 返回通告列表</a>
  </div>
</section>`
}
