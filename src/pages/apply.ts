// 购物车 / 下单页。购物车保存在浏览器 localStorage；提交时由 rent 主应用为每台设备
// 创建一张 pending_approval 订单，多个订单共享租期、取还方式和联系人信息。

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

export function renderCartPage(products: Product[], selectedId = ''): string {
  const cartProducts = products.filter((product) => product.id && product.pricePerDay > 0).map((product) => ({
    id: product.id,
    name: product.name,
    model: product.model,
    categoryLabel: product.categoryLabel,
    day: product.pricePerDay,
    deposit: product.depositAmount,
  }))
  return /* html */ `
<section class="page-hero compact"><div class="wrap"><div class="kicker">购物车</div><h1>先选好设备，再开始结账</h1><p>在这里确认设备和预计费用，下一步再填写租期、取还方式与联系信息。</p></div></section>
<section class="section apply-section"><div class="wrap form-wrap cart-page-wrap">
  <div class="section-head"><div class="kicker">当前选择</div><h2>你的设备清单</h2><p>设备会保存在当前浏览器中，最多同时选择 10 台。</p></div>
  <div class="form-card cart-empty" id="cart-page-empty" hidden><h3>购物车还是空的</h3><p>先去设备库挑选电脑，加入后会显示在这里。</p><a class="btn btn-primary" href="/products">去选择设备</a></div>
  <div id="cart-page-content" hidden>
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
  function read() {
    try {
      var ids = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(ids) ? ids.filter(function (id, index) { return map.has(id) && ids.indexOf(id) === index; }).slice(0, 10) : [];
    } catch (_) { return []; }
  }
  function write(ids) {
    try { localStorage.setItem(key, JSON.stringify(ids)); } catch (_) {}
    if (window.GeekSlopeCart) window.GeekSlopeCart.write(ids);
    render();
  }
  function render() {
    var ids = read();
    if (selectedId && map.has(selectedId) && ids.indexOf(selectedId) < 0 && ids.length < 10) {
      ids.push(selectedId);
      try { localStorage.setItem(key, JSON.stringify(ids)); } catch (_) {}
    }
    empty.hidden = ids.length > 0;
    content.hidden = ids.length === 0;
    items.replaceChildren();
    var deposit = 0;
    ids.forEach(function (id) {
      var product = map.get(id); deposit += Number(product.deposit || 0);
      var row = document.createElement('article'); row.className = 'cart-page-item';
      var detail = document.createElement('div');
      var category = document.createElement('span'); category.textContent = product.categoryLabel;
      var name = document.createElement('h3'); name.textContent = product.name;
      var model = document.createElement('p'); model.textContent = product.model || '配置详情见设备页';
      detail.append(category, name, model);
      var price = document.createElement('div'); price.className = 'cart-page-price';
      var daily = document.createElement('strong'); daily.textContent = '$' + product.day;
      var unit = document.createElement('small'); unit.textContent = '/day'; daily.appendChild(unit);
      var depositText = document.createElement('span'); depositText.textContent = '押金 $' + product.deposit;
      var remove = document.createElement('button'); remove.className = 'cart-remove'; remove.type = 'button'; remove.textContent = '移除';
      remove.addEventListener('click', function () { write(ids.filter(function (item) { return item !== id; })); });
      price.append(daily, depositText, remove); row.append(detail, price);
      items.appendChild(row);
    });
    total.textContent = ids.length ? ids.length + ' 台设备 · 押金 $' + deposit.toFixed(2) + ' 起租' : '';
  }
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
      <p>同一购物车内的设备共用租期与取还方式。预计填写时间 3–5 分钟。</p>
    </div>

    <div class="form-card cart-empty" id="cart-empty" hidden>
      <h3>购物车还是空的</h3>
      <p>先去设备库挑选电脑，加入后会保存在这里。</p>
      <a class="btn btn-primary" href="/products">去选择设备</a>
    </div>

    <form id="apply-form" hidden>
      <div class="form-alert" id="form-error" hidden></div>

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
        <div class="form-card-head"><span>02</span><div><h3>租赁日期</h3><p>半天时段也会折算进预计租期</p></div></div>
        <div class="row2">
          <div class="field"><label for="startDate">取货日期</label><input type="date" id="startDate" name="startDate" lang="en-AU" required></div>
          <div class="field"><label for="startPeriod">取货时段</label><select id="startPeriod" name="startPeriod"><option value="AM">上午</option><option value="PM">下午</option></select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="endDate">归还日期</label><input type="date" id="endDate" name="endDate" lang="en-AU" required></div>
          <div class="field"><label for="endPeriod">归还时段</label><select id="endPeriod" name="endPeriod"><option value="AM">上午</option><option value="PM">下午</option></select></div>
        </div>
        <p class="hint">最短租期 ${config.minimumRentalDays} 天。所有设备需使用同一租期，具体可用档期以系统校验为准。</p>
      </div>

      <div class="form-card">
        <div class="form-card-head"><span>03</span><div><h3>取还方式</h3><p>配送范围与运费会在审核时确认</p></div></div>
        <div class="field">
          <label for="deliveryMethod">取还方式</label>
          <select id="deliveryMethod" name="deliveryMethod"><option value="Pickup"${hasPickupLocations ? '' : ' disabled'}>到店自取${hasPickupLocations ? `（${config.pickupLocations.length} 个可选地点）` : '（暂未开放）'}</option><option value="Delivery"${hasPickupLocations ? '' : ' selected'}>送货上门</option></select>
        </div>
        <div class="field" id="pickup-field"${hasPickupLocations ? '' : ' hidden'}><label for="pickupLocation">自取 / 归还地点</label>${pickupField}</div>
        <div id="delivery-fields"${hasPickupLocations ? ' hidden' : ''}>
          <div class="field"><label for="deliveryStreet">街道地址</label><input id="deliveryStreet" name="deliveryStreet" autocomplete="address-line1"></div>
          <div class="row3">
            <div class="field"><label for="deliverySuburb">Suburb</label><input id="deliverySuburb" name="deliverySuburb" placeholder="如 Docklands / South Yarra"></div>
            <div class="field"><label for="deliveryState">州</label><input id="deliveryState" name="deliveryState" value="VIC" readonly></div>
          </div>
          <div class="field"><label for="deliveryPostcode">邮编</label><input id="deliveryPostcode" name="deliveryPostcode" inputmode="numeric" pattern="\\d{4}" placeholder="4 位数字"></div>
          <p class="hint">${esc(config.deliveryNote)}${deliveryAreas ? ` 可配送区域：${esc(deliveryAreas)}。` : ''} 其他郊区请选到店自取。</p>
        </div>
      </div>

      <div class="form-card">
        <div class="form-card-head"><span>04</span><div><h3>联系与账号</h3><p>用于接收审核结果、后续签约与付款</p></div></div>
        <div class="stripe-wallet-box" id="stripe-wallet-box" hidden>
          <div class="stripe-setup-head"><div><label>Apple Pay</label><p>使用 Apple Pay 快速验证支付方式，不会在提交申请时扣款。</p></div><span>APPLE PAY</span></div>
          <div id="stripe-wallet-element"></div>
          <p id="stripe-wallet-message" class="hint" aria-live="polite"></p>
        </div>
        <div class="row2">
          <div class="field" id="contact-name-field"><label for="contactName">姓名</label><input id="contactName" name="contactName" maxlength="120" autocomplete="name"></div>
          <div class="field"><label for="contactPhone">联系电话</label><input id="contactPhone" name="contactPhone" maxlength="40" autocomplete="tel"></div>
        </div>
        <div class="field" id="contact-email-field"><label for="contactEmail">邮箱</label><input type="email" id="contactEmail" name="contactEmail" maxlength="200" autocomplete="email"></div>
        <label class="choice-line save-contact-choice"><input type="checkbox" id="saveContactInfo"> 保存我的信息，以便下次更快结账</label>
        <div class="payment-method-options" id="payment-method-options" hidden>
          <label class="choice-line"><input type="radio" name="paymentMethod" value="balance"> 账户余额支付 <span id="balance-payment-note">检测到账户余额，可用于支付本次申请。</span></label>
          <label class="choice-line"><input type="radio" name="paymentMethod" value="mixed"> 混合支付（优先扣除余额，再支付剩余金额）</label>
        </div>
        <div class="stripe-setup-box">
          <div class="stripe-setup-head"><div><label>信用卡资料</label><p>仅验证支付方式，不会在提交申请时扣款。</p></div><span>SECURE / STRIPE</span></div>
          <div id="stripe-card-element" class="stripe-card-element"></div>
          <p id="stripe-card-message" class="hint" aria-live="polite">正在加载安全付款组件…</p>
          <button type="button" class="btn btn-ghost" id="stripe-card-confirm" disabled>验证信用卡</button>
          <input type="hidden" id="stripeSetupIntentId" name="stripeSetupIntentId">
        </div>
        <div class="refund-choice">
          <label>押金退还方式</label>
          <p class="hint">设备归还并完成验收后，押金会按你选择的方式处理。退回账号余额仅限已存在的正式账户；新注册或临时账户请选原路退回。</p>
          <label class="choice-line"><input type="radio" name="refundMethod" value="original" checked> 原路退回信用卡</label>
          <label class="choice-line"><input type="radio" id="refund-balance" name="refundMethod" value="balance" disabled> 退回账号余额（仅正式账户）</label>
        </div>
        <div class="field"><label for="rentalNote">备注（选填）</label><textarea id="rentalNote" name="rentalNote" maxlength="500" placeholder="例如期望配送时间、用途等"></textarea></div>
        <div class="field" style="display:flex;gap:8px;align-items:flex-start">
          <input type="checkbox" id="agree" name="agree" value="1" style="width:auto;margin-top:3px" required>
          <label for="agree" style="font-weight:400;margin:0">我已阅读并同意 <a href="/service-terms" target="_blank" rel="noopener" style="color:var(--primary)">服务条款</a> 与 <a href="/privacy" target="_blank" rel="noopener" style="color:var(--primary)">隐私政策</a>。</label>
        </div>
        ${stripeScript}${turnstile}
        <p class="hint">提交后订单进入审核流程，我们确认后会联系你安排签约与付款。个人信息仅用于本次租赁。</p>
      </div>

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
      <div class="temporary-credentials" id="temporary-credentials" hidden><span>请立即保存</span><strong>订单编号：<b id="done-order-no"></b></strong><strong>临时账户密码：<b id="done-temp-password"></b></strong><p>已注册用户请直接登录账号中心；临时密码只在这里显示。</p></div>
      <p style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px"><a class="btn btn-primary" href="${esc(appUrl)}/login">进入账号中心查看申请</a><a class="btn btn-ghost" href="/products">继续浏览产品</a></p>
    </div>
  </div>
</section>

<script>
(() => {
  var CART_KEY = 'geekslope-cart-v1';
  var PRODUCTS = ${scriptJson(cartProducts)};
  var SELECTED_ID = ${scriptJson(selectedId)};
  var ENDPOINT = ${scriptJson(`${appUrl}/public/rental-request`)};
  var SETUP_ENDPOINT = ${scriptJson(`${appUrl}/public/rental-setup-intent`)};
  var MIN_DAYS = ${config.minimumRentalDays};
  var UNAVAILABLE_DATES = ${scriptJson(config.unavailableDates)};
  var UNAVAILABLE_TIME_SLOTS = ${scriptJson(config.unavailableTimeSlots)};
  var COUPON_ENDPOINT = ${scriptJson(`${appUrl}/api/coupons/rental-cart-preview`)};
  var productMap = new Map(PRODUCTS.map(function (product) { return [product.id, product]; }));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function readCart() {
    try {
      var ids = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(ids) ? ids.filter(function (id, index) { return productMap.has(id) && ids.indexOf(id) === index; }).slice(0, 10) : [];
    } catch (_) { return []; }
  }
  function saveCart(ids) {
    if (window.GeekSlopeCart) return window.GeekSlopeCart.write(ids);
    try { localStorage.setItem(CART_KEY, JSON.stringify(ids)); } catch (_) {}
    return ids;
  }
  var cartIds = readCart();
  if (SELECTED_ID && productMap.has(SELECTED_ID) && cartIds.indexOf(SELECTED_ID) < 0) { cartIds.push(SELECTED_ID); cartIds = saveCart(cartIds); }

  var form = document.getElementById('apply-form');
  var emptyBox = document.getElementById('cart-empty');
  var itemsBox = document.getElementById('cart-items');
  var errBox = document.getElementById('form-error');
  var summary = document.getElementById('summary');
  var startD = document.getElementById('startDate');
  var endD = document.getElementById('endDate');
  var startP = document.getElementById('startPeriod');
  var endP = document.getElementById('endPeriod');
  var method = document.getElementById('deliveryMethod');
  var pickupField = document.getElementById('pickup-field');
  var deliveryFields = document.getElementById('delivery-fields');
  var submitBtn = document.getElementById('submit-btn');
  var appliedDiscount = 0;
  var stripe = null;
  var stripeElements = null;
  var setupIntent = null;
  var cardReady = false;
    var stripeFeeRate = 0.025;
  var cardMessage = document.getElementById('stripe-card-message');
  var cardConfirm = document.getElementById('stripe-card-confirm');
  var setupIntentInput = document.getElementById('stripeSetupIntentId');
  var balanceOption = document.getElementById('payment-method-options');
  var paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
  var balancePaymentInput = balanceOption.querySelector('input[value="balance"]');
  var mixedPaymentInput = balanceOption.querySelector('input[value="mixed"]');
  var refundBalanceInput = document.getElementById('refund-balance');
  var contactEmail = document.getElementById('contactEmail');
  var balanceEndpoint = ${scriptJson(`${appUrl}/public/account-balance`)};
  var balanceLookupTimer = null;
  var walletBox = document.getElementById('stripe-wallet-box');
  var walletMessage = document.getElementById('stripe-wallet-message');

  function todayStr() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function addDays(dateString, amount) {
    var date = new Date(dateString + 'T00:00:00');
    date.setDate(date.getDate() + amount);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  var today = todayStr();
  startD.min = today;
  endD.min = today;
  if (!startD.value) startD.value = today;
  endD.min = addDays(startD.value, Math.max(1, MIN_DAYS));
  if (!endD.value) endD.value = endD.min;
  function days() {
    if (!startD.value || !endD.value) return 0;
    var start = new Date(startD.value + 'T00:00:00Z'), end = new Date(endD.value + 'T00:00:00Z');
    var half = Math.round((end - start) / 86400000) * 2 + (endP.value === 'PM' ? 1 : 0) - (startP.value === 'PM' ? 1 : 0);
    return half > 0 ? Math.ceil(half / 2) : 0;
  }
  function periodUnavailable(date, period) {
    var slots = UNAVAILABLE_TIME_SLOTS[date] || [];
    return period === 'AM'
      ? slots.indexOf('morning_service') >= 0 || slots.indexOf('morning') >= 0
      : slots.indexOf('afternoon') >= 0 || slots.indexOf('evening_service') >= 0;
  }
  function validateAvailability() {
    var startMessage = UNAVAILABLE_DATES.indexOf(startD.value) >= 0
      ? '该日期不可取货，请选择其他日期。'
      : periodUnavailable(startD.value, startP.value) ? '该取货时段不可用，请选择其他时段。' : '';
    var endMessage = UNAVAILABLE_DATES.indexOf(endD.value) >= 0
      ? '该日期不可归还，请选择其他日期。'
      : periodUnavailable(endD.value, endP.value) ? '该归还时段不可用，请选择其他时段。' : '';
    startD.setCustomValidity(startMessage); startP.setCustomValidity(startMessage);
    endD.setCustomValidity(endMessage); endP.setCustomValidity(endMessage);
  }
  function refreshSummary() {
    endD.min = addDays(startD.value || todayStr(), Math.max(1, MIN_DAYS));
    if (endD.value && endD.value < endD.min) endD.value = endD.min;
    var count = cartIds.length;
    var rentalDays = days();
    var dailyTotal = cartIds.reduce(function (total, id) { return total + productMap.get(id).day; }, 0);
    var depositTotal = cartIds.reduce(function (total, id) { return total + productMap.get(id).deposit; }, 0);
    var rentTotal = rentalDays ? dailyTotal * rentalDays : 0;
    var total = Math.max(0, rentTotal + depositTotal - appliedDiscount);
    var selectedPaymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';
    var paymentFee = selectedPaymentMethod === 'balance' ? 0 : Math.round(total * stripeFeeRate * 100) / 100;
    var payableTotal = total + paymentFee;
    summary.textContent = rentalDays
      ? count + ' 台设备 · ' + rentalDays + ' 天 · 租金 $' + rentTotal.toFixed(2) + (appliedDiscount ? ' · 优惠 -$' + appliedDiscount.toFixed(2) : '') + ' + 押金 $' + depositTotal.toFixed(2) + ' · 支付手续费 $' + paymentFee.toFixed(2) + ' = 应付 $' + payableTotal.toFixed(2) + (rentalDays < MIN_DAYS ? '（低于最短租期）' : '')
      : count + ' 台设备 · 合计 $' + dailyTotal.toFixed(2) + '/day · 押金 $' + depositTotal.toFixed(2) + '（可退）';
    validateAvailability();
  }
  function renderCart() {
    form.hidden = cartIds.length === 0;
    emptyBox.hidden = cartIds.length !== 0;
    itemsBox.replaceChildren();
    cartIds.forEach(function (id) {
      var product = productMap.get(id);
      var row = document.createElement('div'); row.className = 'cart-checkout-item';
      var detail = document.createElement('div');
      var name = document.createElement('strong'); name.textContent = product.name;
      var meta = document.createElement('span'); meta.textContent = (product.model ? product.model + ' · ' : '') + '$' + product.day + '/day · 押金 $' + product.deposit;
      detail.append(name, meta); row.append(detail); itemsBox.append(row);
    });
    submitBtn.textContent = cartIds.length ? '提交 ' + cartIds.length + ' 台设备申请' : '提交申请';
    refreshSummary();
  }
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
  function updatePaymentMethodVisibility() {
    // 余额、银行卡和钱包可以并存；余额选项只决定最终订单的扣款优先级。
  }
  function lookupBalance() {
    var email = contactEmail.value.trim();
    balanceOption.hidden = true;
    balancePaymentInput.checked = false;
    mixedPaymentInput.checked = false;
    refundBalanceInput.disabled = true;
    if (document.querySelector('input[name="refundMethod"][value="balance"]:checked')) document.querySelector('input[name="refundMethod"][value="original"]').checked = true;
    if (!email) { updatePaymentMethodVisibility(); return; }
    fetch(balanceEndpoint + '?email=' + encodeURIComponent(email), { headers: { Accept: 'application/json' } })
      .then(readJsonResponse)
      .then(function (result) {
        if (!result.ok || !result.json || contactEmail.value.trim() !== email) return;
        refundBalanceInput.disabled = !result.json.accountEligible;
        if (result.json.available) balanceOption.hidden = false;
        document.getElementById('balance-payment-note').textContent = '检测到账户余额，可用于支付本次申请。';
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
  fetch(SETUP_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' } })
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
      var walletElement = walletElements.create('expressCheckout', { paymentMethods: { applePay: 'auto', googlePay: 'auto', link: 'auto', paypal: 'auto', amazonPay: 'auto', klarna: 'auto' } });
      walletElement.mount('#stripe-wallet-element');
      walletElement.on('ready', function (event) {
        if (event.availablePaymentMethods && Object.keys(event.availablePaymentMethods).some(function (method) { return ['applePay', 'googlePay', 'link', 'paypal'].indexOf(method) >= 0 && event.availablePaymentMethods[method]; })) walletBox.hidden = false;
        else walletElement.unmount();
      });
      walletElement.on('confirm', function () {
        walletMessage.textContent = '正在验证快捷支付方式…';
        stripe.confirmSetup({ elements: walletElements, confirmParams: { return_url: location.href }, redirect: 'if_required' })
          .then(function (result) {
            if (result.error) throw new Error(result.error.message || '快捷支付验证失败，请重试。');
            setupIntent = result.setupIntent;
            if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('快捷支付验证尚未完成，请重试。');
            setupIntentInput.value = setupIntent.id;
            cardReady = true; walletMessage.textContent = '快捷支付已验证。'; walletMessage.style.color = 'var(--secondary)';
          })
          .catch(function (error) { walletMessage.textContent = error.message || 'Apple Pay 验证失败，请重试。'; });
      });
      stripeElements = stripe.elements({ appearance: appearance });
      var cardElement = stripeElements.create('card', {
        hidePostalCode: true,
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
      cardElement.on('ready', function () { cardConfirm.disabled = false; });
      cardConfirm.addEventListener('click', function () {
        cardConfirm.disabled = true; cardConfirm.textContent = '验证中…'; setCardMessage('正在向 Stripe 验证支付方式…');
        stripe.confirmCardSetup(result.json.clientSecret, { payment_method: { card: cardElement, billing_details: { name: document.getElementById('contactName').value, email: document.getElementById('contactEmail').value, phone: document.getElementById('contactPhone').value } } }, { handleActions: true })
          .then(function (result) {
            if (result.error) throw new Error(result.error.message || '卡片验证失败，请检查信息。');
            setupIntent = result.setupIntent;
            if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('卡片验证尚未完成，请重试。');
            setupIntentInput.value = setupIntent.id;
            cardReady = true; cardConfirm.textContent = '信用卡已验证'; setCardMessage('信用卡已验证。', true);
          })
          .catch(function (error) { cardConfirm.disabled = false; cardConfirm.textContent = '验证信用卡'; setCardMessage(error.message || '卡片验证失败，请重试。'); });
      });
    })
    .catch(function (error) { setCardMessage(error.message || '安全付款组件暂不可用，请联系客服。'); });
  ['change', 'input'].forEach(function (eventName) { [startD, endD, startP, endP].forEach(function (element) { element.addEventListener(eventName, function () { appliedDiscount = 0; refreshSummary(); }); }); });
  method.addEventListener('change', function () {
    var delivery = method.value === 'Delivery'; deliveryFields.hidden = !delivery; pickupField.hidden = delivery;
    var pickupLocation = document.getElementById('pickupLocation');
    pickupLocation.disabled = delivery || ${hasPickupLocations ? 'false' : 'true'};
    pickupLocation.required = !delivery && ${hasPickupLocations ? 'true' : 'false'};
    ['deliveryStreet', 'deliverySuburb', 'deliveryPostcode'].forEach(function (id) { document.getElementById(id).required = delivery; });
  });
  method.dispatchEvent(new Event('change'));
  document.getElementById('coupon-check').addEventListener('click', function () {
    var code = document.getElementById('couponCode').value.trim();
    var hint = document.getElementById('coupon-hint');
    if (!code) { hint.textContent = '请先输入优惠码。'; return; }
    hint.textContent = '正在校验优惠码…';
    var params = new URLSearchParams({ deviceIds: JSON.stringify(cartIds), days: String(days()), code: code });
    fetch(COUPON_ENDPOINT + '?' + params.toString(), { headers: { Accept: 'application/json' } })
      .then(readJsonResponse)
      .then(function (result) {
        if (!result.ok || !result.json || !result.json.ok) throw new Error((result.json && result.json.message) || '优惠码无效。');
        hint.textContent = result.json.message || ('已优惠 AUD$' + Number(result.json.discount || 0).toFixed(2));
        appliedDiscount = Number(result.json.discount || 0);
        refreshSummary();
      })
      .catch(function (error) { hint.textContent = error.message || '优惠码校验失败，请稍后重试。'; });
  });
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
  form.addEventListener('submit', function (event) {
    event.preventDefault(); errBox.hidden = true;
    if (!cartIds.length) { renderCart(); return; }
    if (!form.reportValidity()) return;
    var selectedPaymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';
    if (selectedPaymentMethod !== 'balance' && (!cardReady || !setupIntentInput.value)) {
      errBox.textContent = '请先填写并验证信用卡信息。验证过程不会扣款。'; errBox.hidden = false; errBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    if (days() < MIN_DAYS) {
      errBox.textContent = '租期不能少于 ' + MIN_DAYS + ' 天，请调整归还日期。'; errBox.hidden = false; errBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    var payload = {};
    new FormData(form).forEach(function (value, key) { payload[key] = value; });
    if (saveContactInfo.checked) {
      try { localStorage.setItem('geekslope-contact-v1', JSON.stringify({ name: payload.contactName || '', phone: payload.contactPhone || '', email: payload.contactEmail || '' })); } catch (_) {}
    }
    payload.deviceIds = cartIds.slice(); payload.deviceId = cartIds[0];
    var turnstileInput = form.querySelector('[name="cf-turnstile-response"]');
    if (turnstileInput) payload['cf-turnstile-response'] = turnstileInput.value;
    submitBtn.disabled = true; submitBtn.textContent = '提交中…';
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(readJsonResponse)
      .then(function (result) {
        if (result.ok && result.json && result.json.ok) {
          saveCart([]); form.hidden = true; doneMsg.textContent = result.json.message || '申请已提交，我们确认后会联系你。';
          if (result.json.orderNo) { document.getElementById('done-order-no').textContent = result.json.orderNo; document.getElementById('done-temp-password').textContent = result.json.temporaryPassword || '请进入账号中心登录'; credentialBox.hidden = false; }
          doneBox.hidden = false;
          if (!reduceMotion) doneBox.classList.add('is-in');
          doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
        }
        throw new Error((result.json && result.json.message) || '提交失败，请稍后重试。');
      })
      .catch(function (error) {
        errBox.textContent = error.message || '提交失败，请稍后重试。'; errBox.hidden = false; submitBtn.disabled = false; submitBtn.textContent = '提交 ' + cartIds.length + ' 台设备申请'; errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  });
})();
</script>`
}
