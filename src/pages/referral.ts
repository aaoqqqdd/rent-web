import { esc } from '../layout'
import type { ReferralConfig } from '../db'

export function renderReferral(config: ReferralConfig, appUrl: string): string {
  const referralUrl = `${appUrl}/customer/referral`
  const rate = config.rate === null ? null : `${config.rate}%`
  const exampleReward = config.rate === null ? null : (1000 * config.rate / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return /* html */ `
<section class="page-hero referral-hero">
  <div class="wrap referral-hero-grid">
    <div>
      <span class="eyebrow">GEEKSLOPE · 推广计划</span>
      <h1>好设备，值得分享。<em>朋友下单，你得分成。</em></h1>
      <p>把 GeekSlope 推荐给需要电脑的朋友。通过你的邀请码注册并完成符合条件的租赁订单后，你就能获得推广分成。</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="${esc(referralUrl)}">进入推广中心 <span aria-hidden="true">↗</span></a>
        <a class="btn btn-ghost btn-lg" href="#how-to-refer">了解参与方式</a>
      </div>
      <p class="referral-account-note">还没有账号？ <a class="inline-link" href="/login?tab=register">先注册 GeekSlope 账号</a></p>
    </div>
    <aside class="referral-receipt" aria-labelledby="referral-rate-title">
      <div class="referral-receipt-head"><span class="section-code">SHARE / EARN</span><span class="referral-receipt-dot" aria-hidden="true"></span></div>
      <h2 id="referral-rate-title">你的推广分成</h2>
      ${rate === null ? '<strong class="referral-rate-unavailable">分成比例暂不可用</strong><p>请到推广中心查看当前比例，或联系客服确认。</p>' : `<strong class="referral-rate">${esc(rate)}</strong><p>按符合条件的订单金额计算，不含押金。</p>
      <div class="referral-example"><span>分成示例</span><dl><div><dt>符合条件的金额</dt><dd>A$1,000.00</dd></div><div><dt>分成比例</dt><dd>${esc(rate)}</dd></div><div class="referral-example-total"><dt>预计分成</dt><dd>A$${esc(exampleReward)}</dd></div></dl><small>仅为计算示例，实际分成以订单结算为准。</small></div>`}
      <div class="referral-withdraw-min"><span>最低提现金额</span><strong>A$100</strong><span>100 澳元</span></div>
    </aside>
  </div>
</section>

<section class="section" id="how-to-refer">
  <div class="wrap">
    <div class="section-head"><div><div class="kicker">参与方式</div><h2>从一次分享开始</h2></div><p>邀请码用于确认推荐关系，记得让朋友在注册时填写。</p></div>
    <div class="steps referral-steps">
      <article class="step"><span class="n">01</span><h3>领取你的邀请码</h3><p>登录 Dashboard，打开「推荐计划」并加入，即可查看自己的邀请码和推荐链接。</p><a class="inline-link" href="${esc(referralUrl)}">查看我的邀请码</a></article>
      <article class="step"><span class="n">02</span><h3>分享给需要的朋友</h3><p>分享你的推荐链接，或让朋友在注册时填写你的邀请码，再选择设备并提交租赁申请。</p><a class="inline-link" href="/products">浏览可租设备</a></article>
      <article class="step"><span class="n">03</span><h3>订单结算，获得分成</h3><p>好友完成符合条件的租赁订单后，分成进入结算流程。可提现分成累计达到 A$100 后，即可申请提现。</p><a class="inline-link" href="${esc(referralUrl)}">查看分成与提现</a></article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap referral-settlement">
    <div><div class="kicker">分成与提现</div><h2>分享有回报，结算有记录。</h2><p>在推广中心查看推荐记录、待结算分成和可提现金额，再按页面提示提交提现申请。</p></div>
    <dl class="referral-rules">
      <div><dt>分成比例</dt><dd>${rate === null ? '请到推广中心确认' : esc(rate)}</dd></div>
      <div><dt>结算周期</dt><dd>${config.settlementDays === null ? '请到推广中心确认' : esc(`${config.settlementDays} 天`)}</dd></div>
      <div><dt>最低提现金额</dt><dd>A$100 <small>（100 澳元）</small></dd></div>
    </dl>
    <p class="referral-settlement-note">订单完成后，分成需经过结算周期及必要审核，才会计入可提现金额。待结算金额不计入提现门槛，取消或退款的订单可能影响最终分成。</p>
  </div>
</section>

<section class="section">
  <div class="wrap faq-layout">
    <div class="faq-intro"><div class="kicker">常见问题</div><h2>分享之前，先了解这些。</h2><p>有其他问题？<a class="inline-link" href="/about#contact">联系我们</a></p></div>
    <div class="faq-list">
      <details><summary>朋友要怎么填写邀请码？</summary><p>朋友可通过你的推荐链接注册，或在注册页面的「邀请码（选填）」中填写你的邀请码。请在注册时完成，方便确认推荐关系。</p></details>
      <details><summary>朋友提交申请后，我就能拿到分成吗？</summary><p>提交申请不等于完成租赁。订单需经审核、签约付款并完成租赁，再按推广规则结算；实际可结算订单和金额以推广中心记录为准。</p></details>
      <details><summary>押金也会计算分成吗？</summary><p>不会。分成按符合条件的订单金额计算，不包含设备押金。</p></details>
      <details><summary>分成不足 A$100 可以提现吗？</summary><p>最低提现金额为 A$100（100 澳元）。可提现分成不足 A$100 时，可继续累计，达到门槛后再提交提现申请。</p></details>
      <details><summary>在哪里查看推荐记录和申请提现？</summary><p>登录 Dashboard 的「推荐计划」，即可查看邀请码、推荐记录、分成状态及提现入口。</p></details>
    </div>
  </div>
</section>

<section class="closing">
  <div class="wrap"><div class="kicker">GEEKSLOPE · 推广计划</div><h2>下一次推荐，让分享有回报。</h2><p>从你的邀请码开始，把合适的设备推荐给需要的朋友。</p><div class="hero-actions"><a class="btn btn-primary btn-lg" href="${esc(referralUrl)}">进入推广中心 <span aria-hidden="true">↗</span></a><a class="btn btn-ghost btn-lg" href="/about#contact">咨询推广计划</a></div></div>
</section>`
}
