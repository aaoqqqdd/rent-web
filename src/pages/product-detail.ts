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
        <div><span>周租</span>${product.pricePerDay > 0 && product.weeklyDiscountPercent > 0 ? `<del class="price-original">$${(product.pricePerDay * 7).toFixed(2)}</del>` : ''}<strong>${product.pricePerDay > 0 ? `$${esc(weekly)}` : '—'}</strong><small>${product.pricePerDay > 0 ? '/ week' : ''}</small></div>
        <div><span>月租</span>${product.pricePerDay > 0 && product.monthlyDiscountPercent > 0 ? `<del class="price-original">$${(product.pricePerDay * 30).toFixed(2)}</del>` : ''}<strong>${product.pricePerDay > 0 ? `$${esc(monthly)}` : '—'}</strong><small>${product.pricePerDay > 0 ? '/ month' : ''}</small></div>
        <div><span>可退押金</span><strong>${product.depositAmount > 0 ? `$${esc(product.depositAmount)}` : '待确认'}</strong><small>验收后退还</small></div>
      </div>
      <div class="detail-rental-term">
        <div class="kicker">先选租期</div>
        <p>选择后加入购物车，之后仍可在购物车中修改。</p>
        <div class="row2">
          <div class="field detail-date-field"><label for="detail-start-date">取货日期</label><div class="detail-date-control"><input type="text" id="detail-start-date" class="detail-date-input" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" required><button type="button" class="detail-date-picker-toggle" id="detail-start-date-toggle" aria-label="打开取货日期日历" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg></button><div class="date-picker detail-date-picker" id="detail-start-date-picker" hidden></div></div></div>
          <div class="field"><label for="detail-start-period">取货时段</label><select id="detail-start-period"><option value="AM">上午</option><option value="PM">下午</option></select></div>
        </div>
        <div class="row2">
          <div class="field detail-date-field"><label for="detail-end-date">归还日期</label><div class="detail-date-control"><input type="text" id="detail-end-date" class="detail-date-input" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" required><button type="button" class="detail-date-picker-toggle" id="detail-end-date-toggle" aria-label="打开归还日期日历" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></button><div class="date-picker detail-date-picker" id="detail-end-date-picker" hidden></div></div></div>
          <div class="field"><label for="detail-end-period">归还时段</label><select id="detail-end-period"><option value="AM">上午</option><option value="PM">下午</option></select></div>
        </div>
        <p class="hint">最短租期 ${esc(config.minimumRentalDays)} 天。</p>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary btn-lg" id="detail-add-cart" type="button">加入购物车并查看</button>
        <a class="btn btn-ghost btn-lg" href="/about?subject=${encodeURIComponent(`咨询 ${product.name}`)}#contact">咨询这台设备</a>
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
  var startToggle = document.getElementById('detail-start-date-toggle');
  var endToggle = document.getElementById('detail-end-date-toggle');
  var startPicker = document.getElementById('detail-start-date-picker');
  var endPicker = document.getElementById('detail-end-date-picker');
  var startPeriod = document.getElementById('detail-start-period');
  var endPeriod = document.getElementById('detail-end-period');
  var button = document.getElementById('detail-add-cart');
  var minimumDays = ${config.minimumRentalDays};
  var globalUnavailableDates = ${scriptJson(config.unavailableDates)};
  var availability = {};
  var availabilityReady = false;
  var openPickerState = null;
  var today = new Date();
  var dateString = function (date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); };
  var formatDate = function (value) {
    var parts = String(value || '').split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : '';
  };
  var maskDate = function (value) {
    var digits = String(value || '').replace(/\\D/g, '').slice(0, 8);
    return digits.length > 4 ? digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
      : digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2)
        : digits;
  };
  var parseDate = function (value) {
    var text = String(value || '').trim();
    if (/^\\d{8}$/.test(text)) text = text.slice(0, 2) + '/' + text.slice(2, 4) + '/' + text.slice(4);
    var match = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(text);
    if (!match) return '';
    var iso = match[3] + '-' + match[2] + '-' + match[1];
    var date = new Date(iso + 'T00:00:00Z');
    return date.getUTCFullYear() === Number(match[3]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[1]) ? iso : '';
  };
  var setDateValue = function (input, value) { input.value = formatDate(value); input.dataset.iso = value; };
  var readDateValue = function (input) {
    var value = parseDate(input.value);
    if (value) input.dataset.iso = value;
    return value;
  };
  var invalidDateMessage = '请输入有效日期（格式：dd/mm/yyyy）。';
  var pastDateMessage = '日期不能早于今天。';
  var unavailableDateMessage = '该设备在此日期不可用，请选择其他日期。';
  var addDays = function (value, amount) { var date = new Date(value + 'T00:00:00'); date.setDate(date.getDate() + amount); return dateString(date); };
  var clearChildren = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); };
  var isUnavailable = function (value) {
    if (!value || globalUnavailableDates.indexOf(value) >= 0) return Boolean(value);
    var item = availability[${JSON.stringify(product.id)}] || {};
    return (item.unavailableDates || []).indexOf(value) >= 0
      || (item.rentalRanges || []).some(function (range) { return range.startDate <= value && value < range.endDate; });
  };
  var nextAvailable = function (value) { for (var index = 0; index < 730 && isUnavailable(value); index += 1) value = addDays(value, 1); return value; };
  var pickerDateDisabled = function (role, value) {
    if (!availabilityReady || value < start.min || isUnavailable(value)) return true;
    if (role !== 'end') return false;
    var startValue = readDateValue(start);
    return !startValue || value < end.min || periodUnavailable(startValue, value);
  };
  var periodUnavailable = function (from, to) {
    for (var value = from; value && value < to; value = addDays(value, 1)) if (isUnavailable(value)) return true;
    return false;
  };
  var renderPicker = function (picker, input, toggle, role, month) {
    var year = month.getFullYear();
    var monthIndex = month.getMonth();
    clearChildren(picker);
    var head = document.createElement('div'); head.className = 'date-picker-head';
    var title = document.createElement('strong'); title.textContent = year + '年' + (monthIndex + 1) + '月';
    var previous = document.createElement('button'); previous.type = 'button'; previous.className = 'date-picker-nav'; previous.textContent = '‹';
    var next = document.createElement('button'); next.type = 'button'; next.className = 'date-picker-nav'; next.textContent = '›';
    previous.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); var month = new Date(year, monthIndex - 1, 1); if (openPickerState) openPickerState.month = month; renderPicker(picker, input, toggle, role, month); });
    next.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); var month = new Date(year, monthIndex + 1, 1); if (openPickerState) openPickerState.month = month; renderPicker(picker, input, toggle, role, month); });
    head.append(previous, title, next); picker.appendChild(head);
    var week = document.createElement('div'); week.className = 'date-picker-week';
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function (label) { var cell = document.createElement('span'); cell.textContent = label; week.appendChild(cell); });
    picker.appendChild(week);
    var grid = document.createElement('div'); grid.className = 'date-picker-grid';
    var first = new Date(year, monthIndex, 1); var offset = (first.getDay() + 6) % 7;
    for (var index = 0; index < 42; index += 1) {
      var date = new Date(year, monthIndex, index - offset + 1); var value = dateString(date);
      var day = document.createElement('button'); day.type = 'button'; day.textContent = String(date.getDate()); day.dataset.date = value;
      if (date.getMonth() !== monthIndex) day.className = 'is-outside';
      day.disabled = pickerDateDisabled(role, value);
      if (value === readDateValue(input)) day.classList.add('is-selected');
      day.addEventListener('click', function (event) {
        setDateValue(input, event.currentTarget.dataset.date);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        picker.hidden = true; toggle.setAttribute('aria-expanded', 'false'); openPickerState = null;
      });
      grid.appendChild(day);
    }
    picker.appendChild(grid);
  };
  var openPicker = function (picker, input, toggle, role) {
    var value = readDateValue(input) || input.min || start.min;
    var date = new Date(value + 'T00:00:00');
    openPickerState = { picker: picker, input: input, toggle: toggle, role: role, month: new Date(date.getFullYear(), date.getMonth(), 1) };
    renderPicker(picker, input, toggle, role, openPickerState.month);
    picker.hidden = false; toggle.setAttribute('aria-expanded', 'true');
  };
  var refreshOpenPicker = function () {
    if (!openPickerState || openPickerState.picker.hidden) return;
    var value = readDateValue(openPickerState.input) || start.min;
    var date = new Date(value + 'T00:00:00');
    openPickerState.month = new Date(date.getFullYear(), date.getMonth(), 1);
    renderPicker(openPickerState.picker, openPickerState.input, openPickerState.toggle, openPickerState.role, openPickerState.month);
  };
  var applyDateRules = function (initial) {
    if (!availabilityReady) return;
    var startValue = readDateValue(start);
    if (!startValue && initial) {
      startValue = nextAvailable(start.min);
      setDateValue(start, startValue);
    }
    if (!startValue) {
      start.setCustomValidity(invalidDateMessage);
      end.setCustomValidity(invalidDateMessage);
      return;
    }
    if (initial && isUnavailable(startValue)) {
      startValue = nextAvailable(startValue);
      setDateValue(start, startValue);
    }
    start.setCustomValidity(startValue < start.min ? pastDateMessage : isUnavailable(startValue) ? unavailableDateMessage : '');
    end.min = nextAvailable(addDays(startValue, minimumDays));
    end.dataset.minIso = end.min;
    var endValue = readDateValue(end);
    if (!endValue && initial) {
      endValue = end.min;
      setDateValue(end, endValue);
    }
    end.setCustomValidity(!endValue ? invalidDateMessage : endValue < end.min ? '归还日期不能早于最短租期或今天。' : isUnavailable(endValue) ? unavailableDateMessage : '');
  };
  start.min = dateString(today); setDateValue(start, start.min);
  end.min = addDays(start.min, minimumDays); setDateValue(end, end.min);
  start.disabled = true; end.disabled = true; startToggle.disabled = false; endToggle.disabled = false; button.disabled = true;
  fetch('/api/device-availability?deviceIds=' + encodeURIComponent(JSON.stringify([${JSON.stringify(product.id)}])), { headers: { Accept: 'application/json' } })
    .then(function (response) { return response.json(); })
    .then(function (result) { availability = result.availability || {}; availabilityReady = true; start.disabled = false; end.disabled = false; startToggle.disabled = false; endToggle.disabled = false; button.disabled = false; applyDateRules(true); refreshOpenPicker(); })
    .catch(function () { availabilityReady = true; start.disabled = false; end.disabled = false; startToggle.disabled = false; endToggle.disabled = false; button.disabled = false; applyDateRules(true); refreshOpenPicker(); });
  start.addEventListener('input', function () { start.value = maskDate(start.value); applyDateRules(false); });
  end.addEventListener('input', function () { end.value = maskDate(end.value); applyDateRules(false); });
  start.addEventListener('change', function () { applyDateRules(false); });
  end.addEventListener('change', function () { applyDateRules(false); });
  startToggle.addEventListener('click', function () { openPicker(startPicker, start, startToggle, 'start'); });
  endToggle.addEventListener('click', function () { openPicker(endPicker, end, endToggle, 'end'); });
  start.addEventListener('focus', function () { openPicker(startPicker, start, startToggle, 'start'); });
  end.addEventListener('focus', function () { openPicker(endPicker, end, endToggle, 'end'); });
  document.addEventListener('click', function (event) {
    [
      [startPicker, startToggle],
      [endPicker, endToggle],
    ].forEach(function (entry) {
      if (!entry[0].parentElement.contains(event.target)) { entry[0].hidden = true; entry[1].setAttribute('aria-expanded', 'false'); if (openPickerState && openPickerState.picker === entry[0]) openPickerState = null; }
    });
  });
  button.addEventListener('click', function () {
    applyDateRules(false);
    var startValue = readDateValue(start);
    var endValue = readDateValue(end);
    if (!startValue || !endValue || endValue < end.min || !window.GeekSlopeCart || !start.checkValidity() || !end.checkValidity()) return;
    window.GeekSlopeCart.add(${scriptJson(product.id)}, { startDate: startValue, endDate: endValue, startPeriod: startPeriod.value, endPeriod: endPeriod.value });
    location.href = ${JSON.stringify(applyHref)};
  });
})();
</script>`
}
