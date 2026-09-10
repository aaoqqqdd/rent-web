// 租赁说明、品牌、联系与 404 页面。

import { esc } from '../layout'
import type { RentalConfig, SiteContact } from '../db'

function pickupSummary(config: RentalConfig): string {
  return config.pickupLocations.length
    ? config.pickupLocations.join('、')
    : '自取地点请联系客服确认'
}

export function renderRentalGuide(config: RentalConfig): string {
  const pickupLocations = config.pickupLocations.length
    ? `<ul class="check-list">${config.pickupLocations.map((location) => `<li>${esc(location)}</li>`).join('')}</ul>`
    : '<p>管理员尚未配置公开自取点，请在提交前联系客服确认。</p>'
  return /* html */ `
<section class="page-hero compact guide-hero">
  <div class="wrap">
    <div class="kicker">租赁说明</div>
    <h1>从选设备到归还，每一步都说清楚</h1>
    <p>申请不会立即扣款。我们先确认档期、取还方式和最终费用，再安排合同与付款。</p>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="guide-steps">
      <article><span>01 / 选择</span><h2>在设备库确定具体机型</h2><p>按用途、配置、价格与现货状态筛选。打开详情页核对处理器、显卡、内存、存储和操作系统。</p><a href="/products" class="text-link">浏览设备库 →</a></article>
      <article><span>02 / 申请</span><h2>填写日期、取还与账号信息</h2><p>下单页会即时估算租金与押金。已有账号时使用相同邮箱和密码；新用户会同时创建账户。</p></article>
      <article><span>03 / 确认</span><h2>管理员核对档期与费用</h2><p>订单先进入待确认状态。我们会核对设备、配送地址、优惠码与最终费用，然后联系你。</p></article>
      <article><span>04 / 交付</span><h2>在线签约付款，再取机</h2><p>确认后进入租赁系统完成合同和付款。内城区安排配送，也可以前往数据库中当前开放的自取点取机。</p></article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">费用怎么组成</div><h2>租金、押金与配送费</h2></div><p>产品卡上的月租价格用于预算参考；实际金额会根据具体日期和审核结果确定。</p></div>
    <div class="fee-table" role="table" aria-label="租赁费用说明">
      <div class="fee-row fee-head" role="row"><span>项目</span><span>什么时候产生</span><span>怎么计算</span></div>
      <div class="fee-row" role="row"><strong>租金</strong><span>合同确认后</span><span>日租价 × 实际租赁天数</span></div>
      <div class="fee-row" role="row"><strong>押金</strong><span>签约付款时</span><span>设备对应押金；归还验收无误后退回</span></div>
      <div class="fee-row" role="row"><strong>配送费</strong><span>选择送货时</span><span>根据地址与时段，在审核时确认</span></div>
      <div class="fee-row" role="row"><strong>额外费用</strong><span>仅发生异常时</span><span>逾期、缺件或人为损坏按合同与实际情况结算</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap delivery-grid">
    <div><div class="kicker">取还范围</div><h2>墨尔本本地交付</h2><p>CBD 与周边内城区可安排送货上门，包括 Docklands、Southbank、South Yarra、Carlton、East Melbourne 等。是否覆盖以及运费，会结合具体地址确认。</p><p>当前可选自取 / 归还地点：</p>${pickupLocations}</div>
    <div class="map-card" aria-label="配送范围示意"><span class="map-ring ring-1"></span><span class="map-ring ring-2"></span><span class="map-pin">MEL</span><div><strong>INNER MELBOURNE</strong><small>DELIVERY ZONE · CONFIRM ON REVIEW</small></div></div>
  </div>
</section>

<section class="section alt" id="faq">
  <div class="wrap faq-layout">
    <div class="faq-intro"><div class="kicker">FAQ</div><h2>常见问题</h2><p>还有具体问题？带上设备名称、日期和 suburb 联系我们，会更快得到准确答复。</p><a href="/contact" class="btn btn-ghost">联系我们</a></div>
    <div class="faq-list">
      <details open><summary>最短可以租多久？</summary><p>当前最短租期为 ${esc(config.minimumRentalDays)} 天。设备周转和不可用日期会由租赁系统继续校验。</p></details>
      <details><summary>为什么提交后还不是正式订单？</summary><p>库存状态实时同步，但最终仍需人工核对档期、设备状况与配送安排。确认后才生成合同并进入付款。</p></details>
      <details><summary>月租参考价是最终价格吗？</summary><p>不是。月租参考价按日租价乘以展示系数计算，用来快速比较。准确租金以下单日期和审核后的订单为准。</p></details>
      <details><summary>押金什么时候退？</summary><p>设备归还并完成验收后处理。无损坏、缺件、逾期或其他应付费用时，按原支付方式退回。</p></details>
      <details><summary>可以续租或提前归还吗？</summary><p>可以提出申请。请尽早联系客服确认后续档期；提前归还是否调整租金，以已签合同约定为准。</p></details>
      <details><summary>设备故障怎么办？</summary><p>先联系 7×12 小时技术支持。确认是设备自身故障且符合租赁条件时，我们会安排排查或免费换机。</p></details>
      <details><summary>设备里会保留我的资料吗？</summary><p>归还前请自行备份并退出个人账号、清除本地资料。我们会按交付流程重置设备，但重要资料不应只保存在租赁设备上。</p></details>
      <details><summary>可以指定软件或配件吗？</summary><p>可在申请备注中写明软件、接口、显示器或其他配件需求。是否可提供及相关费用会在审核时确认。</p></details>
    </div>
  </div>
</section>

<section class="section closing"><div class="wrap"><div class="kicker">下一步</div><h2>规则看明白了，就去选一台。</h2><p>申请提交前会看到租金估算与押金，不确定的配置也可以先问顾问。</p><div class="hero-actions"><a class="btn btn-primary btn-lg" href="/products">浏览设备</a><a class="btn btn-ghost btn-lg" href="/contact">先咨询</a></div></div></section>`
}

export function renderAbout(contact: SiteContact, config: RentalConfig): string {
  return /* html */ `
<section class="page-hero compact about-hero"><div class="wrap"><div class="kicker">关于 ${esc(contact.name)}</div><h1>让好设备跟着项目走，而不是闲在桌上</h1><p>我们服务在墨尔本学习、工作与创作的人：需要性能时随时接上，用完以后轻松归还。</p></div></section>
<section class="section"><div class="wrap story-grid">
  <div class="story-lead"><span>WHY RENT</span><h2>购买不是获得算力的唯一方式。</h2></div>
  <div class="story-copy"><p>一次课程项目、几周的剪辑工作、临时出差，往往都需要一台更合适的电脑，却不一定值得长期持有。${esc(contact.name)} 把设备采购、基础检测、周转与支持放在后台，让用户只为真正使用的时间做决定。</p><p>我们提供游戏笔记本、轻薄商务本和台式工作站。当前最短租期为 ${esc(config.minimumRentalDays)} 天，也可以覆盖更长项目；每次申请都会人工确认设备档期与交付安排。</p></div>
</div></section>
<section class="section alt"><div class="wrap"><div class="section-head tight"><div><div class="kicker">我们怎么做</div><h2>把租赁做得更确定</h2></div></div><div class="principle-grid">
  <article><span>01</span><h3>信息透明</h3><p>配置、日租价、押金与库存状态直接同步展示。最终费用在签约付款前再次确认。</p></article>
  <article><span>02</span><h3>设备可靠</h3><p>交付前检查基础功能与配件；出现符合条件的设备故障时，提供排查或换机支持。</p></article>
  <article><span>03</span><h3>本地响应</h3><p>围绕墨尔本本地配送与自取建立流程。${esc(pickupSummary(config))}。</p></article>
  <article><span>04</span><h3>流程克制</h3><p>先申请、后确认，再签约付款。没有在档期未确认时仓促收款，也不会隐藏关键步骤。</p></article>
  </div></div></section>
<section class="section"><div class="wrap contact-strip" id="contact"><div><div class="kicker">和我们聊聊</div><h2>告诉我们，你准备拿电脑做什么。</h2><p>${esc(contact.address)}</p></div><div class="contact-strip-actions"><a class="btn btn-primary" href="/contact">联系设备顾问</a><a class="text-link" href="mailto:${esc(contact.email)}">${esc(contact.email)} →</a></div></div></section>`
}

export function renderContact(contact: SiteContact, config: RentalConfig, appUrl: string, initialSubject: string): string {
  const phoneHref = contact.phone.replace(/[^+\d]/g, '')
  return /* html */ `
<section class="page-hero compact contact-hero"><div class="wrap"><div class="kicker">联系我们</div><h1>把用途说给我们，配置交给我们一起判断</h1><p>咨询设备、配送范围、档期或已有申请。附上日期、常用软件和预算，会更容易一次答清。</p></div></section>
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
    <div class="row2"><div class="field"><label for="inquiry-start">预计开始日期</label><input type="date" id="inquiry-start" name="start"></div><div class="field"><label for="inquiry-end">预计结束日期</label><input type="date" id="inquiry-end" name="end"></div></div>
    <div class="field"><label for="inquiry-message">用途、软件或其他要求</label><textarea id="inquiry-message" name="message" placeholder="例如：在 Carlton 使用 7 天，需要运行 Premiere Pro，希望 32GB 内存…" required></textarea></div>
    <button class="btn btn-primary btn-lg" type="submit">在邮件应用中继续</button>
  </form>
</div></section>
<section class="section alt"><div class="wrap"><div class="section-head tight"><div><div class="kicker">自助入口</div><h2>也许你可以直接完成</h2></div></div><div class="info-grid three"><a class="info-card linked" href="/products"><span>找设备</span><h3>搜索实时库存</h3><p>按类型、配置、价格和现货状态筛选。</p></a><a class="info-card linked" href="/rental-guide#faq"><span>查规则</span><h3>查看常见问题</h3><p>了解押金、配送、续租与故障处理。</p></a><a class="info-card linked" href="${esc(appUrl)}/login"><span>已有订单</span><h3>进入租赁系统</h3><p>查看进度、签署合同或完成付款。</p></a></div></div></section>
<script>
(() => {
  var form = document.getElementById('contact-form');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    var data = new FormData(form);
    var subject = data.get('subject');
    var body = ['姓名：' + data.get('name'), '联系电话：' + (data.get('phone') || '未填写'), '预计租期：' + (data.get('start') || '待定') + ' 至 ' + (data.get('end') || '待定'), '', String(data.get('message'))].join('\\n');
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
