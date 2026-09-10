// 官网登录页。同一账号体系与 rent 共用：登录后经 /sso/start → rent /sso/consume
// 在两个域名各自建立会话，用户直接进入 rent 用户中心，无需再次登录。
// 注册 / 忘记密码仍走 rent（${APP_URL}/register、/forgot-password）。

import { esc } from '../layout'

interface LoginData {
  appUrl: string
  error?: string
  notice?: string
  account?: string
}

export function renderLogin(data: LoginData): string {
  const { appUrl, error, notice, account } = data
  return /* html */ `
<section class="section">
  <div class="wrap form-wrap auth-wrap">
    <div class="section-head">
      <div class="kicker">账户</div>
      <h2>登录 GeekSlope</h2>
      <p style="color:var(--muted-fg);margin-top:12px">用你在 GeekSlope 的账号登录。登录后可直接进入用户中心查看订单、合同与付款，rent 端无需再次登录。</p>
    </div>

    ${notice ? `<div class="form-alert form-alert-ok">${esc(notice)}</div>` : ''}

    <form method="post" action="/login">
      ${error ? `<div class="form-alert">${esc(error)}</div>` : ''}
      <div class="form-card">
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
      </div>
    </form>

    <p class="form-note">
      还没有账号？<a href="${esc(appUrl)}/register" style="color:var(--primary)">去注册</a>
      &nbsp;·&nbsp;
      <a href="${esc(appUrl)}/forgot-password" style="color:var(--primary)">忘记密码</a>
    </p>
  </div>
</section>`
}
