// 「立即租赁」下单页。设备在产品目录里选定后带 ?device= 进来，本页锁定该设备
// （像订酒店 / 订车：先选好具体那一台，再填租期 / 取还 / 联系方式），
// 提交后由前端 POST 到 rent 主应用的 /public/rental-request。

import { esc } from '../layout'
import type { Product, RentalConfig } from '../db'

interface ApplyData {
  products: Product[]
  selectedId: string
  config: RentalConfig
  appUrl: string
  turnstileSiteKey: string
}

export function renderApply(data: ApplyData): string {
  const { products, selectedId, config, appUrl, turnstileSiteKey } = data
  const rentable = products.filter((p) => p.pricePerDay > 0)

  if (!rentable.length) {
    return /* html */ `
    <section class="section">
      <div class="wrap form-wrap">
        <div class="section-head"><div class="kicker">立即租赁</div><h2>暂无可租设备</h2></div>
        <p style="color:var(--muted-fg)">产品目录正在更新，请稍后再试，或直接联系客服。</p>
      </div>
    </section>`
  }

  // 必须先在产品目录选定一台设备。没带 ?device= 或设备不可租时，引导回目录挑选。
  const device = rentable.find((p) => p.id === selectedId)
  if (!device) {
    return /* html */ `
    <section class="section">
      <div class="wrap form-wrap">
        <div class="section-head">
          <div class="kicker">立即租赁</div>
          <h2>请先选择要租的设备</h2>
          <p style="color:var(--muted-fg);margin-top:12px">和订酒店、订车一样，需要先从产品目录里选定具体的那一台设备，再填写租期与取还信息。</p>
        </div>
        <p style="margin-top:18px"><a class="btn btn-primary btn-lg" href="/products">去产品目录选设备</a></p>
      </div>
    </section>`
  }

  const specChips = [device.gpu, device.cpu, device.ram && `${device.ram} RAM`, device.storage]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .map((s) => `<span class="chip">${esc(s)}</span>`)
    .join('')

  const pickupField = config.pickupLocations.length
    ? `<select id="pickupLocation" name="pickupLocation">${config.pickupLocations
        .map((loc) => `<option value="${esc(loc)}">${esc(loc)}</option>`)
        .join('')}</select>`
    : `<input id="pickupLocation" name="pickupLocation" value="墨尔本 CBD 门店（下单后客服确认具体地址）" readonly>`

  const priceInfo = JSON.stringify({ day: device.pricePerDay, deposit: device.depositAmount, name: device.name })

  const turnstile = turnstileSiteKey
    ? `<div class="field"><div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}"></div></div>
       <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : ''

  return /* html */ `
<section class="section">
  <div class="wrap form-wrap">
    <div class="section-head">
      <div class="kicker">立即租赁</div>
      <h2>填写租赁信息</h2>
      <p style="color:var(--muted-fg);margin-top:12px">填写并注册后提交申请，订单进入待确认状态；管理员确认后会联系你安排在线签约与付款，全程无需线下跑腿。</p>
    </div>

    <form id="apply-form">
      <div class="form-alert" id="form-error" hidden></div>

      <div class="form-card">
        <div class="field">
          <label>已选设备</label>
          <div class="picked-device">
            <div>
              <strong>${esc(device.name)}</strong>${device.model ? ` <span style="color:var(--muted-fg)">· ${esc(device.model)}</span>` : ''}
              ${specChips ? `<div class="chips" style="margin-top:8px">${specChips}</div>` : ''}
            </div>
            <a class="btn btn-ghost btn-sm" href="/products">换一台</a>
          </div>
          <input type="hidden" id="deviceId" name="deviceId" value="${esc(device.id)}">
        </div>
        <div class="form-summary" id="summary"></div>
      </div>

      <div class="form-card">
        <div class="row2">
          <div class="field">
            <label for="startDate">取货日期</label>
            <input type="date" id="startDate" name="startDate" required>
          </div>
          <div class="field">
            <label for="startPeriod">取货时段</label>
            <select id="startPeriod" name="startPeriod"><option value="AM">上午</option><option value="PM">下午</option></select>
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label for="endDate">归还日期</label>
            <input type="date" id="endDate" name="endDate" required>
          </div>
          <div class="field">
            <label for="endPeriod">归还时段</label>
            <select id="endPeriod" name="endPeriod"><option value="AM">上午</option><option value="PM">下午</option></select>
          </div>
        </div>
        <p class="hint">最短租期 ${config.minimumRentalDays} 天。具体可用日期以合同签署页为准。</p>
      </div>

      <div class="form-card">
        <div class="field">
          <label for="deliveryMethod">取还方式</label>
          <select id="deliveryMethod" name="deliveryMethod">
            <option value="Pickup">到店自取（墨尔本全城可选）</option>
            <option value="Delivery">送货上门（仅限墨尔本 CBD 及内城区）</option>
          </select>
        </div>
        <div class="field" id="pickup-field">
          <label for="pickupLocation">自取门店</label>
          ${pickupField}
        </div>
        <div id="delivery-fields" hidden>
          <div class="field">
            <label for="deliveryStreet">街道地址</label>
            <input id="deliveryStreet" name="deliveryStreet" autocomplete="address-line1">
          </div>
          <div class="row3">
            <div class="field">
              <label for="deliverySuburb">Suburb</label>
              <input id="deliverySuburb" name="deliverySuburb" placeholder="如 Docklands / South Yarra">
            </div>
            <div class="field">
              <label for="deliveryState">州</label>
              <select id="deliveryState" name="deliveryState">
                <option>VIC</option><option>NSW</option><option>QLD</option><option>SA</option>
                <option>WA</option><option>TAS</option><option>NT</option><option>ACT</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="deliveryPostcode">邮编</label>
            <input id="deliveryPostcode" name="deliveryPostcode" inputmode="numeric" pattern="\\d{4}" placeholder="4 位数字">
          </div>
          <p class="hint">送货上门仅覆盖墨尔本 CBD 及周边内城区；其他郊区请选到店自取。运费由客服在审核时确认。</p>
        </div>
      </div>

      <div class="form-card">
        <p class="hint" style="margin-top:0">下单前需注册一个账号（用于后续付款与在线签约）。已注册过？填相同邮箱和密码即可。</p>
        <div class="row2">
          <div class="field">
            <label for="contactName">姓名</label>
            <input id="contactName" name="contactName" maxlength="120" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="contactPhone">联系电话</label>
            <input id="contactPhone" name="contactPhone" maxlength="40" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="contactEmail">邮箱（登录账号）</label>
          <input type="email" id="contactEmail" name="contactEmail" maxlength="200" autocomplete="email" required>
        </div>
        <div class="row2">
          <div class="field">
            <label for="password">设置密码</label>
            <input type="password" id="password" name="password" minlength="8" autocomplete="new-password" required>
            <p class="hint">至少 8 位，含字母、数字和符号。</p>
          </div>
          <div class="field">
            <label for="password2">确认密码</label>
            <input type="password" id="password2" autocomplete="new-password" required>
          </div>
        </div>
        <div class="field">
          <label for="couponCode">优惠码（选填）</label>
          <input id="couponCode" name="couponCode" maxlength="40">
        </div>
        <div class="field">
          <label for="rentalNote">备注（选填）</label>
          <textarea id="rentalNote" name="rentalNote" maxlength="500" placeholder="例如期望配送时间、用途等"></textarea>
        </div>
        <div class="field" style="display:flex;gap:8px;align-items:flex-start">
          <input type="checkbox" id="agree" name="agree" value="1" style="width:auto;margin-top:3px" required>
          <label for="agree" style="font-weight:400;margin:0">我已阅读并同意
            <a href="${esc(appUrl)}/terms" target="_blank" rel="noopener" style="color:var(--primary)">服务条款</a> 与
            <a href="${esc(appUrl)}/privacy" target="_blank" rel="noopener" style="color:var(--primary)">隐私政策</a>。</label>
        </div>
        ${turnstile}
        <p class="hint">提交后订单进入待确认状态，管理员确认后会联系你安排签约与付款。个人信息仅用于本次租赁。</p>
      </div>

      <button type="submit" class="btn btn-primary btn-lg" id="submit-btn" style="margin-top:20px">注册并提交申请</button>
      <p class="form-note">遇到问题？可返回 <a href="/products" style="color:var(--primary)">产品目录</a> 或联系客服。</p>
    </form>

    <div class="form-card" id="apply-done" hidden style="margin-top:18px">
      <h3 style="margin-bottom:8px">申请已提交 ✓</h3>
      <p id="apply-done-msg" style="color:var(--muted-fg);font-size:14px"></p>
      <p style="margin-top:14px"><a class="btn btn-ghost" href="/products">继续浏览产品</a></p>
    </div>
  </div>
</section>

<script>
(() => {
  var PRICE = ${priceInfo};
  var ENDPOINT = ${JSON.stringify(`${appUrl}/public/rental-request`)};
  var MIN_DAYS = ${config.minimumRentalDays};
  var form = document.getElementById('apply-form');
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

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  startD.min = todayStr(); endD.min = todayStr();

  function days() {
    if (!startD.value || !endD.value) return 0;
    var a = new Date(startD.value + 'T00:00:00Z'), b = new Date(endD.value + 'T00:00:00Z');
    var half = Math.round((b - a) / 86400000) * 2 + (endP.value === 'PM' ? 1 : 0) - (startP.value === 'PM' ? 1 : 0);
    return half > 0 ? Math.ceil(half / 2) : 0;
  }
  function refresh() {
    var p = PRICE;
    var n = days();
    if (!n) { summary.innerHTML = '<strong>' + p.name + '</strong> · $' + p.day + '/day · 押金 $' + p.deposit + '（可退）'; return; }
    var rent = n * p.day;
    summary.innerHTML = '<strong>' + p.name + '</strong> · ' + n + ' 天 · 租金 $' + rent.toFixed(2) +
      ' + 押金 $' + p.deposit.toFixed(2) + ' = <strong>应付 $' + (rent + p.deposit).toFixed(2) + '</strong>' +
      (n < MIN_DAYS ? ' <span style="color:#ff9a9a">（低于最短租期 ' + MIN_DAYS + ' 天）</span>' : '');
  }
  ['change', 'input'].forEach(function (ev) {
    [startD, endD, startP, endP].forEach(function (el) { el.addEventListener(ev, refresh); });
  });
  method.addEventListener('change', function () {
    var delivery = method.value === 'Delivery';
    deliveryFields.hidden = !delivery;
    pickupField.hidden = delivery;
  });
  refresh();

  var pw = document.getElementById('password');
  var pw2 = document.getElementById('password2');
  var doneBox = document.getElementById('apply-done');
  var doneMsg = document.getElementById('apply-done-msg');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.hidden = true;
    if (pw.value !== pw2.value) {
      errBox.textContent = '两次输入的密码不一致。';
      errBox.hidden = false;
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    var ts = form.querySelector('[name="cf-turnstile-response"]');
    if (ts) data['cf-turnstile-response'] = ts.value;
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          form.hidden = true;
          doneMsg.textContent = res.j.message || '申请已提交，管理员确认后会联系你。';
          doneBox.hidden = false;
          doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        throw new Error((res.j && res.j.message) || '提交失败，请稍后重试。');
      })
      .catch(function (err) {
        errBox.textContent = err.message || '提交失败，请稍后重试。';
        errBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '注册并提交申请';
        errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  });
})();
</script>`
}
