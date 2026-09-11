// 单台设备详情页。数据直接来自设备表，提供完整配置、费用口径与下单入口。

import { esc } from '../layout'
import { monthlyRentalRate, weeklyRentalRate, type Product, type RentalConfig } from '../db'

interface ProductDetailData {
  product: Product
  config: RentalConfig
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function specRow(label: string, value: string): string {
  return value ? `<div class="spec-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : ''
}

export function renderProductDetail({ product, config }: ProductDetailData): string {
  const weekly = weeklyRentalRate(product.pricePerDay, product.weeklyDiscountPercent)
  const monthly = monthlyRentalRate(product.pricePerDay, product.monthlyDiscountPercent)
  const applyHref = `/apply?device=${encodeURIComponent(product.id)}`
  const description = product.description.trim() || '这台设备已经过基础功能检查，适合短期项目、学习、创作或临时替代使用。具体外观与随机配件以交付前确认为准。'
  const pickupText = config.pickupLocations.length
    ? `自取点：${config.pickupLocations.join('、')}`
    : '自取地点请联系客服确认'
  const deliveryText = config.deliveryAreas.length
    ? `配送区域：${config.deliveryAreas.join('、')}`
    : config.deliveryNote

  return /* html */ `
<nav class="crumbs wrap" aria-label="面包屑">
  <a href="/">首页</a><span>/</span><a href="/products">设备库</a><span>/</span><span>${esc(product.name)}</span>
</nav>
<section class="product-detail">
  <div class="wrap detail-grid">
    <div class="detail-visual" aria-hidden="true">
      <div class="detail-orbit orbit-one"></div><div class="detail-orbit orbit-two"></div>
      <div class="detail-device"><div class="detail-screen"><span>GEEK<br>SLOPE</span></div><div class="detail-base"></div></div>
      <span class="detail-category">${esc(product.categoryLabel)}</span>
    </div>
    <div class="detail-copy">
      <div class="status-line"><span class="tag ${product.available ? '' : 'tag-muted'}"><i></i>${product.available ? '现货可租' : '当前可预约'}</span><span>库存实时同步</span></div>
      <p class="detail-brand">${esc(product.brand || product.categoryLabel)}</p>
      <h1>${esc(product.name)}</h1>
      ${product.model ? `<p class="detail-model">型号 ${esc(product.model)}</p>` : ''}
      <p class="detail-description">${esc(description)}</p>
      <div class="detail-price">
        <div><span>按日</span><strong>${product.pricePerDay > 0 ? `$${esc(product.pricePerDay)}` : '询价'}</strong><small>${product.pricePerDay > 0 ? '/ day' : '联系客服'}</small></div>
        <div><span>周租</span><strong>${product.pricePerDay > 0 ? `$${esc(weekly)}` : '—'}</strong><small>${product.weeklyDiscountPercent > 0 ? `折扣 ${esc(product.weeklyDiscountPercent)}%` : '/ week'}</small></div>
        <div><span>月租参考</span><strong>${product.pricePerDay > 0 ? `$${esc(monthly)}` : '—'}</strong><small>${product.pricePerDay > 0 ? '/ month' : ''}</small></div>
        <div><span>可退押金</span><strong>${product.depositAmount > 0 ? `$${esc(product.depositAmount)}` : '待确认'}</strong><small>验收后退还</small></div>
      </div>
      <div class="detail-rental-term">
        <div class="kicker">先选租期</div>
        <p>选择后加入购物车，之后仍可在购物车中修改。</p>
        <div class="row2">
          <div class="field"><label for="detail-start-date">取货日期</label><input type="date" id="detail-start-date" required></div>
          <div class="field"><label for="detail-start-period">取货时段</label><select id="detail-start-period"><option value="AM">上午</option><option value="PM">下午</option></select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="detail-end-date">归还日期</label><input type="date" id="detail-end-date" required></div>
          <div class="field"><label for="detail-end-period">归还时段</label><select id="detail-end-period"><option value="AM">上午</option><option value="PM">下午</option></select></div>
        </div>
        <p class="hint">最短租期 ${esc(config.minimumRentalDays)} 天。</p>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary btn-lg" id="detail-add-cart" type="button">加入购物车并查看</button>
        <a class="btn btn-ghost btn-lg" href="/contact?subject=${encodeURIComponent(`咨询 ${product.name}`)}">咨询这台设备</a>
      </div>
      <p class="microcopy">先提交申请，不会立即扣款。我们确认档期后再安排签约与付款。</p>
    </div>
  </div>
</section>

<section class="section detail-info-section">
  <div class="wrap detail-info-grid">
    <div>
      <div class="section-head tight"><div class="kicker">完整规格</div><h2>你租到什么</h2></div>
      <div class="spec-table">
        ${specRow('处理器', product.cpu)}
        ${specRow('显卡', product.gpu)}
        ${specRow('内存', product.ram)}
        ${specRow('存储', product.storage)}
        ${specRow('操作系统', product.os)}
        ${specRow('品牌', product.brand)}
        ${specRow('型号', product.model)}
        ${product.specs.length ? '' : '<div class="spec-row"><span>配置</span><strong>交付前由客服确认</strong></div>'}
      </div>
    </div>
    <aside class="included-card">
      <div class="kicker">服务包含</div>
      <h2>设备之外，也一起准备好</h2>
      <ul class="check-list">
        <li>交付前基础功能与外观检查</li>
        <li>设备适配的电源与必要配件</li>
        <li>7×12 小时租期内技术支持</li>
        <li>符合条件的故障免费换机</li>
        <li>${esc(deliveryText)}；${esc(pickupText)}</li>
      </ul>
      <a href="/rental-guide" class="text-link">查看租赁规则 <span>→</span></a>
    </aside>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="section-head tight"><div class="kicker">费用说明</div><h2>每一笔费用，提交前都看得见</h2></div>
    <div class="info-grid three">
      <article class="info-card"><span>租金</span><h3>按实际租期计算</h3><p>下单页会根据取还日期即时预估。月租展示价仅供长期租赁预算参考。</p></article>
      <article class="info-card"><span>押金</span><h3>验收无误后退还</h3><p>归还后完成设备检查；无损坏、缺件或逾期费用时，押金按原支付方式退回。</p></article>
      <article class="info-card"><span>配送</span><h3>审核时确认</h3><p>${esc(config.deliveryNote)} ${esc(pickupText)}。</p></article>
    </div>
  </div>
</section>`
    + `<script>
(() => {
  var start = document.getElementById('detail-start-date');
  var end = document.getElementById('detail-end-date');
  var startPeriod = document.getElementById('detail-start-period');
  var endPeriod = document.getElementById('detail-end-period');
  var button = document.getElementById('detail-add-cart');
  var minimumDays = ${config.minimumRentalDays};
  var today = new Date();
  var dateString = function (date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); };
  var addDays = function (value, amount) { var date = new Date(value + 'T00:00:00'); date.setDate(date.getDate() + amount); return dateString(date); };
  start.min = dateString(today); start.value = start.min;
  end.min = addDays(start.value, minimumDays); end.value = end.min;
  start.addEventListener('change', function () { end.min = addDays(start.value, minimumDays); if (end.value < end.min) end.value = end.min; });
  button.addEventListener('click', function () {
    if (!start.value || !end.value || end.value < end.min || !window.GeekSlopeCart) return;
    window.GeekSlopeCart.add(${scriptJson(product.id)}, { startDate: start.value, endDate: end.value, startPeriod: startPeriod.value, endPeriod: endPeriod.value });
    location.href = ${JSON.stringify(applyHref)};
  });
})();
</script>`
}
