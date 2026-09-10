# AGENTS.md — rent-web（GeekSlope 市场官网）

面向 AI 编码代理的子项目指引。人类请先读 [README.md](README.md)。
**这是与 `../`（rent 主应用）完全独立的项目**，单独部署、单独的 `package.json` / `wrangler.jsonc`。

## 这个项目是什么

对外的营销官网，设计还原自参考稿（airo.ai 分享页 `airo.ai/share/…`）。
只做展示，不含登录 / 下单 / 支付 —— 所有「立即租赁」按钮跳转到 rent 主应用（`APP_URL`）。

## 技术栈

- **运行时**：Cloudflare Workers（独立 Worker，name：`geekslope-web`）
- **框架**：Hono，服务端渲染，模板字符串拼 HTML，无前端框架、无构建步骤
- **数据库**：只读复用 rent 的 D1 库，binding `RENT`（`database_id` 与 `../wrangler.jsonc` 一致）
- **语言**：TypeScript，`strict: true`，`moduleResolution: Bundler`
- **依赖**：仅 `hono`

## 常用命令（在 `rent-web/` 目录下）

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地 `wrangler dev`（launch.json 里的 `geekslope-web` 用 8811） |
| `npm run typecheck` | `tsc --noEmit`，改完必须跑 |
| `npm run deploy` | `wrangler deploy --minify`（部署 geekslope-web，不影响 rent） |

## 目录结构

```text
src/index.ts          Worker 入口：路由 + 边缘缓存（caches.default，HTML 60s / CSS 1d）
src/db.ts             实时数据访问层（只读 RENT）：listProducts / pickFeatured / getSiteContact
src/theme.ts          全站 CSS（字符串常量，路由 /styles.css 返回）
src/layout.ts         页面外壳：<head> / 顶栏 / 页脚 / esc()
src/pages/home.ts     首页：Hero → 四大保障 → 为你精选（实时）→ 三步流程 → 收尾 CTA
src/pages/products.ts 产品目录：按类别分组的全部在售设备（实时）
src/pages/content.ts  租赁说明 / 关于我们 / 404（静态文案）
```

## 数据来源（哪些是实时从 D1 读的）

| 展示内容 | 来源 | 兜底 |
| --- | --- | --- |
| 产品名称 / 型号 / CPU / RAM / 存储 / GPU | `devices` 表 | 缺字段则不显示该 chip |
| 日租价、押金 | `devices.pricePerDay` / `devices.depositAmount` | 0 时显示「询价」 |
| 月租展示价 | `日租 × MONTHLY_MULTIPLIER`（默认 20，取整） | 仅展示，真实计费在 rent |
| 「最低 $X/day」 | `MIN(pricePerDay)` | 无数据时改用通用文案 |
| 是否「现货可租」 | `devices.lifecycle_status ∈ {READY, RESERVED}`，无该列则回退 `status='available'` | — |
| 公司名 / 电话 / 邮箱 / 配送范围 | `systemSettings` 表 key=`companyDetails`（JSON） | 代码内 GeekSlope 默认值；`CONTACT_PHONE` / `CONTACT_EMAIL` 变量可再覆盖 |

所有查询都在 `try/catch` 里，D1 不可用或表结构变动时页面仍能出图。
**只读**：本项目绝不对 `RENT` 执行写操作。

## 约定与注意事项

- **不碰 rent 主应用**：不改 `../src`、`../wrangler.jsonc`、`../migrations`；不加迁移（分类由 `src/db.ts` 的 `categorize()` 用启发式从 name/model/gpu 推断，不依赖数据库新增列）。
- **业务事实**：送货上门仅限墨尔本 CBD 及周边内城区（Docklands、Southbank、South Yarra、Carlton 等）；墨尔本其他郊区可到店自取。改文案时保持一致。
- **`APP_URL`** 必须在部署时设成 rent 主应用真实地址，否则所有「立即租赁」按钮指向占位域名。产品卡按钮深链到 `${APP_URL}/customer/rent/<device-id>`。
- 所有用户可见的动态字符串都要经 `esc()`（`src/layout.ts`）。
- 边缘缓存 60s：产品价格改动后最多 1 分钟生效；需要立即刷新可在 Cloudflare 控制台 Purge 或临时调小 `HTML_TTL`。
- 改完跑 `npm run typecheck`。
