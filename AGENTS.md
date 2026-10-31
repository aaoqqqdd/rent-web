# AGENTS.md — rent-web（GeekSlope 市场官网）

面向 AI 编码代理的子项目指引。人类请先读 [README.md](README.md)。
**这是与 rent 主应用完全独立的项目**，单独部署、单独的 `package.json` / `wrangler.jsonc`。

## 这个项目是什么

对外的营销官网，设计还原自参考稿（airo.ai 分享页 `airo.ai/share/…`）。
展示页实时读 rent 的 D1；`/apply` 页做「注册 + 提交租赁申请」，落到 rent 的公开接口。
`/login` 页做「独立注册 / 登录入口」：注册直接写 rent 的 D1 `users` 表（`src/auth.ts`，
哈希 / 字段与 rent `/register` 完全一致）；登录使用共享 `users` 表校验密码。
**登录态：官网与 rent 单点登录（SSO）**。`/login` 用共享 `users` 表校验密码（PBKDF2，
算法与 rent 一致），会话写入两站共用的 `auth_sessions` 表并在官网域下发 `session` cookie；
随后经 `/sso/start` → rent 的 `GET /sso/consume?t=`（一次性握手 token，表 `sso_handoff_tokens`，
60s 失效）在 rent 域也建立会话。登出（`/logout`）撤销该用户全部会话，两站一起掉线。
忘记密码仍走 rent（`${APP_URL}/forgot-password`）。

## 技术栈

- **运行时**：Cloudflare Workers（独立 Worker，name：`geekslope-web`）
- **框架**：Hono，服务端渲染，模板字符串拼 HTML，无前端框架、无构建步骤
- **数据库**：复用 rent 的 D1 库，binding `RENT`（`database_id` 与 rent 一致）
- **语言**：TypeScript，`strict: true`，`moduleResolution: Bundler`
- **依赖**：仅 `hono`

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地 `wrangler dev`（8811；launch.json 里的 `geekslope-web`） |
| `npm run typecheck` | `tsc --noEmit`，改完必须跑 |
| `npm run deploy` | `wrangler deploy --minify`（部署 geekslope-web，不影响 rent） |

## 目录结构

```text
src/index.ts          Worker 入口：路由 + 边缘缓存（caches.default，HTML 60s / CSS 1d；带 session cookie 的请求绕过缓存）
src/db.ts             实时数据访问层（只读）：listProducts / pickFeatured / getSiteContact / getRentalConfig
src/auth.ts           登录 / 会话：密码校验（移植 rent PBKDF2）/ auth_sessions / sso_handoff_tokens / 限流
src/theme.ts          全站 CSS（字符串常量，路由 /styles.css 返回）
src/layout.ts         页面外壳：<head> / 顶栏（按登录态切换）/ 页脚 / esc()
src/pages/home.ts     首页：Hero → 四大保障 → 为你精选（实时）→ 三步流程 → 收尾 CTA
src/pages/products.ts 产品目录：按类别分组的全部在售设备（实时）
src/pages/apply.ts    下单页：设备/租期/取还 + 注册字段，前端 POST 到 rent 的 /public/rental-request
src/pages/login.ts    注册 / 登录页：注册 POST 到本站 /register，登录 POST 到本站 /login 并进入 SSO
src/pages/content.ts  租赁说明 / 关于我们 / 404（静态文案）
src/pages/legal.ts    法律 / 合规文档页外壳（正文实时读 D1，见 db.getLegalDocument）
```

## 数据来源（哪些是实时从 D1 读的）

| 展示内容 | 来源 | 兜底 |
| --- | --- | --- |
| 产品名称 / 型号 / CPU / RAM / 存储 / GPU | `devices` 表 | 缺字段则不显示该 chip |
| 日租价、押金 | `devices.pricePerDay` / `devices.depositAmount` | 0 时显示「询价」 |
| 月租展示价 | `日租 × MONTHLY_MULTIPLIER`（默认 20，取整） | 仅展示，真实计费在 rent |
| 「最低 $X/day」 | `MIN(pricePerDay)` | 无数据时改用通用文案 |
| 是否「现货可租」 | `devices.lifecycle_status ∈ {READY, RESERVED}`，无该列则回退 `status='available'` | — |
| 公司名 / 电话 / 邮箱 / 配送范围 | `systemSettings` key=`companyDetails`（JSON） | 代码内 GeekSlope 默认值；`CONTACT_PHONE` / `CONTACT_EMAIL` 变量可再覆盖 |
| 最短租期、可选自取点 | `systemSettings` key=`rentalRules` / `companyDetails.pickupLocations` | 1 天 / 单个占位自取点 |
| 网站法律文档（服务条款 / 隐私政策 / 用户协议 / Cookie / 退款政策 / 消费者权利 / 投诉 / 可接受使用 / 软件协议） | `systemSettings` key=`serviceTerms` / `privacyPolicy` / `userTerms` / `cookiePolicy` / `copyrightNotice` / `consumerRights` / `complaintsPolicy` / `acceptableUsePolicy` / `softwareTerms`（HTML，含 `{company_*}` 与版本占位符，配合 `legalMetadata`） | 管理员未发布（字段为空）时显示「整理中」占位页 |

展示类查询都在 `try/catch` 里，D1 不可用或表结构变动时页面仍能出图。
**写库范围**：官网注册会写 `users`，登录会写 `auth_sessions`（登录会话）和
`sso_handoff_tokens`（一次性握手 token）；建单仍走 rent 侧 `/public/rental-request`。

## 下单 / 注册流程

- `/apply` 表单字段：`deviceId` / `startDate` / `endDate` / `startPeriod` / `endPeriod` /
  `deliveryMethod` / `pickupLocation` 或 `deliveryStreet|Suburb|State|Postcode` /
  `contactName` / `contactEmail` / `contactPhone` / `password` / `couponCode` / `rentalNote` /
  `agree` / `cf-turnstile-response`。
- 前端 `fetch` JSON POST 到 `${APP_URL}/public/rental-request`，期望 `{ ok, message }`；
  成功后隐藏表单、显示「申请已提交」。**不再跳转签署页**——签约在管理员确认后进行。
- rent 侧（`../src/actions/public/rentalRequest.ts`）：Turnstile → 校验 → 注册/复用
  `users`（CUSTOMER，PBKDF2）→ `orders` 插入 `status='pending_approval'`（无合同、无收款）→
  通知在职管理员。

## 登录 / SSO 流程

- 顶栏按钮：未登录 →「登录 / 注册」(`/login?tab=login`)；官网已登录 →「进入 Dashboard」(`/sso/start`) +「退出」(`/logout`)。
- 官网 `geekslope.de5.net` 在页面加载及切回标签页时，通过浏览器携带 Cookie 查询 dashboard 的 `/public/session`（仅放行 `PUBLIC_WEB_ORIGIN`，只返回登录布尔值，禁止缓存）。dashboard 已登录时，按钮直达 `https://dashboard.geekslope.de5.net`；官网自身会话另由 `/api/session` 校验。不要在服务端代查 dashboard Cookie，也不要把个人登录态写入营销页缓存。
- `POST /login`：同源校验 → `web-login` 限流（10 次 / 10 分钟 / IP）→ `verifyCredentials`
  （`users` 表，仅 `status='active' AND account_type='formal'`）→ `createSession` 写 `auth_sessions`
  + 下发官网域 `session` cookie（12h，勾「记住」30d）→ 302 到 `/sso/start`。
- `GET /sso/start`：官网已登录 → 签发一次性握手 token（`sso_handoff_tokens`，60s）→ 302 到
  `${APP_URL}/sso/consume?t=`。
- `GET /logout`：撤销该用户在 `auth_sessions` 的**全部**行（官网 + rent 一起掉线）+ 清 cookie。
- 携带 `session` cookie 的请求绕过边缘缓存（否则会缓存带登录态的顶栏导致串号）。

## 反馈层（Toast / 确认弹窗）

- 全站统一实现在 `src/components/feedback.ts`，由 `layout.ts` 注入每个页面；页面脚本调用
  `window.GeekSlopeUI.toast(message, { type, title })` 与
  `window.GeekSlopeUI.confirm({ title, message, details, confirmText, cancelText, variant })`。
- 表单校验错误留在字段 / 表单内（`.form-alert`、`.inline-form-error`）；异步结果用 Toast；
  **退出登录、提交租赁申请**等高风险动作必须先走确认弹窗。业务代码不要直接用
  `alert()` / `confirm()`（`<dialog>` 不可用的旧浏览器由反馈层内部兜底）。
- 模态中的动态内容用 `textContent` 注入；新文案优先传 `uiText(zh, en)` / `t()`，不要拼 HTML。

## 约定与注意事项

- **rent 侧的改动**：① 新增 `src/actions/public/rentalRequest.ts` 与 `POST /public/rental-request` 路由、
  全局中间件里对该路径的 CORS / 来源放行（`PUBLIC_WEB_ORIGIN`）与限流；② 新增 `GET /sso/consume?t=`
  （`../rent/src/index.ts`，`/login` POST 之后）：校验 `sso_handoff_tokens` 一次性 token → 立即销毁
  → `createAuthSession` + 下发 rent 域 `session` cookie → 302 到 `/`。改这些要在 rent 仓库里跑
  `npx tsc --noEmit` + `npm test`，并重新部署 rent。
- **业务事实**：送货上门仅限墨尔本 CBD 及周边周边地区（Docklands、Southbank、South Yarra、Carlton 等）；
  墨尔本其他郊区可到店自取。官网订单先 `pending_approval`，管理员确认后才签合同、才付款。
- **`APP_URL`** 必须在部署时设成 rent 主应用真实地址，否则 `/apply` 提交无处可去。
- 所有用户可见的动态字符串都要经 `esc()`（`src/layout.ts`）。
- 边缘缓存 60s：产品价格改动后最多 1 分钟生效。
- 改完跑 `npm run typecheck`。

## 安全基线（改路由 / 中间件前先读）

- 所有安全响应头（CSP / X-Frame-Options / nosniff / Referrer-Policy / Permissions-Policy /
  COOP / CORP / HSTS）由 `src/index.ts` 的全局中间件统一写入，并在 `await next()` **之后再写一遍**
  到 `c.res.headers`。原因：`cachedHtml()` 等处理器直接 `return new Response(...)`，Hono 的
  `c.header()` 不会合并进这类响应；只写一次会导致所有营销页丢 CSP（已验证回归）。
- 从 `caches.default` 取出的响应 headers 是**只读**的，必须先
  `new Response(cached.body, { headers: new Headers(cached.headers) })` 再返回，否则补安全头会抛错。
- `/api/account-balance` 只返回**当前 session 用户自己**的余额；未登录返回
  `requiresLogin: true` 且不含任何账户信息。不要按 `?email=` 放行。
- 结账 `/api/rental-request`：已有账号必须带 session 才能改资料 / 用余额 / 绑礼品卡
  （`ownsAccount`）；未登录只允许用新邮箱创建账号并按卡支付。
- 请求体上限 128 KB：`Content-Length` 检查 + `parseRequestBody()` 的流式字节预算
  （防 `Transfer-Encoding: chunked` 绕过）。新增 JSON 接口请复用 `parseRequestBody()`。
- 上游（Stripe / Square）错误只写日志，不把 `error.message` 回显给访客。
- 限流统一走 `enforceRateLimit()`（D1 `security_rate_limits`）。新增会调外部付费 API 的接口
  必须限流（示例：`/api/rental-setup-intent`）。
- **Turnstile 配置读共享 D1**：`src/turnstile.ts` 优先读取 rent 后台
  `/admin/api-settings` 写入的 `systemSettings.turnstileConfig`（site key 明文、
  secret 用 `SETTINGS_ENCRYPTION_KEY` 加密），失败才回退 `TURNSTILE_SITE_KEY` /
  `TURNSTILE_SECRET_KEY`。解密/读表统一走 `src/settings.ts`（与 delivery 配置同一套约定），
  读取失败一律软失败。后台配置存在但解不开时打日志并按「未配置」处理（不渲染 widget、不假装有校验）。
- 第三方脚本：Tawk.to 客服组件在 CSP 里显式放行（`embed.tawk.to`、`*.tawk.to`、`wss://*.tawk.to`），
  并在 `load` 后用 `requestIdleCallback` 懒加载。新增第三方域名必须同步更新 CSP。

## 多语言（zh/en）与移动端约定

- 渲染架构：**服务端只输出中文 HTML**，`<head>` 里的内联脚本按
  `localStorage.geekslope-language` → `navigator.languages[0]` 提前设置 `html[lang]` / `html[data-lang]`；
  `layout.ts` 末尾的翻译引擎按 `ENGLISH_COPY` 精确匹配 → `ENGLISH_PATTERNS` 正则替换翻译文本。
- **不再有「短语局部替换」兜底**：未命中的字符串保持中文（而不是拼出 `Delivery 时段` 这类中英混杂）。
  新增用户可见文案必须同时给英文：优先加到 `src/i18n.ts` 的 `ENGLISH_COPY`；动态拼接的句子加
  `ENGLISH_PATTERNS`（模式里的捕获组会经过 `normalizePatternResult()` 处理地名/顿号）。
- `src/layout.ts` 的内联脚本在 TS 模板字符串里：**所有反斜杠必须写两次**（`/\\p{Script=Han}/u`、
  `'\\n'`、`/\\s+/`）。写错会产出的页面脚本 SyntaxError，导致菜单/语言切换/购物车全部失效。
  改完用 `node -e` 对渲染后的 `<script>` 做 `new Function()` 语法检查，或跑下面的验证脚本。
- 中文标点只在 EN 模式清理（`。` 去掉、`；` 转行）；zh 模式必须与 SSR 完全一致。
- 语言切换时 `geekslope:language-change` 事件会重渲染列表/购物车/反馈层；新增动态组件请监听它。
- 自动识别的语言**不写入** localStorage，只有用户点「中 / EN」才持久化。
- 移动端：输入控件字号 ≥16px（防 iOS 聚焦缩放）、图标/语言切换/页脚链接 ≥44px 命中区、
  `.gs-toast-region` 用 `--gs-overlay-top` 贴在「header + 通告条」下方、锚点用
  `scroll-padding-top: 88px` 避免被 sticky header 遮挡。

## 验证脚本

| 命令 | 用途 |
| --- | --- |
| `node scripts/i18n-audit.mjs` | 静态扫描所有 SSR / 运行时中文字符串，检查英文覆盖率（应为 0 findings） |
| `node scripts/verify-site.mjs --lang en` | 无头 Chrome 渲染 12 个页面 × 3 视口，检查 EN 模式残留中文 / 横向溢出 / 输入字号 |
| `node scripts/verify-i18n-switch.mjs` | 语言切换（含 Toast / 弹窗 / 持久化）、移动菜单、动态文本回归 |
| `node scripts/verify-responsive.mjs` | 390 / 844×390 / 1024 / 1440 视口的溢出、Toast/弹窗几何、结账控件尺寸 |
