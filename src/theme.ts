// 全站样式。设计还原自参考稿（airo.ai 分享页 GeekSlope 官网）：
// 深色底 + 青色主色 + 网格背景 + 径向光晕。路由 /styles.css 直接返回此字符串。

export const STYLES = /* css */ `
:root {
  --bg: #080a10;
  --fg: #f3f4f8;
  --card: #11141d;
  --muted: #171b28;
  --muted-fg: #9ca3b7;
  --primary: #7c6cff;
  --primary-ink: #ffffff;
  --secondary: #59e5c1;
  --border: #252a3a;
  --border-bright: #394057;
  --radius: 14px;
  --maxw: 1180px;
  --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  --display: "Space Grotesk", "Inter", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
h1, h2, h3 { margin: 0; font-family: var(--display); line-height: 1.1; font-weight: 600; letter-spacing: -0.035em; }
p { margin: 0; }

.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 24px; }

/* ---------- header ---------- */
.site-header {
  position: sticky; top: 0; z-index: 50;
  backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  border-bottom: 1px solid var(--border);
}
.site-header .wrap { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.header-brand-group { display: flex; align-items: center; gap: 16px; min-width: 0; }
.brand { display: inline-flex; align-items: center; }
.brand .brand-banner { height: 36px; width: auto; display: block; }
.site-footer .brand .brand-banner { height: 30px; }
@media (max-width: 620px) { .brand .brand-banner { height: 32px; } }
.header-location { padding-left: 16px; border-left: 1px solid var(--border); color: var(--muted-fg); font-family: var(--mono); font-size: 9px; letter-spacing: .08em; white-space: nowrap; }
.nav { display: flex; align-items: center; gap: 30px; }
.nav a { color: var(--muted-fg); font-size: 14px; transition: color .15s; }
.nav a:hover { color: var(--fg); }
.header-cart {
  position: relative; display: inline-flex; align-items: center; gap: 8px;
  color: var(--muted-fg); font-size: 13px; font-weight: 600; white-space: nowrap;
  transition: color .15s;
}
.header-cart:hover, .header-cart[aria-current="page"] { color: var(--primary); }
.header-cart svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.cart-count {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: var(--primary); color: var(--primary-ink); font-size: 11px; line-height: 18px; text-align: center;
  will-change: transform, opacity;
}
.header-actions { display: flex; align-items: center; gap: 12px; }
.language-switcher { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: 6px; }
.language-switcher button { padding: 4px 6px; border: 0; border-radius: 4px; background: transparent; color: var(--muted-fg); font: 600 10px var(--mono); cursor: pointer; }
.language-switcher button.is-active { background: var(--primary); color: var(--primary-ink); }
.header-account { padding: 9px 14px; font-size: 12px; }
.nav-account { display: flex; align-items: center; gap: 14px; }
.nav-logout { color: var(--muted-fg); font-size: 13px; transition: color .15s; }
.nav-logout:hover { color: var(--fg); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px 20px; border-radius: 6px; font-size: 14px; font-weight: 600;
  border: 1px solid transparent; cursor: pointer; transition: transform .12s, box-shadow .15s, background .15s;
}
.btn-primary { background: var(--primary); color: var(--primary-ink); box-shadow: 0 0 0 1px rgba(0,230,255,.25), 0 8px 30px -12px rgba(0,230,255,.5); }
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(0,230,255,.35), 0 12px 36px -12px rgba(0,230,255,.65); }
.btn-ghost { background: transparent; color: var(--fg); border-color: var(--border); }
.btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
.btn-lg { padding: 14px 26px; font-size: 15px; }
.btn-sm { padding: 7px 14px; font-size: 13px; }
.btn.is-added { background: rgba(0,230,255,.08); color: var(--primary); border-color: rgba(0,230,255,.36); box-shadow: none; }

.picked-device {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: 8px;
  background: rgba(255,255,255,.02);
}
.picked-device .chips { margin: 0; }
.picked-device .btn { flex: none; }

/* ---------- hero ---------- */
.hero { position: relative; overflow: hidden; border-bottom: 1px solid var(--border); }
.hero::before {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,230,255,.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,230,255,.045) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(120% 90% at 70% 40%, #000 0%, transparent 75%);
}
.hero::after {
  content: ""; position: absolute; right: -10%; top: -20%; width: 70%; height: 130%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(0,230,255,.12) 0%, transparent 70%);
  pointer-events: none;
}
.hero .wrap { position: relative; padding: 118px 24px 104px; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border: 1px solid var(--border); border-radius: 999px;
  background: rgba(0,230,255,.05); color: var(--muted-fg); font-size: 13px;
}
.eyebrow::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 8px var(--primary); }
.hero h1 { font-size: clamp(40px, 7vw, 68px); margin: 26px 0 6px; }
.hero .lede-accent { font-size: clamp(20px, 3vw, 26px); color: var(--muted-fg); font-weight: 600; }
.hero p { max-width: 560px; margin: 22px 0 32px; color: var(--muted-fg); font-size: 16px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 14px; }

/* ---------- sections ---------- */
.section { padding: 84px 0; }
.section.alt { background: var(--card); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.section-head { margin-bottom: 44px; }
.section-head .kicker { color: var(--primary); font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.section-head h2 { font-size: clamp(26px, 4vw, 36px); margin-top: 10px; }

/* ---------- feature strip ---------- */
.features { background: var(--card); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.features .wrap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; padding: 44px 24px; }
.feature .ic { width: 34px; height: 34px; color: var(--primary); margin-bottom: 12px; }
.feature h3 { font-size: 15px; }
.feature p { color: var(--muted-fg); font-size: 13.5px; margin-top: 6px; }

/* ---------- product cards ---------- */
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.card {
  position: relative; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 24px; overflow: hidden;
  transition: transform .15s, border-color .15s;
}
.card::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px;
  background: linear-gradient(to right, rgba(0,230,255,.6), rgba(0,230,255,.12), transparent);
}
.card:hover { transform: translateY(-4px); border-color: rgba(0,230,255,.35); }
.card .tag {
  display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .04em;
  color: var(--primary); background: rgba(0,230,255,.08); border: 1px solid rgba(0,230,255,.2);
  padding: 3px 9px; border-radius: 999px; margin-bottom: 14px;
}
.card h3 { font-size: 18px; }
.card .sub { color: var(--muted-fg); font-size: 13.5px; margin-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; margin: 16px 0 18px; }
.chip {
  font-size: 12px; color: var(--muted-fg);
  background: var(--muted); border: 1px solid var(--border);
  padding: 4px 9px; border-radius: 6px;
}
.price-row { display: flex; gap: 26px; padding-top: 16px; border-top: 1px solid var(--border); }
.price-row .lbl { font-size: 11px; color: var(--muted-fg); text-transform: uppercase; letter-spacing: .06em; }
.price-row .val { font-size: 18px; font-weight: 700; margin-top: 2px; }
.price-row .val small { font-size: 12px; font-weight: 500; color: var(--muted-fg); }
.price-original { display: block; color: #737b91; font-size: .65em; font-weight: 500; line-height: 1.25; text-decoration-thickness: 1px; white-space: nowrap; }
.price-row .val > strong { display: inline-block; }
.card .btn { width: 100%; margin-top: 18px; }
.deposit { font-size: 12px; color: var(--muted-fg); margin-top: 10px; }

.center-cta { text-align: center; margin-top: 42px; }

/* ---------- steps ---------- */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.step { position: relative; padding: 26px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
.step .n { font-size: 34px; font-weight: 800; color: rgba(0,230,255,.28); font-variant-numeric: tabular-nums; }
.step h3 { font-size: 17px; margin-top: 8px; }
.step p { color: var(--muted-fg); font-size: 14px; margin-top: 8px; }

/* ---------- closing cta ---------- */
.closing { position: relative; text-align: center; overflow: hidden; }
.closing::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(60% 120% at 50% 0%, rgba(0,230,255,.10) 0%, transparent 70%);
  pointer-events: none;
}
.closing .wrap { position: relative; padding: 90px 24px; }
.closing h2 { font-size: clamp(26px, 4vw, 36px); }
.closing p { color: var(--muted-fg); max-width: 520px; margin: 16px auto 30px; }

/* ---------- apply / rental form ---------- */
.form-wrap { max-width: 760px; }
.form-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 28px;
}
.form-card + .form-card { margin-top: 18px; }
.field { margin-bottom: 18px; }
.field:last-child { margin-bottom: 0; }
.field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 7px; }
.field .hint { font-size: 12px; color: var(--muted-fg); margin-top: 6px; }
.field input, .field select, .field textarea {
  width: 100%; padding: 10px 12px; font: inherit; color: var(--fg);
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
}
.field input:focus, .field select:focus, .field textarea:focus {
  outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(0,230,255,.15);
}
.field input[type="date"] { color-scheme: dark; cursor: pointer; }
.field input[type="date"]::-webkit-calendar-picker-indicator { opacity: .9; cursor: pointer; filter: invert(72%) sepia(72%) saturate(700%) hue-rotate(145deg); }
.detail-date-control { position: relative; }
.detail-date-control input { padding-right: 44px; }
.detail-date-picker-toggle { position: absolute; top: 50%; right: 8px; display: grid; width: 30px; height: 30px; place-items: center; padding: 5px; border: 0; border-radius: 6px; color: var(--secondary); background: transparent; cursor: pointer; transform: translateY(-50%); }
.detail-date-picker-toggle:hover, .detail-date-picker-toggle:focus-visible { background: rgba(89,229,193,.1); color: var(--fg); }
.detail-date-picker-toggle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.detail-date-picker { top: calc(100% + 6px); left: 0; width: min(280px, 100%); }
.field textarea { resize: vertical; min-height: 68px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.row3 { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.form-summary {
  background: var(--muted); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; font-size: 14px; margin-bottom: 18px;
}
.form-summary strong { color: var(--primary); }
.cart-checkout-list { display: grid; gap: 10px; }
.cart-page-list { display: grid; gap: 12px; }
.cart-page-item { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 22px 24px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); }
.cart-page-item > div:first-child > span { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .08em; }
.cart-page-item h3 { margin-top: 7px; font-size: 20px; }
.cart-page-item p { margin-top: 5px; color: var(--muted-fg); font-size: 13px; }
.cart-page-item--term { align-items: flex-start; }
.device-term-editor { max-width: 650px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
.device-term-editor-head { display: flex; justify-content: space-between; align-items: center; color: var(--fg); font-size: 13px; }
.term-date-grid, .term-period-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.term-date-field, .term-period-field { position: relative; display: grid; gap: 6px; color: var(--muted-fg); font-size: 11px; }
.term-date-control { position: relative; }
.term-date-field .term-date-control input { padding-right: 44px; }
.date-picker-toggle { position: absolute; top: 50%; right: 8px; display: grid; width: 30px; height: 30px; place-items: center; padding: 5px; border: 0; border-radius: 6px; color: var(--secondary); background: transparent; cursor: pointer; transform: translateY(-50%); }
.date-picker-toggle:hover, .date-picker-toggle:focus-visible { background: rgba(89,229,193,.1); color: var(--fg); }
.date-picker-toggle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.term-date-field input, .term-period-field select { width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid var(--border-bright); border-radius: 8px; color: var(--fg); background: #0b0e15; font: inherit; }
.term-date-field input:focus, .term-period-field select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(124,108,255,.13); }
.date-picker { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; width: 280px; padding: 12px; border: 1px solid var(--border-bright); border-radius: 10px; background: #111520; box-shadow: 0 18px 45px rgba(0,0,0,.42); }
.date-picker[hidden] { display: none; }
.date-picker-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; color: var(--fg); }
.date-picker-nav { width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 6px; color: var(--fg); background: transparent; cursor: pointer; }
.date-picker-week, .date-picker-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
.date-picker-week { margin-bottom: 4px; color: var(--muted-fg); font-size: 10px; }
.date-picker-grid button { min-height: 30px; border: 0; border-radius: 6px; color: var(--fg); background: transparent; cursor: pointer; }
.date-picker-grid button:hover:not(:disabled), .date-picker-grid button.is-selected { color: #fff; background: var(--primary); }
.date-picker-grid button.is-outside { color: #555d71; }
.date-picker-grid button:disabled { opacity: .22; cursor: not-allowed; }
.term-status { margin-top: 12px; color: var(--secondary) !important; font-size: 12px !important; }
.term-status[data-state="error"] { color: #ff9b9b !important; }
.cart-page-summary .is-disabled { opacity: .45; cursor: not-allowed; }
.cart-page-price { display: flex; align-items: center; gap: 18px; flex: none; }
.cart-page-price strong { font-size: 20px; }
.cart-page-price strong small { color: var(--muted-fg); font-size: 12px; font-weight: 500; }
.cart-page-price > div > small { display: block; margin-top: 2px; color: var(--muted-fg); font-size: 11px; }
.cart-page-price > span { color: var(--muted-fg); font-size: 12px; }
.cart-page-price .cart-remove { margin: 0; }
.cart-page-summary { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-top: 18px; }
.cart-page-summary strong { display: block; margin-top: 8px; font-family: var(--display); font-size: 22px; }
.cart-page-summary p { margin-top: 7px; color: var(--muted-fg); font-size: 13px; }
.cart-checkout-item {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,.02);
  will-change: transform, opacity;
}
.cart-checkout-item strong, .cart-checkout-item span { display: block; }
.cart-checkout-item span { color: var(--muted-fg); font-size: 12px; margin-top: 3px; }
.cart-checkout-item span .price-original { display: inline; margin-right: 4px; }
.cart-remove { padding: 7px 10px; border: 0; background: transparent; color: var(--muted-fg); font: inherit; font-size: 13px; cursor: pointer; }
.cart-remove:hover { color: #ff9a9a; }
.cart-empty { text-align: center; padding: 42px 24px; }
.cart-empty h3 { margin-bottom: 8px; }
.cart-empty p { color: var(--muted-fg); font-size: 14px; margin-bottom: 20px; }
.address-autocomplete { position: relative; }
.address-search-status { margin-top: 7px; color: var(--muted-fg); font-size: 12px; line-height: 1.5; }
.address-search-status[data-state="loading"] { color: var(--primary); }
.address-search-status[data-state="success"] { color: var(--secondary); }
.address-suggestions {
  position: relative; z-index: 5; display: grid; gap: 2px; max-height: 240px; overflow-y: auto;
  margin-top: 8px; padding: 5px; border: 1px solid var(--border-bright); border-radius: 10px;
  background: #0b0e15; box-shadow: 0 14px 30px rgba(0,0,0,.28);
}
.address-suggestions[hidden] { display: none; }
.address-suggestions button {
  display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; width: 100%;
  padding: 10px; border: 0; border-radius: 7px; background: transparent; color: var(--fg);
  text-align: left; font: inherit; cursor: pointer;
}
.address-suggestions button:hover, .address-suggestions button[aria-selected="true"] { background: rgba(124,108,255,.14); }
.address-suggestion-marker { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .08em; padding-top: 2px; }
.address-attribution { display: block; margin-top: 5px; color: var(--muted-fg); font-size: 10px; }
.coupon-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 18px; }
.coupon-row .field { margin: 0; }
.coupon-row .btn { min-height: 43px; }
.success-title { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.success-title svg { width: 24px; height: 24px; fill: none; stroke: var(--primary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.form-alert {
  background: rgba(255,80,80,.08); border: 1px solid rgba(255,80,80,.35);
  color: #ff9a9a; border-radius: 8px; padding: 12px 14px; font-size: 14px; margin-bottom: 16px;
}
.form-alert-ok {
  background: rgba(0,199,159,.10); border-color: rgba(0,199,159,.40); color: #7ff0d4;
}
.form-note { color: var(--muted-fg); font-size: 13px; margin-top: 14px; }
.auth-wrap { max-width: 440px; }
@media (max-width: 620px) {
  .row2, .row3 { grid-template-columns: 1fr; }
}

/* ---------- auth (注册 / 登录) ---------- */
.auth-wrap { max-width: 560px; }
.auth-tabs { display: flex; gap: 6px; padding: 5px; margin-bottom: 18px;
  background: var(--muted); border: 1px solid var(--border); border-radius: 8px; }
.auth-tab { flex: 1; padding: 10px 12px; font: inherit; font-size: 14px; font-weight: 600;
  color: var(--muted-fg); background: transparent; border: 0; border-radius: 6px; cursor: pointer;
  transition: background .15s, color .15s; }
.auth-tab:hover { color: var(--fg); }
.auth-tab.is-active { background: var(--bg); color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--border); }
.auth-panel.is-hidden { display: none; }

/* ---------- content pages ---------- */
.doc { max-width: 760px; }
.doc h1 { font-size: clamp(30px, 5vw, 42px); }
.doc h2 { font-size: 22px; margin-top: 40px; }
.doc p, .doc li { color: var(--muted-fg); font-size: 15.5px; }
.doc ul { padding-left: 20px; }
.doc .lead { color: var(--fg); font-size: 17px; margin-top: 16px; }
.legal-document .kicker { color: var(--primary); font-size: 13px; font-weight: 600; letter-spacing: .08em; }
.legal-document > h1 { margin-top: 10px; }
.legal-document__content { margin-top: 32px; }
.legal-document__content h1 { font-size: 26px; margin: 0 0 20px; }
.legal-document__content h2 { margin-top: 34px; }
.legal-document__content h3, .legal-document__content h4 { margin: 28px 0 10px; }
.legal-document__content p, .legal-document__content li { line-height: 1.8; }
.legal-document__content p { margin-bottom: 16px; }
.legal-document__content ol { padding-left: 22px; }
.legal-document__content a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
.legal-document__content table { width: 100%; margin: 20px 0; border-collapse: collapse; }
.legal-document__content th, .legal-document__content td { padding: 10px 12px; border: 1px solid var(--border); text-align: left; }
.legal-document__content blockquote, .legal-notice { margin: 24px 0; padding: 14px 16px; border-left: 3px solid var(--primary); background: var(--card); color: var(--muted-fg); }
.legal-document__content pre { overflow-x: auto; padding: 14px; border: 1px solid var(--border); background: var(--card); }
.doc-blank { color: var(--muted-fg); }
.legal-empty { padding: 24px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); }

/* ---------- 2026 studio system ---------- */
[hidden] { display: none !important; }
::selection { background: var(--primary); color: #fff; }
.skip-link { position: fixed; left: 16px; top: -60px; z-index: 100; padding: 10px 14px; border-radius: 8px; background: #fff; color: #080a10; font-weight: 700; }
.skip-link:focus { top: 12px; }
:focus-visible { outline: 2px solid var(--secondary); outline-offset: 3px; }
.site-header { background: rgba(8,10,16,.86); backdrop-filter: blur(18px) saturate(140%); }
.site-header .wrap { height: 74px; gap: 24px; }
.site-header, .site-header .wrap { transition: background .25s ease, border-color .25s ease, height .25s ease; }
.site-header.is-scrolled { background: rgba(8,10,16,.96); border-color: var(--border-bright); box-shadow: 0 12px 30px rgba(0,0,0,.18); }
.site-header.is-scrolled .wrap { height: 64px; }
.site-announcement { border-bottom: 1px solid var(--border); background: linear-gradient(90deg, rgba(124,108,255,.14), rgba(89,229,193,.07)); }
.site-announcement-inner { display: flex; align-items: center; gap: 16px; min-height: 42px; }
.site-announcement-label { color: var(--secondary); font: 600 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.site-announcement-link { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-width: 0; width: 100%; color: var(--fg); font-size: 13px; }
.site-announcement-link strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.site-announcement-link > span { color: var(--muted-fg); flex: none; font-size: 12px; }
.site-announcement-link:hover strong { color: var(--secondary); }
.notice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.notice-card { display: block; padding: 24px; border: 1px solid var(--border); background: var(--card); transition: border-color .18s, transform .18s, background .18s; }
.notice-card:hover { border-color: var(--border-bright); background: var(--muted); transform: translateY(-2px); }
.notice-card-kind { color: var(--secondary); font: 600 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; }
.notice-card h2 { margin-top: 12px; font-size: 24px; }
.notice-card time { display: block; margin-top: 10px; color: var(--muted-fg); font: 11px var(--mono); }
.notice-card p { display: -webkit-box; overflow: hidden; margin-top: 18px; color: var(--muted-fg); -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.notice-card .text-link { display: inline-block; margin-top: 22px; color: var(--primary); font-size: 13px; }
.notice-detail-wrap { max-width: 820px; }
.notice-detail { padding: clamp(24px, 5vw, 52px); border: 1px solid var(--border); background: var(--card); }
.notice-detail-message { white-space: pre-wrap; color: var(--fg); line-height: 1.9; }
.coupon-callout { display: flex; align-items: center; gap: 18px; margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); }
.coupon-callout span { color: var(--muted-fg); font-size: 13px; }
.coupon-callout strong { color: var(--secondary); font: 700 20px var(--mono); letter-spacing: .08em; }
.coupon-callout .btn { margin-left: auto; }
.nav { gap: 6px; }
.nav a { padding: 8px 12px; border-radius: 8px; color: #aeb5c7; }
.nav a:hover, .nav a[aria-current="page"] { color: var(--fg); background: rgba(255,255,255,.05); }
html[lang^="en"] .nav { gap: 2px; }
html[lang^="en"] .nav a { padding-left: 9px; padding-right: 9px; font-size: 12px; white-space: nowrap; }
html[lang^="en"] .header-account { padding-left: 12px; padding-right: 12px; font-size: 11px; white-space: nowrap; }
html[lang^="en"] .header-cart { font-size: 12px; }
.menu-toggle { display: none; width: 40px; height: 40px; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--card); }
.menu-toggle span { display: block; width: 18px; height: 1px; margin: 4px auto; background: var(--fg); transition: transform .2s, opacity .2s; }
.menu-toggle[aria-expanded="true"] span:nth-child(1) { transform: translateY(5px) rotate(45deg); }
.menu-toggle[aria-expanded="true"] span:nth-child(2) { opacity: 0; }
.menu-toggle[aria-expanded="true"] span:nth-child(3) { transform: translateY(-5px) rotate(-45deg); }
.btn { min-height: 42px; border-radius: 9px; }
.btn-primary { background: var(--primary); color: var(--primary-ink); box-shadow: 0 10px 30px -14px rgba(124,108,255,.8); }
.btn-primary:hover { box-shadow: 0 14px 36px -14px rgba(124,108,255,.95); }
.btn-light { background: #fff; color: #0b0e16; }
.text-link { display: inline-flex; align-items: center; gap: 10px; color: var(--fg); font-weight: 600; }
.text-link span { color: var(--primary); transition: transform .2s; }
.text-link:hover span { transform: translateX(4px); }
.kicker { color: var(--primary); font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }

/* hero as a live rental desk */
.hero { min-height: 680px; background: radial-gradient(80% 100% at 100% 0%, rgba(124,108,255,.15), transparent 62%); }
.hero::before { background-image: linear-gradient(rgba(124,108,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(124,108,255,.045) 1px, transparent 1px); background-size: 52px 52px; mask-image: linear-gradient(to right, transparent, #000 32%, #000); }
.hero::after { width: 580px; height: 580px; right: 4%; top: 8%; border: 1px solid rgba(124,108,255,.13); border-radius: 50%; background: radial-gradient(circle, rgba(124,108,255,.08), transparent 64%); }
.hero .hero-grid { display: grid; grid-template-columns: minmax(0, 1.06fr) minmax(380px, .94fr); gap: 78px; align-items: center; padding-top: 96px; padding-bottom: 96px; }
.hero h1 { max-width: 680px; margin: 24px 0 0; font-size: clamp(48px, 6.3vw, 78px); }
.hero h1 em { display: block; color: var(--primary); font-style: normal; }
.hero p { max-width: 620px; margin: 26px 0 30px; color: #afb5c6; font-size: 17px; line-height: 1.85; }
.hero-notes { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-top: 26px; color: var(--muted-fg); font-family: var(--mono); font-size: 11px; }
.hero-notes span::first-letter { color: var(--secondary); }
.rental-console { position: relative; z-index: 2; overflow: hidden; border: 1px solid var(--border-bright); border-radius: 18px; background: rgba(14,17,26,.88); box-shadow: 0 34px 90px -36px rgba(0,0,0,.9), 0 0 70px -42px var(--primary); transform: rotate(1.2deg); }
.console-head { display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid var(--border); color: var(--muted-fg); font-family: var(--mono); font-size: 10px; letter-spacing: .06em; }
.console-head i { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: var(--secondary); box-shadow: 0 0 12px var(--secondary); }
.console-device { display: grid; grid-template-columns: 44% 1fr; gap: 22px; align-items: center; min-height: 260px; padding: 26px; background: linear-gradient(135deg, rgba(124,108,255,.10), transparent 52%); }
.console-art { position: relative; height: 170px; }
.console-screen { position: absolute; inset: 12px 16px 40px; display: grid; place-items: center; border: 2px solid #3b4052; border-radius: 6px; background: linear-gradient(145deg, #171c2a, #0a0d14); box-shadow: inset 0 0 40px rgba(124,108,255,.15); transform: perspective(400px) rotateY(5deg); }
.console-screen::after { content: ""; position: absolute; inset: 8px; border: 1px solid rgba(124,108,255,.16); }
.console-screen span { color: #b8b0ff; font-family: var(--mono); font-size: 14px; line-height: 1.4; letter-spacing: .12em; }
.console-base { position: absolute; left: 5px; right: 4px; bottom: 28px; height: 13px; clip-path: polygon(9% 0, 91% 0, 100% 100%, 0 100%); background: #454b5d; box-shadow: 0 9px 18px #000; }
.console-device-copy { min-width: 0; }
.console-device-copy small, .console-device-copy strong, .console-device-copy span { display: block; }
.console-device-copy small { margin-bottom: 10px; color: var(--secondary); font-family: var(--mono); font-size: 9px; letter-spacing: .12em; }
.console-device-copy strong { font-family: var(--display); font-size: 21px; line-height: 1.18; }
.console-device-copy span { margin-top: 10px; color: var(--muted-fg); font-size: 12px; line-height: 1.6; }
.console-metrics { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.console-metrics > div { min-width: 0; padding: 17px 14px; border-right: 1px solid var(--border); }
.console-metrics > div:last-child { border: 0; }
.console-metrics span, .console-metrics strong { display: block; }
.console-metrics span { color: var(--muted-fg); font-size: 10px; }
.console-metrics strong { margin-top: 6px; font-family: var(--mono); font-size: 15px; }
.console-metrics small { color: var(--muted-fg); font-size: 9px; }
.console-link { display: flex; justify-content: space-between; padding: 16px 18px; color: #cbc7ff; font-size: 12px; font-weight: 600; }

/* reusable sections */
.section { padding: 96px 0; }
.section.alt { background: #0e1119; }
.section-head { display: flex; justify-content: space-between; gap: 48px; align-items: end; margin-bottom: 42px; }
.section-head > p, .section-head > div + p { max-width: 440px; color: var(--muted-fg); font-size: 14px; }
.section-head h2 { max-width: 680px; margin-top: 12px; font-size: clamp(30px, 4vw, 46px); }
.section-head.tight { margin-bottom: 32px; }
.features { background: #0e1119; }
.features .wrap { padding-top: 38px; padding-bottom: 38px; }
.feature { padding-right: 18px; border-right: 1px solid var(--border); }
.feature:last-child { border: 0; }
.feature .ic { width: 28px; height: 28px; color: var(--secondary); }
.feature h3 { font-family: var(--display); font-size: 16px; }
.feature p { line-height: 1.65; }

/* product catalog and cards */
.grid { gap: 18px; }
.card { border-radius: 15px; padding: 20px; background: #10131c; }
.card::before { background: linear-gradient(to right, rgba(124,108,255,.78), rgba(89,229,193,.28), transparent); }
.card:hover { border-color: rgba(124,108,255,.55); }
.card, .scenario, .info-card, .contact-option { transition: transform .28s cubic-bezier(.2,.8,.2,1), border-color .2s ease, box-shadow .28s ease; }
.card:hover, .scenario:hover, .info-card.linked:hover, .contact-option:hover { box-shadow: 0 18px 40px -30px rgba(124,108,255,.9); }
.product-visual { position: relative; height: 150px; margin: -4px -4px 20px; overflow: hidden; border-radius: 10px; background: radial-gradient(circle at 50% 20%, rgba(124,108,255,.24), transparent 55%), #0b0e15; }
.product-visual::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 22px 22px; }
.device-screen { position: absolute; left: 50%; top: 28px; width: 118px; height: 76px; border: 2px solid #4a5063; border-radius: 5px; background: linear-gradient(145deg, #171c2b, #0d1018); transform: translateX(-50%) perspective(500px) rotateX(-2deg); box-shadow: inset 0 0 30px rgba(124,108,255,.16); }
.device-screen i { position: absolute; inset: 9px; border: 1px solid rgba(124,108,255,.24); }
.device-screen i::after { content: ""; position: absolute; left: 12px; top: 14px; width: 48px; height: 2px; background: var(--primary); box-shadow: 0 8px 0 rgba(89,229,193,.5), 0 16px 0 rgba(255,255,255,.12); }
.device-base { position: absolute; left: 50%; top: 104px; width: 152px; height: 10px; background: #4a5063; clip-path: polygon(10% 0, 90% 0, 100% 100%, 0 100%); transform: translateX(-50%); }
.visual-code { position: absolute; right: 10px; bottom: 8px; color: rgba(255,255,255,.23); font-family: var(--mono); font-size: 10px; letter-spacing: .12em; }
.compact-visual { height: 126px; }
.compact-visual .device-screen { top: 20px; }
.compact-visual .device-base { top: 96px; }
.card-top { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 14px; }
.card .tag { display: inline-flex; align-items: center; gap: 7px; margin: 0; color: var(--secondary); background: rgba(89,229,193,.07); border-color: rgba(89,229,193,.18); }
.card .tag i, .status-line .tag i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }
.card .tag-muted, .tag-muted { color: #f0b867 !important; background: rgba(240,184,103,.07) !important; border-color: rgba(240,184,103,.2) !important; }
.card-code { color: #747c92; font-family: var(--mono); font-size: 9px; letter-spacing: .09em; text-transform: uppercase; }
.card h3 { font-size: 20px; }
.card h3 a:hover { color: #c5c0ff; }
.card .sub { min-height: 22px; }
.card-actions { display: grid; grid-template-columns: .75fr 1.25fr; gap: 9px; margin-top: 18px; }
.card-actions .btn { width: auto; margin: 0; padding: 10px 11px; }
.catalog-tools { display: grid; grid-template-columns: minmax(240px, 1fr) auto; gap: 16px 22px; padding: 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
.search-box { display: flex; align-items: center; min-width: 0; height: 46px; padding: 0 14px; border: 1px solid var(--border); border-radius: 9px; background: var(--bg); }
.search-box:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(124,108,255,.12); }
.search-box svg { width: 19px; height: 19px; margin-right: 9px; fill: none; stroke: var(--muted-fg); stroke-width: 1.8; }
.search-box input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--fg); font: inherit; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 7px; grid-column: 1 / -1; }
.filter-chip { padding: 8px 11px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--muted-fg); font: inherit; font-size: 12px; cursor: pointer; }
.filter-chip span { margin-left: 4px; font-family: var(--mono); font-size: 9px; }
.filter-chip:hover, .filter-chip.is-active { border-color: rgba(124,108,255,.5); background: rgba(124,108,255,.10); color: #d5d1ff; }
.tool-tail { display: flex; gap: 12px; align-items: center; }
.tool-tail select { height: 46px; padding: 0 34px 0 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--bg); color: var(--fg); }
.stock-toggle { display: flex; gap: 7px; align-items: center; color: var(--muted-fg); font-size: 12px; white-space: nowrap; }
.stock-toggle input { accent-color: var(--primary); }
.catalog-meta { display: flex; gap: 7px; align-items: baseline; padding: 26px 2px 16px; color: var(--muted-fg); font-size: 12px; }
.catalog-meta strong { color: var(--fg); font-family: var(--mono); font-size: 22px; }
.catalog-meta span { margin-left: auto; }
.empty-state { grid-column: 1 / -1; padding: 52px 24px; border: 1px dashed var(--border-bright); border-radius: 14px; text-align: center; }
.empty-state strong { font-family: var(--display); font-size: 20px; }
.empty-state p { margin: 8px 0 20px; color: var(--muted-fg); font-size: 14px; }
.info-band { background: var(--primary); color: #fff; }
.info-band .wrap { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding-top: 32px; padding-bottom: 32px; }
.info-band span, .info-band strong { display: block; }
.info-band span { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; opacity: .75; }
.info-band strong { margin-top: 4px; font-family: var(--display); font-size: 20px; }

/* scenarios, process, FAQ */
.scenario-grid { display: grid; grid-template-columns: 1.2fr .8fr; grid-template-rows: repeat(2, minmax(190px, auto)); gap: 16px; }
.scenario { position: relative; overflow: hidden; padding: 30px; border: 1px solid var(--border); border-radius: 14px; background: #10131c; }
.scenario::after { content: ""; position: absolute; right: -60px; bottom: -80px; width: 190px; height: 190px; border: 1px solid rgba(124,108,255,.18); border-radius: 50%; box-shadow: 0 0 0 34px rgba(124,108,255,.025), 0 0 0 68px rgba(124,108,255,.02); }
.scenario:hover { border-color: var(--border-bright); background: #121620; }
.scenario-wide { grid-row: 1 / 3; display: flex; flex-direction: column; justify-content: end; padding-top: 170px; background: radial-gradient(circle at 65% 20%, rgba(124,108,255,.22), transparent 36%), #10131c; }
.scenario-index { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .09em; }
.scenario h3 { max-width: 420px; margin-top: 13px; font-size: clamp(22px, 3vw, 34px); }
.scenario p { max-width: 480px; margin-top: 10px; color: var(--muted-fg); font-size: 14px; }
.scenario b { display: block; margin-top: 24px; color: #c9c5ff; font-size: 13px; }
.steps { position: relative; }
.step { border-radius: 14px; background: var(--bg); }
.step .n { color: rgba(124,108,255,.42); font-family: var(--mono); }
.process-note { display: flex; gap: 14px; align-items: flex-start; margin-top: 20px; padding: 17px 20px; border: 1px solid rgba(124,108,255,.25); border-radius: 11px; background: rgba(124,108,255,.06); }
.process-note span { color: #c7c2ff; font-family: var(--mono); font-size: 10px; letter-spacing: .1em; }
.process-note p { color: var(--muted-fg); font-size: 13px; }
.split-head { display: grid; grid-template-columns: .75fr 1.25fr; gap: 80px; align-items: start; }
.split-head h2, .faq-intro h2 { margin-top: 12px; font-size: clamp(30px, 4vw, 44px); }
.split-head > div:first-child > p, .faq-intro p { margin: 18px 0 26px; color: var(--muted-fg); }
.faq-list details { border-top: 1px solid var(--border); }
.faq-list details:last-child { border-bottom: 1px solid var(--border); }
.faq-list summary { position: relative; padding: 20px 38px 20px 0; color: var(--fg); font-family: var(--display); font-size: 17px; cursor: pointer; list-style: none; }
.faq-list summary::-webkit-details-marker { display: none; }
.faq-list summary::after { content: "+"; position: absolute; right: 4px; color: var(--primary); font-family: var(--mono); font-size: 21px; font-weight: 400; }
.faq-list details[open] summary::after { content: "−"; }
.faq-list details p { max-width: 680px; padding: 0 40px 21px 0; color: var(--muted-fg); font-size: 14px; }
.closing .hero-actions { justify-content: center; }
.closing .kicker { margin-bottom: 13px; }
.error-code { color: rgba(124,108,255,.22); font-family: var(--mono); font-size: clamp(80px, 18vw, 180px); font-weight: 600; line-height: .8; }

/* page heroes and editorial pages */
.page-hero { position: relative; min-height: 560px; overflow: hidden; border-bottom: 1px solid var(--border); background: radial-gradient(80% 100% at 100% 0%, rgba(124,108,255,.15), transparent 62%); }
.page-hero::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(124,108,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(124,108,255,.045) 1px, transparent 1px); background-size: 52px 52px; mask-image: linear-gradient(to right, transparent, #000 32%, #000); }
.page-hero::after { content: ""; position: absolute; right: 4%; top: 8%; width: 580px; height: 580px; border: 1px solid rgba(124,108,255,.13); border-radius: 50%; background: radial-gradient(circle, rgba(124,108,255,.08), transparent 64%); pointer-events: none; }
.page-hero .wrap { position: relative; z-index: 1; padding-top: 96px; padding-bottom: 96px; }
.page-hero h1 { max-width: 820px; margin-top: 24px; font-size: clamp(48px, 6.3vw, 78px); }
.page-hero h1 em { display: block; color: var(--primary); font-style: normal; }
.page-hero p { max-width: 700px; margin: 26px 0 30px; color: #afb5c6; font-size: 17px; line-height: 1.85; }
.guide-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 680px; border: 1px solid var(--border); background: rgba(8,10,16,.42); }
.guide-facts div { padding: 15px 18px; border-right: 1px solid var(--border); }
.guide-facts div:last-child { border-right: 0; }
.guide-facts strong, .guide-facts span { display: block; }
.guide-facts strong { font-family: var(--display); font-size: 18px; }
.guide-facts span { margin-top: 4px; color: var(--muted-fg); font-size: 11px; }
.guide-jump { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 28px; }
.guide-jump a { padding: 8px 12px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted-fg); font-size: 12px; transition: border-color .15s, color .15s, background .15s; }
.guide-jump a:hover { border-color: var(--primary); background: rgba(124,108,255,.08); color: var(--fg); }
.inline-link { color: var(--primary); text-decoration: underline; text-decoration-color: rgba(124,108,255,.4); text-underline-offset: 3px; }
.inline-link:hover { text-decoration-color: currentColor; }
.process-heading { max-width: 680px; margin: 0 auto 64px; text-align: center; }
.process-heading h2 { font-size: clamp(32px, 4vw, 46px); }
.process-heading p { margin-top: 14px; color: var(--muted-fg); font-size: 14px; }
.guide-steps { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 22px; }
.guide-steps::before { content: ""; position: absolute; left: 10%; right: 10%; top: 43px; height: 1px; background: linear-gradient(90deg, rgba(89,229,193,.18), rgba(89,229,193,.62), rgba(89,229,193,.18)); }
.guide-steps article { position: relative; z-index: 1; padding: 0 8px; text-align: center; }
.guide-steps article > span { display: grid; place-items: center; width: 86px; height: 86px; margin: 0 auto; border: 2px solid rgba(89,229,193,.7); border-radius: 50%; background: var(--bg); box-shadow: 0 0 28px rgba(89,229,193,.06), inset 0 0 18px rgba(89,229,193,.025); color: var(--secondary); font-family: var(--mono); font-size: 22px; font-weight: 800; letter-spacing: -.03em; }
.guide-steps h3 { margin: 24px 0 12px; font-size: 17px; }
.guide-steps p { max-width: 235px; margin: 0 auto; color: var(--muted-fg); font-size: 13px; line-height: 1.75; }
.rental-plan-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.rental-plan-grid article { position: relative; padding: 32px 28px; border: 1px solid var(--border); border-radius: 16px; background: var(--bg); }
.rental-plan-grid article.featured { border-color: rgba(89,229,193,.55); box-shadow: 0 0 0 1px rgba(89,229,193,.12); }
.rental-plan-grid article > b { position: absolute; right: 20px; top: 20px; padding: 5px 12px; border-radius: 999px; background: rgba(89,229,193,.15); color: var(--secondary); font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: .04em; }
.rental-plan-grid h3 { font-size: 22px; }
.rental-plan-grid .plan-badge { display: inline-block; margin-top: 14px; padding: 5px 12px; border-radius: 8px; background: rgba(124,108,255,.14); color: #a5b4fc; font-size: 13px; font-weight: 600; }
.rental-plan-grid p { margin-top: 18px; color: var(--muted-fg); font-size: 14px; line-height: 1.6; }
.rental-plan-grid .plan-note { display: block; margin-top: 16px; color: var(--secondary); font-size: 13px; font-weight: 600; }
.rental-terms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.rental-terms-grid article { padding: 26px; border: 1px solid var(--border); border-radius: 13px; background: var(--bg); }
.rental-terms-grid span { color: var(--primary); font-family: var(--mono); font-size: 10px; }
.rental-terms-grid h3 { margin-top: 30px; font-size: 20px; }
.rental-terms-grid p { margin-top: 12px; color: var(--muted-fg); font-size: 13px; }
.delivery-grid, .detail-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 74px; align-items: center; }
.delivery-grid h2 { margin: 12px 0 20px; font-size: 40px; }
.delivery-grid p { margin-top: 13px; color: var(--muted-fg); }
.map-card { position: relative; min-height: 360px; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: radial-gradient(circle at 66% 70%, rgba(124,108,255,.16), transparent 24%), #0d1018; }
.australia-map { position: absolute; inset: 8px 8px 42px; width: calc(100% - 16px); height: calc(100% - 50px); }
.map-grid-line { fill: none; stroke: rgba(145,151,180,.065); stroke-width: 1; }
.map-state { fill: url(#au-fill); stroke: rgba(198,202,229,.45); stroke-width: 1.25; stroke-linejoin: round; }
.map-state.victoria-shape { fill: rgba(124,108,255,.52); stroke: #a198ff; stroke-width: 1.6; }
.mel-glow { fill: rgba(124,108,255,.65); filter: url(#mel-glow); }
.mel-pulse { fill: none; stroke: #9b91ff; stroke-width: 1.5; transform-box: fill-box; transform-origin: center; animation: map-pulse 2.4s ease-out infinite; }
.mel-dot { fill: #fff; stroke: #7568ff; stroke-width: 3; }
.mel-leader { fill: none; stroke: #9b91ff; stroke-width: 1; }
.mel-label, .vic-label { fill: #f2f3ff; font-family: var(--mono); font-weight: 700; letter-spacing: .08em; }
.mel-label { font-size: 10px; }.vic-label { fill: #cbc7ff; font-size: 8px; }
.map-caption { position: absolute; left: 20px; bottom: 18px; }
.map-card strong, .map-card small { display: block; font-family: var(--mono); }
.map-card strong { font-size: 11px; }.map-card small { margin-top: 4px; color: var(--muted-fg); font-size: 8px; }
.map-country { position: absolute; right: 18px; top: 16px; color: #737b94; font-family: var(--mono); font-size: 8px; letter-spacing: .12em; }
@keyframes map-pulse { 0% { opacity: .9; transform: scale(.6); } 80%, 100% { opacity: 0; transform: scale(2.5); } }
.faq-layout { display: grid; grid-template-columns: .7fr 1.3fr; gap: 84px; align-items: start; }
.faq-intro { position: sticky; top: 110px; }
.about-hero-grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 64px; align-items: center; }
.about-signal { position: relative; display: flex; min-height: 310px; flex-direction: column; justify-content: end; overflow: hidden; padding: 30px; border: 1px solid var(--border); border-radius: 18px; background: radial-gradient(circle at 70% 25%, rgba(124,108,255,.26), transparent 38%), #0d1018; box-shadow: 0 30px 70px -50px rgba(124,108,255,.9); }
.about-signal::before, .about-signal::after { content: ""; position: absolute; width: 210px; height: 210px; border: 1px solid rgba(89,229,193,.14); border-radius: 50%; }
.about-signal::before { right: -45px; top: -58px; box-shadow: 0 0 0 42px rgba(89,229,193,.025); }
.about-signal::after { right: 72px; top: 44px; width: 8px; height: 8px; border: 0; background: var(--secondary); box-shadow: 0 0 20px var(--secondary); }
.signal-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 30px 30px; mask-image: linear-gradient(to bottom, #000, transparent 80%); }
.about-signal span, .about-signal strong, .about-signal small { position: relative; z-index: 1; display: block; }
.about-signal span { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .12em; }
.about-signal strong { margin-top: 12px; font-family: var(--display); font-size: clamp(31px, 4vw, 48px); line-height: .95; letter-spacing: -.04em; }
.about-signal small { margin-top: 18px; color: var(--muted-fg); font-family: var(--mono); font-size: 9px; letter-spacing: .08em; }
.about-brand-subtitle { display: block; margin-top: 8px; color: var(--secondary); font-family: var(--display); font-size: 20px; }
.about-stats { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--card); }
.about-stats .wrap { display: grid; grid-template-columns: repeat(4, 1fr); }
.about-stats .wrap > div { padding: 30px 24px; border-right: 1px solid var(--border); text-align: center; }
.about-stats .wrap > div:last-child { border-right: 0; }
.about-stats strong, .about-stats span { display: block; }
.about-stats strong { color: var(--primary); font-family: var(--display); font-size: 34px; }
.about-stats span { margin-top: 5px; color: var(--muted-fg); font-size: 12px; }
.story-grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 90px; align-items: start; }
.story-lead > span { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .1em; }
.story-lead h2 { margin-top: 20px; font-size: clamp(36px, 5vw, 58px); }
.story-copy p { margin-bottom: 24px; color: var(--muted-fg); font-size: 17px; line-height: 1.9; }
.principle-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
.principle-grid article { padding: 27px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
.principle-grid span { color: var(--primary); font-family: var(--mono); font-size: 11px; }
.principle-grid h3 { margin-top: 42px; font-size: 21px; }
.principle-grid p { margin-top: 12px; color: var(--muted-fg); font-size: 13px; }
.principle-grid.about-values { grid-template-columns: repeat(3, 1fr); }
.about-contact { display: grid; grid-template-columns: .85fr 1.15fr; gap: 72px; align-items: start; }
.about-contact h2 { max-width: 540px; margin-top: 12px; font-size: clamp(30px, 4vw, 44px); }
.about-contact > div:first-child > p { margin: 18px 0 28px; color: var(--muted-fg); line-height: 1.8; }
.contact-strip { display: flex; justify-content: space-between; gap: 40px; align-items: end; padding: 40px !important; border: 1px solid var(--border); border-radius: 16px; background: linear-gradient(120deg, rgba(124,108,255,.12), transparent 48%), var(--card); }
.contact-strip h2 { margin-top: 12px; font-size: clamp(28px, 4vw, 44px); }.contact-strip p { margin-top: 12px; color: var(--muted-fg); }
.contact-strip-actions { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.contact-layout { display: grid; grid-template-columns: .8fr 1.2fr; gap: 28px; align-items: start; }
.contact-options { display: grid; gap: 12px; }
.contact-option { display: block; padding: 22px; border: 1px solid var(--border); border-radius: 12px; background: var(--card); }
a.contact-option:hover { border-color: var(--border-bright); }
.contact-option span, .contact-option strong, .contact-option small { display: block; }
.contact-option span { color: var(--primary); font-family: var(--mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
.contact-option strong { margin-top: 8px; font-family: var(--display); font-size: 19px; overflow-wrap: anywhere; }
.contact-option small { margin-top: 6px; color: var(--muted-fg); font-size: 12px; }
.response-note { display: flex; gap: 12px; padding: 18px; color: var(--muted-fg); font-size: 12px; }
.response-note i { flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--secondary); box-shadow: 0 0 10px var(--secondary); }
.response-note strong { color: var(--fg); }.response-note p { margin-top: 4px; }
.contact-form h2 { margin-top: 10px; font-size: 30px; }.form-intro { margin: 8px 0 24px; color: var(--muted-fg); font-size: 13px; }
.info-grid { display: grid; gap: 16px; }.info-grid.three { grid-template-columns: repeat(3, 1fr); }
.info-card { padding: 25px; border: 1px solid var(--border); border-radius: 13px; background: var(--bg); }
.info-card > span { color: var(--secondary); font-family: var(--mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
.info-card h3 { margin-top: 22px; font-size: 20px; }.info-card p { margin-top: 10px; color: var(--muted-fg); font-size: 13px; }
.info-card.linked:hover { border-color: var(--primary); transform: translateY(-2px); }
.home-essentials-note { display: flex; align-items: center; gap: 18px; margin-top: 18px; padding: 16px 20px; border: 1px solid rgba(89,229,193,.18); border-radius: 10px; background: rgba(89,229,193,.045); }
.home-essentials-note strong { color: var(--secondary); font-family: var(--mono); font-size: 11px; white-space: nowrap; }
.home-essentials-note span { color: var(--muted-fg); font-size: 13px; }
.home-essentials-note .text-link { margin-left: auto; font-size: 13px; white-space: nowrap; }
.service-standard-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--border); border-left: 1px solid var(--border); }
.service-standard-grid article { min-height: 250px; padding: 25px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.service-standard-grid span { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .08em; }
.service-standard-grid h3 { margin-top: 42px; font-size: 20px; }
.service-standard-grid ul { display: grid; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
.service-standard-grid li { position: relative; padding-left: 17px; color: var(--muted-fg); font-size: 12px; line-height: 1.6; }
.service-standard-grid li::before { content: ""; position: absolute; left: 0; top: .65em; width: 5px; height: 5px; border-radius: 50%; background: var(--primary); }

/* product detail */
.crumbs { display: flex; gap: 9px; padding-top: 24px; padding-bottom: 12px; color: var(--muted-fg); font-size: 12px; }
.crumbs a:hover { color: var(--primary); }
.product-detail { padding: 34px 0 92px; border-bottom: 1px solid var(--border); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 74px; align-items: center; }
.detail-visual { position: relative; display: grid; place-items: center; min-height: 500px; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: radial-gradient(circle, rgba(124,108,255,.18), transparent 50%), #0d1018; }
.detail-orbit { position: absolute; border: 1px solid rgba(124,108,255,.15); border-radius: 50%; }.orbit-one { width: 310px; height: 310px; }.orbit-two { width: 440px; height: 440px; }
.detail-device { position: relative; width: 270px; height: 220px; }
.detail-screen { display: grid; place-items: center; width: 240px; height: 165px; margin: 0 auto; border: 4px solid #464c60; border-radius: 9px; background: linear-gradient(145deg, #161b2a, #090c13); box-shadow: inset 0 0 60px rgba(124,108,255,.18), 0 28px 50px -20px #000; }
.detail-screen span { color: #bcb6ff; font-family: var(--mono); font-size: 19px; letter-spacing: .12em; line-height: 1.35; }
.detail-base { height: 17px; background: #4b5163; clip-path: polygon(7% 0, 93% 0, 100% 100%, 0 100%); }
.detail-category { position: absolute; left: 18px; bottom: 16px; color: var(--muted-fg); font-family: var(--mono); font-size: 9px; letter-spacing: .1em; }
.status-line { display: flex; justify-content: space-between; align-items: center; color: var(--muted-fg); font-size: 11px; }
.status-line .tag { display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; border: 1px solid rgba(89,229,193,.2); border-radius: 999px; color: var(--secondary); background: rgba(89,229,193,.07); }
.detail-brand { margin-top: 27px; color: var(--primary); font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
.detail-copy h1 { margin-top: 10px; font-size: clamp(42px, 6vw, 68px); }.detail-model { margin-top: 8px; color: var(--muted-fg); font-family: var(--mono); font-size: 11px; }
.detail-description { margin-top: 25px; color: #afb5c6; line-height: 1.8; }
.detail-price { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 30px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.detail-price > div { padding: 17px 12px 17px 0; }.detail-price span, .detail-price strong, .detail-price small { display: block; }
.detail-price span { color: var(--muted-fg); font-size: 10px; }.detail-price strong { margin-top: 5px; font-family: var(--mono); font-size: 21px; }.detail-price small { margin-top: 2px; color: #71798d; font-size: 9px; }
.detail-price .price-original { margin-top: 5px; font-family: var(--mono); font-size: 11px; }
.detail-rental-term { margin-top: 28px; padding: 18px; border: 1px solid rgba(124,108,255,.28); border-radius: 10px; background: rgba(124,108,255,.06); }.detail-rental-term p { margin-top: 6px; color: var(--muted-fg); font-size: 12px; }.detail-rental-term .row2 { margin-top: 16px; }
.detail-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }.microcopy { margin-top: 13px; color: var(--muted-fg); font-size: 11px; }
.spec-table { border-top: 1px solid var(--border); }.spec-row { display: grid; grid-template-columns: .7fr 1.3fr; gap: 20px; padding: 15px 0; border-bottom: 1px solid var(--border); font-size: 13px; }.spec-row span { color: var(--muted-fg); }.spec-row strong { font-weight: 600; }
.included-card { padding: 32px; border: 1px solid var(--border); border-radius: 15px; background: var(--card); }.included-card h2 { margin-top: 12px; font-size: 30px; }.check-list { display: grid; gap: 12px; margin: 24px 0; padding: 0; list-style: none; }.check-list li { position: relative; padding-left: 24px; color: var(--muted-fg); font-size: 14px; }.check-list li::before { content: "✓"; position: absolute; left: 0; color: var(--secondary); }

/* forms */
.apply-progress { display: flex; align-items: center; gap: 11px; max-width: 620px; margin-top: 30px; color: var(--muted-fg); font-size: 11px; }
.apply-progress span { display: flex; align-items: center; gap: 7px; white-space: nowrap; }.apply-progress i { display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid var(--border-bright); border-radius: 50%; font-family: var(--mono); font-size: 9px; font-style: normal; }.apply-progress .is-current { color: var(--fg); }.apply-progress .is-current i { border-color: var(--primary); background: var(--primary); color: #fff; }.apply-progress b { width: 58px; height: 1px; background: var(--border); }
.form-wrap { max-width: 820px; }.apply-section { padding-top: 70px; }
.apply-section .form-wrap { max-width: 1100px; }
.apply-section .section-head { display: block; }
.apply-section .section-head h2 { margin-top: 10px; }
.apply-grid { display: grid; grid-template-columns: 1fr 380px; align-items: start; gap: 18px; }
.apply-grid-main, .apply-grid-payment { min-width: 0; }
.apply-grid-payment { position: static; }
.apply-grid-main .form-card + .form-card, .apply-grid-payment .form-card + .form-card { margin-top: 18px; }
.apply-grid-main > .field { margin-top: 18px; }
.form-card { border-radius: 14px; padding: 30px; }.form-card-head { display: flex; gap: 13px; align-items: center; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }.form-card-head > span { color: var(--primary); font-family: var(--mono); font-size: 10px; }.form-card-head h3 { font-size: 17px; }.form-card-head p { margin-top: 3px; color: var(--muted-fg); font-size: 11px; }
.cart-term-card { margin-bottom: 18px; border-color: rgba(124,108,255,.28); background: rgba(124,108,255,.06); }
.field input, .field select, .field textarea { min-height: 44px; border-radius: 8px; background: #0b0e15; }.field textarea { min-height: 100px; }.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(124,108,255,.13); }
.form-summary { border-color: rgba(124,108,255,.22); background: rgba(124,108,255,.06); }
.coupon-hint { margin: -6px 0 0; color: var(--muted-fg); font-size: 12px; }
.apply-expectations { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 24px; border: 1px solid var(--border); background: var(--border); }
.apply-expectations > div { min-height: 156px; padding: 20px; background: var(--card); }
.apply-expectations span { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.apply-expectations strong { display: block; margin-top: 18px; font-family: var(--display); font-size: 17px; }
.apply-expectations p { margin-top: 8px; color: var(--muted-fg); font-size: 12px; line-height: 1.7; }
.stripe-wallet-box, .stripe-setup-box, .refund-choice { margin-top: 20px; padding: 18px; border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.025); }
.stripe-setup-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
.stripe-setup-head label, .refund-choice > label { display: block; font-size: 13px; font-weight: 600; }
.stripe-setup-head p { margin-top: 5px; color: var(--muted-fg); font-size: 12px; }
.stripe-setup-head > span { color: var(--secondary); font-family: var(--mono); font-size: 9px; letter-spacing: .08em; white-space: nowrap; }
.stripe-card-element { min-height: 48px; margin-top: 15px; padding: 14px 13px; border: 1px solid var(--border-bright); border-radius: 8px; background: #0b0e15; transition: border-color .15s, box-shadow .15s; }
.stripe-card-element:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(124,108,255,.12); }
.stripe-wallet-box [id="stripe-wallet-element"] { margin-top: 15px; }
.stripe-setup-box .btn { margin-top: 12px; }
.choice-line { display: block; margin-top: 11px; color: var(--fg); font-size: 13px; font-weight: 400 !important; }
.choice-line input { width: auto; min-height: auto; margin-right: 7px; accent-color: var(--primary); }
.legal-agreement { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: start; }
.legal-agreement input { width: 18px !important; min-height: 18px; margin: 3px 0 0; }
.legal-agreement label { min-width: 0; line-height: 1.6; }
.temporary-credentials { display: grid; gap: 8px; margin-top: 18px; padding: 18px; border: 1px solid rgba(89,229,193,.3); border-radius: 10px; background: rgba(89,229,193,.06); }
.temporary-credentials > span { color: var(--secondary); font-family: var(--mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.temporary-credentials strong { font-size: 14px; }.temporary-credentials b { color: var(--secondary); font-family: var(--mono); letter-spacing: .04em; }
.temporary-credentials p { color: var(--muted-fg); font-size: 12px; }
.lookup-wrap { max-width: 1100px; }
.lookup-query-card { max-width: 680px; margin: 0 auto 48px; }
.lookup-wrap .lookup-query-card .form-card { padding: clamp(24px, 4vw, 34px); }
.lookup-query-card .form-card-head { display: block; }
.lookup-query-card .form-card-head > span { display: block; margin-bottom: 12px; }
.lookup-result { margin-top: 0; padding: 0; border: 0; background: transparent; }
.lookup-result h2 { font-size: clamp(28px, 4vw, 40px); }
.lookup-result .form-intro { margin-top: 8px; color: var(--muted-fg); }
.lookup-order-info { display: grid; gap: 8px; margin-top: 24px; padding: 0; border: 0; color: var(--muted-fg); font-size: 13px; }
.lookup-order-info strong { color: var(--fg); font-size: 16px; }.lookup-login { margin-top: 18px; }
.lookup-orders { max-width: 1100px; margin: 0 auto 48px; }.lookup-orders .section-head { margin-bottom: 18px; }.lookup-orders .section-head > p { max-width: 260px; }
.order-record { overflow: hidden; margin-top: 18px; border: 1px solid var(--border-bright); border-radius: 14px; background: var(--card); }
.order-record-head { display: flex; justify-content: space-between; gap: 20px; align-items: start; padding: 24px; border-bottom: 1px solid var(--border); background: linear-gradient(110deg, rgba(124,108,255,.10), rgba(89,229,193,.035)); }
.order-record-head h2 { margin-top: 8px; font-size: clamp(20px, 3vw, 28px); }.order-status { flex: none; padding: 7px 11px; border: 1px solid rgba(89,229,193,.3); border-radius: 999px; color: var(--secondary); background: rgba(89,229,193,.08); font-family: var(--mono); font-size: 10px; white-space: nowrap; }
.order-record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--border); }.order-record-section { min-width: 0; padding: 28px; background: var(--card); }.order-record-section h3 { margin-top: 9px; font-size: 18px; }.lookup-data-list { display: grid; gap: 0; margin-top: 16px; }.lookup-data-list > div { display: grid; grid-template-columns: minmax(106px, .36fr) minmax(0, 1fr); gap: 16px; align-items: start; padding: 11px 0; border-top: 1px solid var(--border); font-size: 13px; }.lookup-data-list dt, .lookup-data-list dd { margin: 0; }.lookup-data-list dt { color: var(--muted-fg); }.lookup-data-list dd { min-width: 0; overflow-wrap: anywhere; line-height: 1.55; }.contract-status-row, .credential-row { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-top: 16px; padding: 12px 0; border-top: 1px solid var(--border); font-size: 12px; }.contract-status-row strong, .credential-row strong { color: var(--secondary); font-family: var(--mono); overflow-wrap: anywhere; text-align: right; }.order-record-section > .btn { margin-top: 14px; }.credential-section { background: linear-gradient(145deg, rgba(89,229,193,.055), var(--card)); }
.order-lookup-hero .wrap { padding-top: 58px; padding-bottom: 48px; }
.order-lookup-hero { min-height: 280px; }
.order-lookup-hero h1 { max-width: 620px; margin-top: 10px; font-size: clamp(30px, 4vw, 46px); line-height: 1.1; }
.order-lookup-hero p { max-width: 560px; margin-top: 14px; font-size: 14px; line-height: 1.7; }
.lookup-wrap .form-card { padding: 24px; }
.lookup-wrap .field { margin-bottom: 14px; }
.lookup-wrap .field label { font-size: 12px; }
.lookup-wrap .btn { min-height: 42px; padding: 10px 16px; font-size: 13px; }
.lookup-result h2 { font-size: clamp(28px, 4vw, 40px); }
.lookup-result .form-intro { margin-bottom: 16px; font-size: 12px; }

/* ---------- footer ---------- */
.site-footer { background: var(--bg); border-top: 1px solid var(--border); }
.site-footer .wrap { padding: 60px 24px 30px; }
.foot-grid { display: grid; grid-template-columns: 1.55fr repeat(4, 1fr); gap: 28px; }
.foot-brand p { color: var(--muted-fg); font-size: 13.5px; margin-top: 14px; max-width: 280px; }
.foot-status { display: flex; align-items: center; gap: 8px; margin-top: 18px; color: var(--secondary); font-family: var(--mono); font-size: 9px; letter-spacing: .04em; }
.foot-status i { width: 6px; height: 6px; border-radius: 50%; background: var(--secondary); box-shadow: 0 0 9px var(--secondary); }
.foot-col h4 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted-fg); margin: 0 0 14px; }
.foot-col a, .foot-col span { display: block; color: var(--fg); font-size: 13.5px; margin-bottom: 10px; }
.foot-col a:hover { color: var(--primary); }
.foot-bottom {
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  margin-top: 46px; padding-top: 24px; border-top: 1px solid var(--border);
  color: var(--muted-fg); font-size: 13px;
}
.foot-bottom a { margin-left: 18px; }
.foot-bottom a:hover { color: var(--primary); }

/* ---------- responsive ---------- */
@media (max-width: 900px) {
  .features .wrap { grid-template-columns: repeat(2, 1fr); }
  .grid, .steps { grid-template-columns: 1fr; }
  .foot-grid { grid-template-columns: 1fr 1fr; }
  .nav { gap: 18px; }
  .header-account { display: none; }
  .header-location { display: none; }
  .hero .hero-grid { grid-template-columns: 1fr; gap: 42px; }
  .rental-console { width: min(100%, 680px); justify-self: center; }
  .detail-grid { grid-template-columns: 1fr; gap: 44px; }
  .detail-visual { min-height: 390px; }
  .delivery-grid, .detail-info-grid, .contact-layout { grid-template-columns: 1fr; gap: 42px; }
  .guide-steps, .story-grid, .faq-layout, .about-hero-grid, .about-contact { grid-template-columns: 1fr; gap: 42px; }
  .process-heading { margin-bottom: 42px; }
  .guide-steps { max-width: 680px; margin: 0 auto; gap: 0; }
  .guide-steps::before { left: 43px; right: auto; top: 43px; bottom: 43px; width: 1px; height: auto; background: linear-gradient(180deg, rgba(89,229,193,.18), rgba(89,229,193,.62), rgba(89,229,193,.18)); }
  .guide-steps article { display: grid; grid-template-columns: 86px 1fr; column-gap: 22px; min-height: 132px; padding: 0 0 32px; text-align: left; }
  .guide-steps article:last-child { min-height: 86px; padding-bottom: 0; }
  .guide-steps article > span { grid-row: 1 / 3; margin: 0; }
  .guide-steps h3 { margin: 10px 0 7px; }
  .guide-steps p { max-width: none; margin: 0; }
  .rental-plan-grid, .rental-terms-grid { grid-template-columns: 1fr; }
  .principle-grid { grid-template-columns: repeat(2, 1fr); }
  .cart-page-item, .cart-page-summary { align-items: stretch; flex-direction: column; }
  .cart-page-price { justify-content: space-between; }
  .principle-grid.about-values { grid-template-columns: repeat(2, 1fr); }
  .service-standard-grid { grid-template-columns: repeat(2, 1fr); }
  .apply-grid { grid-template-columns: 1fr; }
  .apply-grid-payment { position: static; }
}
@media (max-width: 760px) {
  .order-record-grid { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .nav { display: none; }
  .site-header .wrap { position: relative; gap: 10px; }
  .header-brand-group { flex: 1; }
  .menu-toggle { display: block; margin-left: auto; flex: none; }
  .nav.is-open { position: absolute; top: 68px; left: 12px; right: 12px; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 8px; border: 1px solid var(--border); border-radius: 12px; background: rgba(14,17,25,.98); box-shadow: 0 18px 44px rgba(0,0,0,.38); }
  .nav.is-open a { padding: 12px 14px; }
  .header-cart > span { display: none; }
  .header-actions { gap: 5px; }
  .site-announcement-inner { gap: 10px; min-height: 48px; padding-left: 18px; padding-right: 18px; }
  .site-announcement-link { gap: 10px; font-size: 12px; }
  .site-announcement-link > span { font-size: 11px; }
  .notice-grid { grid-template-columns: 1fr; }
  .coupon-callout { align-items: flex-start; flex-wrap: wrap; gap: 12px; }
  .coupon-callout .btn { width: 100%; margin-left: 0; }
  .features .wrap { grid-template-columns: 1fr; }
  .foot-grid { grid-template-columns: 1fr; }
  .site-footer .wrap { padding-top: 46px; }
  .foot-bottom { display: block; margin-top: 32px; line-height: 1.8; }
  .foot-bottom > span:last-child { display: block; margin-top: 8px; }
  .foot-bottom a { margin: 0 16px 0 0; }
  .wrap { padding-left: 18px; padding-right: 18px; }
  .hero .wrap { padding: 78px 18px 64px; }
  .hero h1 { font-size: clamp(40px, 13vw, 58px); }
  .hero p { font-size: 15px; line-height: 1.75; }
  .hero-actions .btn { width: 100%; }
  .rental-console { transform: none; border-radius: 13px; }
  .console-device { grid-template-columns: 1fr; gap: 2px; min-height: 0; padding: 20px; }
  .console-art { height: 145px; }
  .console-device-copy strong { font-size: 18px; }
  .console-metrics > div { padding: 13px 10px; }
  .console-metrics span { font-size: 9px; }
  .console-metrics strong { font-size: 12px; }
  .section { padding: 68px 0; }
  .page-hero .wrap { padding-top: 70px; padding-bottom: 62px; }
  .page-hero h1 { font-size: clamp(40px, 13vw, 58px); }
  .order-lookup-hero .wrap { padding-top: 48px; padding-bottom: 38px; }
  .order-lookup-hero h1 { max-width: 330px; font-size: clamp(30px, 9vw, 40px); line-height: 1.16; }
  .order-lookup-hero p { max-width: 340px; margin-top: 12px; font-size: 13px; line-height: 1.65; }
  .lookup-wrap { padding-left: 14px; padding-right: 14px; }
  .lookup-wrap .form-card { padding: 20px 18px; }
  .lookup-wrap .btn { width: 100%; }
  .order-record-head { flex-direction: column; gap: 12px; padding: 20px 18px; }
  .order-record-section { padding: 20px 18px; }
  .lookup-data-list > div { grid-template-columns: 1fr; gap: 4px; }
  .credential-row, .contract-status-row { align-items: flex-start; flex-direction: column; gap: 6px; }
  .contract-status-row strong, .credential-row strong { text-align: left; }
  .guide-facts { grid-template-columns: 1fr; }
  .guide-facts div { border-right: 0; border-bottom: 1px solid var(--border); }
  .guide-facts div:last-child { border-bottom: 0; }
  .guide-steps article { grid-template-columns: 70px 1fr; column-gap: 16px; min-height: 122px; }
  .guide-steps article:last-child { min-height: 70px; }
  .guide-steps article > span { width: 70px; height: 70px; font-size: 18px; }
  .guide-steps::before { left: 35px; top: 35px; bottom: 35px; }
  .section-head { display: block; margin-bottom: 28px; }
  .section-head > p { margin-top: 16px; }
  .home-essentials-note { display: block; padding: 16px; }
  .home-essentials-note span { display: block; margin-top: 8px; }
  .home-essentials-note .text-link { display: inline-flex; margin-top: 14px; }
  .scenario-grid { grid-template-columns: 1fr; grid-template-rows: auto; }
  .scenario-wide { grid-row: auto; padding-top: 100px; }
  .info-grid.three { grid-template-columns: 1fr; }
  .service-standard-grid { grid-template-columns: 1fr; }
  .service-standard-grid article { min-height: auto; }
  .about-stats .wrap { grid-template-columns: repeat(2, 1fr); }
  .about-stats .wrap > div { border-bottom: 1px solid var(--border); }
  .about-stats .wrap > div:nth-child(2) { border-right: 0; }
  .about-stats .wrap > div:nth-last-child(-n+2) { border-bottom: 0; }
  .principle-grid.about-values { grid-template-columns: 1fr; }
  .detail-price { grid-template-columns: 1fr 1fr; }
  .detail-price > div:last-child { grid-column: 1 / -1; border-top: 1px solid var(--border); }
  .detail-copy h1 { font-size: clamp(38px, 12vw, 54px); }
  .detail-actions .btn { width: 100%; }
  .detail-visual { min-height: 310px; }
  .orbit-two { width: 300px; height: 300px; }
  .orbit-one { width: 220px; height: 220px; }
  .detail-screen { transform: scale(.82); }
  .catalog-tools { grid-template-columns: 1fr; padding: 12px; }
  .filter-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 3px; scrollbar-width: thin; }
  .filter-chip { flex: none; }
  .tool-tail { justify-content: space-between; }
  .tool-tail select { flex: 1; }
  .catalog-meta { align-items: flex-start; flex-wrap: wrap; }
  .catalog-meta span { width: 100%; margin-left: 0; }
  .card { padding: 17px; }
  .card-actions { grid-template-columns: 1fr 1.25fr; }
  .coupon-row { grid-template-columns: 1fr; }
  .apply-expectations { grid-template-columns: 1fr; }
  .apply-expectations > div { min-height: auto; }
  .form-card { padding: 22px 18px; }
  .apply-progress { gap: 5px; justify-content: space-between; }
  .apply-progress b { width: 14px; }
  .apply-progress span { gap: 4px; font-size: 9px; }
}
/* ---------- motion ----------
   自托管：全部原生 CSS 动画 + IntersectionObserver（见 layout.ts 内联脚本），
   不挂第三方 CDN。参考稿（airo.ai 分享页）里每个板块进场都有动效；这里对齐
   同样的手法——分段入场、滚动触发的错落淡入、微交互——但不依赖任何外部脚本
   加载成功与否，避免网络/广告拦截把全站动效整体拿掉却毫无提示。
*/
@keyframes hero-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes console-in { from { opacity: 0; transform: translateY(18px) rotate(3deg); } to { opacity: 1; transform: translateY(0) rotate(1.2deg); } }
@keyframes console-float { 0%, 100% { transform: translateY(0) rotate(1.2deg); } 50% { transform: translateY(-7px) rotate(1.2deg); } }
@keyframes reveal-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes glow-drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-3%, 2%); } }
@keyframes bump { 0%, 100% { transform: scale(1); } 45% { transform: scale(.972); } }
@keyframes badge-pop { 0% { opacity: 0; transform: scale(.4) translateY(6px); } 65% { opacity: 1; transform: scale(1.14) translateY(0); } 100% { transform: scale(1) translateY(0); } }
@keyframes row-out { to { opacity: 0; transform: translateX(28px) scale(.97); } }
@keyframes card-in { from { opacity: 0; transform: translateY(22px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }

.hero::after { animation: glow-drift 15s ease-in-out infinite; }
.hero-copy > *, .page-hero .wrap > * { opacity: 0; animation: hero-in .7s cubic-bezier(.16,.84,.44,1) forwards; }
.hero-copy > *:nth-child(1), .page-hero .wrap > *:nth-child(1) { animation-delay: .02s; }
.hero-copy > *:nth-child(2), .page-hero .wrap > *:nth-child(2) { animation-delay: .1s; }
.hero-copy > *:nth-child(3), .page-hero .wrap > *:nth-child(3) { animation-delay: .2s; }
.hero-copy > *:nth-child(4), .page-hero .wrap > *:nth-child(4) { animation-delay: .3s; }
.hero-copy > *:nth-child(5), .page-hero .wrap > *:nth-child(5) { animation-delay: .38s; }
.rental-console { animation: console-in .9s cubic-bezier(.16,.84,.44,1) .32s both, console-float 3.2s ease-in-out 1.3s infinite; }

/* 由 layout.ts 的 IntersectionObserver 打上 .reveal，进入视口后加 .is-in 播放 */
.reveal { opacity: 0; }
.reveal.is-in { animation: reveal-in .64s cubic-bezier(.16,.84,.44,1) both; }
.reveal:nth-child(2) { animation-delay: .06s; }
.reveal:nth-child(3) { animation-delay: .12s; }
.reveal:nth-child(4) { animation-delay: .18s; }
.reveal:nth-child(5) { animation-delay: .24s; }
.reveal:nth-child(6) { animation-delay: .3s; }
.reveal:nth-child(7) { animation-delay: .36s; }
.reveal:nth-child(8) { animation-delay: .42s; }

/* 购物车 / 下单流程的微交互 */
.cart-checkout-item { animation: card-in .5s cubic-bezier(.16,.84,.44,1) both; }
.cart-checkout-item:nth-child(2) { animation-delay: .05s; }
.cart-checkout-item:nth-child(3) { animation-delay: .1s; }
.cart-checkout-item:nth-child(4) { animation-delay: .15s; }
.cart-checkout-item:nth-child(5) { animation-delay: .2s; }
.cart-checkout-item:nth-child(6) { animation-delay: .25s; }
.cart-checkout-item.is-leaving { animation: row-out .22s ease-in forwards; }
.card.is-bumped { animation: bump .46s cubic-bezier(.34,1.2,.4,1); }
.cart-count.is-popped { animation: badge-pop .46s cubic-bezier(.34,1.56,.64,1); }
#apply-done.is-in { animation: card-in .6s cubic-bezier(.16,.84,.44,1); }

/* 按钮 / 卡片微交互（仅真正能悬停的设备上启用，避免触屏误触卡顿） */
@media (hover: hover) {
  .btn-primary { position: relative; overflow: hidden; }
  .btn-primary::after {
    content: ""; position: absolute; inset: 0; transform: translateX(-120%);
    background: linear-gradient(115deg, transparent, rgba(255,255,255,.32), transparent);
  }
  .btn-primary:hover::after { transform: translateX(120%); transition: transform .6s ease; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`

// 内容指纹：STYLES 一变就变。页面用 /styles.css?v=${STYLE_VERSION} 引样式，
// 使改版后回访用户不被 1 天的长缓存卡在旧样式（例如旧的 logo 尺寸）。
export const STYLE_VERSION = ((): string => {
  let h = 5381
  for (let i = 0; i < STYLES.length; i++) h = (((h << 5) + h) ^ STYLES.charCodeAt(i)) >>> 0
  return h.toString(36)
})()
