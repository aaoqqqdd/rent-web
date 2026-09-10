// 全站样式。设计还原自参考稿（airo.ai 分享页 GeekSlope 官网）：
// 深色底 + 青色主色 + 网格背景 + 径向光晕。路由 /styles.css 直接返回此字符串。

export const STYLES = /* css */ `
:root {
  --bg: #0a0a0f;
  --fg: #f5f5f5;
  --card: #14181f;
  --muted: #1a1f2e;
  --muted-fg: #8b93a7;
  --primary: #00e6ff;
  --primary-ink: #04222a;
  --secondary: #00c79f;
  --border: #1d2434;
  --radius: 10px;
  --maxw: 1120px;
  --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
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
h1, h2, h3 { margin: 0; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; }
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
.brand { display: inline-flex; align-items: center; }
.brand .brand-banner { height: 36px; width: auto; display: block; }
.site-footer .brand .brand-banner { height: 30px; }
@media (max-width: 620px) { .brand .brand-banner { height: 32px; } }
.nav { display: flex; align-items: center; gap: 30px; }
.nav a { color: var(--muted-fg); font-size: 14px; transition: color .15s; }
.nav a:hover { color: var(--fg); }

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
.field textarea { resize: vertical; min-height: 68px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.row3 { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.form-summary {
  background: var(--muted); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; font-size: 14px; margin-bottom: 18px;
}
.form-summary strong { color: var(--primary); }
.form-alert {
  background: rgba(255,80,80,.08); border: 1px solid rgba(255,80,80,.35);
  color: #ff9a9a; border-radius: 8px; padding: 12px 14px; font-size: 14px; margin-bottom: 16px;
}
.form-note { color: var(--muted-fg); font-size: 13px; margin-top: 14px; }
@media (max-width: 620px) {
  .row2, .row3 { grid-template-columns: 1fr; }
}

/* ---------- content pages ---------- */
.doc { max-width: 760px; }
.doc h1 { font-size: clamp(30px, 5vw, 42px); }
.doc h2 { font-size: 22px; margin-top: 40px; }
.doc p, .doc li { color: var(--muted-fg); font-size: 15.5px; }
.doc ul { padding-left: 20px; }
.doc .lead { color: var(--fg); font-size: 17px; margin-top: 16px; }

/* ---------- footer ---------- */
.site-footer { background: var(--bg); border-top: 1px solid var(--border); }
.site-footer .wrap { padding: 60px 24px 30px; }
.foot-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.2fr; gap: 40px; }
.foot-brand p { color: var(--muted-fg); font-size: 13.5px; margin-top: 14px; max-width: 280px; }
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
}
@media (max-width: 620px) {
  .nav { display: none; }
  .features .wrap { grid-template-columns: 1fr; }
  .foot-grid { grid-template-columns: 1fr; }
  .hero .wrap { padding: 88px 24px 72px; }
}
`

// 内容指纹：STYLES 一变就变。页面用 /styles.css?v=${STYLE_VERSION} 引样式，
// 使改版后回访用户不被 1 天的长缓存卡在旧样式（例如旧的 logo 尺寸）。
export const STYLE_VERSION = ((): string => {
  let h = 5381
  for (let i = 0; i < STYLES.length; i++) h = (((h << 5) + h) ^ STYLES.charCodeAt(i)) >>> 0
  return h.toString(36)
})()
