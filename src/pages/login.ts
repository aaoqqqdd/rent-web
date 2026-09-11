// 独立的注册 / 登录页（路由 /login，别名 /register 302 到此）。
//
// 注册：真表单，前端 JSON POST 到本站 /register，服务端直接写 rent 的 D1 users 表
//       （见 ../auth.ts），落库结果与 rent /register 等价。
// 登录：本站校验共享账号并建立会话，再经 /sso/start → rent /sso/consume
//       在两个域名建立登录态。

import { esc } from '../layout'

interface LoginData {
  appUrl: string
  turnstileSiteKey: string
  /** 初始展示的面板：register | login。 */
  tab: 'register' | 'login'
  error?: string
  notice?: string
  account?: string
}

export function renderLogin(data: LoginData): string {
  const { appUrl, turnstileSiteKey, tab, error, notice, account } = data
  const forgotUrl = `${appUrl}/forgot-password`

  const turnstile = turnstileSiteKey
    ? `<div class="field"><div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}"></div></div>
       <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : ''
  return /* html */ `
<section class="section">
  <div class="wrap form-wrap auth-wrap">
    <div class="section-head">
      <div class="kicker">账号</div>
      <h2>注册 / 登录</h2>
      <p style="color:var(--muted-fg);margin-top:12px">
        下单前需注册一个账号（用于后续付款与在线签约）。已注册过？直接登录即可，
        无需重复填写。注册后可用同一套邮箱和密码在下单页与账户中心通用。
      </p>
    </div>

    <div class="auth-tabs" role="tablist">
      <button type="button" class="auth-tab${tab === 'register' ? ' is-active' : ''}" data-tab="register" role="tab">注册新账号</button>
      <button type="button" class="auth-tab${tab === 'login' ? ' is-active' : ''}" data-tab="login" role="tab">已有账号 · 登录</button>
    </div>

    <!-- ============ 注册 ============ -->
    <div class="auth-panel${tab === 'register' ? '' : ' is-hidden'}" data-panel="register">
      <form id="register-form" class="form-card" novalidate>
        <div class="form-alert" id="reg-error" hidden></div>

        <div class="field">
          <label for="reg-name">姓名</label>
          <input id="reg-name" name="name" maxlength="120" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="reg-email">邮箱（登录账号）</label>
          <input type="email" id="reg-email" name="email" maxlength="200" autocomplete="email" required>
        </div>
        <div class="row2">
          <div class="field">
            <label for="reg-phone">联系电话（选填）</label>
            <input id="reg-phone" name="phone" maxlength="40" autocomplete="tel">
          </div>
          <div class="field">
            <label for="reg-referral">邀请码（选填）</label>
            <input id="reg-referral" name="referral" maxlength="10" autocapitalize="characters" style="text-transform:uppercase">
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label for="reg-pw">设置密码</label>
            <input type="password" id="reg-pw" name="password" minlength="8" autocomplete="new-password" required>
            <p class="hint">至少 8 位，含字母、数字和符号。</p>
          </div>
          <div class="field">
            <label for="reg-pw2">确认密码</label>
            <input type="password" id="reg-pw2" name="passwordConfirm" minlength="8" autocomplete="new-password" required>
          </div>
        </div>

        <div class="field" style="display:flex;gap:8px;align-items:flex-start">
          <input type="checkbox" id="reg-agree" name="agree" value="1" style="width:auto;margin-top:3px" required>
          <label for="reg-agree" style="font-weight:400;margin:0">我已阅读并同意
            <a href="/service-terms" target="_blank" rel="noopener" style="color:var(--primary)">服务条款</a> 与
            <a href="/privacy" target="_blank" rel="noopener" style="color:var(--primary)">隐私政策</a>。</label>
        </div>

        ${turnstile}

        <button type="submit" class="btn btn-primary btn-lg" id="reg-submit" style="margin-top:8px">创建账号</button>
        <p class="form-note">创建账号即写入租赁系统；随后可直接 <a href="#" data-tab-link="login" style="color:var(--primary)">登录</a> 或前往 <a href="/apply" style="color:var(--primary)">下单页</a>。</p>
      </form>

      <div class="form-card" id="reg-done" hidden style="margin-top:18px">
        <h3 style="margin-bottom:8px">账号创建成功 ✓</h3>
        <p id="reg-done-msg" style="color:var(--muted-fg);font-size:14px"></p>
        <p style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn btn-primary" href="/login?tab=login">立即登录</a>
          <a class="btn btn-ghost" href="/apply">去下单</a>
        </p>
      </div>
    </div>

    <!-- ============ 登录 ============ -->
    <div class="auth-panel${tab === 'login' ? '' : ' is-hidden'}" data-panel="login">
      ${notice ? `<div class="form-alert form-alert-ok">${esc(notice)}</div>` : ''}
      <form method="post" action="/login" class="form-card">
        ${error ? `<div class="form-alert">${esc(error)}</div>` : ''}
        <div class="field">
          <label for="account">邮箱或手机号</label>
          <input id="account" name="account" autocomplete="username" required maxlength="254" value="${esc(account ?? '')}">
        </div>
        <div class="field">
          <label for="password">密码</label>
          <input type="password" id="password" name="password" autocomplete="current-password" required minlength="8">
        </div>
        <div class="field" style="display:flex;gap:8px;align-items:center">
          <input type="checkbox" id="remember" name="remember" value="1" style="width:auto">
          <label for="remember" style="font-weight:400;margin:0">记住此设备 30 天</label>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="margin-top:6px;width:100%">登录</button>
        <p class="form-note"><a href="${esc(forgotUrl)}" style="color:var(--primary)">忘记密码</a> · 还没有账号？<a href="#" data-tab-link="register" style="color:var(--primary)">注册新账号</a></p>
      </form>
    </div>
  </div>
</section>

<script>
(() => {
  var ENDPOINT = '/register';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.auth-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.auth-panel'));

  function show(name) {
    tabs.forEach(function (t) { t.classList.toggle('is-active', t.dataset.tab === name); });
    panels.forEach(function (p) { p.classList.toggle('is-hidden', p.dataset.panel !== name); });
    if (history.replaceState) history.replaceState(null, '', name === 'login' ? '?tab=login' : location.pathname);
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
  document.querySelectorAll('[data-tab-link]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); show(a.getAttribute('data-tab-link')); });
  });

  var form = document.getElementById('register-form');
  var errBox = document.getElementById('reg-error');
  var submitBtn = document.getElementById('reg-submit');
  var pw = document.getElementById('reg-pw');
  var pw2 = document.getElementById('reg-pw2');
  var doneBox = document.getElementById('reg-done');
  var doneMsg = document.getElementById('reg-done-msg');

  function fail(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.hidden = true;

    var name = form.name.value.trim();
    var email = form.email.value.trim();
    if (!name || !email) { fail('请填写姓名和邮箱。'); return; }
    if (pw.value.length < 8) { fail('密码至少 8 位。'); return; }
    if (!/(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])/.test(pw.value)) { fail('密码需同时包含字母、数字和符号。'); return; }
    if (pw.value !== pw2.value) { fail('两次输入的密码不一致。'); return; }
    if (!form.agree.checked) { fail('请先阅读并同意服务条款与隐私政策。'); return; }

    var payload = {
      name: name,
      email: email,
      phone: form.phone.value.trim(),
      referral: form.referral.value.trim().toUpperCase(),
      password: pw.value,
      passwordConfirm: pw2.value,
      agree: true
    };
    var ts = form.querySelector('[name="cf-turnstile-response"]');
    if (ts) payload.turnstileToken = ts.value;

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.j && res.j.ok) {
          form.hidden = true;
          doneMsg.textContent = res.j.message || '账号已创建，请前往登录。';
          doneBox.hidden = false;
          doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = '创建账号';
        if (res.j && res.j.code === 'exists') {
          fail('该邮箱已注册。请切换到「已有账号 · 登录」。');
          return;
        }
        fail((res.j && res.j.message) || '注册失败，请稍后重试。');
        if (window.turnstile) try { window.turnstile.reset(); } catch (_) {}
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = '创建账号';
        fail('网络错误，请稍后重试。');
      });
  });
})();
</script>`
}
