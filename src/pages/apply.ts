// 购物车 / 下单页。购物车保存在浏览器 localStorage；提交时由官网 Worker
// 直接校验并写入共享 D1 的 pending_approval 订单。

import { esc } from '../layout'
import type { Product, RentalConfig } from '../db'

interface ApplyData {
  products: Product[]
  selectedId: string
  config: RentalConfig
  appUrl: string
  turnstileSiteKey: string
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

export function renderCartPage(products: Product[], config: RentalConfig, selectedId = ''): string {
  const cartProducts = products.filter((product) => product.id && product.pricePerDay > 0).map((product) => ({
    id: product.id,
    name: product.name,
    model: product.model,
    categoryLabel: product.categoryLabel,
    day: product.pricePerDay,
    weeklyDiscountPercent: product.weeklyDiscountPercent,
    monthlyDiscountPercent: product.monthlyDiscountPercent,
    deposit: product.depositAmount,
  }))
  return /* html */ `
<section class="page-hero compact"><div class="wrap"><div class="kicker">购物车</div><h1>先选设备，再确认租期</h1><p>设备详情页先选租期；加入购物车后，只需在这里修改租期。</p></div></section>
<section class="section apply-section"><div class="wrap form-wrap cart-page-wrap">
  <div class="section-head"><div class="kicker">当前选择</div><h2>你的设备清单</h2><p>设备会保存在当前浏览器中，最多同时选择 10 台。</p></div>
  <div class="form-card cart-empty" id="cart-page-empty" hidden><h3>购物车还是空的</h3><p>先去设备库挑选电脑，加入后会显示在这里。</p><a class="btn btn-primary" href="/products">去选择设备</a></div>
  <div id="cart-page-content" hidden>
    <div class="form-card cart-term-card">
      <div class="form-card-head"><span>01</span><div><h3>分别设置每台设备租期</h3><p>每台设备独立校验档期和不可用日期</p></div></div>
      <p class="hint">请在下方每台设备卡片中选择取货和归还日期。日历会禁用不可用日期，手动输入不可用日期也无法继续结账。</p>
    </div>
    <div class="cart-page-list" id="cart-page-items"></div>
    <div class="form-card cart-page-summary"><div><span class="kicker">预计费用</span><strong id="cart-page-total"></strong><p>租金会根据实际日期计算，押金在归还验收后按规则处理。</p></div><div class="hero-actions"><a class="btn btn-ghost" href="/products">继续选设备</a><a class="btn btn-primary btn-lg" href="/checkout">前往结账 <span>→</span></a></div></div>
  </div>
</div></section>
<script>
(() => {
  var products = ${scriptJson(cartProducts)};
  var selectedId = ${scriptJson(selectedId)};
  var map = new Map(products.map(function (product) { return [product.id, product]; }));
  var key = 'geekslope-cart-v1';
  var empty = document.getElementById('cart-page-empty');
  var content = document.getElementById('cart-page-content');
  var items = document.getElementById('cart-page-items');
  var total = document.getElementById('cart-page-total');
  var minimumDays = ${config.minimumRentalDays};
  var unavailableDates = ${scriptJson(config.unavailableDates)};
  var availability = {};
  var availabilityReady = false;
  var availabilityFailed = false;
  var availabilityKey = '';
  function today() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function addDays(value, amount) {
    var date = new Date(value + 'T00:00:00'); date.setDate(date.getDate() + amount);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function dateUnavailable(id, date) {
    if (!date || unavailableDates.indexOf(date) >= 0) return Boolean(date);
    var item = availability[id] || {};
    return (item.unavailableDates || []).indexOf(date) >= 0
      || (item.rentalRanges || []).some(function (range) { return range.startDate <= date && date < range.endDate; });
  }
  function periodUnavailable(id, start, end) {
    for (var day = start; day && day < end; day = addDays(day, 1)) if (dateUnavailable(id, day)) return true;
    return false;
  }
  function nextAvailableDate(id, date) {
    var value = date || today();
    for (var index = 0; index < 730 && dateUnavailable(id, value); index += 1) value = addDays(value, 1);
    return value;
  }
  function loadAvailability(ids) {
    var requestKey = ids.join(',');
    if (!requestKey || requestKey === availabilityKey) return;
    availabilityKey = requestKey;
    availabilityReady = false;
    fetch('/api/device-availability?deviceIds=' + encodeURIComponent(JSON.stringify(ids)), { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (result) { if (requestKey !== availabilityKey) return; availability = result.availability || {}; availabilityReady = true; render(); })
      .catch(function () { if (requestKey === availabilityKey) { availabilityFailed = true; availabilityReady = true; render(); } });
  }
  function formatDate(value) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4) : ''; }
  function parseDate(value) {
    var text = String(value || '').trim(); var match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (match) text = match[3] + '-' + match[2] + '-' + match[1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    var date = new Date(text + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : '';
  }
  function termDays(term) {
    if (!term || !term.startDate || !term.endDate) return 0;
    var half = Math.round((Date.parse(term.endDate + 'T00:00:00Z') - Date.parse(term.startDate + 'T00:00:00Z')) / 86400000) * 2 + (term.endPeriod === 'PM' ? 1 : 0) - (term.startPeriod === 'PM' ? 1 : 0);
    return half > 0 ? Math.ceil(half / 2) : 0;
  }
  function defaultTerm(id) {
    var start = nextAvailableDate(id, today()); var end = addDays(start, Math.max(1, minimumDays));
    while (periodUnavailable(id, start, end) && end < addDays(start, 730)) end = addDays(end, 1);
    return { startDate: start, endDate: end, startPeriod: 'AM', endPeriod: 'AM' };
  }
  function normalizeTerm(id, value) {
    var fallback = defaultTerm(id); value = value && typeof value === 'object' ? value : {};
    return { startDate: parseDate(value.startDate) || fallback.startDate, endDate: parseDate(value.endDate) || fallback.endDate, startPeriod: value.startPeriod === 'PM' ? 'PM' : 'AM', endPeriod: value.endPeriod === 'PM' ? 'PM' : 'AM' };
  }
  function read() {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '[]'); var ids = Array.isArray(value) ? value : value.items;
      var savedTerms = !Array.isArray(value) && value.terms && typeof value.terms === 'object' ? value.terms : {}; var legacy = !Array.isArray(value) ? value.term : null;
      ids = Array.isArray(ids) ? ids.filter(function (id, index) { return map.has(id) && ids.indexOf(id) === index; }).slice(0, 10) : [];
      var terms = {}; ids.forEach(function (id) { terms[id] = normalizeTerm(id, savedTerms[id] || legacy); }); return { ids: ids, terms: terms };
    } catch (_) { return { ids: [], terms: {} }; }
  }
  function persist(ids, terms) {
    try { localStorage.setItem(key, JSON.stringify({ items: ids, terms: terms })); } catch (_) {}
    if (window.GeekSlopeCart) window.GeekSlopeCart.write(ids);
  }
  function write(ids, terms) { persist(ids, terms); render(); }
  function legacySharedRender() {
    var state = read();
    if (!state.ids) state = { ids: [], term: null };
    var ids = state.ids;
    if (selectedId && map.has(selectedId) && ids.indexOf(selectedId) < 0 && ids.length < 10) {
      ids.push(selectedId);
      write(ids, state.term);
    }
    empty.hidden = ids.length > 0;
    content.hidden = ids.length === 0;
    if (ids.length) {
      loadAvailability(ids);
      var term = state.term || { startDate: today(), endDate: addDays(today(), minimumDays), startPeriod: 'AM', endPeriod: 'AM' };
      var savedStart = term.startDate;
      var savedEnd = term.endDate;
      startInput.min = today();
      if (!term.startDate || term.startDate < startInput.min) term.startDate = startInput.min;
      if (availabilityReady) term.startDate = nextAvailableDate(term.startDate);
      startInput.value = term.startDate;
      endInput.min = addDays(startInput.value, Math.max(1, minimumDays));
      if (availabilityReady) endInput.min = nextAvailableDate(endInput.min);
      endInput.value = term.endDate && term.endDate >= endInput.min ? term.endDate : endInput.min;
      if (availabilityReady && deviceDateUnavailable(endInput.value)) endInput.value = nextAvailableDate(endInput.value);
      startInput.disabled = !availabilityReady; endInput.disabled = !availabilityReady;
      startPeriodInput.value = term.startPeriod || 'AM';
      endPeriodInput.value = term.endPeriod || 'AM';
      if (availabilityReady && (startInput.value !== savedStart || endInput.value !== savedEnd)) {
        write(ids, { startDate: startInput.value, endDate: endInput.value, startPeriod: startPeriodInput.value, endPeriod: endPeriodInput.value });
        return;
      }
    }
    items.replaceChildren();
    var deposit = 0;
    var rentalDays = ids.length && startInput.value && endInput.value ? Math.max(0, Math.ceil((new Date(endInput.value + 'T00:00:00Z') - new Date(startInput.value + 'T00:00:00Z')) / 86400000)) : 0;
    ids.forEach(function (id) {
      var product = map.get(id); deposit += Number(product.deposit || 0);
      var row = document.createElement('article'); row.className = 'cart-page-item';
      var detail = document.createElement('div');
      var category = document.createElement('span'); category.textContent = product.categoryLabel;
      var name = document.createElement('h3'); name.textContent = product.name;
      var model = document.createElement('p'); model.textContent = product.model || '配置详情见设备页';
      detail.append(category, name, model);
      var price = document.createElement('div'); price.className = 'cart-page-price';
      var priceValue = document.createElement('div');
      var rawDaily = Number(product.day || 0);
      var effectiveDaily = rentalDays > 0 ? rentalFee(product, rentalDays) / rentalDays : rawDaily;
      var daily = document.createElement('strong');
      if (rentalDays > 0 && effectiveDaily < rawDaily - 0.005) {
        var original = document.createElement('del'); original.className = 'price-original'; original.textContent = '$' + rawDaily.toFixed(2);
        priceValue.appendChild(original);
        daily.textContent = '$' + effectiveDaily.toFixed(2);
      } else {
        daily.textContent = '$' + product.day;
      }
      var unit = document.createElement('small'); unit.textContent = '/day'; daily.appendChild(unit);
      priceValue.appendChild(daily);
      var depositText = document.createElement('span'); depositText.textContent = '押金 $' + product.deposit;
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cart-remove'; remove.dataset.cartRemove = id; remove.textContent = '移除';
      price.append(priceValue, depositText, remove); row.append(detail, price);
      items.appendChild(row);
    });
    var rent = ids.reduce(function (sum, id) { return sum + rentalFee(map.get(id), rentalDays); }, 0);
    total.textContent = ids.length ? ids.length + ' 台设备 · ' + rentalDays + ' 天 · 租金 $' + rent.toFixed(2) + ' · 押金 $' + deposit.toFixed(2) : '';
  }
  function rentalFee(product, days) {
    var monthlyDays = Math.floor(days / 30) * 30;
    var weeklyDays = Math.floor((days - monthlyDays) / 7) * 7;
    var dailyDays = days - monthlyDays - weeklyDays;
    var day = Number(product.day || 0);
    var weeklyRate = day * (1 - Math.min(100, Math.max(0, Number(product.weeklyDiscountPercent || 0))) / 100);
    var monthlyRate = day * (1 - Math.min(100, Math.max(0, Number(product.monthlyDiscountPercent || 0))) / 100);
    return monthlyDays * monthlyRate + weeklyDays * weeklyRate + dailyDays * day;
  }
  function pickerDateDisabled(id, role, term, date) {
    if (!availabilityReady || availabilityFailed || date < today() || dateUnavailable(id, date)) return true;
    return role === 'end' && (date <= term.startDate || date < addDays(term.startDate, Math.max(1, minimumDays)) || periodUnavailable(id, term.startDate, date));
  }
  function renderPicker(picker, id, role, term, month) {
    var year = month.getFullYear(); var monthIndex = month.getMonth(); picker.replaceChildren();
    var head = document.createElement('div'); head.className = 'date-picker-head'; var title = document.createElement('strong'); title.textContent = year + '年' + (monthIndex + 1) + '月';
    var previous = document.createElement('button'); previous.type = 'button'; previous.className = 'date-picker-nav'; previous.textContent = '‹'; var next = document.createElement('button'); next.type = 'button'; next.className = 'date-picker-nav'; next.textContent = '›';
    previous.addEventListener('click', function () { renderPicker(picker, id, role, term, new Date(year, monthIndex - 1, 1)); }); next.addEventListener('click', function () { renderPicker(picker, id, role, term, new Date(year, monthIndex + 1, 1)); }); head.append(previous, title, next); picker.appendChild(head);
    var week = document.createElement('div'); week.className = 'date-picker-week'; ['一', '二', '三', '四', '五', '六', '日'].forEach(function (label) { var cell = document.createElement('span'); cell.textContent = label; week.appendChild(cell); }); picker.appendChild(week);
    var grid = document.createElement('div'); grid.className = 'date-picker-grid'; var first = new Date(year, monthIndex, 1); var offset = (first.getDay() + 6) % 7;
    for (var index = 0; index < 42; index += 1) {
      var date = new Date(year, monthIndex, index - offset + 1); var iso = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); var button = document.createElement('button'); button.type = 'button'; button.textContent = String(date.getDate()); button.dataset.date = iso;
      if (date.getMonth() !== monthIndex) button.className = 'is-outside'; button.disabled = pickerDateDisabled(id, role, term, iso); if (iso === term[role === 'start' ? 'startDate' : 'endDate']) button.classList.add('is-selected');
      button.addEventListener('click', function (event) { var picked = event.currentTarget.dataset.date; term[role === 'start' ? 'startDate' : 'endDate'] = picked; if (role === 'start' && term.endDate < addDays(picked, Math.max(1, minimumDays))) term.endDate = addDays(picked, Math.max(1, minimumDays)); var state = read(); state.terms[id] = term; persist(state.ids, state.terms); render(); }); grid.appendChild(button);
    }
    picker.appendChild(grid);
  }
  function dateField(id, role, term) {
    var field = document.createElement('div'); field.className = 'term-date-field'; var label = document.createElement('label'); label.textContent = role === 'start' ? '取货日期' : '归还日期';
    var input = document.createElement('input'); input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.placeholder = 'dd/mm/yyyy'; input.value = formatDate(term[role === 'start' ? 'startDate' : 'endDate']); var picker = document.createElement('div'); picker.className = 'date-picker'; picker.hidden = true;
    var open = function () { picker.hidden = false; var value = parseDate(input.value) || term[role === 'start' ? 'startDate' : 'endDate'] || today(); var date = new Date(value + 'T00:00:00'); renderPicker(picker, id, role, term, new Date(date.getFullYear(), date.getMonth(), 1)); };
    input.addEventListener('focus', open); input.addEventListener('click', open); input.addEventListener('input', function () { input.setCustomValidity(''); });
    input.addEventListener('blur', function () { window.setTimeout(function () { if (!field.contains(document.activeElement)) picker.hidden = true; }, 100); var value = parseDate(input.value); if (!value) { input.setCustomValidity('请输入有效日期（格式：dd/mm/yyyy）。'); return; } var state = read(); var next = state.terms[id] || term; next[role === 'start' ? 'startDate' : 'endDate'] = value; state.terms[id] = next; persist(state.ids, state.terms); render(); });
    field.append(label, input, picker); return field;
  }
  function termError(id, term) {
    if (!parseDate(term.startDate) || !parseDate(term.endDate)) return '请输入有效日期（格式：dd/mm/yyyy）。'; if (term.startDate < today()) return '取货日期不能早于今天。'; if (termDays(term) < minimumDays) return '租期不能少于 ' + minimumDays + ' 天。'; if (dateUnavailable(id, term.startDate) || periodUnavailable(id, term.startDate, term.endDate)) return '该设备在所选租期内不可用，请选择其他日期。'; return '';
  }
  function termEditor(id, term) {
    var wrap = document.createElement('div'); wrap.className = 'device-term-editor'; var head = document.createElement('div'); head.className = 'device-term-editor-head'; var title = document.createElement('strong'); title.textContent = '本设备租期'; head.appendChild(title); wrap.appendChild(head);
    var fields = document.createElement('div'); fields.className = 'term-date-grid'; fields.append(dateField(id, 'start', term), dateField(id, 'end', term)); var periods = document.createElement('div'); periods.className = 'term-period-grid';
    [['startPeriod', '取货时段'], ['endPeriod', '归还时段']].forEach(function (entry) { var field = document.createElement('label'); field.className = 'term-period-field'; field.textContent = entry[1]; var select = document.createElement('select'); select.innerHTML = '<option value="AM">上午</option><option value="PM">下午</option>'; select.value = term[entry[0]]; select.addEventListener('change', function () { var state = read(); state.terms[id][entry[0]] = select.value; persist(state.ids, state.terms); render(); }); field.appendChild(select); periods.appendChild(field); });
    var status = document.createElement('p'); status.className = 'term-status'; var error = availabilityReady && !availabilityFailed ? termError(id, term) : ''; status.textContent = availabilityFailed ? '设备档期检查失败，请刷新后重试。' : (availabilityReady ? (error || '该设备档期可用。') : '正在检查该设备档期…'); if (error || availabilityFailed) status.dataset.state = 'error'; wrap.append(fields, periods, status); return wrap;
  }
  function render() {
    var state = read(); var ids = state.ids; if (selectedId && map.has(selectedId) && ids.indexOf(selectedId) < 0 && ids.length < 10) { ids.push(selectedId); state.terms[selectedId] = normalizeTerm(selectedId, null); persist(ids, state.terms); }
    empty.hidden = ids.length > 0; content.hidden = ids.length === 0; if (!ids.length) { items.replaceChildren(); total.textContent = ''; return; } loadAvailability(ids); items.replaceChildren(); var deposit = 0; var rent = 0; var valid = true;
    ids.forEach(function (id) { var product = map.get(id); var term = state.terms[id] || normalizeTerm(id, null); var days = termDays(term); var error = availabilityReady && !availabilityFailed ? termError(id, term) : availabilityFailed ? '设备档期检查失败，请刷新后重试。' : ''; if (error) valid = false; deposit += Number(product.deposit || 0); rent += days > 0 ? rentalFee(product, days) : 0; var row = document.createElement('article'); row.className = 'cart-page-item cart-page-item--term'; var detail = document.createElement('div'); var category = document.createElement('span'); category.textContent = product.categoryLabel; var name = document.createElement('h3'); name.textContent = product.name; var model = document.createElement('p'); model.textContent = product.model || '配置详情见设备页'; detail.append(category, name, model, termEditor(id, term)); var price = document.createElement('div'); price.className = 'cart-page-price'; var daily = document.createElement('strong'); daily.textContent = '$' + Number(product.day || 0).toFixed(2); var unit = document.createElement('small'); unit.textContent = '/day'; daily.appendChild(unit); var depositText = document.createElement('span'); depositText.textContent = '押金 $' + Number(product.deposit || 0).toFixed(2); var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cart-remove'; remove.dataset.cartRemove = id; remove.textContent = '移除'; price.append(daily, depositText, remove); row.append(detail, price); items.appendChild(row); });
    total.textContent = ids.length + ' 台设备｜租金 $' + rent.toFixed(2) + '｜押金 $' + deposit.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (valid ? '' : '｜请先修正不可用租期');
    var checkout = content.querySelector('a[href="/checkout"], a[data-checkout-link]');
    if (checkout) { checkout.dataset.checkoutLink = 'true'; checkout.href = valid ? '/checkout' : '#cart-page-items'; checkout.setAttribute('aria-disabled', String(!valid)); checkout.classList.toggle('is-disabled', !valid); }
  }
  items.addEventListener('click', function (event) { var remove = event.target.closest('[data-cart-remove]'); if (!remove) return; selectedId = ''; var state = read(); delete state.terms[remove.dataset.cartRemove]; write(state.ids.filter(function (id) { return id !== remove.dataset.cartRemove; }), state.terms); });
  render();
})();
</script>`
}

export function renderApply(data: ApplyData): string {
  const { products, selectedId, config, appUrl, turnstileSiteKey } = data
  const rentable = products.filter((product) => product.id && product.pricePerDay > 0)
  const hasPickupLocations = config.pickupLocations.length > 0
  const deliveryAreas = config.deliveryAreas.join('、')

  if (!rentable.length) {
    return /* html */ `
    <section class="section">
      <div class="wrap form-wrap">
        <div class="section-head"><div class="kicker">购物车</div><h2>暂无可租设备</h2></div>
        <p style="color:var(--muted-fg)">产品目录正在更新，请稍后再试，或直接联系客服。</p>
      </div>
    </section>`
  }

  const pickupField = hasPickupLocations
    ? `<select id="pickupLocation" name="pickupLocation" required>${config.pickupLocations
      .map((location) => `<option value="${esc(location)}">${esc(location)}</option>`)
      .join('')}</select>`
    : `<select id="pickupLocation" name="pickupLocation" disabled><option value="">我们尚未配置公开自取点</option></select>`

  const cartProducts = rentable.map((product) => ({
    id: product.id,
    name: product.name,
    model: product.model,
    day: product.pricePerDay,
    weeklyDiscountPercent: product.weeklyDiscountPercent,
    monthlyDiscountPercent: product.monthlyDiscountPercent,
    deposit: product.depositAmount,
  }))
  const turnstile = turnstileSiteKey
    ? `<div class="field"><div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}"></div></div>
       <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : ''
  const stripeScript = '<script src="https://js.stripe.com/v3/"></script>'

  return /* html */ `
<section class="page-hero compact apply-hero"><div class="wrap"><div class="kicker">租赁申请</div><h1>确认设备，安排你的使用时间</h1><p>现在只提交申请。档期和费用确认后，再进入合同与付款。</p><div class="apply-progress"><span class="is-current"><i>1</i>填写申请</span><b></b><span><i>2</i>确认档期</span><b></b><span><i>3</i>签约交付</span></div></div></section>
<section class="section apply-section">
  <div class="wrap form-wrap">
    <div class="section-head">
      <div class="kicker">第 1 步</div>
      <h2>确认设备与租赁信息</h2>
    </div>

    <div class="form-card cart-empty" id="cart-empty" hidden>
      <h3>购物车还是空的</h3>
      <p>先去设备库挑选电脑，加入后会保存在这里。</p>
      <a class="btn btn-primary" href="/products">去选择设备</a>
    </div>

    <form id="apply-form" hidden>
      <div class="form-alert" id="form-error" hidden></div>

      <input type="hidden" id="deviceTerms" name="deviceTerms" required>

      <div class="apply-grid">
        <div class="apply-grid-main">
          <div class="form-card">
            <div class="form-card-head"><span>01</span><div><h3>订单摘要</h3><p>设备已从购物车带入，需修改时返回购物车</p></div></div>
            <div class="field">
              <label>已选择设备</label>
              <div class="cart-checkout-list" id="cart-items"></div>
            </div>
            <p class="hint"><a href="/apply" style="color:var(--primary)">返回购物车修改设备</a> · 每台库存设备只能加入一次，单次最多 10 台。</p>
            <div class="form-summary" id="summary"></div>
            <div class="coupon-row">
              <div class="field">
                <label for="couponCode">优惠码（选填）</label>
                <input id="couponCode" name="couponCode" maxlength="40" autocomplete="off" placeholder="输入优惠码">
              </div>
              <button class="btn btn-ghost" type="button" id="coupon-check">使用优惠码</button>
            </div>
            <p class="coupon-hint" id="coupon-hint" aria-live="polite">有优惠码？提交时会同时校验适用设备、租期和折扣金额。</p>
          </div>

          <div class="form-card">
            <div class="form-card-head"><span>02</span><div><h3>取还方式</h3><p>配送范围与运费会在审核时确认</p></div></div>
            <div class="field">
              <label for="deliveryMethod">取还方式</label>
              <select id="deliveryMethod" name="deliveryMethod"><option value="Pickup"${hasPickupLocations ? '' : ' disabled'}>到店自取${hasPickupLocations ? `（${config.pickupLocations.length} 个可选地点）` : '（暂未开放）'}</option><option value="Delivery"${hasPickupLocations ? '' : ' selected'}>送货上门</option></select>
            </div>
            <div class="field" id="pickup-field"${hasPickupLocations ? '' : ' hidden'}><label for="pickupLocation">自取 / 归还地点</label>${pickupField}</div>
            <div id="delivery-fields"${hasPickupLocations ? ' hidden' : ''}>
              <div class="field address-autocomplete">
                <label for="delivery-address-search">搜索墨尔本地址</label>
                <input id="delivery-address-search" type="search" autocomplete="off" role="combobox" aria-controls="address-suggestions" aria-expanded="false" placeholder="例如 123 Collins Street, Melbourne">
                <div class="address-search-status" id="address-search-status" aria-live="polite">输入至少 3 个字符开始联想。</div>
                <div class="address-suggestions" id="address-suggestions" role="listbox" hidden></div>
                <small class="address-attribution">地址数据 © OpenStreetMap contributors</small>
              </div>
              <div class="field"><label for="deliveryStreet">街道地址</label><input id="deliveryStreet" name="deliveryStreet" autocomplete="address-line1"></div>
              <div class="row3">
                <div class="field"><label for="deliverySuburb">Suburb</label><input id="deliverySuburb" name="deliverySuburb" placeholder="如 Docklands / South Yarra"></div>
                <div class="field"><label for="deliveryState">州</label><input id="deliveryState" name="deliveryState" value="VIC" readonly></div>
              </div>
              <div class="field"><label for="deliveryPostcode">邮编</label><input id="deliveryPostcode" name="deliveryPostcode" inputmode="numeric" pattern="\\d{4}" placeholder="4 位数字"></div>
              <p class="hint">${esc(config.deliveryNote)}${deliveryAreas ? ` 可配送区域：${esc(deliveryAreas)}。` : ''} 其他城市或郊区请选到店自取。</p>
            </div>
          </div>

          <div class="form-card">
            <div class="form-card-head"><span>03</span><div><h3>联系与账号</h3><p>用于接收审核结果、后续签约与付款</p></div></div>
            <div class="row2">
              <div class="field" id="contact-name-field"><label for="contactName">姓名</label><input id="contactName" name="contactName" maxlength="120" autocomplete="name" required></div>
              <div class="field"><label for="contactPhone">联系电话</label><input id="contactPhone" name="contactPhone" maxlength="40" autocomplete="tel" required></div>
            </div>
            <div class="field" id="contact-email-field"><label for="contactEmail">邮箱</label><input type="email" id="contactEmail" name="contactEmail" maxlength="200" autocomplete="email" required></div>
              <label class="choice-line save-contact-choice"><input type="checkbox" id="saveContactInfo"> 保存我的信息，以便下次更快结账</label>
          </div>

          <div class="field"><label for="rentalNote">备注（选填）</label><textarea id="rentalNote" name="rentalNote" maxlength="500" placeholder="例如期望配送时间、用途等"></textarea></div>
        </div>

        <div class="apply-grid-payment">
          <div class="form-card" id="wallet-step-card" hidden>
            <div class="form-card-head"><span>04</span><div><h3>快捷支付</h3><p>使用 Apple Pay / Google Pay / Link 可自动填充联系与地址信息</p></div></div>
            <div class="stripe-wallet-box" id="stripe-wallet-box">
              <div class="stripe-setup-head"><div><label id="stripe-wallet-title">快捷支付</label><p id="stripe-wallet-description">使用可用的快捷支付方式验证。</p></div><span id="stripe-wallet-badge">EXPRESS CHECKOUT</span></div>
              <div id="stripe-wallet-element"></div>
              <p id="stripe-wallet-message" class="hint" aria-live="polite"></p>
            </div>
          </div>

          <div class="form-card">
            <div class="form-card-head"><span>05</span><div><h3>支付方式</h3><p>验证支付方式，押金归还时使用</p></div></div>
            <div class="payment-method-options" id="payment-method-options" hidden>
              <label class="choice-line"><input type="radio" name="paymentMethod" value="balance"> 账户余额支付 <span id="balance-payment-note">检测到账户余额，可用于支付本次申请。</span></label>
            </div>
            <div class="stripe-setup-box">
              <div class="stripe-setup-head"><div><label>信用卡资料</label><p>验证支付方式。</p></div><span>SECURE / STRIPE</span></div>
              <div id="stripe-card-element" class="stripe-card-element"></div>
              <p id="stripe-card-message" class="hint" aria-live="polite">正在加载安全付款组件…</p>
              <button type="button" class="btn btn-ghost" id="stripe-card-confirm" disabled>验证</button>
              <input type="hidden" id="stripeSetupIntentId" name="stripeSetupIntentId">
            </div>
            <div class="refund-choice">
              <label>押金处理方式</label>
              <label class="choice-line"><input type="radio" name="refundMethod" value="original" checked> 原路退回信用卡</label>
              <label class="choice-line"><input type="radio" id="refund-balance" name="refundMethod" value="balance" disabled> 退回账号余额（仅正式账户）</label>
            </div>
            <p class="hint">提交后订单进入审核流程，我们确认后会联系你安排签约与付款。个人信息仅用于本次租赁。</p>
          </div>
        </div>
      </div>

      <div class="field legal-agreement">
        <input type="checkbox" id="agree" name="agree" value="1" style="width:auto;margin-top:3px" required>
        <label for="agree" style="font-weight:400;margin:0">我已阅读并同意 <a href="/service-terms" target="_blank" rel="noopener" style="color:var(--primary)">服务条款</a> 与 <a href="/privacy" target="_blank" rel="noopener" style="color:var(--primary)">隐私政策</a>。</label>
      </div>
      ${stripeScript}${turnstile}

      <div class="apply-expectations" aria-label="提交申请后的流程">
        <div><span>提交时</span><strong>不会立即扣款</strong><p>先创建租赁申请，保留你的设备、租期和联系信息。</p></div>
        <div><span>审核时</span><strong>确认档期与费用</strong><p>我们会核对库存、地址、优惠码和最终配送安排。</p></div>
        <div><span>确认后</span><strong>签约再付款</strong><p>档期确认后进入租赁系统，完成合同、付款和取机安排。</p></div>
      </div>

      <button type="submit" class="btn btn-primary btn-lg" id="submit-btn" style="margin-top:20px">注册并提交申请</button>
      <p class="form-note">遇到问题？可返回 <a href="/products" style="color:var(--primary)">设备库</a> 或联系客服。</p>
    </form>

    <div class="form-card" id="apply-done" hidden style="margin-top:18px">
      <h3 class="success-title"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 9"></path></svg><span>申请已提交</span></h3>
      <p id="apply-done-msg" style="color:var(--muted-fg);font-size:14px"></p>
      <div class="temporary-credentials" id="temporary-credentials" hidden><span>申请已提交</span><strong>订单编号：<b id="done-order-no"></b></strong><strong>临时密码：<b id="done-password"></b></strong><p>请保存临时密码，进入账号中心查看申请进度。</p></div>
      <p style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px"><a class="btn btn-primary" href="${esc(appUrl)}/login">进入账号中心查看申请</a><a class="btn btn-ghost" href="/products">继续浏览产品</a></p>
    </div>
  </div>
</section>

<script>
(() => {
  var CART_KEY = 'geekslope-cart-v1';
  var PRODUCTS = ${scriptJson(cartProducts)};
  var SELECTED_ID = ${scriptJson(selectedId)};
  var ENDPOINT = '/api/rental-request';
  var SETUP_ENDPOINT = '/api/rental-setup-intent';
  var MIN_DAYS = ${config.minimumRentalDays};
  var UNAVAILABLE_DATES = ${scriptJson(config.unavailableDates)};
  var UNAVAILABLE_TIME_SLOTS = ${scriptJson(config.unavailableTimeSlots)};
  var DEVICE_AVAILABILITY = {};
  var AVAILABILITY_READY = false;
  var AVAILABILITY_FAILED = false;
  var DELIVERY_AREAS = ${scriptJson(config.deliveryAreas)};
  var COUPON_ENDPOINT = '/api/coupons/rental-cart-preview';
  var productMap = new Map(PRODUCTS.map(function (product) { return [product.id, product]; }));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function readCartState() {
    try {
      var value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      var ids = Array.isArray(value) ? value : value.items;
      ids = Array.isArray(ids) ? ids.filter(function (id, index) { return productMap.has(id) && ids.indexOf(id) === index; }).slice(0, 10) : [];
      var terms = !Array.isArray(value) && value.terms && typeof value.terms === 'object' ? value.terms : {};
      var legacy = !Array.isArray(value) ? value.term : null;
      return { ids: ids, terms: terms, legacy: legacy };
    } catch (_) { return { ids: [], terms: {}, legacy: null }; }
  }
  function saveCart(ids) {
    if (window.GeekSlopeCart) return window.GeekSlopeCart.write(ids);
    try { localStorage.setItem(CART_KEY, JSON.stringify({ items: ids, terms: cartTerms })); } catch (_) {}
    return ids;
  }
  var cartState = readCartState();
  var cartIds = cartState.ids;
  var cartTerms = cartState.terms;
  if (SELECTED_ID && productMap.has(SELECTED_ID) && cartIds.indexOf(SELECTED_ID) < 0) { cartIds.push(SELECTED_ID); if (!cartTerms[SELECTED_ID] && cartState.legacy) cartTerms[SELECTED_ID] = cartState.legacy; saveCart(cartIds); }

  var form = document.getElementById('apply-form');
  var emptyBox = document.getElementById('cart-empty');
  var itemsBox = document.getElementById('cart-items');
  var errBox = document.getElementById('form-error');
  var summary = document.getElementById('summary');
  var deviceTermsInput = document.getElementById('deviceTerms');
  var method = document.getElementById('deliveryMethod');
  var pickupField = document.getElementById('pickup-field');
  var deliveryFields = document.getElementById('delivery-fields');
  var submitBtn = document.getElementById('submit-btn');
  var appliedDiscount = 0;
  var couponState = 'empty';
  var checkoutBlocked = false;
  var stripe = null;
  var stripeElements = null;
  var setupIntent = null;
  var cardReady = false;
  var stripeFeeRate = 0.025;
  var accountBalance = null;
  var cardMessage = document.getElementById('stripe-card-message');
  var cardConfirm = document.getElementById('stripe-card-confirm');
  var setupIntentInput = document.getElementById('stripeSetupIntentId');
  var balanceOption = document.getElementById('payment-method-options');
  var paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
  var balancePaymentInput = balanceOption.querySelector('input[value="balance"]');
  var refundBalanceInput = document.getElementById('refund-balance');
  var contactEmail = document.getElementById('contactEmail');
  var balanceEndpoint = '/api/account-balance';
  var balanceLookupTimer = null;
  var walletBox = document.getElementById('stripe-wallet-box');
  var walletStepCard = document.getElementById('wallet-step-card');
  var walletMessage = document.getElementById('stripe-wallet-message');
  var stripeSetupBox = document.querySelector('.stripe-setup-box');
  var addressSearch = document.getElementById('delivery-address-search');
  var addressSuggestions = document.getElementById('address-suggestions');
  var addressStatus = document.getElementById('address-search-status');
  var addressTimer = null;
  var addressRequest = null;
  var activeAddressSuggestion = -1;

  function todayStr() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function addDays(dateString, amount) {
    var date = new Date(dateString + 'T00:00:00');
    date.setDate(date.getDate() + amount);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function formatDate(value) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4) : ''; }
  function normalizeAddress(value) {
    return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function isMelbourneDeliveryAddress() {
    if (document.getElementById('deliveryState').value.toUpperCase() !== 'VIC') return false;
    var text = normalizeAddress((addressSearch && addressSearch.value || '') + ' ' + document.getElementById('deliverySuburb').value);
    var areas = ['melbourne', 'docklands', 'southbank', 'south yarra', 'carlton', 'east melbourne'].concat(DELIVERY_AREAS || []);
    return areas.map(normalizeAddress).filter(Boolean).some(function (area) { return text.indexOf(area.replace('melbourne cbd', 'melbourne')) >= 0; });
  }
  function showFormError(message) {
    checkoutBlocked = true;
    errBox.textContent = message;
    errBox.hidden = false;
  }
  function clearCheckoutError() {
    checkoutBlocked = false;
    if (!form.querySelector(':invalid')) errBox.hidden = true;
  }
  function markCouponDirty() {
    var code = document.getElementById('couponCode').value.trim();
    couponState = code ? 'unchecked' : 'empty';
    appliedDiscount = 0;
  }
  function setAddressStatus(message, state) {
    if (addressStatus) { addressStatus.textContent = message; addressStatus.dataset.state = state || ''; }
  }
  function closeAddressSuggestions() {
    if (!addressSuggestions) return;
    addressSuggestions.hidden = true;
    addressSearch.setAttribute('aria-expanded', 'false');
    activeAddressSuggestion = -1;
  }
  function setActiveAddressSuggestion(index) {
    var options = addressSuggestions.querySelectorAll('button[role="option"]');
    if (!options.length) return;
    activeAddressSuggestion = Math.max(0, Math.min(index, options.length - 1));
    options.forEach(function (option, optionIndex) { option.setAttribute('aria-selected', String(optionIndex === activeAddressSuggestion)); });
    options[activeAddressSuggestion].scrollIntoView({ block: 'nearest' });
  }
  function renderAddressSuggestions(items) {
    addressSuggestions.replaceChildren();
    items.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false');
      button.dataset.address = JSON.stringify(item);
      var marker = document.createElement('span'); marker.className = 'address-suggestion-marker'; marker.textContent = 'AU';
      var label = document.createElement('span'); label.textContent = item.text;
      button.append(marker, label); addressSuggestions.appendChild(button);
    });
    addressSuggestions.hidden = !items.length;
    addressSearch.setAttribute('aria-expanded', String(Boolean(items.length)));
  }
  if (addressSearch && addressSuggestions) {
    addressSearch.addEventListener('input', function () {
      window.clearTimeout(addressTimer);
      if (addressRequest) addressRequest.abort();
      var query = addressSearch.value.trim();
      if (query.length < 3) { closeAddressSuggestions(); renderAddressSuggestions([]); setAddressStatus('输入至少 3 个字符开始联想。'); return; }
      setAddressStatus('正在查找墨尔本地址…', 'loading');
      addressTimer = window.setTimeout(function () {
        addressRequest = new AbortController();
        fetch('/api/address/autocomplete?q=' + encodeURIComponent(query), { headers: { Accept: 'application/json' }, signal: addressRequest.signal })
          .then(readJsonResponse)
          .then(function (result) {
            if (!result.ok) throw new Error((result.json && result.json.error) || '地址联想暂时不可用。');
            renderAddressSuggestions(result.json.suggestions || []);
            setAddressStatus(result.json.suggestions && result.json.suggestions.length ? '请选择地址以自动填写。' : '没有找到匹配的墨尔本地址，请继续输入。', result.json.suggestions && result.json.suggestions.length ? 'ready' : 'empty');
          })
          .catch(function (error) { if (error.name !== 'AbortError') { closeAddressSuggestions(); setAddressStatus(''); showFormError(error.message || '地址联想暂时不可用，请手工填写。'); } });
      }, 300);
    });
    addressSearch.addEventListener('keydown', function (event) {
      var options = addressSuggestions.querySelectorAll('button[role="option"]');
      if (addressSuggestions.hidden || !options.length) return;
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveAddressSuggestion(activeAddressSuggestion + 1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveAddressSuggestion(activeAddressSuggestion <= 0 ? options.length - 1 : activeAddressSuggestion - 1); }
      if (event.key === 'Enter' && activeAddressSuggestion >= 0) { event.preventDefault(); options[activeAddressSuggestion].click(); }
      if (event.key === 'Escape') closeAddressSuggestions();
    });
    addressSuggestions.addEventListener('click', function (event) {
      var button = event.target.closest('button[role="option"]');
      if (!button) return;
      var item = JSON.parse(button.dataset.address || '{}');
      addressSearch.value = item.formattedAddress || item.text || '';
      document.getElementById('deliveryStreet').value = item.street || '';
      document.getElementById('deliverySuburb').value = item.suburb || '';
      document.getElementById('deliveryState').value = item.state || 'VIC';
      document.getElementById('deliveryPostcode').value = item.postcode || '';
      closeAddressSuggestions(); setAddressStatus('地址已自动填写，请核对后提交。', 'success');
    });
    document.addEventListener('click', function (event) { if (!event.target.closest('.address-autocomplete')) closeAddressSuggestions(); });
  }
  var today = todayStr();
  function termFor(id) {
    var value = cartTerms[id] || cartState.legacy || {}; var start = value.startDate || today; if (start < today) start = today;
    return { startDate: start, endDate: value.endDate || addDays(start, Math.max(1, MIN_DAYS)), startPeriod: value.startPeriod === 'PM' ? 'PM' : 'AM', endPeriod: value.endPeriod === 'PM' ? 'PM' : 'AM' };
  }
  function termDays(term) {
    var half = Math.round((Date.parse(term.endDate + 'T00:00:00Z') - Date.parse(term.startDate + 'T00:00:00Z')) / 86400000) * 2 + (term.endPeriod === 'PM' ? 1 : 0) - (term.startPeriod === 'PM' ? 1 : 0);
    return half > 0 ? Math.ceil(half / 2) : 0;
  }
  function dateUnavailable(id, date) {
    if (!date || UNAVAILABLE_DATES.indexOf(date) >= 0) return Boolean(date);
    var item = DEVICE_AVAILABILITY[id] || {};
    return (item.unavailableDates || []).indexOf(date) >= 0 || (item.rentalRanges || []).some(function (range) { return range.startDate <= date && date < range.endDate; });
  }
  function periodUnavailable(date, period) {
    var slots = UNAVAILABLE_TIME_SLOTS[date] || [];
    return period === 'AM' ? slots.indexOf('morning_service') >= 0 || slots.indexOf('morning') >= 0 : slots.indexOf('afternoon') >= 0 || slots.indexOf('evening_service') >= 0;
  }
  function termError(id, term) {
    if (!term.startDate || !term.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(term.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(term.endDate)) return '请为每台设备填写有效租期。';
    if (term.startDate < today || termDays(term) < MIN_DAYS) return '每台设备的租期不能少于 ' + MIN_DAYS + ' 天。';
    if (dateUnavailable(id, term.startDate) || periodUnavailable(term.startDate, term.startPeriod)) return '该设备取货日期或时段不可用。';
    for (var day = term.startDate; day < term.endDate; day = addDays(day, 1)) if (dateUnavailable(id, day)) return '该设备在所选租期内不可用。';
    if (periodUnavailable(term.endDate, term.endPeriod)) return '该设备归还时段不可用。';
    return '';
  }
  function validateTerms() {
    if (!AVAILABILITY_READY) return '正在检查设备档期，请稍候再提交。';
    if (AVAILABILITY_FAILED) return '设备档期检查失败，请刷新页面后重试。';
    for (var index = 0; index < cartIds.length; index += 1) { var error = termError(cartIds[index], termFor(cartIds[index])); if (error) return error; }
    return '';
  }
  function refreshSummary() {
    var count = cartIds.length;
    var dailyTotal = cartIds.reduce(function (total, id) { return total + productMap.get(id).day; }, 0);
    var depositTotal = cartIds.reduce(function (total, id) { return total + productMap.get(id).deposit; }, 0);
    var rentTotal = cartIds.reduce(function (total, id) { var term = termFor(id); var days = termDays(term); return total + (days > 0 ? rentalFee(productMap.get(id), days) : 0); }, 0);
    var total = Math.max(0, rentTotal + depositTotal - appliedDiscount);
    var selectedPaymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';
    var paymentFee = selectedPaymentMethod === 'balance' ? 0 : Math.round(Math.max(0, rentTotal - appliedDiscount) * stripeFeeRate * 100) / 100;
    var payableTotal = total + paymentFee;
    if (accountBalance !== null) {
      balancePaymentInput.disabled = accountBalance < total;
      if (balancePaymentInput.disabled && balancePaymentInput.checked) balancePaymentInput.checked = false;
      document.getElementById('balance-payment-note').textContent = accountBalance >= total
        ? '当前余额为 AUD$' + accountBalance.toFixed(2) + '，可以支付本次申请。'
        : '当前余额为 AUD$' + accountBalance.toFixed(2) + '，余额不足';
    }
    summary.textContent = count
      ? count + ' 台设备｜租金 $' + rentTotal.toFixed(2) + (appliedDiscount ? '｜优惠 -$' + appliedDiscount.toFixed(2) : '') + '｜手续费 $' + paymentFee.toFixed(2) + '｜本次应付 $' + (Math.max(0, rentTotal - appliedDiscount) + paymentFee).toFixed(2) + '｜押金 $' + depositTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : count + ' 台设备 · 合计 $' + dailyTotal.toFixed(2) + '/day · 押金 $' + depositTotal.toFixed(2);
  }
  function renderCart() {
    form.hidden = cartIds.length === 0;
    emptyBox.hidden = cartIds.length !== 0;
    itemsBox.replaceChildren();
    cartIds.forEach(function (id) {
      var product = productMap.get(id);
      var term = termFor(id);
      var rentalDays = termDays(term);
      var row = document.createElement('div'); row.className = 'cart-checkout-item';
      var detail = document.createElement('div');
      var name = document.createElement('strong'); name.textContent = product.name;
      var meta = document.createElement('span');
      var rawDaily = Number(product.day || 0);
      var effectiveDaily = rentalDays > 0 ? rentalFee(product, rentalDays) / rentalDays : rawDaily;
      var priceText = (product.model ? product.model + ' · ' : '') + formatDate(term.startDate) + '–' + formatDate(term.endDate) + ' · ' + rentalDays + ' 天 · ';
      if (rentalDays > 0 && effectiveDaily < rawDaily - 0.005) {
        var original = document.createElement('del'); original.className = 'price-original'; original.textContent = '$' + rawDaily.toFixed(2);
        meta.textContent = priceText;
        meta.appendChild(original);
        meta.appendChild(document.createTextNode(' $' + effectiveDaily.toFixed(2) + '/day · 押金 $' + product.deposit));
      } else {
        meta.textContent = priceText + '$' + product.day + '/day · 押金 $' + product.deposit;
      }
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cart-remove'; remove.dataset.cartRemove = id; remove.textContent = '移除';
      detail.append(name, meta); row.append(detail, remove); itemsBox.append(row);
    });
    submitBtn.textContent = cartIds.length ? '提交 ' + cartIds.length + ' 台设备申请' : '提交申请';
    deviceTermsInput.value = JSON.stringify(Object.fromEntries(cartIds.map(function (id) { return [id, termFor(id)]; })));
    refreshSummary();
  }
  function rentalFee(product, days) {
    var monthlyDays = Math.floor(days / 30) * 30;
    var weeklyDays = Math.floor((days - monthlyDays) / 7) * 7;
    var dailyDays = days - monthlyDays - weeklyDays;
    var day = Number(product.day || 0);
    var weeklyRate = day * (1 - Math.min(100, Math.max(0, Number(product.weeklyDiscountPercent || 0))) / 100);
    var monthlyRate = day * (1 - Math.min(100, Math.max(0, Number(product.monthlyDiscountPercent || 0))) / 100);
    return monthlyDays * monthlyRate + weeklyDays * weeklyRate + dailyDays * day;
  }
  if (cartIds.length) {
    fetch('/api/device-availability?deviceIds=' + encodeURIComponent(JSON.stringify(cartIds)), { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (result) { DEVICE_AVAILABILITY = result.availability || {}; AVAILABILITY_READY = true; refreshSummary(); })
      .catch(function () { AVAILABILITY_FAILED = true; AVAILABILITY_READY = true; refreshSummary(); });
  } else {
    AVAILABILITY_READY = true;
  }
  itemsBox.addEventListener('click', function (event) {
    var remove = event.target.closest('[data-cart-remove]');
    if (!remove) return;
    SELECTED_ID = '';
    cartIds = saveCart(cartIds.filter(function (id) { return id !== remove.dataset.cartRemove; }));
    markCouponDirty();
    renderCart();
  });
  function setCardMessage(message, isSuccess) {
    cardMessage.textContent = message;
    cardMessage.style.color = isSuccess ? 'var(--secondary)' : '';
  }
  function readJsonResponse(response) {
    return response.text().then(function (text) {
      var json;
      try { json = JSON.parse(text); } catch (_) {
        throw new Error('支付服务返回了无法识别的响应（HTTP ' + response.status + '），请稍后重试或联系客服。');
      }
      return { ok: response.ok, json: json };
    });
  }
  function paymentError(error, fallback) {
    var message = error && error.message ? String(error.message) : '';
    return /failed to fetch|network ?error|load failed/i.test(message)
      ? '无法连接支付服务，请检查网络后刷新页面重试。'
      : (message || fallback);
  }
  function updatePaymentMethodVisibility() {
    var useBalance = balancePaymentInput.checked && !balancePaymentInput.disabled;
    stripeSetupBox.hidden = useBalance;
    walletStepCard.hidden = useBalance || walletBox.getAttribute('data-available') !== 'true';
  }
  function lookupBalance() {
    var email = contactEmail.value.trim();
    balanceOption.hidden = true;
    balancePaymentInput.checked = false;
    refundBalanceInput.disabled = true;
    if (document.querySelector('input[name="refundMethod"][value="balance"]:checked')) document.querySelector('input[name="refundMethod"][value="original"]').checked = true;
    if (!email) { updatePaymentMethodVisibility(); return; }
    fetch(balanceEndpoint + '?email=' + encodeURIComponent(email), { headers: { Accept: 'application/json' } })
      .then(readJsonResponse)
      .then(function (result) {
        if (!result.ok || !result.json || contactEmail.value.trim() !== email) return;
        refundBalanceInput.disabled = !result.json.accountEligible;
        if (result.json.accountEligible) {
          balanceOption.hidden = false;
          var balance = Number(result.json.balance || 0);
          accountBalance = balance;
          refreshSummary();
        }
      })
      .catch(function () {})
      .finally(updatePaymentMethodVisibility);
  }
  contactEmail.addEventListener('input', function () {
    window.clearTimeout(balanceLookupTimer);
    balanceLookupTimer = window.setTimeout(lookupBalance, 450);
  });
  paymentMethodInputs.forEach(function (input) { input.addEventListener('change', function () { updatePaymentMethodVisibility(); refreshSummary(); }); });
  updatePaymentMethodVisibility();
  fetch(SETUP_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' })
    .then(readJsonResponse)
    .then(function (result) {
      if (!result.ok || !result.json || !result.json.clientSecret || !result.json.publishableKey || !window.Stripe) throw new Error((result.json && result.json.message) || '安全付款组件暂不可用。');
      if (Number.isFinite(Number(result.json.feeRate))) stripeFeeRate = Math.min(1, Math.max(0, Number(result.json.feeRate)));
      refreshSummary();
      stripe = window.Stripe(result.json.publishableKey);
      var appearance = {
        theme: 'night',
        variables: {
          colorPrimary: '#7c6cff',
          colorBackground: '#0b0e15',
          colorText: '#f3f4f8',
          colorTextSecondary: '#9ca3b7',
          colorTextPlaceholder: '#737b91',
          borderRadius: '8px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      };
      var walletElements = stripe.elements({ clientSecret: result.json.clientSecret, appearance: appearance });
      var walletElement = walletElements.create('expressCheckout', {
        emailRequired: true,
        phoneNumberRequired: true,
        billingAddressRequired: true,
        shippingAddressRequired: true,
      });
      walletElement.mount('#stripe-wallet-element');
      walletElement.on('ready', function (event) {
        var labels = { applePay: 'Apple Pay', googlePay: 'Google Pay', link: 'Link', paypal: 'PayPal' };
        var available = event.availablePaymentMethods ? Object.keys(labels).filter(function (method) { return event.availablePaymentMethods[method]; }).map(function (method) { return labels[method]; }) : [];
        if (!available.length) { walletElement.unmount(); return; }
        document.getElementById('stripe-wallet-title').textContent = available.length === 1 ? available[0] : '快捷支付';
        document.getElementById('stripe-wallet-description').textContent = '使用 ' + available.join('、') + ' 快速验证支付方式。';
        document.getElementById('stripe-wallet-badge').textContent = available.join(' / ').toUpperCase();
        walletBox.setAttribute('data-available', 'true');
        updatePaymentMethodVisibility();
      });
      function applyWalletContact(event) {
        var billing = event.billingDetails || {};
        var shipping = event.shippingAddress || {};
        var name = billing.name || shipping.name;
        if (name) document.getElementById('contactName').value = name;
        if (billing.phone) document.getElementById('contactPhone').value = billing.phone;
        if (billing.email) {
          contactEmail.value = billing.email;
          contactEmail.dispatchEvent(new Event('input'));
        }
        var addr = shipping.address || billing.address;
        if (addr && method.value === 'Delivery') {
          if (addr.line1) document.getElementById('deliveryStreet').value = addr.line1;
          if (addr.city) document.getElementById('deliverySuburb').value = addr.city;
          if (addr.postal_code) document.getElementById('deliveryPostcode').value = addr.postal_code;
          if (addr.state) document.getElementById('deliveryState').value = addr.state;
          validateDeliveryAddress(false);
        }
      }
      walletElement.on('confirm', function (event) {
        applyWalletContact(event);
        walletMessage.textContent = '正在验证快捷支付方式…';
        stripe.confirmSetup({ elements: walletElements, confirmParams: { return_url: location.href }, redirect: 'if_required' })
          .then(function (result) {
            if (result.error) throw new Error(paymentError(result.error, '快捷支付验证失败，请重试。'));
            setupIntent = result.setupIntent;
            if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('快捷支付验证尚未完成，请重试。');
            setupIntentInput.value = setupIntent.id;
            cardReady = true; walletMessage.textContent = '快捷支付已验证。'; walletMessage.style.color = 'var(--secondary)'; clearCheckoutError();
          })
          .catch(function (error) {
            var message = paymentError(error, 'Apple Pay 验证失败，请重试。');
            walletMessage.textContent = ''; showFormError(message);
          });
      });
      stripeElements = stripe.elements({ appearance: appearance });
      var cardElement = stripeElements.create('card', {
        hidePostalCode: true,
        disableLink: true,
        style: {
          base: {
            color: '#f3f4f8',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '15px',
            fontSmoothing: 'antialiased',
            '::placeholder': { color: '#737b91' },
          },
          invalid: { color: '#ff8c9b', iconColor: '#ff8c9b' },
        },
      });
      cardElement.mount('#stripe-card-element');
      cardElement.on('ready', function () { cardConfirm.disabled = false; setCardMessage(''); });
      cardConfirm.addEventListener('click', function () {
        cardConfirm.disabled = true; cardConfirm.textContent = '验证中…'; setCardMessage('正在向 Stripe 验证支付方式…');
        stripe.confirmCardSetup(result.json.clientSecret, { payment_method: { card: cardElement, billing_details: { name: document.getElementById('contactName').value, email: document.getElementById('contactEmail').value, phone: document.getElementById('contactPhone').value } } }, { handleActions: true })
          .then(function (result) {
            if (result.error) throw new Error(paymentError(result.error, '卡片验证失败，请检查信息。'));
            setupIntent = result.setupIntent;
            if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('卡片验证尚未完成，请重试。');
            setupIntentInput.value = setupIntent.id;
            cardReady = true; cardConfirm.textContent = '信用卡已验证'; setCardMessage('信用卡已验证。', true); clearCheckoutError();
          })
          .catch(function (error) {
            var message = paymentError(error, '卡片验证失败，请重试。');
            cardConfirm.disabled = false; cardConfirm.textContent = '验证信用卡'; setCardMessage(''); showFormError(message);
          });
      });
    })
    .catch(function (error) {
      var message = paymentError(error, '安全付款组件暂不可用，请联系客服。');
      setCardMessage(''); showFormError(message);
    });
  ['change', 'input'].forEach(function (eventName) { [deviceTermsInput].forEach(function (element) { element.addEventListener(eventName, function () { markCouponDirty(); refreshSummary(); }); }); });
  method.addEventListener('change', function () {
    var delivery = method.value === 'Delivery'; deliveryFields.hidden = !delivery; pickupField.hidden = delivery;
    var pickupLocation = document.getElementById('pickupLocation');
    pickupLocation.disabled = delivery || ${hasPickupLocations ? 'false' : 'true'};
    pickupLocation.required = !delivery && ${hasPickupLocations ? 'true' : 'false'};
    ['deliveryStreet', 'deliverySuburb', 'deliveryPostcode'].forEach(function (id) { document.getElementById(id).required = delivery; });
    validateDeliveryAddress(false);
  });
  function validateDeliveryAddress(showError) {
    var suburb = document.getElementById('deliverySuburb');
    if (method.value !== 'Delivery') { suburb.setCustomValidity(''); return true; }
    var street = document.getElementById('deliveryStreet').value.trim();
    var suburbValue = suburb.value.trim();
    var postcode = document.getElementById('deliveryPostcode').value.trim();
    var message = street && suburbValue && postcode && !isMelbourneDeliveryAddress()
      ? '送货地址仅限墨尔本及当前配置的服务区域，其他城市或郊区请选到店自取。' : '';
    suburb.setCustomValidity(message);
    if (message && showError) showFormError(message);
    return !message;
  }
  function validateContactFields(showError) { return true; }
  ['input', 'change'].forEach(function (eventName) {
    ['deliveryStreet', 'deliverySuburb', 'deliveryPostcode'].forEach(function (id) {
      document.getElementById(id).addEventListener(eventName, function () { validateDeliveryAddress(true); });
    });
  });
  method.dispatchEvent(new Event('change'));
  document.getElementById('coupon-check').addEventListener('click', function () {
    var code = document.getElementById('couponCode').value.trim();
    var hint = document.getElementById('coupon-hint');
    if (!code) { couponState = 'empty'; appliedDiscount = 0; hint.textContent = '请先输入优惠码。'; return; }
    couponState = 'checking';
    hint.textContent = '正在校验优惠码…';
    var params = new URLSearchParams({ deviceIds: JSON.stringify(cartIds), terms: deviceTermsInput.value, days: '0', code: code });
    fetch(COUPON_ENDPOINT + '?' + params.toString(), { headers: { Accept: 'application/json' } })
      .then(readJsonResponse)
      .then(function (result) {
        if (!result.ok || !result.json || !result.json.ok) throw new Error((result.json && result.json.message) || '优惠码无效。');
        hint.textContent = result.json.message || ('已优惠 AUD$' + Number(result.json.discount || 0).toFixed(2));
        appliedDiscount = Number(result.json.discount || 0);
        couponState = 'valid';
        clearCheckoutError();
        refreshSummary();
      })
      .catch(function (error) { couponState = 'invalid'; appliedDiscount = 0; hint.textContent = ''; showFormError(error.message || '优惠码校验失败，请稍后重试。'); });
  });
  document.getElementById('couponCode').addEventListener('input', markCouponDirty);
  renderCart();

  var doneBox = document.getElementById('apply-done');
  var doneMsg = document.getElementById('apply-done-msg');
  var credentialBox = document.getElementById('temporary-credentials');
  var saveContactInfo = document.getElementById('saveContactInfo');
  var savedContactInfo;
  try { savedContactInfo = JSON.parse(localStorage.getItem('geekslope-contact-v1') || 'null'); } catch (_) { savedContactInfo = null; }
  if (savedContactInfo && typeof savedContactInfo === 'object') {
    document.getElementById('contactName').value = typeof savedContactInfo.name === 'string' ? savedContactInfo.name : '';
    document.getElementById('contactPhone').value = typeof savedContactInfo.phone === 'string' ? savedContactInfo.phone : '';
    document.getElementById('contactEmail').value = typeof savedContactInfo.email === 'string' ? savedContactInfo.email : '';
    saveContactInfo.checked = true;
  }
  if (contactEmail.value) lookupBalance();
  form.addEventListener('invalid', function (event) {
    var field = event.target;
    if (field && field.validationMessage) {
      var message = field.id === 'agree' ? '请先勾选同意服务条款与隐私政策。'
        : field.id === 'deliveryPostcode' && field.validity.patternMismatch ? '请输入 4 位澳洲邮编。'
        : field.validationMessage;
      showFormError(message);
    }
  }, true);
  form.addEventListener('input', function (event) {
    var field = event.target;
    if (field && field.checkValidity() && !form.querySelector(':invalid')) { checkoutBlocked = false; errBox.hidden = true; }
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (checkoutBlocked) { errBox.hidden = false; errBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    errBox.hidden = true;
    if (!cartIds.length) { renderCart(); return; }
    if (!validateDeliveryAddress(true) || !validateContactFields(true) || !form.reportValidity()) return;
    var enteredCoupon = document.getElementById('couponCode').value.trim();
    if (enteredCoupon && couponState !== 'valid') {
      showFormError('请先点击“使用优惠码”完成校验，确认优惠码有效后再提交。');
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var selectedPaymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';
    if (selectedPaymentMethod !== 'balance' && (!cardReady || !setupIntentInput.value)) {
      showFormError('请先填写并验证信用卡信息。验证过程不会扣款。'); errBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    var termValidationError = validateTerms();
    if (termValidationError) { showFormError(termValidationError); errBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    var payload = {};
    new FormData(form).forEach(function (value, key) { payload[key] = value; });
    if (saveContactInfo.checked) {
      try { localStorage.setItem('geekslope-contact-v1', JSON.stringify({ name: payload.contactName || '', phone: payload.contactPhone || '', email: payload.contactEmail || '' })); } catch (_) {}
    }
    payload.deviceIds = cartIds.slice(); payload.deviceId = cartIds[0];
    payload.deviceTerms = deviceTermsInput.value;
    var turnstileInput = form.querySelector('[name="cf-turnstile-response"]');
    if (turnstileInput) payload['cf-turnstile-response'] = turnstileInput.value;
    submitBtn.disabled = true; submitBtn.textContent = '提交中…';
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(readJsonResponse)
      .then(function (result) {
        if (result.ok && result.json && result.json.ok) {
          saveCart([]); form.hidden = true; doneMsg.textContent = result.json.message || '申请已提交，我们确认后会联系你。';
          if (result.json.orderNo) { document.getElementById('done-order-no').textContent = result.json.orderNo; document.getElementById('done-password').textContent = result.json.temporaryPassword || '已有账号，请使用原密码'; credentialBox.hidden = false; }
          doneBox.hidden = false;
          if (!reduceMotion) doneBox.classList.add('is-in');
          doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
        }
        throw new Error((result.json && result.json.message) || '提交失败，请稍后重试。');
      })
      .catch(function (error) {
        showFormError(error.message || '提交失败，请稍后重试。'); submitBtn.disabled = false; submitBtn.textContent = '提交 ' + cartIds.length + ' 台设备申请'; errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  });
})();
</script>`
}
