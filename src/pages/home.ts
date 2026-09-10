// 首页。结构还原参考稿：Hero → 四大保障 → 为你精选（实时读库）→ 三步流程 → 收尾 CTA。

import { esc } from '../layout'
import { monthlyRate, type Product, type RentalConfig } from '../db'

const FEATURES = [
  { t: '交付前检测', d: '基础功能、外观与配件逐项确认，拿到手即可开工', ic: 'M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z' },
  { t: '租期可调整', d: '短租应急或长期项目都可以，到期前还能申请续租', ic: 'M8 2v4M16 2v4M3 10h18M5 6h14v14H5z' },
  { t: '本地交付', d: '墨尔本 CBD 与内城区可配送，其他区域支持门店自取', ic: 'M3 7h11v8H3zM14 10h4l3 3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z' },
  { t: '租期内支持', d: '7×12 小时技术支持，符合条件的故障安排换机', ic: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v5M12 16h.01' },
]

const STEPS = [
  { n: '01', t: '选择设备与租期', d: '按用途、预算和配置筛选，打开详情确认设备规格，再填写取还日期。' },
  { n: '02', t: '提交租赁申请', d: '留下联系与取还信息。提交只是锁定申请，不会立即扣款。' },
  { n: '03', t: '确认后签约交付', d: '管理员确认档期与费用后联系你，在线完成签约与付款，再配送或安排自取。' },
]

const CARD_TAGS = ['热门', '推荐', '专业']

function productCard(p: Product, index: number, multiplier: number): string {
  const daily = p.pricePerDay > 0 ? `$${p.pricePerDay}/day` : '询价'
  const monthly = p.pricePerDay > 0 ? `$${monthlyRate(p.pricePerDay, multiplier)}/month` : '—'
  const chips = p.specs.slice(0, 4).map((s) => `<span class="chip">${esc(s)}</span>`).join('')
  const detailHref = p.id ? `/products/${encodeURIComponent(p.id)}` : '/products'
  return /* html */ `
  <article class="card product-card featured-card">
    <div class="product-visual compact-visual" aria-hidden="true"><span class="device-screen"><i></i></span><span class="device-base"></span><span class="visual-code">${esc(p.category === 'workstation' ? 'WS' : p.category === 'gaming' ? 'RTX' : 'MOB')}</span></div>
    <div class="card-top"><span class="tag"><i></i>${esc(CARD_TAGS[index] ?? '精选')}</span><span class="card-code">${esc(p.categoryLabel)}</span></div>
    <h3><a href="${detailHref}">${esc(p.name)}</a></h3>
    <p class="sub">${esc(p.categoryLabel)}${p.model ? ` · ${esc(p.model)}` : ''}</p>
    <div class="chips">${chips || '<span class="chip">配置待更新</span>'}</div>
    <div class="price-row">
      <div><div class="lbl">日租</div><div class="val">${esc(daily)}</div></div>
      <div><div class="lbl">月租</div><div class="val">${esc(monthly)} <small>参考</small></div></div>
    </div>
    ${p.depositAmount > 0 ? `<div class="deposit">押金 $${esc(p.depositAmount)}（可退）</div>` : ''}
    <div class="card-actions"><a class="btn btn-ghost" href="${detailHref}">详情</a><button class="btn btn-primary" type="button" data-cart-add data-device-id="${esc(p.id)}" aria-pressed="false">加入购物车</button></div>
  </article>`
}

interface HomeData {
  featured: Product[]
  minRate: number
  multiplier: number
  config: RentalConfig
}

export function renderHome(data: HomeData): string {
  const { featured, minRate, multiplier, config } = data
  const fromLine = minRate > 0 ? `最低 $${minRate}/day 起` : '灵活租期，按需计费'
  const heroDevice = featured[0]
  const availableCount = featured.filter((p) => p.available).length
  const pickupSummary = config.pickupLocations.length
    ? `可选自取点：${config.pickupLocations.join('、')}`
    : '自取地点请联系客服确认'
  const features = FEATURES.map((feature, index) => index === 2
    ? { ...feature, d: `墨尔本 CBD 与内城区可配送；${pickupSummary}` }
    : feature)

  return /* html */ `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <span class="eyebrow">MELBOURNE · 设备租赁</span>
      <h1>设备不用拥有，<em>进度照样向前。</em></h1>
      <p>给课程作业、临时项目、游戏周末和创作冲刺准备的电脑。配置与库存实时同步，${esc(fromLine)}；提交申请后再确认档期、签约与付款。</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="/products">打开设备库 <span>→</span></a>
        <a class="btn btn-ghost btn-lg" href="/rental-guide">先了解怎么租</a>
      </div>
      <div class="hero-notes"><span>✓ 提交不扣款</span><span>✓ 押金可退</span><span>✓ 本地技术支持</span></div>
    </div>
    <div class="rental-console" aria-label="实时租赁概览">
      <div class="console-head"><span><i></i> RENTAL DESK / LIVE</span><span>${new Date().toLocaleDateString('en-AU', { month: 'short', day: '2-digit' }).toUpperCase()}</span></div>
      <div class="console-device">
        <div class="console-art" aria-hidden="true"><div class="console-screen"><span>READY<br>TO BUILD</span></div><div class="console-base"></div></div>
        <div class="console-device-copy"><small>NEXT AVAILABLE</small><strong>${esc(heroDevice?.name || '设备目录更新中')}</strong><span>${esc(heroDevice?.specs.slice(0, 2).join(' · ') || '查看设备库获取实时配置')}</span></div>
      </div>
      <div class="console-metrics">
        <div><span>精选现货</span><strong>${availableCount || '—'}<small> / ${featured.length || '—'}</small></strong></div>
        <div><span>起租价格</span><strong>${minRate > 0 ? `$${minRate}` : '询价'}<small>${minRate > 0 ? ' / DAY' : ''}</small></strong></div>
        <div><span>申请状态</span><strong>人工确认</strong></div>
      </div>
      <a href="/products" class="console-link"><span>浏览全部实时库存</span><span>↗</span></a>
    </div>
  </div>
</section>

<section class="features">
  <div class="wrap">
    ${features.map(
      (f) => `
    <div class="feature">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${f.ic}"/></svg>
      <h3>${esc(f.t)}</h3>
      <p>${esc(f.d)}</p>
    </div>`,
    ).join('')}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div><div class="kicker">当前推荐</div><h2>从用途出发，不从参数焦虑开始</h2></div>
      <p>每类挑一台代表设备。库存和价格来自租赁系统，最多延迟 60 秒。</p>
    </div>
    <div class="grid">
      ${
        featured.length
          ? featured.map((p, i) => productCard(p, i, multiplier)).join('')
          : '<div class="empty-state"><strong>设备库正在更新</strong><p>暂时没有推荐设备，可稍后刷新或直接联系我们。</p></div>'
      }
    </div>
    <div class="center-cta"><a class="text-link" href="/products">查看全部设备与实时库存 <span>→</span></a></div>
  </div>
</section>

<section class="section use-cases">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">按场景选择</div><h2>为一段明确的任务，配一台正好的电脑</h2></div></div>
    <div class="scenario-grid">
      <a class="scenario scenario-wide" href="/products?category=gaming"><span class="scenario-index">PLAY / 01</span><h3>高帧游戏与电竞活动</h3><p>优先独立显卡与散热能力，适合 LAN Party、比赛训练和短期娱乐。</p><b>查看游戏本 →</b></a>
      <a class="scenario" href="/products?category=ultrabook"><span class="scenario-index">MOVE / 02</span><h3>课程、差旅与临时办公</h3><p>更看重续航、重量与随身携带。</p><b>查看轻薄本 →</b></a>
      <a class="scenario" href="/products?category=workstation"><span class="scenario-index">BUILD / 03</span><h3>剪辑、渲染与开发项目</h3><p>为高负载软件和长时间运行准备。</p><b>查看工作站 →</b></a>
    </div>
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
    <div class="process-note"><span>重要</span><p>官网订单先进入“待确认”。我们确认设备档期、配送范围与最终费用后，才会请你签署合同并付款。</p></div>
  </div>
</section>

<section class="section home-faq">
  <div class="wrap split-head">
    <div><div class="kicker">开始前</div><h2>几个最常问的问题</h2><p>规则不绕弯。更完整的押金、续租、配送与故障处理说明都在租赁指南里。</p><a class="text-link" href="/rental-guide#faq">查看全部常见问题 <span>→</span></a></div>
    <div class="faq-list">
      <details><summary>提交申请会立即扣款吗？</summary><p>不会。申请先由管理员确认档期和费用，之后才进入在线签约与付款。</p></details>
      <details><summary>哪些区域可以送货或自取？</summary><p>墨尔本 CBD、Docklands、Southbank、South Yarra、Carlton 等内城区可安排配送；${esc(pickupSummary)}。</p></details>
      <details><summary>最短可以租多久？</summary><p>当前最短租期为 ${esc(config.minimumRentalDays)} 天，具体可用档期以下单页校验为准。</p></details>
      <details><summary>设备出故障怎么办？</summary><p>租期内可联系 7×12 小时技术支持；确认属于设备故障且符合条件时，会安排免费换机。</p></details>
    </div>
  </div>
</section>

<section class="section closing">
  <div class="wrap">
    <div class="kicker">READY WHEN YOU ARE</div>
    <h2>下一台电脑，不必等到买下它。</h2>
    <p>先看实时库存；如果不确定配置，告诉我们要运行的软件和使用天数。</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="/products">浏览设备</a><a class="btn btn-ghost btn-lg" href="/contact">咨询配置</a></div>
  </div>
</section>`
}
