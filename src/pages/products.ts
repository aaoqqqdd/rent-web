// 产品目录。实时读库，按类别分组展示全部在售设备。

import { esc } from '../layout'
import { monthlyRate, type Product } from '../db'

function card(p: Product, multiplier: number): string {
  const daily = p.pricePerDay > 0 ? `$${p.pricePerDay}/day` : '询价'
  const monthly = p.pricePerDay > 0 ? `$${monthlyRate(p.pricePerDay, multiplier)}/month` : '—'
  const chips = p.specs.slice(0, 5).map((s) => `<span class="chip">${esc(s)}</span>`).join('')
  const detailHref = p.id ? `/products/${encodeURIComponent(p.id)}` : '/products'
  const searchText = [p.name, p.brand, p.model, p.categoryLabel, ...p.specs].join(' ').toLowerCase()
  return /* html */ `
  <article class="card product-card" data-product data-category="${esc(p.category)}" data-available="${p.available ? 'true' : 'false'}" data-price="${p.pricePerDay}" data-name="${esc(p.name.toLowerCase())}" data-search="${esc(searchText)}">
    <div class="product-visual" aria-hidden="true">
      <span class="device-screen"><i></i></span>
      <span class="device-base"></span>
      <span class="visual-code">${esc(p.category === 'workstation' ? 'WS' : p.category === 'gaming' ? 'RTX' : 'MOB')}</span>
    </div>
    <div class="card-top"><span class="tag ${p.available ? '' : 'tag-muted'}"><i></i>${p.available ? '现货可租' : '可预约'}</span><span class="card-code">${esc(p.brand || p.categoryLabel)}</span></div>
    <h3><a href="${detailHref}">${esc(p.name)}</a></h3>
    <p class="sub">${esc(p.categoryLabel)}${p.model ? ` · ${esc(p.model)}` : ''}</p>
    <div class="chips">${chips || '<span class="chip">配置待更新</span>'}</div>
    <div class="price-row">
      <div><div class="lbl">日租</div><div class="val">${esc(daily)}</div></div>
      <div><div class="lbl">月租</div><div class="val">${esc(monthly)} <small>参考</small></div></div>
    </div>
    ${p.depositAmount > 0 ? `<div class="deposit">押金 $${esc(p.depositAmount)}（可退）</div>` : ''}
    <div class="card-actions">
      <a class="btn btn-ghost" href="${detailHref}">查看详情</a>
      <button class="btn btn-primary" type="button" data-cart-add data-device-id="${esc(p.id)}" aria-pressed="false">加入购物车</button>
    </div>
  </article>`
}

const GROUP_ORDER: Array<[Product['category'], string]> = [
  ['gaming', '游戏笔记本'],
  ['ultrabook', '轻薄商务本'],
  ['workstation', '台式工作站'],
]

interface ProductsData {
  products: Product[]
  multiplier: number
}

export function renderProducts(data: ProductsData): string {
  const { products, multiplier } = data
  const categoryCounts = new Map(GROUP_ORDER.map(([category]) => [category, products.filter((p) => p.category === category).length]))
  const cards = products.length
    ? products.map((p) => card(p, multiplier)).join('')
    : '<div class="empty-state"><strong>设备库正在更新</strong><p>暂时没有可展示的设备，请稍后再来或直接联系我们。</p><a class="btn btn-ghost" href="/contact">联系顾问</a></div>'

  return /* html */ `
<section class="page-hero compact">
  <div class="wrap">
    <div class="kicker">实时设备库</div>
    <h1>找到适合这一段旅程的电脑</h1>
    <p>配置、日租价与库存状态直接同步。按用途筛选，再查看完整规格和费用说明。</p>
  </div>
</section>
<section class="section products-section">
  <div class="wrap">
    <div class="catalog-tools" aria-label="产品筛选">
      <label class="search-box" for="product-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
        <input id="product-search" type="search" placeholder="搜索型号、CPU、显卡…" autocomplete="off">
      </label>
      <div class="filter-chips" id="category-filters">
        <button class="filter-chip is-active" type="button" data-category="all">全部 <span>${products.length}</span></button>
        ${GROUP_ORDER.map(([cat, label]) => `<button class="filter-chip" type="button" data-category="${cat}">${label} <span>${categoryCounts.get(cat) || 0}</span></button>`).join('')}
      </div>
      <div class="tool-tail">
        <label class="stock-toggle"><input id="stock-only" type="checkbox"><span>只看现货</span></label>
        <select id="product-sort" aria-label="排序方式"><option value="default">默认排序</option><option value="price">价格从低到高</option><option value="name">名称排序</option></select>
      </div>
    </div>
    <div class="catalog-meta"><strong id="result-count">${products.length}</strong> 台设备<span>月租为参考价，最终费用以确认订单为准</span></div>
    <div class="grid catalog-grid" id="product-grid">${cards}</div>
    <div class="empty-state" id="filter-empty" hidden><strong>没有匹配的设备</strong><p>试试更短的关键词，或清除筛选条件。</p><button class="btn btn-ghost" type="button" id="clear-filters">清除筛选</button></div>
  </div>
</section>
<section class="info-band"><div class="wrap"><div><span>不知道选哪台？</span><strong>告诉我们用途、软件和预算，帮你匹配配置。</strong></div><a class="btn btn-light" href="/contact">咨询设备顾问</a></div></section>
<script>
(() => {
  var grid = document.getElementById('product-grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-product]'));
  var search = document.getElementById('product-search');
  var stock = document.getElementById('stock-only');
  var sort = document.getElementById('product-sort');
  var count = document.getElementById('result-count');
  var empty = document.getElementById('filter-empty');
  var activeCategory = new URLSearchParams(location.search).get('category') || 'all';

  function apply() {
    var term = search.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (card) {
      var matchCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
      var matchSearch = !term || card.dataset.search.indexOf(term) !== -1;
      var matchStock = !stock.checked || card.dataset.available === 'true';
      var visible = matchCategory && matchSearch && matchStock;
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    count.textContent = String(shown);
    empty.hidden = shown !== 0 || cards.length === 0;
  }

  function setCategory(category) {
    activeCategory = ['gaming', 'ultrabook', 'workstation'].indexOf(category) >= 0 ? category : 'all';
    document.querySelectorAll('[data-category]').forEach(function (button) {
      if (button.tagName === 'BUTTON') button.classList.toggle('is-active', button.dataset.category === activeCategory);
    });
    var url = new URL(location.href);
    if (activeCategory === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', activeCategory);
    history.replaceState(null, '', url.pathname + url.search);
    apply();
  }

  document.querySelectorAll('#category-filters [data-category]').forEach(function (button) {
    button.addEventListener('click', function () { setCategory(button.dataset.category); });
  });
  search.addEventListener('input', apply);
  stock.addEventListener('change', apply);
  sort.addEventListener('change', function () {
    var ordered = cards.slice();
    if (sort.value === 'price') ordered.sort(function (a, b) { return Number(a.dataset.price) - Number(b.dataset.price); });
    if (sort.value === 'name') ordered.sort(function (a, b) { return a.dataset.name.localeCompare(b.dataset.name, 'zh-CN'); });
    ordered.forEach(function (card) { grid.appendChild(card); });
  });
  document.getElementById('clear-filters').addEventListener('click', function () {
    search.value = ''; stock.checked = false; sort.value = 'default'; setCategory('all');
  });
  setCategory(activeCategory);
})();
</script>`
}
