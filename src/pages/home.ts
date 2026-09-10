// 首页。结构还原参考稿：Hero → 四大保障 → 为你精选（实时读库）→ 三步流程 → 收尾 CTA。

import { esc } from '../layout'
import { monthlyRate, type Product } from '../db'

const FEATURES = [
  { t: '品质保障', d: '全新或翻新认证设备，性能稳定可靠', ic: 'M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z' },
  { t: '灵活租期', d: '按日、按周、按月，自由选择租赁周期', ic: 'M8 2v4M16 2v4M3 10h18M5 6h14v14H5z' },
  { t: '快速配送', d: '墨尔本 CBD 及内城区送货上门，最快当日达', ic: 'M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z' },
  { t: '专业售后', d: '7×12 小时技术支持，故障免费换机', ic: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v5M12 16h.01' },
]

const STEPS = [
  { n: '01', t: '选择设备', d: '浏览产品目录，按需求筛选配置，找到最适合你的设备。' },
  { n: '02', t: '提交申请', d: '填写租赁信息，选择租期，在线提交申请，全程无需线下跑腿。' },
  { n: '03', t: '确认配送', d: '审核通过后专业包装，墨尔本 CBD 及内城区（Docklands、South Yarra 等）送货上门或到店自取，最快当日到达。' },
]

const CARD_TAGS = ['热门', '推荐', '专业']

function productCard(p: Product, index: number, appUrl: string, multiplier: number): string {
  const daily = p.pricePerDay > 0 ? `$${p.pricePerDay}/day` : '询价'
  const monthly = p.pricePerDay > 0 ? `$${monthlyRate(p.pricePerDay, multiplier)}/month` : '—'
  const chips = p.specs.slice(0, 4).map((s) => `<span class="chip">${esc(s)}</span>`).join('')
  const rentHref = p.id ? `/apply?device=${encodeURIComponent(p.id)}` : '/apply'
  return /* html */ `
  <article class="card">
    <span class="tag">${esc(CARD_TAGS[index] ?? '精选')}</span>
    <h3>${esc(p.categoryLabel)}</h3>
    <p class="sub">${esc(p.name)}${p.model ? ` · ${esc(p.model)}` : ''}</p>
    <div class="chips">${chips || '<span class="chip">配置待更新</span>'}</div>
    <div class="price-row">
      <div><div class="lbl">日租</div><div class="val">${esc(daily)}</div></div>
      <div><div class="lbl">月租</div><div class="val">${esc(monthly)} <small>参考</small></div></div>
    </div>
    ${p.depositAmount > 0 ? `<div class="deposit">押金 $${esc(p.depositAmount)}（可退）</div>` : ''}
    <a class="btn btn-primary" href="${rentHref}">立即租赁</a>
  </article>`
}

interface HomeData {
  featured: Product[]
  minRate: number
  appUrl: string
  multiplier: number
}

export function renderHome(data: HomeData): string {
  const { featured, minRate, appUrl, multiplier } = data
  const fromLine = minRate > 0 ? `最低 $${minRate}/day 起` : '灵活租期，按需计费'

  return /* html */ `
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">专业电脑租赁平台</span>
    <h1>租一台好电脑</h1>
    <div class="lede-accent">随时开始创造</div>
    <p>GeekSlope 为学生和个人用户提供高品质电脑租赁服务。灵活租期，快速配送，专业售后，让你专注于真正重要的事。${esc(fromLine)}。</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="/products">浏览产品</a>
      <a class="btn btn-ghost btn-lg" href="/rental-guide">了解租赁流程</a>
    </div>
  </div>
</section>

<section class="features">
  <div class="wrap">
    ${FEATURES.map(
      (f) => `
    <div class="feature">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${f.ic}"/></svg>
      <h3>${f.t}</h3>
      <p>${f.d}</p>
    </div>`,
    ).join('')}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">热门产品</div>
      <h2>为你精选的设备</h2>
    </div>
    <div class="grid">
      ${
        featured.length
          ? featured.map((p, i) => productCard(p, i, appUrl, multiplier)).join('')
          : '<p style="color:var(--muted-fg)">产品目录正在更新，请稍后再来。</p>'
      }
    </div>
    <div class="center-cta"><a class="btn btn-ghost" href="/products">查看全部产品</a></div>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">租赁流程</div>
      <h2>三步完成租赁</h2>
    </div>
    <div class="steps">
      ${STEPS.map(
        (s) => `
      <div class="step">
        <div class="n">${s.n}</div>
        <h3>${s.t}</h3>
        <p>${s.d}</p>
      </div>`,
      ).join('')}
    </div>
  </div>
</section>

<section class="section closing">
  <div class="wrap">
    <h2>准备好了吗？</h2>
    <p>立即浏览我们的产品目录，找到最适合你的设备，开始你的创作之旅。</p>
    <a class="btn btn-primary btn-lg" href="/apply">开始租赁</a>
  </div>
</section>`
}
