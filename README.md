# GeekSlope 市场官网（rent-web）

GeekSlope 电脑租赁的对外营销官网。**独立部署**的 Cloudflare Worker（Hono SSR），与 rent 主应用互不影响：单独的 `package.json`、`wrangler.jsonc`，单独的 Worker（`geekslope-web`）。

设计还原自参考稿：<https://airo.ai/share/djVpOHpkdTZudDpjMzU6Sk42aXc3RGRsczR2>

## 特点

- 服务端渲染、无构建步骤，仅依赖 `hono`
- **产品信息实时从数据库获取**：设备名称、配置、日租价、押金、库存状态，以及公司名 / 电话 / 邮箱 / 配送范围，全部实时读自 rent 的 D1 库（`systemSettings` + `devices`）
- 深色 + 青色主色、网格背景的落地页
- `/apply` 下单：访客**注册账号 + 提交租赁申请**，订单进入 `pending_approval`，管理员在 rent 后台确认后再安排签约与付款
- 边缘缓存（`caches.default`）：HTML 60 秒、CSS 1 天

## 页面与数据

| 路由 | 内容 | 实时数据 |
| --- | --- | --- |
| `/` | 落地页 | 「为你精选」3 张卡（每类别一台，优先现货）、「最低 $X/day」、页脚联系方式 |
| `/products` | 全部在售设备，按游戏本 / 轻薄本 / 工作站分组 | 全量 `devices`（排除 RETIRED） |
| `/apply` | 下单表单：选设备 + 租期 + 取还方式 + 注册信息 | 设备下拉、价格、最短租期、可选自取点 |
| `/rental-guide` | 租赁流程 + 常见问题 | 无（静态文案） |
| `/about` | 关于 + 联系方式 | 页面内联系方式来自 `systemSettings.companyDetails` |
| `/healthz` `/favicon.ico` `/robots.txt` | 运维 / 爬虫 | — |

月租为 `日租 × MONTHLY_MULTIPLIER`（默认 20）的**参考价**，真实计费仍在 rent 主应用完成。

## 下单流程

1. 访客在 `/apply` 选设备、填租期与取还方式，并填写**注册信息**（姓名 / 邮箱 / 密码），勾选同意条款。
2. 前端 POST 到 `${APP_URL}/public/rental-request`（rent 主应用的新公开接口）。
3. rent 侧：Turnstile 校验 → 按 rent 既有规则校验日期 / 档期冲突 → **注册或复用**同一个 `users` 表里的 CUSTOMER 账号（PBKDF2，与 rent 登录兼容）→ 创建 `status='pending_approval'` 的订单（**不生成合同、不收款**）→ 通知所有在职管理员。
4. 管理员在 rent 后台确认订单后，走既有 staff 建合同流程，生成 `/contract/sign` 链接让客户在线签署并付款。

> 官网不实现登录态；账号一旦注册，客户可直接用同一邮箱 / 密码登录 rent 查看进度、付款、签约。

## 本地开发

```bash
npm install
npm run dev        # wrangler dev，默认 http://localhost:8811
npm run typecheck
```

本地 `wrangler dev` 用本机 miniflare D1，默认空库 —— 页面会显示「产品目录正在更新」。要看到产品卡，先塞几条数据：

```bash
npx wrangler d1 execute RENT --local --command \
  "CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT,model TEXT,pricePerDay REAL,depositAmount REAL,status TEXT,description TEXT,serialNumber TEXT UNIQUE,brand TEXT,cpu TEXT,ram TEXT,storage TEXT,gpu TEXT,os TEXT,lifecycle_status TEXT DEFAULT 'READY');
   INSERT INTO devices(id,name,model,pricePerDay,depositAmount,status,serialNumber,cpu,ram,storage,gpu,lifecycle_status)
   VALUES('d1','ROG 魔霸新锐','G16CH',19,1200,'available','SN1','i7-13700H','16GB','1TB SSD','RTX 4060','READY');"
```

`/apply` 的提交要连到一个跑着 rent 主应用的实例（本地或 staging），并在 rent 侧设置 `PUBLIC_WEB_ORIGIN` 指向本站 origin。

## 部署

```bash
npx wrangler deploy --minify        # 部署 Worker: geekslope-web
```

首次部署前确认 `wrangler.jsonc`：

- `d1_databases[0].database_id` —— 与 rent 库一致（当前已填 `65a5ded3-…`）。账号不同就改成目标账号里 rent 库的 id。
- `vars.APP_URL` —— **必须**改成 rent 主应用真实地址（如 `https://rent.geekslope.com.au`）。`/apply` 表单会 POST 到 `${APP_URL}/public/rental-request`。
- `vars.MONTHLY_MULTIPLIER` —— 月租展示系数。
- `vars.TURNSTILE_SITE_KEY` —— 与 rent 同一个 Turnstile 组件的站点公钥（留空则不显示人机验证）。
- 可选：`wrangler secret put CONTACT_PHONE` / `CONTACT_EMAIL` 覆盖数据库里的联系方式。

**rent 主应用侧同时需要：**

- `PUBLIC_WEB_ORIGIN` = 本站部署 origin（如 `https://geekslope-web.pages.dev`）—— 用于放行本站的跨站下单请求（CORS + 来源校验）。
- `PUBLIC_APP_URL`（可选）= rent 自身对外地址。
- `TURNSTILE_SECRET_KEY`（已有）—— 未配置则公开下单接口跳过人机校验。
- 部署新增的 `src/actions/public/rentalRequest.ts` + `POST /public/rental-request` 路由后重新 `wrangler deploy`。

绑定自定义域名：Cloudflare 控制台 Workers → geekslope-web → Settings → Domains & Routes。

> 部署 geekslope-web 不会触及 rent 主应用；两者共享同一个 D1 数据库（本项目会写入 `users` / `orders`，仅限公开下单接口所需）。

## 数据可用性

展示类 D1 查询都有 `try/catch` 兜底：数据库不可达、表缺失或字段变动时，页面回落到中性文案与内置默认联系方式，不会白屏。
