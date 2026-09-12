// 首页。结构还原参考稿：Hero → 四大保障 → 为你精选（实时读库）→ 三步流程 → 收尾 CTA。

import { esc } from '../layout'
import { bestDiscountedDailyOffer, monthlyRentalRate, weeklyRentalRate, type Product, type RentalConfig } from '../db'

const FEATURES = [
  { t: '交付前检测', d: '基础功能、外观与配件逐项确认，拿到手即可开工', ic: 'M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z' },
  { t: '租期可调整', d: '短租应急或长期项目都可以，到期前还能申请续租', ic: 'M8 2v4M16 2v4M3 10h18M5 6h14v14H5z' },
  { t: '本地交付', d: '墨尔本 CBD 与周边地区可配送，其他区域支持门店自取', ic: 'M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z' },
  { t: '租期内支持', d: '7×12 小时技术支持，符合条件的故障安排换机', ic: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v5M12 16h.01' },
]

const STEPS = [
  { n: '01', t: '选择设备与租期', d: '按用途、预算和配置筛选，打开详情确认设备规格，再填写取还日期。' },
  { n: '02', t: '提交租赁申请', d: '留下联系与取还信息。提交只是锁定申请，不会立即扣款。' },
  { n: '03', t: '确认后签约交付', d: '我们确认档期与费用后联系你，在线完成签约与付款，再配送或安排自取。' },
]

const CARD_TAGS = ['热门', '推荐', '专业']

function productCard(p: Product, index: number): string {
  const dailyOffer = bestDiscountedDailyOffer(p.pricePerDay, p.weeklyDiscountPercent, p.monthlyDiscountPercent)
  const daily = p.pricePerDay > 0
    ? dailyOffer
      ? `<del class="price-original">$${p.pricePerDay.toFixed(2)}/day</del><strong>$${dailyOffer.rate.toFixed(2)}/day</strong><small>${dailyOffer.label}</small>`
      : `$${p.pricePerDay}/day`
    : '询价'
  const weeklyOriginal = p.pricePerDay * 7
  const monthlyOriginal = p.pricePerDay * 30
  const weekly = p.pricePerDay > 0 ? `$${weeklyRentalRate(p.pricePerDay, p.weeklyDiscountPercent)}/week` : '—'
  const monthly = p.pricePerDay > 0 ? `$${monthlyRentalRate(p.pricePerDay, p.monthlyDiscountPercent)}/month` : '—'
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
      <div><div class="lbl">日租</div><div class="val">${typeof daily === 'string' && daily.startsWith('<') ? daily : esc(daily)}</div></div>
      <div><div class="lbl">周租</div><div class="val">${p.weeklyDiscountPercent > 0 ? `<del class="price-original">$${weeklyOriginal.toFixed(2)}/week</del>` : ''}${esc(weekly)} <small>${p.weeklyDiscountPercent > 0 ? `折后${p.weeklyDiscountPercent}%` : '7 天参考'}</small></div></div>
      <div><div class="lbl">月租</div><div class="val">${p.monthlyDiscountPercent > 0 ? `<del class="price-original">$${monthlyOriginal.toFixed(2)}/month</del>` : ''}${esc(monthly)} <small>${p.monthlyDiscountPercent > 0 ? `折后${p.monthlyDiscountPercent}%` : '参考'}</small></div></div>
    </div>
    ${p.depositAmount > 0 ? `<div class="deposit">押金 $${esc(p.depositAmount)}</div>` : ''}
    <div class="card-actions"><a class="btn btn-ghost" href="${detailHref}">详情</a><a class="btn btn-primary" href="${detailHref}">选择租期</a></div>
  </article>`
}

interface HomeData {
  featured: Product[]
  products: Product[]
  minRate: number
  config: RentalConfig
}

export function renderHome(data: HomeData): string {
  const { featured, products, minRate, config } = data
  const fromLine = minRate > 0 ? `最低 $${minRate}/day 起` : '灵活租期，按需计费'
  const heroDevice = products.length ? products[Math.floor(Math.random() * products.length)] : featured[0]
  const availableCount = products.filter((p) => p.available).length
  const pickupSummary = config.pickupLocations.length
    ? `可选自取点：${config.pickupLocations.join('、')}`
    : '自取地点请联系客服确认'
  const deliverySummary = config.deliveryAreas.length ? config.deliveryAreas.join('、') : '墨尔本 CBD 及周边地区'
  const features = FEATURES.map((feature, index) => index === 2
    ? { ...feature, d: `可配送区域：${deliverySummary}；${pickupSummary}` }
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
      <div class="hero-notes"><span>✓ 提交不扣款</span><span>✓ 最快当天可取</span><span>✓ 本地技术支持</span></div>
    </div>
    <div class="rental-console" aria-label="实时租赁概览">
      <div class="console-head"><span><i></i> RENTAL DESK / LIVE</span><span>${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></div>
      <div class="console-device">
        <div class="console-art" aria-hidden="true"><div class="console-screen"><span>READY<br>TO BUILD</span></div><div class="console-base"></div></div>
        <div class="console-device-copy"><small>NEXT AVAILABLE</small><strong>${esc(heroDevice?.name || '设备目录更新中')}</strong><span>${esc(heroDevice?.specs.slice(0, 2).join(' · ') || '查看设备库获取实时配置')}</span></div>
      </div>
      <div class="console-metrics">
        <div><span>实时现货</span><strong>${availableCount || '—'}<small> / ${products.length || '—'}</small></strong></div>
        <div><span>起租价格</span><strong>${minRate > 0 ? `$${minRate}` : '询价'}<small>${minRate > 0 ? ' / DAY 起' : ''}</small></strong></div>
        <div><span>申请状态</span><strong>确认档期</strong></div>
      </div>
      <a href="/products" class="console-link"><span>浏览全部库存</span><span>↗</span></a>
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
    </div>
    <div class="grid">
      ${featured.length
      ? featured.map((p, i) => productCard(p, i)).join('')
      : '<div class="empty-state"><strong>设备库正在更新</strong><p>暂时没有推荐设备，可稍后刷新或直接联系我们。</p></div>'
    }
    </div>
    <div class="center-cta"><a class="text-link" href="/products">查看全部设备 <span>→</span></a></div>
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
    <div class="process-note"><span>重要</span><p>官网订单先进入审核流程。确认设备档期、配送范围与最终费用后，再签署合同并付款。</p></div>
  </div>
</section>

<section class="section home-essentials">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">租之前先知道</div><h2>把预算和交付安排一次看明白</h2></div><p>产品页展示的是实时基础信息，最终金额和档期会在提交申请后确认。</p></div>
    <div class="info-grid three">
      <article class="info-card"><span>费用</span><h3>租金 + 押金</h3><p>租金按日租价乘以实际租期计算；押金在设备归还并验收无误后按规则退回。</p></article>
      <article class="info-card"><span>交付</span><h3>配送或到店自取</h3><p>墨尔本 CBD 与周边地区可安排配送，其他郊区可咨询自取地点。配送费会随地址确认。</p></article>
      <article class="info-card"><span>适合</span><h3>短期项目与临时升级</h3><p>课程作业、剪辑渲染、开发测试、游戏活动或差旅办公，都可以按实际使用时间申请。</p></article>
    </div>
    <div class="home-essentials-note"><strong>当前最短租期：${esc(config.minimumRentalDays)} 天</strong><span>提交申请不会立即扣款，确认档期后才进入合同与付款。</span><a class="text-link" href="/rental-guide">查看完整租赁规则 <span>→</span></a></div>
  </div>
</section>

<section class="section alt home-service-standard">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">服务标准</div><h2>从交付前到归还后，都有明确节点</h2></div><p>租赁不是把设备交给你就结束。每个阶段都有可确认的事项，遇到问题也知道应该联系谁。</p></div>
    <div class="service-standard-grid">
      <article><span>01 / 交付前</span><h3>确认设备状态</h3><ul><li>核对型号、核心配置和配件</li><li>检查基础功能与外观</li><li>确认取货时间或配送地址</li></ul></article>
      <article><span>02 / 使用中</span><h3>租期内有人响应</h3><ul><li>提供 7×12 小时技术支持</li><li>先排查软件、连接和使用问题</li><li>符合条件时安排故障换机</li></ul></article>
      <article><span>03 / 归还时</span><h3>按清单完成验收</h3><ul><li>确认设备、充电器和配件齐全</li><li>请提前备份并退出个人账户</li><li>记录归还时间与设备状态</li></ul></article>
      <article><span>04 / 归还后</span><h3>完成结算与押金处理</h3><ul><li>检查逾期、缺件或损坏情况</li><li>无额外费用时按规则退还押金</li><li>需要说明时提供结算明细</li></ul></article>
    </div>
  </div>
</section>

<section class="section home-faq">
  <div class="wrap split-head">
    <div><div class="kicker">开始前</div><h2>几个最常问的问题</h2><p>规则不绕弯。更完整的押金、续租、配送与故障处理说明都在租赁指南里。</p><a class="text-link" href="/rental-guide#faq">查看全部常见问题 <span>→</span></a></div>
    <div class="faq-list">
      <details><summary>提交申请会立即扣款吗？</summary><p>不会。申请先由我们确认档期和费用，之后才进入在线签约与付款。</p></details>
      <details><summary>哪些区域可以送货或自取？</summary><p>可配送区域包括 ${esc(deliverySummary)}；${esc(pickupSummary)}。</p></details>
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
