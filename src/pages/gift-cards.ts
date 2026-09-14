import { esc } from '../layout'

export interface GiftCardsData {
  giftCardUrl: string
}

export function renderGiftCards(data: GiftCardsData): string {
  const giftCardUrl = esc(data.giftCardUrl)
  return /* html */ `
<section class="page-hero compact gift-card-hero">
  <div class="wrap">
    <span class="eyebrow" data-i18n="giftCardEyebrow">GEEKSLOPE · 礼品卡</span>
    <h1>把下一次升级，<em>送给值得的人。</em></h1>
    <p data-i18n="giftCardIntro">购买一张 GeekSlope Square eGift Card，用于设备租赁；也可以随时查询余额或给现有礼品卡加值。</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${giftCardUrl}" target="_blank" rel="noopener" data-i18n="giftCardOpen">打开礼品卡页面 <span>↗</span></a>
      <a class="btn btn-ghost btn-lg" href="/products" data-i18n="giftCardRent">查看租赁设备</a>
    </div>
  </div>
</section>

<section class="section gift-card-section">
  <div class="wrap">
    <div class="section-head">
      <div><div class="kicker" data-i18n="giftCardKicker">SQUARE EGIFT CARD</div><h2 data-i18n="giftCardHeading">三个入口，一个礼品卡页面</h2></div>
      <p data-i18n="giftCardDescription">Square 托管支付、收件人与礼品卡交付。点击任一入口后，会在 Square 页面完成对应操作。</p>
    </div>
    <div class="gift-card-grid">
      <a class="gift-card-action" href="${giftCardUrl}" target="_blank" rel="noopener">
        <span class="gift-card-action-index">01 / BUY</span>
        <h3 data-i18n="giftCardBuy">购买礼品卡</h3>
        <p data-i18n="giftCardBuyText">选择金额、填写收件人和祝福语，付款后由 Square 发送数字礼品卡。</p>
        <b>购买 eGift Card <span>↗</span></b>
      </a>
      <a class="gift-card-action" href="${giftCardUrl}" target="_blank" rel="noopener">
        <span class="gift-card-action-index">02 / CHECK</span>
        <h3 data-i18n="giftCardCheck">查询余额</h3>
        <p data-i18n="giftCardCheckText">打开礼品卡页面，输入 16 位卡号和 PIN（如有）查看实时余额。</p>
        <b>查看卡片余额 <span>↗</span></b>
      </a>
      <a class="gift-card-action gift-card-action-accent" href="${giftCardUrl}" target="_blank" rel="noopener">
        <span class="gift-card-action-index">03 / LOAD</span>
        <h3 data-i18n="giftCardAdd">Add money</h3>
        <p data-i18n="giftCardAddText">已有礼品卡？在 Square 页面选择 Reload card，为卡片增加新的金额。</p>
        <b>Add money <span>↗</span></b>
      </a>
    </div>
  </div>
</section>

<section class="section alt gift-card-note-section">
  <div class="wrap gift-card-note">
    <div><span class="kicker" data-i18n="giftCardNoteKicker">HOW IT WORKS</span><h2 data-i18n="giftCardNoteTitle">礼品卡可以用于 GeekSlope 租赁</h2></div>
    <p data-i18n="giftCardNoteText">购买完成后，请保留礼品卡邮件中的卡号。下单或付款时选择 Square 礼品卡即可使用；余额不足时，可按页面提示完成差额支付。</p>
  </div>
</section>`
}
