// 产品目录。实时读库，按类别分组展示全部在售设备。

import { esc } from '../layout'
import { bestDiscountedDailyOffer, monthlyRentalRate, weeklyRentalRate, type Product } from '../db'

function card(p: Product): string {
  const dailyOffer = bestDiscountedDailyOffer(p.pricePerDay, p.weeklyDiscountPercent, p.monthlyDiscountPercent)
  const daily = p.pricePerDay > 0
    ? dailyOffer
      ? `<del class="price-original">$${p.pricePerDay.toFixed(2)}/day</del><strong>$${dailyOffer.rate.toFixed(2)}/day</strong><small>${dailyOffer.label}</small>`
      : `$${p.pricePerDay}/day`
    : '询价'
  const weeklyOriginal = p.pricePerDay * 7
  const monthlyOriginal = p.pricePerDay * 30
  const weekly = p.pricePerDay > 0 ? `$${weeklyRentalRate(p.pricePerDay, p.weeklyDiscountPercent)}/week` : '—'
  const monthly = p.pricePerDay > 0 ? `$${monthlyRentalRate(p.pricePerDay, p.monthlyDiscountPercent)}/month` : '—'
  const chips = p.specs.slice(0, 5).map((s) => `<span class="chip">${esc(s)}</span>`).join('')
  const detailHref = p.id ? `/products/${encodeURIComponent(p.id)}` : '/products'
  const searchText = [p.name, p.brand, p.model, p.categoryLabel, p.cpu, p.gpu, p.ram, p.storage, p.os, p.description].join(' ').toLowerCase()
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
      <div><div class="lbl">日租</div><div class="val">${typeof daily === 'string' && daily.startsWith('<') ? daily : esc(daily)}</div></div>
      <div><div class="lbl">周租</div><div class="val">${p.weeklyDiscountPercent > 0 ? `<del class="price-original">$${weeklyOriginal.toFixed(2)}/week</del>` : ''}${esc(weekly)} <small>${p.weeklyDiscountPercent > 0 ? `折后${p.weeklyDiscountPercent}%` : '7 天参考'}</small></div></div>
      <div><div class="lbl">月租</div><div class="val">${p.monthlyDiscountPercent > 0 ? `<del class="price-original">$${monthlyOriginal.toFixed(2)}/month</del>` : ''}${esc(monthly)} <small>${p.monthlyDiscountPercent > 0 ? `折后${p.monthlyDiscountPercent}%` : '参考'}</small></div></div>
    </div>
    ${p.depositAmount > 0 ? `<div class="deposit">押金 $${esc(p.depositAmount)}（可退）</div>` : ''}
    <div class="card-actions">
      <a class="btn btn-ghost" href="${detailHref}">查看详情</a>
      <a class="btn btn-primary" href="${detailHref}">选择租期</a>
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
  couponCode?: string
}

export function renderProducts(data: ProductsData): string {
  const { products, couponCode } = data
  const categoryCounts = new Map(GROUP_ORDER.map(([category]) => [category, products.filter((p) => p.category === category).length]))
  const cards = products.length
    ? products.map((p) => card(p)).join('')
    : '<div class="empty-state"><strong>设备库正在更新</strong><p>暂时没有可展示的设备，请稍后再来或直接联系我们。</p><a class="btn btn-ghost" href="/about#contact">联系顾问</a></div>'

  return /* html */ `
<section class="page-hero compact">
  <div class="wrap">
    <div class="kicker">实时设备库</div>
    <h1>${couponCode ? `参与优惠码 ${esc(couponCode)} 的设备` : '找到适合这一段旅程的电脑'}</h1>
    <p>${couponCode ? '以下设备可使用当前优惠码，选择后即可在结账时自动校验。' : '配置、日租价与库存状态直接同步。按用途筛选，再查看完整规格和费用说明。'}</p>
  </div>
</section>
<section class="section products-section">
  <div class="wrap">
    <div class="catalog-tools" role="search" aria-label="搜索和筛选租赁设备">
      <label class="search-box" for="product-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
        <input id="product-search" type="search" placeholder="搜索型号、CPU、显卡、操作系统…" autocomplete="off" aria-label="搜索租赁设备" aria-controls="product-grid" enterkeyhint="search">
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
    <div class="catalog-meta"><strong id="result-count" aria-live="polite">${products.length}</strong> 台设备<span>月租为参考价，最终费用以确认订单为准</span></div>
    <div class="grid catalog-grid" id="product-grid">${cards}</div>
    <div class="empty-state" id="filter-empty" hidden><strong>没有匹配的设备</strong><p>试试更短的关键词，或清除筛选条件。</p><button class="btn btn-ghost" type="button" id="clear-filters">清除筛选</button></div>
  </div>
</section>
<section class="info-band"><div class="wrap"><div><span>不知道选哪台？</span><strong>告诉我们用途、软件和预算，帮你匹配配置。</strong></div><a class="btn btn-light" href="/about#contact">咨询设备顾问</a></div></section>
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
  var initialParams = new URLSearchParams(location.search);
  var activeCategory = initialParams.get('category') || 'all';
  search.value = initialParams.get('q') || '';

  function normalize(value) {
    return String(value || '').normalize('NFKD').toLowerCase().replace(/\\s+/g, ' ').trim();
  }

  function apply() {
    var term = normalize(search.value);
    var terms = term ? term.split(' ') : [];
    var shown = 0;
    cards.forEach(function (card) {
      var matchCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
      var haystack = normalize(card.dataset.search);
      var matchSearch = terms.every(function (word) { return haystack.indexOf(word) !== -1; });
      var matchStock = !stock.checked || card.dataset.available === 'true';
      var visible = matchCategory && matchSearch && matchStock;
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    count.textContent = String(shown);
    empty.hidden = shown !== 0 || cards.length === 0;
    var url = new URL(location.href);
    if (term) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
    history.replaceState(null, '', url.pathname + url.search);
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
