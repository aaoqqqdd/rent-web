// 静态内容页：租赁说明、关于我们、404。文案随品牌走，不读库。

import { esc } from '../layout'
import type { SiteContact } from '../db'

export function renderRentalGuide(appUrl: string): string {
  return /* html */ `
<section class="section">
  <div class="wrap doc">
    <div class="kicker" style="color:var(--primary);font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">租赁说明</div>
    <h1>三步完成租赁</h1>
    <p class="lead">从挑选设备到收货，全程线上办理，墨尔本 CBD 及内城区最快当日送达。</p>

    <h2>01 · 选择设备</h2>
    <p>在<a href="/products" style="color:var(--primary)">产品目录</a>中按用途和配置筛选，游戏本、轻薄本、台式工作站均可按日或按月租用。</p>

    <h2>02 · 提交申请</h2>
    <p>登录后在下单页填写租期、收货方式与联系信息，在线提交。押金在租期结束、设备验收无误后原路退还。</p>

    <h2>03 · 确认配送</h2>
    <p>审核通过后我们专业包装并送货上门，最快当日达。送货上门仅限墨尔本 CBD 及周边内城区（如 Docklands、Southbank、South Yarra、Carlton、East Melbourne 等）；墨尔本其他郊区可预约到店自取。</p>

    <h2 id="faq">常见问题</h2>
    <ul>
      <li>送货上门仅限墨尔本 CBD 及周边内城区（Docklands、Southbank、South Yarra、Carlton 等）；墨尔本其他郊区可到店自取。</li>
      <li>最短租期通常为 1 天，具体以下单页提示为准。</li>
      <li>租期内正常损耗由我们承担；人为损坏按维修实际费用结算。</li>
      <li>设备故障提供 7×12 小时技术支持，符合条件的免费换机。</li>
      <li>续租请在到期前联系客服，避免产生逾期费用。</li>
    </ul>

    <p style="margin-top:40px"><a class="btn btn-primary" href="${esc(appUrl)}">立即开始租赁</a></p>
  </div>
</section>`
}

export function renderAbout(contact: SiteContact): string {
  return /* html */ `
<section class="section">
  <div class="wrap doc">
    <div class="kicker" style="color:var(--primary);font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">关于我们</div>
    <h1>${esc(contact.name)}</h1>
    <p class="lead">专业电脑出租平台，为学生和个人用户提供高品质设备租赁服务。</p>
    <p>我们相信好设备不该成为创作的门槛。GeekSlope 提供全新或翻新认证的笔记本与台式工作站，灵活的按日 / 按周 / 按月租期。送货上门仅限墨尔本 CBD 及周边内城区（Docklands、Southbank、South Yarra、Carlton 等）；墨尔本其他郊区可到店自取。</p>

    <h2 id="contact">联系我们</h2>
    <ul>
      <li>电话：${esc(contact.phone)}</li>
      <li>邮箱：<a href="mailto:${esc(contact.email)}" style="color:var(--primary)">${esc(contact.email)}</a></li>
      <li>配送：${esc(contact.address)}</li>
    </ul>
  </div>
</section>`
}

export function renderNotFound(): string {
  return /* html */ `
<section class="section closing">
  <div class="wrap">
    <h2>页面走丢了</h2>
    <p>你访问的地址不存在或已移动。</p>
    <a class="btn btn-primary btn-lg" href="/">返回首页</a>
  </div>
</section>`
}
