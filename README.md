# GeekSlope 市场官网（rent-web）

GeekSlope 电脑租赁的对外营销官网。**独立部署**的 Cloudflare Worker，与 `../`（rent 主应用）互不影响：单独的 `package.json`、`wrangler.jsonc`，单独的 Worker（`geekslope-web`）。

设计还原自参考稿：<https://airo.ai/share/djVpOHpkdTZudDpjMzU6Sk42aXc3RGRsczR2>

## 特点

- 服务端渲染、无构建步骤，仅依赖 `hono`
- **产品信息实时从数据库获取**：设备名称、配置、日租价、押金、库存状态，以及公司名 / 电话 / 邮箱 / 配送范围，全部只读自 rent 的 D1 库（`systemSettings` + `devices`）
- 深色 + 青色主色、网格背景的落地页；页面：`/`、`/products`、`/rental-guide`、`/about`
- 边缘缓存（`caches.default`）：HTML 60 秒、CSS 1 天

## 页面与数据

| 路由 | 内容 | 实时数据 |
| --- | --- | --- |
| `/` | 落地页 | 「为你精选」3 张卡（每类别一台，优先现货）、「最低 $X/day」、页脚联系方式 |
| `/products` | 全部在售设备，按游戏本 / 轻薄本 / 工作站分组 | 全量 `devices`（排除 RETIRED） |
| `/rental-guide` | 租赁流程 + 常见问题 | 无（静态文案） |
| `/about` | 关于 + 联系方式 | 页面内联系方式来自 `systemSettings.companyDetails` |
| `/healthz` `/favicon.ico` `/robots.txt` | 运维 / 爬虫 | — |

月租为 `日租 × MONTHLY_MULTIPLIER`（默认 20）的**参考价**，真实计费仍在 rent 主应用完成。

## 本地开发

```bash
cd rent-web
npm install
npm run dev        # wrangler dev，默认 http://localhost:8811
npm run typecheck
```

本地 `wrangler dev` 用的是本机 miniflare D1，默认空库 —— 页面会显示「产品目录正在更新」。
要看到产品卡，先往本地库塞几条数据：

```bash
npx wrangler d1 execute RENT --local --command \
  "CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT,model TEXT,pricePerDay REAL,depositAmount REAL,status TEXT,description TEXT,serialNumber TEXT UNIQUE,brand TEXT,cpu TEXT,ram TEXT,storage TEXT,gpu TEXT,os TEXT,lifecycle_status TEXT DEFAULT 'READY');
   INSERT INTO devices(id,name,model,pricePerDay,depositAmount,status,serialNumber,cpu,ram,storage,gpu,lifecycle_status)
   VALUES('d1','ROG 魔霸新锐','G16CH',19,1200,'available','SN1','i7-13700H','16GB','1TB SSD','RTX 4060','READY');"
```

## 部署

```bash
cd rent-web
npx wrangler deploy --minify        # 部署 Worker: geekslope-web
```

首次部署前确认 `wrangler.jsonc`：

- `d1_databases[0].database_id` —— 与 `../wrangler.jsonc` 的 rent 库一致（当前已填 `65a5ded3-…`）。若账号不同，改成目标账号里 rent 库的 id。
- `vars.APP_URL` —— **必须**改成 rent 主应用的真实地址（如 `https://rent.geekslope.com.au`）。所有「立即租赁」按钮跳这里；产品卡深链到 `${APP_URL}/customer/rent/<设备id>`。
- `vars.MONTHLY_MULTIPLIER` —— 月租展示系数，按需调整。
- 可选：`wrangler secret put CONTACT_PHONE` / `CONTACT_EMAIL` 覆盖数据库里的联系方式。

绑定自定义域名：在 Cloudflare 控制台 Workers → geekslope-web → Settings → Domains & Routes 添加，或用 `wrangler deploy` 前在 `wrangler.jsonc` 加 `routes`。

> 部署 geekslope-web 不会触及 rent 主应用；两者只共享同一个 D1 数据库（本项目只读）。

## 数据可用性

所有 D1 查询都有 `try/catch` 兜底：数据库不可达、表缺失或字段变动时，页面回落到中性文案与内置默认联系方式，不会报错白屏。
