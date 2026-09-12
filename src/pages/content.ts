// 租赁说明、品牌、联系与 404 页面。

import { esc } from '../layout'
import type { RentalConfig, SiteContact } from '../db'
import type { OrderView } from '../orders'

function pickupSummary(config: RentalConfig): string {
  return config.pickupLocations.length
    ? config.pickupLocations.join('、')
    : '自取地点请联系客服确认'
}

export function renderRentalGuide(config: RentalConfig): string {
  const deliveryAreas = config.deliveryAreas.length ? config.deliveryAreas.join('、') : '墨尔本 CBD 及周边地区'
  const pickupLocations = config.pickupLocations.length
    ? `<ul class="check-list">${config.pickupLocations.map((location) => `<li>${esc(location)}</li>`).join('')}</ul>`
    : '<p>我们尚未配置公开自取点，请在提交前联系客服确认。</p>'
  return /* html */ `
<section class="page-hero compact guide-hero">
  <div class="wrap">
    <span class="eyebrow">MELBOURNE · 租赁指南</span>
    <h1>从选设备到归还，<em>每一步都说清楚。</em></h1>
    <p>申请不会立即扣款。我们先确认档期、取还方式和最终费用，再安排合同、付款和交付。</p>
    <div class="guide-facts" aria-label="租赁关键信息"><div><strong>${esc(config.minimumRentalDays)} 天起</strong><span>灵活租期</span></div><div><strong>先申请</strong><span>后付款</span></div><div><strong>本地交付</strong><span>配送或到店自取</span></div></div>
    <nav class="guide-jump" aria-label="租赁说明快速导航"><a href="#process">租赁流程</a><a href="#pricing">租金说明</a><a href="#terms">租赁条款</a><a href="#faq">常见问题</a></nav>
  </div>
</section>
<section class="section" id="process">
  <div class="wrap">
    <div class="process-heading"><h2>租赁流程</h2><p>提交申请后，我们会先确认设备档期与最终费用，再安排合同、付款和交付。</p></div>
    <div class="guide-steps">
      <article><span>01</span><h3>选择设备</h3><p>浏览产品目录，按用途、配置、价格与现货状态选择适合你的设备。</p></article>
      <article><span>02</span><h3>提交申请</h3><p>填写租期、取还方式与联系方式，并验证付款方式；验证过程不会立即扣款。</p></article>
      <article><span>03</span><h3>签约付款</h3><p>审核通过后查看并签署电子合同，再按确认后的订单金额完成付款。</p></article>
      <article><span>04</span><h3>配送或自取</h3><p>按确认时间安排墨尔本本地配送，或前往约定地点自取并完成验机。</p></article>
      <article><span>05</span><h3>到期归还</h3><p>租期结束前联系我们安排归还；设备与配件验收完成后处理押金。</p></article>
    </div>
  </div>
</section>

<section class="section alt" id="pricing">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">租金说明</div><h2>按实际使用时间来租</h2></div><p>从 ${esc(config.minimumRentalDays)} 天起，可覆盖短期任务到长期项目；准确租金以具体日期和审核后的订单为准。</p></div>
    <div class="rental-plan-grid" aria-label="租期选择说明">
      <article><h3>日租</h3><span class="plan-badge">${esc(config.minimumRentalDays)} 天起</span><p>适合短期项目、临时出差或活动使用。</p><strong class="plan-note">按天计费，最少租 ${esc(config.minimumRentalDays)} 天</strong></article>
      <article><h3>周租</h3><span class="plan-badge">7 天以上</span><p>适合项目开发、培训课程或中期使用。</p><strong class="plan-note">部分设备享周租折扣，具体以产品页价格为准</strong></article>
      <article class="featured"><b>最优惠</b><h3>月租</h3><span class="plan-badge">30 天以上</span><p>适合长期办公、创业团队或持续项目。</p><strong class="plan-note">部分设备享月租折扣，具体以产品页价格为准</strong></article>
    </div>
    <div class="process-note"><span>费用构成</span><p>预计金额可能包含租金、设备押金、优惠、配送费和支付手续费。付款前请核对审核后的最终订单与租赁合同。</p></div>
  </div>
</section>

<section class="section" id="delivery">
  <div class="wrap delivery-grid">
    <div><div class="kicker">取还范围</div><h2>墨尔本本地交付</h2><p>${esc(config.deliveryNote)} 当前可配送区域包括：${esc(deliveryAreas)}。</p><p>具体配送时段、费用和地址是否可服务，会在订单审核时确认。其他墨尔本郊区请选择到店自取。</p><p>当前可选自取 / 归还地点：</p>${pickupLocations}</div>
    <div class="map-card" aria-label="澳大利亚地图，墨尔本本地配送范围">
      <svg class="australia-map" viewBox="0 0 560 360" role="img" aria-labelledby="australia-map-title australia-map-desc">
        <title id="australia-map-title">澳大利亚与墨尔本位置</title>
        <desc id="australia-map-desc">澳大利亚轮廓地图，东南部标出维多利亚州和墨尔本本地配送点。</desc>
        <defs>
          <linearGradient id="au-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#242941"/><stop offset="1" stop-color="#171b2c"/></linearGradient>
          <filter id="mel-glow" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="7"/></filter>
        </defs>
        <path class="map-grid-line" d="M38 90H522M38 150H522M38 210H522M38 270H522M110 32V302M200 32V302M290 32V302M380 32V302M470 32V302"/>
        <g class="australia-states">
          <path class="map-state" d="M75.6 170.3L75.3 166.8L77.5 172.4L80.2 171.4L76.7 162L78.5 168.5L80.1 166.1L82 171L83.5 169.6L83.8 165.6L75.6 151.7L81.2 127.9L83.1 127.3L82.4 133.5L84.5 133.9L87.4 127.6L107.7 115.2L113.1 117.6L129.2 109.9L133.6 111L146.9 106.7L160 92.5L158.1 84.5L164.4 80.1L165.2 76.3L171.3 87.5L171.4 82.4L174.5 84L174.9 80.7L170.6 78.8L171.1 74.3L179.1 77.7L178.9 75.9L184.2 76.3L179 75.8L182.3 71L180 72.6L178.9 70L181.9 65.6L188.6 69.8L183.2 65L185.4 63L189.2 64.7L186.6 60L190.3 59.1L190.6 56L190.8 59.9L192.3 58L193.2 60.1L194.2 53.1L196.5 56.1L199.4 53.3L199.7 56.1L202.7 51.4L215 60.6L212.9 68.1L214.1 65L216.1 68L216.6 61.4L222.3 62.1L222.3 220.1L206.5 225.5L193.6 225.8L177.5 232.6L170.9 241.3L138.1 241.1L119.1 252.3L104.6 251.4L90.9 244.2L90.7 237.4L94.1 238.5L96.9 235.5L97.1 225.5L99.8 222L97.5 223.5L91.2 209L89.5 195.9L74.7 166.8Z"/>
          <path class="map-state" d="M236.5 41.9L238.6 41.7L237.5 38.6L240.8 41L239.4 38.9L243.9 35.4L251.1 37.9L256.4 35.8L255.1 30.2L248.2 28.6L250.4 26.8L252.1 29.6L253.6 26.7L261.7 32.5L268.5 32.6L270.9 36.1L276.3 34.6L280.7 37.8L287.2 34.6L284.8 36.9L288.5 35.6L289.5 39.1L293.4 33.9L294.2 37.6L297.3 38.3L292.4 42.3L294.4 44.5L292.5 46.8L291.2 44.8L287.3 47L286.9 51.1L288.9 50.6L282.5 62L306.9 77.8L306.9 166.6L222.3 166.6L222.3 62.1L223.8 65.1L224.4 61.7L228.7 64.6L227 61.3L230.8 61.1L225.7 57Z"/>
          <path class="map-state" d="M341.3 63.3L339.5 52.6L343.5 40.6L340.6 40.3L344.6 35.4L345.7 25.2L349.5 22.7L352.5 33.6L356.2 34.7L354.6 38.2L359 43L361.2 57.6L368.1 55.4L376 62.8L376.5 77L381.7 81.1L384.8 99.8L408.1 112.5L409.6 115.3L407.1 115.7L412.4 120.2L415.9 131.7L420.1 135.3L420.1 130.2L425.3 134.3L425 132L427.7 144.3L436.3 148L443.6 159.2L447.1 160L447.9 166.3L449.7 166L448.4 180.4L451.8 182.1L452.9 187.1L442.8 187.9L438.1 190.3L438.6 194L432.8 196.5L422.4 190.5L415 190.8L409.9 194.8L335.1 194.8L335.1 166.6L306.9 166.6L306.9 77.8L316.6 81.2L325.7 88.8L331.3 87.7L337.9 77.3Z"/>
          <path class="map-state" d="M311.6 249.8L307.6 243.1L304.6 252.3L295.8 253.5L297.6 250.2L301.7 250.4L301.7 243.1L306.7 237.7L304.5 226.9L304.9 232.4L287.4 246.8L288.1 251.1L279.9 247L283.5 247.6L281.1 241.7L275.9 234.1L270.9 233L271.8 228.4L267.9 228.1L266.1 224L252.4 223.3L242.5 218L222.3 220.1L222.3 166.6L335.1 166.6L334.8 280L329.4 278.7L324.2 273.1L324.3 266.7L319.8 259.6L314.1 256.1L307.8 257.1Z"/>
          <path class="map-state" d="M430.4 240.2L427.5 251.9L421.3 257.8L419.5 274.8L401.9 268.2L400.1 260.6L391 261.7L377.7 258.8L370.6 261.9L357.6 253L357.2 249.3L351.9 247L349.7 249.1L346 243.3L335.1 242.2L335.1 194.8L409.9 194.8L415 190.8L422.4 190.5L432.8 196.5L438.6 194L438.1 190.3L442.8 187.9L453.1 187L453.6 193.4L443.6 227.2L434.8 232.1L433 237.4L429.8 236.7L432.2 237.9Z"/>
          <path class="map-state victoria-shape" d="M373.9 283.1L369.4 282.3L373.8 280.8L371.7 278L366.7 280.4L369.6 281.9L358.7 287.5L348 282.7L338.6 283.1L334.8 280L334.7 241.7L346 243.3L349.7 249.1L351.9 247L357.2 249.3L357.6 253L368.1 260.5L398.1 260L400.9 261.1L401.9 268.2L419.5 274.8L398.9 279L390.4 285.4L384.1 286L386.6 286.9L386.1 290.1L376.2 284.5L377.3 281.6Z"/>
          <path class="map-state tasmania-shape" d="M370.4 308.2L370.1 304.3L375.1 304.9L385.7 309.9L389.3 308.4L392.6 311.8L389.5 308.1L403 306.2L404.1 319.1L402.4 317L399.8 325L396.1 324.7L395.4 326.9L392.6 324.3L394.7 326.9L393.1 329.1L391.8 327L390.3 332.4L382.4 331.8L381.3 330L384.3 329.5L377.3 326.4L374.2 318.9L378.5 321.2L374.8 319.1Z"/>
        </g>
        <circle class="mel-glow" cx="372.3" cy="277.7" r="18"/>
        <circle class="mel-pulse" cx="372.3" cy="277.7" r="10"/>
        <circle class="mel-dot" cx="372.3" cy="277.7" r="4"/>
        <path class="mel-leader" d="M381 274L432 246"/>
        <text class="mel-label" x="438" y="244">MELBOURNE</text>
        <text class="vic-label" x="345" y="263">VIC</text>
      </svg>
      <div class="map-caption"><strong>INNER MELBOURNE</strong><small>DELIVERY ZONE · CONFIRM ON REVIEW</small></div>
      <span class="map-country">AUSTRALIA · VIC</span>
    </div>
  </div>
</section>

<section class="section alt" id="terms">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">租赁条款</div><h2>重要规则，提前说清楚</h2></div><p>以下为便于理解的摘要；每笔租赁最终以审核后的订单、已签合同及网站法律文件为准。</p></div>
    <div class="rental-terms-grid">
      <article><span>01</span><h3>押金政策</h3><p>押金按设备显示金额收取。归还验收无损坏、缺件、逾期或其他应付费用后，按规则退回。</p></article>
      <article><span>02</span><h3>损坏责任</h3><p>正常使用损耗与人为损坏会分别处理；维修、缺件或其他费用以合同和实际检查结果为准。</p></article>
      <article><span>03</span><h3>续租规则</h3><p>请在租期结束前尽早提出申请。是否能够续租，需要根据后续设备档期再次确认。</p></article>
      <article><span>04</span><h3>提前归还</h3><p>可以提前联系我们安排归还；已付租金是否调整，按订单状态、已签合同和退款政策处理。</p></article>
      <article><span>05</span><h3>数据安全</h3><p>归还前请备份文件、退出个人账户并清除本地资料，重要资料不要只保存在租赁设备上。</p></article>
      <article><span>06</span><h3>禁止行为</h3><p>不得转租、抵押、擅自拆机改装、绕过安全措施，或将设备用于任何违法用途。</p></article>
    </div>
    <div class="process-note"><span>技术支持</span><p>租期内出现故障时，请先停止可能扩大损坏的操作并联系我们。经确认是设备自身故障且符合租赁条件时，我们会安排排查或换机。</p></div>
  </div>
</section>

<section class="section" id="faq">
  <div class="wrap faq-layout">
    <div class="faq-intro"><div class="kicker">FAQ</div><h2>常见问题</h2><p>还有具体问题？带上设备名称、日期和 suburb 联系我们，会更快得到准确答复。</p><a href="/about#contact" class="btn btn-ghost">联系我们</a></div>
    <div class="faq-list">
      <details open><summary>最短可以租多久？</summary><p>当前最短租期为 ${esc(config.minimumRentalDays)} 天。设备周转和不可用日期会由租赁系统继续校验。</p></details>
      <details><summary>租赁天数怎么计算？</summary><p>按取货日期、归还日期以及上午 / 下午时段折算，半天部分会计入预计租期。最终天数以审核后的订单和合同为准。</p></details>
      <details><summary>为什么提交后还不是正式订单？</summary><p>库存状态实时同步，但最终仍需人工核对档期、设备状况与配送安排。确认后才生成合同并进入付款。</p></details>
      <details><summary>为什么提交前要验证信用卡？</summary><p>用于确认后续可用的付款方式。验证由 Stripe 安全付款组件处理；提交申请时不会立即扣除租金或押金。</p></details>
      <details><summary>一次可以申请多台设备吗？</summary><p>可以，单次最多 10 台。同一购物车内的设备共用租期、取还方式和联系信息；各台设备会分别建立订单并校验档期。</p></details>
      <details><summary>月租参考价是最终价格吗？</summary><p>不是。月租参考价按日租价乘以展示系数计算，用来快速比较。准确租金以下单日期和审核后的订单为准。</p></details>
      <details><summary>押金什么时候退？</summary><p>设备归还并完成验收后处理。无损坏、缺件、逾期或其他应付费用时，按申请时选择的方式退回；账号余额退回仅适用于符合条件的已有正式账户。</p></details>
      <details><summary>可以续租或提前归还吗？</summary><p>可以提出申请。请尽早联系客服确认后续档期；提前归还是否调整租金，以已签合同约定为准。</p></details>
      <details><summary>如果要取消申请怎么办？</summary><p>尽快联系客服并提供订单编号。付款前取消不涉及退款；已付款订单会按订单状态、已签合同和<a href="/refund-policy" class="inline-link">退款政策</a>处理。</p></details>
      <details><summary>设备故障怎么办？</summary><p>先联系 7×12 小时技术支持。确认是设备自身故障且符合租赁条件时，我们会安排排查或免费换机。</p></details>
      <details><summary>设备里会保留我的资料吗？</summary><p>归还前请自行备份并退出个人账号、清除本地资料。我们会按交付流程重置设备，但重要资料不应只保存在租赁设备上。</p></details>
      <details><summary>可以指定软件或配件吗？</summary><p>可在申请备注中写明软件、接口、显示器或其他配件需求。是否可提供及相关费用会在审核时确认。</p></details>
    </div>
  </div>
</section>

<section class="section closing"><div class="wrap"><div class="kicker">下一步</div><h2>规则看明白了，就去选一台。</h2><p>申请前请同时阅读<a href="/service-terms" class="inline-link">服务条款</a>和<a href="/refund-policy" class="inline-link">退款政策</a>。不确定配置、档期或配送范围时，可以先问顾问。</p><div class="hero-actions"><a class="btn btn-primary btn-lg" href="/products">浏览设备</a><a class="btn btn-ghost btn-lg" href="/about#contact">先咨询</a></div></div></section>`
}

export function renderAbout(contact: SiteContact, config: RentalConfig, appUrl: string, initialSubject: string): string {
  const phoneHref = contact.phone.replace(/[^+\d]/g, '')
  return /* html */ `
<section class="page-hero compact about-hero"><div class="wrap about-hero-grid">
  <div><span class="eyebrow">MELBOURNE · 关于 ${esc(contact.name)}</span><h1>好设备不该成为，<em>创造力的门槛。</em></h1><strong class="about-brand-subtitle">GeekSlope</strong><p>需要性能时用得上，项目结束后不必长期持有。我们让学习、工作和创作所需的设备更容易获得。</p><div class="hero-actions"><a class="btn btn-primary" href="/products">查看实时设备</a><a class="btn btn-ghost" href="#contact">联系我们</a></div></div>
  <div class="about-signal" aria-label="墨尔本本地电脑租赁"><div class="signal-grid"></div><span>MEL / LOCAL</span><strong>COMPUTE<br>ON DEMAND</strong><small>实时库存 · 先审核后付款</small></div>
</div></section>

<section class="about-stats"><div class="wrap">
  <div><strong>1</strong><span>天起租</span></div>
  <div><strong>2</strong><span>种取还方式</span></div>
  <div><strong>3</strong><span>类核心设备</span></div>
  <div><strong>7×12</strong><span>小时技术支持</span></div>
</div></section>

<section class="section"><div class="wrap story-grid">
  <div class="story-lead"><span>品牌故事</span><h2>从一个简单的困惑开始</h2></div>
  <div class="story-copy"><p>一次课程项目、几周的剪辑工作、临时出差，往往都需要一台更合适的电脑，却不一定值得长期持有。${esc(contact.name)} 把设备采购、检查、周转和支持放在后台，让用户按真正需要的时间使用设备。</p><p>我们专注墨尔本本地服务，提供游戏笔记本、轻薄商务本和台式工作站。租期可从 ${esc(config.minimumRentalDays)} 天起，也可覆盖更长项目；每份申请都会在付款前核对档期、价格和交付安排。</p><p>我们想解决的不只是“哪里能租到电脑”，而是让配置、费用、押金、取还和售后都有明确的下一步。</p></div>
</div></section>

<section class="section alt"><div class="wrap"><div class="section-head"><div><div class="kicker">服务承诺</div><h2>我们对每位用户的承诺</h2></div><p>不用夸大的数字讲故事，用每个订单都能验证的流程建立信任。</p></div><div class="principle-grid about-values">
  <article><span>01</span><h3>信息透明</h3><p>配置、日租价、押金和库存状态直接同步展示。</p></article>
  <article><span>02</span><h3>设备可靠</h3><p>交付前检查基础功能和配件，归还后再次验机。</p></article>
  <article><span>03</span><h3>费用先确认</h3><p>申请阶段不立即扣款，最终费用在签约付款前核对。</p></article>
  <article><span>04</span><h3>墨尔本本地响应</h3><p>围绕本地配送和自取建立流程。${esc(pickupSummary(config))}。</p></article>
  <article><span>05</span><h3>租期内有支持</h3><p>提供 7×12 小时技术支持，符合条件的故障安排排查或换机。</p></article>
  <article><span>06</span><h3>责任说清楚</h3><p>正常损耗、人为损坏、缺件和逾期处理以已签合同为准。</p></article>
</div></div></section>

<section class="section" id="contact"><div class="wrap">
  <div class="section-head tight"><div><div class="kicker">联系我们</div><h2>把用途说给我们，配置交给我们一起判断</h2></div><p>咨询设备、配送范围、档期或已有申请。附上日期、常用软件和预算，会更容易一次答清。</p></div>
</div></section>
<section class="section"><div class="wrap contact-layout">
  <div class="contact-options">
    <a class="contact-option" href="tel:${esc(phoneHref)}"><span>电话</span><strong>${esc(contact.phone)}</strong><small>适合紧急档期与当天取还咨询</small></a>
    <a class="contact-option" href="mailto:${esc(contact.email)}"><span>邮箱</span><strong>${esc(contact.email)}</strong><small>适合发送配置清单、地址或项目说明</small></a>
    <div class="contact-option"><span>公司地址</span><strong>${esc(contact.address)}</strong><small>${contact.contact ? `联系人：${esc(contact.contact)}` : '具体到访时间请提前确认'}</small></div>
    <div class="contact-option"><span>自取 / 归还</span><strong>${esc(config.pickupLocations.length ? `${config.pickupLocations.length} 个可选地点` : '联系客服确认')}</strong><small>${esc(pickupSummary(config))}</small></div>
    <div class="response-note"><i></i><div><strong>建议提供</strong><p>设备或用途、开始与结束日期、所在 suburb、必须运行的软件。</p></div></div>
  </div>
  <form class="form-card contact-form" id="contact-form">
    <div class="kicker">邮件咨询</div><h2>整理一封询价邮件</h2><p class="form-intro">填写后会打开你的邮件应用；内容不会在本网站保存或发送。</p>
    <div class="row2"><div class="field"><label for="inquiry-name">怎么称呼你</label><input id="inquiry-name" name="name" autocomplete="name" required></div><div class="field"><label for="inquiry-phone">联系电话（选填）</label><input id="inquiry-phone" name="phone" autocomplete="tel"></div></div>
    <div class="field"><label for="inquiry-subject">想咨询什么</label><select id="inquiry-subject" name="subject">${initialSubject ? `<option selected>${esc(initialSubject)}</option>` : ''}<option>帮我推荐设备</option><option>查询设备档期</option><option>确认配送范围</option><option>续租或已有订单</option><option>其他问题</option></select></div>
    <div class="row2"><div class="field"><label for="inquiry-start">预计开始日期</label><input type="date" id="inquiry-start" name="start" lang="en-AU"></div><div class="field"><label for="inquiry-end">预计结束日期</label><input type="date" id="inquiry-end" name="end" lang="en-AU"></div></div>
    <div class="field"><label for="inquiry-message">用途、软件或其他要求</label><textarea id="inquiry-message" name="message" placeholder="例如：在 Carlton 使用 7 天，需要运行 Premiere Pro，希望 32GB 内存…" required></textarea></div>
    <button class="btn btn-primary btn-lg" type="submit">在邮件应用中继续</button>
  </form>
</div></section>
<section class="section alt"><div class="wrap"><div class="section-head tight"><div><div class="kicker">自助入口</div><h2>也许你可以直接完成</h2></div></div><div class="info-grid three"><a class="info-card linked" href="/products"><span>找设备</span><h3>搜索实时库存</h3><p>按类型、配置、价格和现货状态筛选。</p></a><a class="info-card linked" href="/rental-guide#faq"><span>查规则</span><h3>查看常见问题</h3><p>了解押金、配送、续租与故障处理。</p></a><a class="info-card linked" href="${esc(appUrl)}/login"><span>已有订单</span><h3>进入租赁系统</h3><p>查看进度、签署合同或完成付款。</p></a></div></div></section>
<script>
(() => {
  var form = document.getElementById('contact-form');
  var inquiryStart = document.getElementById('inquiry-start');
  var inquiryEnd = document.getElementById('inquiry-end');
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  function formatDate(value) {
    var parts = String(value || '').split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : (value || '待定');
  }
  inquiryStart.min = today;
  inquiryEnd.min = today;
  function validateInquiryDates() {
    inquiryEnd.min = inquiryStart.value || today;
    inquiryEnd.setCustomValidity(inquiryStart.value && inquiryEnd.value && inquiryEnd.value < inquiryStart.value
      ? '结束日期不能早于开始日期。'
      : '');
  }
  inquiryStart.addEventListener('change', validateInquiryDates);
  inquiryEnd.addEventListener('change', validateInquiryDates);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    validateInquiryDates();
    if (!form.reportValidity()) return;
    var data = new FormData(form);
    var subject = data.get('subject');
    var body = ['姓名：' + data.get('name'), '联系电话：' + (data.get('phone') || '未填写'), '预计租期：' + formatDate(data.get('start')) + ' 至 ' + formatDate(data.get('end')), '', String(data.get('message'))].join('\\n');
    location.href = 'mailto:${esc(contact.email)}?subject=' + encodeURIComponent('[${esc(contact.name)} 咨询] ' + subject) + '&body=' + encodeURIComponent(body);
  });
})();
</script>`
}

export function renderNotFound(): string {
  return /* html */ `
<section class="section closing">
  <div class="wrap">
    <div class="error-code">404</div><h2>这台设备不在架上</h2>
    <p>地址可能已经改变。回到首页，或直接查看目前可租的设备。</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="/products">查看设备库</a><a class="btn btn-ghost btn-lg" href="/">返回首页</a></div>
  </div>
</section>`
}

function money(value: number): string {
  return `AUD$${Number(value || 0).toFixed(2)}`
}

function lookupDate(value: string): string {
  const parts = String(value || '').split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || '待定'
}

function orderDetail(label: string, value: unknown): string {
  const text = String(value ?? '').trim()
  return text ? `<div><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>` : ''
}

function renderOrderCard(order: OrderView): string {
  const rentalAmount = Math.max(0, order.totalAmount - order.depositAmount - order.deliveryFee)
  const specs = [order.device.cpu, order.device.ram, order.device.storage, order.device.gpu, order.device.os].filter(Boolean).join(' · ')
  const credentialBlock = order.windowsPassword
    ? `<section class="order-record-section credential-section"><p class="section-code">ACCESS</p><h3>设备账户</h3>${order.windowsUsername ? `<div class="credential-row"><span>Windows 用户名</span><strong>${esc(order.windowsUsername)}</strong></div>` : ''}<div class="credential-row"><span>Windows 密码</span><strong>${esc(order.windowsPassword)}</strong></div><p class="section-note">请勿将密码分享给他人，归还设备前请备份资料并退出个人账户。</p></section>`
    : ''
  const contractBlock = order.contract
    ? `<section class="order-record-section"><p class="section-code">CONTRACT</p><h3>合同</h3><div class="contract-status-row"><span>${esc(order.contract.number || '租赁合同')}</span><strong>${esc(order.contract.statusLabel)}</strong></div>${order.contract.signedAt ? `<p class="section-note">签署时间：${esc(order.contract.signedAt)}</p>` : ''}${order.contract.url ? `<a class="btn btn-primary" href="${esc(order.contract.url)}" target="_blank" rel="noopener">${order.contract.status === 'pending_sign' ? '打开合同并签署' : '查看 / 下载合同'}</a>` : '<p class="section-note">合同链接将在状态更新后开放。</p>'}</section>`
    : ''
  const contractAction = order.contract?.url
    ? `<a class="btn btn-primary order-contract-action" href="${esc(order.contract.url)}" target="_blank" rel="noopener">${order.contract.status === 'pending_sign' ? '签署合同' : '查看合同'}</a>`
    : ''
  return `<article class="order-record">
    <div class="order-record-head"><div><p class="section-code">ORDER / ${esc(order.orderNo)}</p><h2>${esc(order.device.name)}</h2><p class="section-note">${esc(lookupDate(order.startDate))} 至 ${esc(lookupDate(order.endDate))}</p></div><div class="order-record-head-actions"><span class="order-status">${esc(order.statusLabel)}</span>${contractAction}</div></div>
    <div class="order-record-grid">
      <section class="order-record-section"><p class="section-code">ORDER DETAIL</p><h3>订单详情</h3><dl class="lookup-data-list">${orderDetail('订单编号', order.orderNo)}${orderDetail('下单时间', order.createdAt)}${orderDetail('租期', `${lookupDate(order.startDate)} ${order.startPeriod === 'PM' ? '下午' : '上午'} 至 ${lookupDate(order.endDate)} ${order.endPeriod === 'PM' ? '下午' : '上午'}（${order.rentalPeriod || 0} 天）`)}${orderDetail('取还方式', order.deliveryMethod === 'Delivery' ? '送货上门' : '到店自取')}${orderDetail('取货地点 / 时间', [order.pickupLocation, order.pickupTimeSlot].filter(Boolean).join(' · '))}${orderDetail('归还地点 / 时间', [order.returnLocation, order.returnTimeSlot].filter(Boolean).join(' · '))}${orderDetail('订单备注', order.rentalNote)}</dl></section>
      <section class="order-record-section"><p class="section-code">DEVICE</p><h3>设备信息</h3><dl class="lookup-data-list">${orderDetail('设备名称', order.device.name)}${orderDetail('型号', order.device.model)}${orderDetail('序列号', order.device.serialNumber)}${orderDetail('配置', specs)}</dl></section>
      <section class="order-record-section"><p class="section-code">PAYMENT</p><h3>费用与付款</h3><dl class="lookup-data-list">${orderDetail('租赁费用', money(rentalAmount))}${orderDetail('配送费', money(order.deliveryFee))}${orderDetail('押金', money(order.depositAmount))}${orderDetail('订单合计', money(order.totalAmount))}${order.amountDue > 0 ? orderDetail('待支付', money(order.amountDue)) : ''}${orderDetail('付款状态', order.paymentStatus)}${orderDetail('押金状态', order.depositStatus)}</dl></section>
      ${contractBlock}${credentialBlock}
    </div>
  </article>`
}

export function renderOrderLookup(appUrl: string, orders: OrderView[] = [], turnstileSiteKey = ''): string {
  const orderList = orders.length
    ? `<section class="lookup-orders"><div class="section-head tight"><div><div class="kicker">我的订单</div><h2>当前订单状态</h2></div><p>登录状态下只显示属于你的订单。</p></div>${orders.map(renderOrderCard).join('')}</section>`
    : ''
  return /* html */ `
<section class="page-hero compact order-lookup-hero"><div class="wrap"><div class="kicker">订单查询</div><h1>订单进度与交付信息</h1><p>输入订单编号和申请邮箱，可查看审核、签约、取货、租赁和退款状态。</p></div></section>
<section class="section"><div class="wrap form-wrap lookup-wrap">
  <div class="lookup-query-card">
    <form class="form-card" id="order-lookup-form">
      <div class="form-card-head"><span>LOOKUP</span><div><h3>查询一笔订单</h3><p>订单号和申请邮箱需要与提交时一致。</p></div></div>
      <div class="form-alert" id="lookup-error" hidden></div>
      <div class="field"><label for="lookup-order-no">订单编号</label><input id="lookup-order-no" name="orderNo" placeholder="例如 ORD-20260101-ABC123" autocomplete="off" required></div>
      <div class="field"><label for="lookup-email">申请邮箱</label><input id="lookup-email" name="email" type="email" autocomplete="email" required></div>
      ${turnstileSiteKey ? `<div class="field"><div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}"></div></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}
      <button class="btn btn-primary btn-lg" type="submit" id="lookup-submit">查询订单</button>
    </form>
  </div>
  ${orderList}
  <div class="form-card lookup-result" id="lookup-result" hidden>
    <h2>订单信息</h2><p id="lookup-message" class="form-intro"></p>
    <div id="lookup-credentials" class="temporary-credentials" hidden><span>临时账户</span><strong>订单编号：<b id="lookup-result-order"></b></strong><strong>临时密码：<b id="lookup-result-password"></b></strong><p>密码已更新，请立即保存。之后可进入账号中心登录。</p></div>
    <div id="lookup-order-info"></div>
    <p class="lookup-login"><a class="btn btn-primary" href="${esc(appUrl)}/login">进入账号中心</a><a class="btn btn-ghost" href="/order-lookup">返回查询</a></p>
  </div>
</div></section>
<script>
(() => {
  var form = document.getElementById('order-lookup-form');
  var queryCard = document.querySelector('.lookup-query-card');
  var error = document.getElementById('lookup-error');
  var result = document.getElementById('lookup-result');
  var submit = document.getElementById('lookup-submit');
  function formatDate(value) { var parts = String(value || '').split('-'); return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : (value || '待定'); }
  function addDetail(parent, label, value) { if (!value) return; var row = document.createElement('div'); var dt = document.createElement('dt'); var dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); parent.appendChild(row); }
  function section(title, code) { var node = document.createElement('section'); node.className = 'order-record-section'; var codeNode = document.createElement('p'); codeNode.className = 'section-code'; codeNode.textContent = code; var heading = document.createElement('h3'); heading.textContent = title; node.append(codeNode, heading); return node; }
  function renderOrder(order, temporaryPassword) {
    var article = document.createElement('article'); article.className = 'order-record';
    var head = document.createElement('div'); head.className = 'order-record-head';
    var headCopy = document.createElement('div'); var code = document.createElement('p'); code.className = 'section-code'; code.textContent = 'ORDER / ' + order.orderNo; var title = document.createElement('h2'); title.textContent = order.device.name; var date = document.createElement('p'); date.className = 'section-note'; date.textContent = formatDate(order.startDate) + ' 至 ' + formatDate(order.endDate); headCopy.append(code, title, date);
    var actions = document.createElement('div'); actions.className = 'order-record-head-actions'; var status = document.createElement('span'); status.className = 'order-status'; status.textContent = order.statusLabel; actions.appendChild(status); if (order.contract && order.contract.url) { var signLink = document.createElement('a'); signLink.className = 'btn btn-primary order-contract-action'; signLink.href = order.contract.url; signLink.target = '_blank'; signLink.rel = 'noopener'; signLink.textContent = order.contract.status === 'pending_sign' ? '签署合同' : '查看合同'; actions.appendChild(signLink); } head.append(headCopy, actions); article.appendChild(head);
    var grid = document.createElement('div'); grid.className = 'order-record-grid';
    var detail = section('订单详情', 'ORDER DETAIL'); var detailList = document.createElement('dl'); detailList.className = 'lookup-data-list'; addDetail(detailList, '订单编号', order.orderNo); addDetail(detailList, '下单时间', order.createdAt); addDetail(detailList, '租期', formatDate(order.startDate) + (order.startPeriod === 'PM' ? ' 下午' : ' 上午') + ' 至 ' + formatDate(order.endDate) + (order.endPeriod === 'PM' ? ' 下午' : ' 上午') + '（' + (order.rentalPeriod || 0) + ' 天）'); addDetail(detailList, '取还方式', order.deliveryMethod === 'Delivery' ? '送货上门' : '到店自取'); addDetail(detailList, '取货地点 / 时间', [order.pickupLocation, order.pickupTimeSlot].filter(Boolean).join(' · ')); addDetail(detailList, '归还地点 / 时间', [order.returnLocation, order.returnTimeSlot].filter(Boolean).join(' · ')); addDetail(detailList, '订单备注', order.rentalNote); detail.appendChild(detailList); grid.appendChild(detail);
    var device = section('设备信息', 'DEVICE'); var deviceList = document.createElement('dl'); deviceList.className = 'lookup-data-list'; addDetail(deviceList, '设备名称', order.device.name); addDetail(deviceList, '型号', order.device.model); addDetail(deviceList, '序列号', order.device.serialNumber); addDetail(deviceList, '配置', [order.device.cpu, order.device.ram, order.device.storage, order.device.gpu, order.device.os].filter(Boolean).join(' · ')); device.appendChild(deviceList); grid.appendChild(device);
    var payment = section('费用与付款', 'PAYMENT'); var paymentList = document.createElement('dl'); paymentList.className = 'lookup-data-list'; var rentalAmount = Math.max(0, Number(order.totalAmount || 0) - Number(order.depositAmount || 0) - Number(order.deliveryFee || 0)); addDetail(paymentList, '租赁费用', 'AUD$' + rentalAmount.toFixed(2)); addDetail(paymentList, '配送费', 'AUD$' + Number(order.deliveryFee || 0).toFixed(2)); addDetail(paymentList, '押金', 'AUD$' + Number(order.depositAmount || 0).toFixed(2)); addDetail(paymentList, '订单合计', 'AUD$' + Number(order.totalAmount || 0).toFixed(2)); if (Number(order.amountDue || 0) > 0) addDetail(paymentList, '待支付', 'AUD$' + Number(order.amountDue).toFixed(2)); addDetail(paymentList, '付款状态', order.paymentStatus); addDetail(paymentList, '押金状态', order.depositStatus); payment.appendChild(paymentList); grid.appendChild(payment);
    if (order.contract) { var contract = section('合同', 'CONTRACT'); var contractList = document.createElement('dl'); contractList.className = 'lookup-data-list'; addDetail(contractList, '合同编号', order.contract.number || '租赁合同'); addDetail(contractList, '合同状态', order.contract.statusLabel); if (order.contract.signedAt) addDetail(contractList, '签署时间', order.contract.signedAt); contract.appendChild(contractList); if (order.contract.url) { var link = document.createElement('a'); link.className = 'btn btn-primary'; link.href = order.contract.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = order.contract.status === 'pending_sign' ? '打开合同并签署' : '查看 / 下载合同'; contract.appendChild(link); } grid.appendChild(contract); }
    if (order.windowsPassword || temporaryPassword) { var access = section('账户密码', 'ACCESS'); if (temporaryPassword) { var temp = document.createElement('div'); temp.className = 'credential-row'; var tempLabel = document.createElement('span'); tempLabel.textContent = '临时账户密码'; var tempValue = document.createElement('strong'); tempValue.textContent = temporaryPassword; temp.append(tempLabel, tempValue); access.appendChild(temp); } if (order.windowsUsername) { var username = document.createElement('div'); username.className = 'credential-row'; var usernameLabel = document.createElement('span'); usernameLabel.textContent = 'Windows 用户名'; var usernameValue = document.createElement('strong'); usernameValue.textContent = order.windowsUsername; username.append(usernameLabel, usernameValue); access.appendChild(username); } if (order.windowsPassword) { var win = document.createElement('div'); win.className = 'credential-row'; var winLabel = document.createElement('span'); winLabel.textContent = 'Windows 密码'; var winValue = document.createElement('strong'); winValue.textContent = order.windowsPassword; win.append(winLabel, winValue); access.appendChild(win); } var note = document.createElement('p'); note.className = 'section-note'; note.textContent = temporaryPassword ? '临时密码已更新，请立即保存。' : '请勿将密码分享给他人。'; access.appendChild(note); grid.appendChild(access); }
    article.appendChild(grid); return article;
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault(); error.hidden = true; result.hidden = true; submit.disabled = true; submit.textContent = '查询中…';
    var data = new FormData(form); var turnstile = form.querySelector('[name="cf-turnstile-response"]');
    fetch('/api/order-lookup', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ orderNo: data.get('orderNo'), email: data.get('email'), turnstileToken: turnstile ? turnstile.value : '' }) })
      .then(function (response) { return response.json().then(function (json) { return { ok: response.ok, json: json }; }); })
      .then(function (response) { if (!response.ok || !response.json.ok) throw new Error(response.json.message || '查询失败。'); result.hidden = false; if (queryCard) queryCard.hidden = true; document.getElementById('lookup-message').textContent = response.json.message || '已找到订单。'; if (response.json.registered) { document.getElementById('lookup-credentials').hidden = true; document.getElementById('lookup-order-info').replaceChildren(); return; } document.getElementById('lookup-message').textContent = '已找到订单，以下为当前最新信息。'; var credentials = document.getElementById('lookup-credentials'); credentials.hidden = !response.json.temporaryPassword; if (response.json.temporaryPassword) { document.getElementById('lookup-result-order').textContent = response.json.order.orderNo; document.getElementById('lookup-result-password').textContent = response.json.temporaryPassword; } var info = document.getElementById('lookup-order-info'); info.replaceChildren(renderOrder(response.json.order, response.json.temporaryPassword)); })
      .catch(function (reason) { error.textContent = reason.message || '查询失败，请稍后重试。'; error.hidden = false; if (window.turnstile) window.turnstile.reset(); })
      .finally(function () { submit.disabled = false; submit.textContent = '查询订单'; });
  });
})();
</script>`
}
