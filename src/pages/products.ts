// 产品目录。实时读库，按类别分组展示全部在售设备。

import { esc } from '../layout'
import { monthlyRate, type Product } from '../db'

function card(p: Product, appUrl: string, multiplier: number): string {
  const daily = p.pricePerDay > 0 ? `$${p.pricePerDay}/day` : '询价'
  const monthly = p.pricePerDay > 0 ? `$${monthlyRate(p.pricePerDay, multiplier)}/month` : '—'
  const chips = p.specs.slice(0, 5).map((s) => `<span class="chip">${esc(s)}</span>`).join('')
  const rentHref = p.id ? `/apply?device=${encodeURIComponent(p.id)}` : '/apply'
  return /* html */ `
  <article class="card">
    <span class="tag">${p.available ? '现货可租' : '可预约'}</span>
    <h3>${esc(p.name)}</h3>
    <p class="sub">${esc(p.categoryLabel)}${p.model ? ` · ${esc(p.model)}` : ''}</p>
    <div class="chips">${chips || '<span class="chip">配置待更新</span>'}</div>
    <div class="price-row">
      <div><div class="lbl">日租</div><div class="val">${esc(daily)}</div></div>
      <div><div class="lbl">月租</div><div class="val">${esc(monthly)} <small>参考</small></div></div>
    </div>
    ${p.depositAmount > 0 ? `<div class="deposit">押金 $${esc(p.depositAmount)}（可退）</div>` : ''}
    <a class="btn btn-primary" href="${rentHref}">立即租赁</a>
  </article>`
}

const GROUP_ORDER: Array<[Product['category'], string]> = [
  ['gaming', '游戏笔记本'],
  ['ultrabook', '轻薄商务本'],
  ['workstation', '台式工作站'],
]

interface ProductsData {
  products: Product[]
  appUrl: string
  multiplier: number
}

export function renderProducts(data: ProductsData): string {
  const { products, appUrl, multiplier } = data

  const groups = GROUP_ORDER.map(([cat, label]) => ({
    label,
    items: products.filter((p) => p.category === cat),
  })).filter((g) => g.items.length)

  const body = groups.length
    ? groups
        .map(
          (g) => `
    <div class="section-head" style="margin-top:56px">
      <div class="kicker">${esc(g.label)}</div>
      <h2>${esc(g.label)} · ${g.items.length} 款</h2>
    </div>
    <div class="grid">${g.items.map((p) => card(p, appUrl, multiplier)).join('')}</div>`,
        )
        .join('')
    : '<p style="color:var(--muted-fg);margin-top:40px">产品目录正在更新，请稍后再来。</p>'

  return /* html */ `
<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">产品目录</div>
      <h2>全部设备</h2>
      <p style="color:var(--muted-fg);margin-top:12px">价格与配置实时同步自库存系统。月租为参考价，实际计费以下单页为准。</p>
    </div>
    ${body}
  </div>
</section>`
}
