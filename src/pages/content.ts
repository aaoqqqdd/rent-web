// 租赁说明、品牌、联系与 404 页面。

import { esc } from '../layout'
import type { RentalConfig, SiteContact } from '../db'

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
    <div class="kicker">租赁说明</div>
    <h1>从选设备到归还，每一步都说清楚</h1>
    <p>申请不会立即扣款。我们先确认档期、取还方式和最终费用，再安排合同、付款和交付。</p>
    <nav class="guide-jump" aria-label="租赁说明快速导航"><a href="#process">申请流程</a><a href="#pricing">费用</a><a href="#delivery">取还</a><a href="#responsibilities">使用与归还</a><a href="#faq">FAQ</a></nav>
  </div>
</section>
<section class="section" id="process">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">完整流程</div><h2>先申请，确认后再付款</h2></div><p>页面上的库存和价格来自实时设备库，但提交申请不等于订单已最终确认。</p></div>
    <div class="guide-steps">
      <article><span>01 / 选择</span><h2>在设备库确定具体机型</h2><p>按用途、配置、价格与现货状态筛选。打开详情页核对处理器、显卡、内存、存储和操作系统。</p><a href="/products" class="text-link">浏览设备库 →</a></article>
      <article><span>02 / 申请</span><h2>填写租期、取还与联系信息</h2><p>可一次申请多台设备，同一购物车共用租期和取还方式。页面会估算租金、优惠和押金。</p></article>
      <article><span>03 / 验证</span><h2>验证付款方式并提交</h2><p>提交前需通过 Stripe 验证信用卡。这一步只验证付款方式，不会立即收取租金或押金。</p></article>
      <article><span>04 / 审核</span><h2>我们核对档期与最终费用</h2><p>订单先进入待审核状态。我们会核对库存冲突、配送地址、优惠码、配送费和最终金额。</p></article>
      <article><span>05 / 签约付款</span><h2>确认后进入租赁系统</h2><p>查看并签署租赁合同，按确认金额完成付款。在此之前，申请不会直接进入交付。</p></article>
      <article><span>06 / 交付归还</span><h2>按确认的时间取机并验收</h2><p>选择配送或当前开放的自取点。租期结束时携齐设备与配件归还，完成验机和押金结算。</p></article>
    </div>
  </div>
</section>

<section class="section alt" id="pricing">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">费用怎么组成</div><h2>租金、押金与配送费</h2></div><p>产品卡上的月租价格用于预算参考；实际金额会根据具体日期和审核结果确定。</p></div>
    <div class="fee-table" role="table" aria-label="租赁费用说明">
      <div class="fee-row fee-head" role="row"><span>项目</span><span>什么时候产生</span><span>怎么计算</span></div>
      <div class="fee-row" role="row"><strong>租金</strong><span>合同确认后</span><span>日租价 × 实际租赁天数</span></div>
      <div class="fee-row" role="row"><strong>押金</strong><span>签约付款时</span><span>设备对应押金；归还验收无误后退回</span></div>
      <div class="fee-row" role="row"><strong>优惠</strong><span>提交申请时</span><span>按优惠码的适用设备、有效期、使用次数和最低消费校验</span></div>
      <div class="fee-row" role="row"><strong>配送费</strong><span>选择送货时</span><span>根据地址与时段，在审核时确认</span></div>
      <div class="fee-row" role="row"><strong>额外费用</strong><span>仅发生异常时</span><span>逾期、缺件或人为损坏按合同与实际情况结算</span></div>
    </div>
    <div class="process-note"><span>IMPORTANT</span><p>下单页显示的是预计金额。付款前请核对审核后的最终订单和租赁合同；合同内的费用、租期和取还安排是本次租赁的最终依据。</p></div>
  </div>
</section>

<section class="section" id="delivery">
  <div class="wrap delivery-grid">
    <div><div class="kicker">取还范围</div><h2>墨尔本本地交付</h2><p>${esc(config.deliveryNote)} 当前可配送区域包括：${esc(deliveryAreas)}。</p><p>具体配送时段、费用和地址是否可服务，会在订单审核时确认。其他墨尔本郊区请选择到店自取。</p><p>当前可选自取 / 归还地点：</p>${pickupLocations}</div>
    <div class="map-card" aria-label="配送范围示意"><span class="map-ring ring-1"></span><span class="map-ring ring-2"></span><span class="map-pin">MEL</span><div><strong>INNER MELBOURNE</strong><small>DELIVERY ZONE · CONFIRM ON REVIEW</small></div></div>
  </div>
</section>

<section class="section alt" id="responsibilities">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">交付到归还</div><h2>设备怎么验收、使用和交回</h2></div><p>出租前和归还后都会检查设备。收到时及时核对，能减少后续对设备状态的争议。</p></div>
    <div class="service-standard-grid">
      <article><span>01 / 收到时</span><h3>当面核对</h3><ul><li>确认型号、外观和基本功能</li><li>核对充电器及约定的配件</li><li>发现异常尽快联系并留存记录</li></ul></article>
      <article><span>02 / 使用中</span><h3>妥善保管</h3><ul><li>仅用于合法用途，不转借、转租或抵押</li><li>不自行拆机、改装或绕过安全措施</li><li>注意防水、防摔和账户安全</li></ul></article>
      <article><span>03 / 需要变更</span><h3>提前联系</h3><ul><li>续租需先确认后续档期</li><li>提前归还是否调整租金以合同为准</li><li>地址或时间变更需重新确认</li></ul></article>
      <article><span>04 / 归还前</span><h3>备份并清点</h3><ul><li>备份文件，退出个人账户并清除资料</li><li>携齐设备、充电器和全部配件</li><li>按合同时间和地点完成归还</li></ul></article>
    </div>
    <div class="process-note"><span>SUPPORT</span><p>租期内出现故障时，请先停止可能扩大损坏的操作，并联系 7×12 小时技术支持。经确认为设备自身故障且符合租赁条件时，我们会安排排查或免费换机。</p></div>
  </div>
</section>

<section class="section" id="faq">
  <div class="wrap faq-layout">
    <div class="faq-intro"><div class="kicker">FAQ</div><h2>常见问题</h2><p>还有具体问题？带上设备名称、日期和 suburb 联系我们，会更快得到准确答复。</p><a href="/contact" class="btn btn-ghost">联系我们</a></div>
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

<section class="section closing"><div class="wrap"><div class="kicker">下一步</div><h2>规则看明白了，就去选一台。</h2><p>申请前请同时阅读<a href="/service-terms" class="inline-link">服务条款</a>和<a href="/refund-policy" class="inline-link">退款政策</a>。不确定配置、档期或配送范围时，可以先问顾问。</p><div class="hero-actions"><a class="btn btn-primary btn-lg" href="/products">浏览设备</a><a class="btn btn-ghost btn-lg" href="/contact">先咨询</a></div></div></section>`
}

export function renderAbout(contact: SiteContact, config: RentalConfig): string {
  const phoneHref = contact.phone.replace(/[^+\d]/g, '')
  return /* html */ `
<section class="page-hero compact about-hero"><div class="wrap about-hero-grid">
  <div><div class="kicker">关于 ${esc(contact.name)}</div><h1>好设备应该跟着项目走</h1><p>我们为在墨尔本学习、工作和创作的人提供电脑租赁：需要性能时用得上，项目结束后不必长期闲置。</p></div>
  <div class="about-signal" aria-label="墨尔本本地电脑租赁"><div class="signal-grid"></div><span>MEL / LOCAL</span><strong>COMPUTE<br>ON DEMAND</strong><small>实时库存 · 先审核后付款</small></div>
</div></section>

<section class="about-stats"><div class="wrap">
  <div><strong>3</strong><span>类核心设备</span></div>
  <div><strong>${esc(config.minimumRentalDays)}</strong><span>天起租</span></div>
  <div><strong>2</strong><span>种取还方式</span></div>
  <div><strong>7×12</strong><span>小时技术支持</span></div>
</div></section>

<section class="section"><div class="wrap story-grid">
  <div class="story-lead"><span>OUR STORY</span><h2>购买，不是获得算力的唯一方式。</h2></div>
  <div class="story-copy"><p>一次课程项目、几周的剪辑工作、临时出差，往往都需要一台更合适的电脑，却不一定值得长期持有。${esc(contact.name)} 把设备采购、检查、周转和支持放在后台，让用户按真正需要的时间使用设备。</p><p>我们专注墨尔本本地服务，提供游戏笔记本、轻薄商务本和台式工作站。租期可从 ${esc(config.minimumRentalDays)} 天起，也可覆盖更长项目；每份申请都会在付款前核对档期、价格和交付安排。</p><p>我们想解决的不只是“哪里能租到电脑”，而是让配置、费用、押金、取还和售后都有明确的下一步。</p></div>
</div></section>

<section class="section alt"><div class="wrap"><div class="section-head"><div><div class="kicker">我们的承诺</div><h2>把租赁做得更透明、更可预期</h2></div><p>不用夸大的数字讲故事，用每个订单都能验证的流程建立信任。</p></div><div class="principle-grid about-values">
  <article><span>01</span><h3>信息透明</h3><p>配置、日租价、押金和库存状态直接同步展示。</p></article>
  <article><span>02</span><h3>设备可靠</h3><p>交付前检查基础功能和配件，归还后再次验机。</p></article>
  <article><span>03</span><h3>费用先确认</h3><p>申请阶段不立即扣款，最终费用在签约付款前核对。</p></article>
  <article><span>04</span><h3>墨尔本本地响应</h3><p>围绕本地配送和自取建立流程。${esc(pickupSummary(config))}。</p></article>
  <article><span>05</span><h3>租期内有支持</h3><p>提供 7×12 小时技术支持，符合条件的故障安排排查或换机。</p></article>
  <article><span>06</span><h3>责任说清楚</h3><p>正常损耗、人为损坏、缺件和逾期处理以已签合同为准。</p></article>
</div></div></section>

<section class="section" id="contact"><div class="wrap about-contact">
  <div><div class="kicker">和我们聊聊</div><h2>告诉我们，你准备拿电脑做什么。</h2><p>带上用途、开始与结束日期、所在 suburb 和必须运行的软件，我们可以更快帮你判断配置。</p><a class="btn btn-primary" href="/products">浏览产品目录</a></div>
  <div class="contact-options">
    <a class="contact-option" href="tel:${esc(phoneHref)}"><span>电话</span><strong>${esc(contact.phone)}</strong><small>适合紧急档期与当天取还咨询</small></a>
    <a class="contact-option" href="mailto:${esc(contact.email)}"><span>邮箱</span><strong>${esc(contact.email)}</strong><small>适合发送配置清单和项目说明</small></a>
    <a class="contact-option" href="/contact"><span>本地取还</span><strong>${esc(contact.address)}</strong><small>${esc(pickupSummary(config))}</small></a>
  </div>
</div></section>`
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
  var inquiryStart = document.getElementById('inquiry-start');
  var inquiryEnd = document.getElementById('inquiry-end');
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
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

export function renderOrderLookup(appUrl: string): string {
  return /* html */ `
<section class="page-hero compact"><div class="wrap"><div class="kicker">订单查询</div><h1>用订单编号查看申请进度</h1><p>输入订单编号和申请时使用的邮箱。临时账户可重新生成一次临时密码，正式账户请直接登录。</p></div></section>
<section class="section"><div class="wrap form-wrap lookup-wrap">
  <form class="form-card" id="order-lookup-form">
    <div class="form-alert" id="lookup-error" hidden></div>
    <div class="field"><label for="lookup-order-no">订单编号</label><input id="lookup-order-no" name="orderNo" placeholder="例如 OD-20260911-ABC123" autocomplete="off" required></div>
    <div class="field"><label for="lookup-email">申请邮箱</label><input id="lookup-email" name="email" type="email" autocomplete="email" required></div>
    <button class="btn btn-primary btn-lg" type="submit" id="lookup-submit">查询订单</button>
  </form>
  <div class="form-card lookup-result" id="lookup-result" hidden>
    <h2 id="lookup-title">订单信息</h2><p id="lookup-message" class="form-intro"></p>
    <div id="lookup-credentials" class="temporary-credentials" hidden><span>临时账户</span><strong>订单编号：<b id="lookup-result-order"></b></strong><strong>临时密码：<b id="lookup-result-password"></b></strong><p>密码已更新，请立即保存。之后可进入账号中心登录。</p></div>
    <div id="lookup-order-info" class="lookup-order-info" hidden></div>
    <p class="lookup-login"><a class="btn btn-primary" href="${esc(appUrl)}/login">进入账号中心</a></p>
  </div>
</div></section>
<script>
(() => {
  var form = document.getElementById('order-lookup-form');
  var error = document.getElementById('lookup-error');
  var result = document.getElementById('lookup-result');
  var submit = document.getElementById('lookup-submit');
  form.addEventListener('submit', function (event) {
    event.preventDefault(); error.hidden = true; submit.disabled = true; submit.textContent = '查询中…';
    var data = new FormData(form);
    fetch(${JSON.stringify(`${appUrl}/public/order-lookup`)}, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ orderNo: data.get('orderNo'), email: data.get('email') }) })
      .then(function (response) { return response.json().then(function (json) { return { ok: response.ok, json: json }; }); })
      .then(function (response) {
        if (!response.ok || !response.json.ok) throw new Error(response.json.message || '查询失败。');
        result.hidden = false; document.getElementById('lookup-message').textContent = response.json.message || '已找到订单。';
        if (response.json.registered) return;
        var order = response.json.order;
        document.getElementById('lookup-credentials').hidden = false;
        document.getElementById('lookup-result-order').textContent = order.orderNo;
        document.getElementById('lookup-result-password').textContent = response.json.temporaryPassword;
        var info = document.getElementById('lookup-order-info'); info.hidden = false; info.replaceChildren(); [order.deviceName, order.startDate + ' 至 ' + order.endDate, '状态：' + order.status, '预计金额：AUD$' + Number(order.totalAmount || 0).toFixed(2)].forEach(function (text, index) { var node = document.createElement(index === 0 ? 'strong' : 'span'); node.textContent = text || ''; info.appendChild(node); });
      })
      .catch(function (reason) { error.textContent = reason.message || '查询失败，请稍后重试。'; error.hidden = false; })
      .finally(function () { submit.disabled = false; submit.textContent = '查询订单'; });
  });
})();
</script>`
}
