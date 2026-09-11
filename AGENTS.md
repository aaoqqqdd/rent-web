# AGENTS.md — rent-web（GeekSlope 市场官网）

面向 AI 编码代理的子项目指引。人类请先读 [README.md](README.md)。
**这是与 rent 主应用完全独立的项目**，单独部署、单独的 `package.json` / `wrangler.jsonc`。

## 这个项目是什么

对外的营销官网，设计还原自参考稿（airo.ai 分享页 `airo.ai/share/…`）。
展示页实时读 rent 的 D1；`/apply` 页做「注册 + 提交租赁申请」，落到 rent 的公开接口。
`/login` 页做「独立注册 / 登录入口」：注册直接写 rent 的 D1 `users` 表（`src/auth.ts`，
哈希 / 字段与 rent `/register` 完全一致），登录跳转到 `${APP_URL}/login`。
**本站不实现登录态**：会话由 rent 持有，注册后客户用同一套邮箱 / 密码去 rent 登录付款签约。

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
src/index.ts          Worker 入口：路由 + 边缘缓存（caches.default，HTML 60s / CSS 1d）
src/db.ts             实时数据访问层：listProducts / pickFeatured / getSiteContact / getRentalConfig
src/theme.ts          全站 CSS（字符串常量，路由 /styles.css 返回）
src/layout.ts         页面外壳：<head> / 顶栏 / 页脚 / esc()
src/pages/home.ts     首页：Hero → 四大保障 → 为你精选（实时）→ 三步流程 → 收尾 CTA
src/pages/products.ts 产品目录：按类别分组的全部在售设备（实时）
src/pages/apply.ts    下单页：设备/租期/取还 + 注册字段，前端 POST 到 rent 的 /public/rental-request
src/pages/login.ts    注册 / 登录页：注册面板 POST 到本站 /register，登录面板跳 ${APP_URL}/login
src/pages/content.ts  租赁说明 / 关于我们 / 404（静态文案）
src/auth.ts           注册写库：PBKDF2 哈希 + INSERT users（与 rent /register 等价）+ 共用限流表
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

展示类查询都在 `try/catch` 里，D1 不可用或表结构变动时页面仍能出图。
本项目对 D1 的写操作只有一处：`/login` 页注册 → `src/auth.ts` 直接 `INSERT INTO users`
（CUSTOMER，PBKDF2，与 rent 登录兼容）。建 orders 等其余写操作仍全部发生在 rent 侧的
`/public/rental-request`。

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

## 约定与注意事项

- **rent 侧的改动**：新增 `src/actions/public/rentalRequest.ts` 与 `POST /public/rental-request` 路由、
  全局中间件里对该路径的 CORS / 来源放行（`PUBLIC_WEB_ORIGIN`）与限流。改这些要在 rent 仓库里跑
  `npx tsc --noEmit` + `npm test`，并重新部署 rent。
- **业务事实**：送货上门仅限墨尔本 CBD 及周边周边地区（Docklands、Southbank、South Yarra、Carlton 等）；
  墨尔本其他郊区可到店自取。官网订单先 `pending_approval`，管理员确认后才签合同、才付款。
- **`APP_URL`** 必须在部署时设成 rent 主应用真实地址，否则 `/apply` 提交无处可去。
- 所有用户可见的动态字符串都要经 `esc()`（`src/layout.ts`）。
- 边缘缓存 60s：产品价格改动后最多 1 分钟生效。
- 改完跑 `npm run typecheck`。
