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
    deposit: product.depositAmount,
  }))
  return /* html */ `
<section class="page-hero compact"><div class="wrap"><div class="kicker">购物车</div><h1>先选设备，再确认租期</h1><p>设备详情页先选租期；加入购物车后，只需在这里修改租期。</p></div></section>
<section class="section apply-section"><div class="wrap form-wrap cart-page-wrap">
  <div class="section-head"><div class="kicker">当前选择</div><h2>你的设备清单</h2><p>设备会保存在当前浏览器中，最多同时选择 10 台。</p></div>
  <div class="form-card cart-empty" id="cart-page-empty" hidden><h3>购物车还是空的</h3><p>先去设备库挑选电脑，加入后会显示在这里。</p><a class="btn btn-primary" href="/products">去选择设备</a></div>
  <div id="cart-page-content" hidden>
    <div class="form-card cart-term-card">
      <div class="form-card-head"><span>01</span><div><h3>租赁日期</h3><p>购物车中的设备共用这一租期</p></div></div>
      <div class="row2">
        <div class="field"><label for="cart-start-date">取货日期</label><input type="date" id="cart-start-date" required></div>
        <div class="field"><label for="cart-start-period">取货时段</label><select id="cart-start-period"><option value="AM">上午</option><option value="PM">下午</option></select></div>
      </div>
      <div class="row2">
        <div class="field"><label for="cart-end-date">归还日期</label><input type="date" id="cart-end-date" required></div>
        <div class="field"><label for="cart-end-period">归还时段</label><select id="cart-end-period"><option value="AM">上午</option><option value="PM">下午</option></select></div>
      </div>
      <p class="hint">最短租期 ${esc(config.minimumRentalDays)} 天。租期可在提交前继续修改。</p>
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
  var startInput = document.getElementById('cart-start-date');
  var endInput = document.getElementById('cart-end-date');
  var startPeriodInput = document.getElementById('cart-start-period');
  var endPeriodInput = document.getElementById('cart-end-period');
  function today() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function addDays(value, amount) {
    var date = new Date(value + 'T00:00:00'); date.setDate(date.getDate() + amount);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function read() {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '[]');
      var ids = Array.isArray(value) ? value : value.items;
      var term = Array.isArray(value) ? null : value.term;
      return { ids: Array.isArray(ids) ? ids.filter(function (id, index) { return map.has(id) && ids.indexOf(id) === index; }).slice(0, 10) : [], term: term };
    } catch (_) { return { ids: [], term: null }; }
  }
  function write(ids, term) {
    var state = { items: ids, term: term };
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) {}
    if (window.GeekSlopeCart) window.GeekSlopeCart.write(ids, term);
    render();
  }
  function render() {
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
      var term = state.term || { startDate: today(), endDate: addDays(today(), minimumDays), startPeriod: 'AM', endPeriod: 'AM' };
      startInput.min = today();
      if (!term.startDate || term.startDate < startInput.min) term.startDate = startInput.min;
      startInput.value = term.startDate;
      endInput.min = addDays(startInput.value, Math.max(1, minimumDays));
      endInput.value = term.endDate && term.endDate >= endInput.min ? term.endDate : endInput.min;
      startPeriodInput.value = term.startPeriod || 'AM';
      endPeriodInput.value = term.endPeriod || 'AM';
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
      var daily = document.createElement('strong'); daily.textContent = '$' + product.day;
      var unit = document.createElement('small'); unit.textContent = '/day'; daily.appendChild(unit);
      var depositText = document.createElement('span'); depositText.textContent = '押金 $' + product.deposit;
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cart-remove'; remove.dataset.cartRemove = id; remove.textContent = '移除';
      price.append(daily, depositText, remove); row.append(detail, price);
      items.appendChild(row);
    });
    total.textContent = ids.length ? ids.length + ' 台设备 · ' + rentalDays + ' 天 · 租金 $' + (rentalDays * ids.reduce(function (sum, id) { return sum + Number(map.get(id).day || 0); }, 0)).toFixed(2) + ' · 押金 $' + deposit.toFixed(2) : '';
  }
  function saveTerm() {
    var minimumEnd = addDays(startInput.value || today(), Math.max(1, minimumDays));
    endInput.min = minimumEnd;
    if (endInput.value < minimumEnd) endInput.value = minimumEnd;
    write(read().ids, { startDate: startInput.value, endDate: endInput.value, startPeriod: startPeriodInput.value, endPeriod: endPeriodInput.value });
  }
  startInput.addEventListener('change', saveTerm);
  endInput.addEventListener('change', saveTerm);
  startPeriodInput.addEventListener('change', saveTerm);
  endPeriodInput.addEventListener('change', saveTerm);
  items.addEventListener('click', function (event) {
    var remove = event.target.closest('[data-cart-remove]');
    if (!remove) return;
    selectedId = '';
    var state = read();
    write(state.ids.filter(function (id) { return id !== remove.dataset.cartRemove; }), state.term);
    render();
  });
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

      <input type="hidden" id="startDate" name="startDate" required>
      <input type="hidden" id="endDate" name="endDate" required>
      <input type="hidden" id="startPeriod" name="startPeriod" value="AM">
      <input type="hidden" id="endPeriod" name="endPeriod" value="AM">

      <div class="form-card">
        <div class="form-card-head"><span>03</span><div><h3>取还方式</h3><p>配送范围与运费会在审核时确认</p></div></div>
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
        <div class="form-card-head"><span>04</span><div><h3>联系与账号</h3><p>用于接收审核结果、后续签约与付款</p></div></div>
        <div class="stripe-wallet-box" id="stripe-wallet-box" hidden>
          <div class="stripe-setup-head"><div><label id="stripe-wallet-title">快捷支付</label><p id="stripe-wallet-description">使用可用的快捷支付方式验证，不会在提交申请时扣款。</p></div><span id="stripe-wallet-badge">EXPRESS CHECKOUT</span></div>
          <div id="stripe-wallet-element"></div>
          <p id="stripe-wallet-message" class="hint" aria-live="polite"></p>
        </div>
        <div class="row2">
          <div class="field" id="contact-name-field"><label for="contactName">姓名</label><input id="contactName" name="contactName" maxlength="120" autocomplete="name" required></div>
          <div class="field"><label for="contactPhone">联系电话</label><input id="contactPhone" name="contactPhone" maxlength="40" autocomplete="tel" required></div>
        </div>
        <div class="field" id="contact-email-field"><label for="contactEmail">邮箱</label><input type="email" id="contactEmail" name="contactEmail" maxlength="200" autocomplete="email" required></div>
        <div class="row2">
          <div class="field"><label for="password">设置 / 输入密码</label><input type="password" id="password" name="password" minlength="8" autocomplete="new-password" required></div>
          <div class="field"><label for="passwordConfirm">确认密码</label><input type="password" id="passwordConfirm" name="passwordConfirm" minlength="8" autocomplete="new-password" required></div>
        </div>
        <p class="hint">已有账号请填写原密码；新账号密码至少 8 位，并包含字母、数字和符号。</p>
        <label class="choice-line save-contact-choice"><input type="checkbox" id="saveContactInfo"> 保存我的信息，以便下次更快结账</label>
        <div class="payment-method-options" id="payment-method-options" hidden>
          <label class="choice-line"><input type="radio" name="paymentMethod" value="balance"> 账户余额支付 <span id="balance-payment-note">检测到账户余额，可用于支付本次申请。</span></label>
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
        <div class="field legal-agreement">
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
      <div class="temporary-credentials" id="temporary-credentials" hidden><span>申请已提交</span><strong>订单编号：<b id="done-order-no"></b></strong><p>请使用刚才设置的密码，进入账号中心查看申请进度。</p></div>
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
  var DELIVERY_AREAS = ${scriptJson(config.deliveryAreas)};
  var COUPON_ENDPOINT = '/api/coupons/rental-cart-preview';
  var productMap = new Map(PRODUCTS.map(function (product) { return [product.id, product]; }));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function readCart() {
    try {
      var value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      var ids = Array.isArray(value) ? value : value.items;
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
  var passwordInput = document.getElementById('password');
  var passwordConfirmInput = document.getElementById('passwordConfirm');
  var balanceEndpoint = '/api/account-balance';
  var balanceLookupTimer = null;
  var walletBox = document.getElementById('stripe-wallet-box');
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
          .catch(function (error) { if (error.name !== 'AbortError') { closeAddressSuggestions(); setAddressStatus(error.message || '地址联想暂时不可用，请手工填写。', 'error'); } });
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
  startD.min = today;
  endD.min = today;
  try {
    var savedCart = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    var savedTerm = savedCart && !Array.isArray(savedCart) ? savedCart.term : null;
    if (savedTerm && savedTerm.startDate && savedTerm.endDate) {
      startD.value = savedTerm.startDate; endD.value = savedTerm.endDate;
      if (savedTerm.startPeriod) startP.value = savedTerm.startPeriod;
      if (savedTerm.endPeriod) endP.value = savedTerm.endPeriod;
    }
  } catch (_) {}
  if (!startD.value) startD.value = today;
  if (startD.value < today) startD.value = today;
  endD.min = addDays(startD.value, Math.max(1, MIN_DAYS));
  if (!endD.value || endD.value < endD.min) endD.value = endD.min;
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
    if (accountBalance !== null) {
      balancePaymentInput.disabled = accountBalance < total;
      if (balancePaymentInput.disabled && balancePaymentInput.checked) balancePaymentInput.checked = false;
      document.getElementById('balance-payment-note').textContent = accountBalance >= total
        ? '当前余额为 AUD$' + accountBalance.toFixed(2) + '，可以支付本次申请。'
        : '当前余额为 AUD$' + accountBalance.toFixed(2) + '，余额不足';
    }
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
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cart-remove'; remove.dataset.cartRemove = id; remove.textContent = '移除';
      detail.append(name, meta); row.append(detail, remove); itemsBox.append(row);
    });
    submitBtn.textContent = cartIds.length ? '提交 ' + cartIds.length + ' 台设备申请' : '提交申请';
    refreshSummary();
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
  function updatePaymentMethodVisibility() {
    var useBalance = balancePaymentInput.checked && !balancePaymentInput.disabled;
    stripeSetupBox.hidden = useBalance;
    walletBox.hidden = useBalance || walletBox.getAttribute('data-available') !== 'true';
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
      var walletElement = walletElements.create('expressCheckout');
      walletElement.mount('#stripe-wallet-element');
      walletElement.on('ready', function (event) {
        var labels = { applePay: 'Apple Pay', googlePay: 'Google Pay', link: 'Link', paypal: 'PayPal' };
        var available = event.availablePaymentMethods ? Object.keys(labels).filter(function (method) { return event.availablePaymentMethods[method]; }).map(function (method) { return labels[method]; }) : [];
        if (!available.length) { walletElement.unmount(); return; }
        document.getElementById('stripe-wallet-title').textContent = available.length === 1 ? available[0] : '快捷支付';
        document.getElementById('stripe-wallet-description').textContent = '使用 ' + available.join('、') + ' 快速验证支付方式，不会在提交申请时扣款。';
        document.getElementById('stripe-wallet-badge').textContent = available.join(' / ').toUpperCase();
        walletBox.setAttribute('data-available', 'true');
        updatePaymentMethodVisibility();
      });
      walletElement.on('confirm', function () {
        walletMessage.textContent = '正在验证快捷支付方式…';
        stripe.confirmSetup({ elements: walletElements, confirmParams: { return_url: location.href }, redirect: 'if_required' })
          .then(function (result) {
            if (result.error) throw new Error(result.error.message || '快捷支付验证失败，请重试。');
            setupIntent = result.setupIntent;
            if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('快捷支付验证尚未完成，请重试。');
            setupIntentInput.value = setupIntent.id;
            cardReady = true; walletMessage.textContent = '快捷支付已验证。'; walletMessage.style.color = 'var(--secondary)'; clearCheckoutError();
          })
          .catch(function (error) {
            var message = error.message || 'Apple Pay 验证失败，请重试。';
            walletMessage.textContent = message; showFormError(message);
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
      cardElement.on('ready', function () { cardConfirm.disabled = false; setCardMessage('信用卡资料已加载，请填写后点击验证。'); });
      cardConfirm.addEventListener('click', function () {
        cardConfirm.disabled = true; cardConfirm.textContent = '验证中…'; setCardMessage('正在向 Stripe 验证支付方式…');
        stripe.confirmCardSetup(result.json.clientSecret, { payment_method: { card: cardElement, billing_details: { name: document.getElementById('contactName').value, email: document.getElementById('contactEmail').value, phone: document.getElementById('contactPhone').value } } }, { handleActions: true })
          .then(function (result) {
            if (result.error) throw new Error(result.error.message || '卡片验证失败，请检查信息。');
            setupIntent = result.setupIntent;
            if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('卡片验证尚未完成，请重试。');
            setupIntentInput.value = setupIntent.id;
            cardReady = true; cardConfirm.textContent = '信用卡已验证'; setCardMessage('信用卡已验证。', true); clearCheckoutError();
          })
          .catch(function (error) {
            var message = error.message || '卡片验证失败，请重试。';
            cardConfirm.disabled = false; cardConfirm.textContent = '验证信用卡'; setCardMessage(message); showFormError(message);
          });
      });
    })
    .catch(function (error) {
      var message = error.message || '安全付款组件暂不可用，请联系客服。';
      setCardMessage(message); showFormError(message);
    });
  ['change', 'input'].forEach(function (eventName) { [startD, endD, startP, endP].forEach(function (element) { element.addEventListener(eventName, function () { markCouponDirty(); refreshSummary(); }); }); });
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
  function validateContactFields(showError) {
    var message = passwordInput.value && passwordConfirmInput.value && passwordInput.value !== passwordConfirmInput.value
      ? '两次输入的密码不一致。' : '';
    passwordConfirmInput.setCustomValidity(message);
    if (message && showError) showFormError(message);
    return !message;
  }
  ['input', 'change'].forEach(function (eventName) {
    ['deliveryStreet', 'deliverySuburb', 'deliveryPostcode'].forEach(function (id) {
      document.getElementById(id).addEventListener(eventName, function () { validateDeliveryAddress(true); });
    });
  });
  [passwordInput, passwordConfirmInput].forEach(function (input) {
    input.addEventListener('input', function () { validateContactFields(true); });
  });
  method.dispatchEvent(new Event('change'));
  document.getElementById('coupon-check').addEventListener('click', function () {
    var code = document.getElementById('couponCode').value.trim();
    var hint = document.getElementById('coupon-hint');
    if (!code) { couponState = 'empty'; appliedDiscount = 0; hint.textContent = '请先输入优惠码。'; return; }
    couponState = 'checking';
    hint.textContent = '正在校验优惠码…';
    var params = new URLSearchParams({ deviceIds: JSON.stringify(cartIds), days: String(days()), code: code });
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
      .catch(function (error) { couponState = 'invalid'; appliedDiscount = 0; hint.textContent = error.message || '优惠码校验失败，请稍后重试。'; showFormError(hint.textContent); });
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
    if (days() < MIN_DAYS) {
      showFormError('租期不能少于 ' + MIN_DAYS + ' 天，请调整归还日期。'); errBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    var payload = {};
    new FormData(form).forEach(function (value, key) { payload[key] = value; });
    if (saveContactInfo.checked) {
      try { localStorage.setItem('geekslope-contact-v1', JSON.stringify({ name: payload.contactName || '', phone: payload.contactPhone || '', email: payload.contactEmail || '' })); } catch (_) {}
    }
    payload.deviceIds = cartIds.slice(); payload.deviceId = cartIds[0];
    payload.startDate = startD.value; payload.endDate = endD.value; payload.startPeriod = startP.value; payload.endPeriod = endP.value;
    var turnstileInput = form.querySelector('[name="cf-turnstile-response"]');
    if (turnstileInput) payload['cf-turnstile-response'] = turnstileInput.value;
    submitBtn.disabled = true; submitBtn.textContent = '提交中…';
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(readJsonResponse)
      .then(function (result) {
        if (result.ok && result.json && result.json.ok) {
          saveCart([]); form.hidden = true; doneMsg.textContent = result.json.message || '申请已提交，我们确认后会联系你。';
          if (result.json.orderNo) { document.getElementById('done-order-no').textContent = result.json.orderNo; credentialBox.hidden = false; }
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
