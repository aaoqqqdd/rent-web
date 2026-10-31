# 墨尔本电脑租赁 SEO

官网规范域名为 `https://www.geekslope.de5.net`，集中定义在 `src/seo.ts`。所有部署别名输出相同的 canonical、结构化数据与 sitemap URL，迁移域名时应一起更新。语言仍按项目约定：中文 SSR，英文由浏览器切换；没有独立英文 URL，因此不伪造 hreflang 页面。

## 关键词与内容

- 首页：墨尔本电脑租赁、墨尔本租电脑、墨尔本华人电脑租赁、电脑租赁中文服务。
- 设备库与详情：电脑租赁、笔记本租赁、游戏本租赁、电竞电脑租赁、商务笔记本租赁、台式工作站租赁。
- 用途介绍：留学生租电脑、办公电脑短租、电脑送修临时租赁、剪辑渲染电脑租赁。
- 租赁指南：电脑日租、电脑周租、电脑月租、押金、墨尔本配送、预约自取。
- 英文展示：Melbourne computer rental、computer hire Melbourne、laptop hire Melbourne、gaming laptop rental Melbourne、workstation hire Melbourne。

这些词按真实服务自然分布在标题、正文、FAQ 与内部链接中。不要堆砌关键词、隐藏文字、虚构评价，或批量生成只有地名不同的空洞页面。面向全国的“电脑租赁”竞争范围很大，优先衡量带 Melbourne / 墨尔本、设备类型及用途的搜索。

## 抓取与索引

- `/robots.txt` 的通配规则允许公开页面，包括 OAI-SearchBot 等 AI 搜索爬虫。API、SSO、退出与健康检查排除抓取并返回 `X-Robots-Tag: noindex`。
- 登录、结账、申请和订单查询输出 noindex，但不禁止抓取，让搜索引擎能读到指令。robots.txt 不承担权限控制。
- `/sitemap.xml` 包含公开主页面、当前设备详情、有效通告与已有正文的法律文档。未发布的法律占位页 noindex，不进入 sitemap；不捏造 lastmod。
- `/llms.txt` 提供中英文业务摘要和实时页面索引，不复制可能过时的价格、库存、地址或最短租期。它是辅助资料，不能保证排名或 AI 引用。
- Organization / Service / WebPage / Product / FAQ 信息对应可见正文；不把默认占位联系方式标成真实商家数据，不编造地址、评分或营业时间。

## 发布后的站外工作

1. 在 Google Search Console 验证官网域名，提交 `https://www.geekslope.de5.net/sitemap.xml`；用 URL Inspection 检查首页、设备库与实际设备详情。
2. 在 Bing Webmaster Tools 验证并提交相同 sitemap，查看抓取与索引错误。
3. 在 Cloudflare 检查 Bot / WAF 配置与 Security Events，确认真实 Googlebot、Bingbot 与所需 AI 搜索爬虫未被挑战或拦截。代码里的 robots 规则无法覆盖边缘规则；核对官方 IP 或验证方式，不要只信 User-Agent，也不要关闭全站防护。
4. 若符合条件，建立并验证 Google Business Profile；名称、真实电话、公开地址或服务区域与网站保持一致。向真实客户邀请真实评价，并在相关本地商家目录与华人社区建立有用的品牌资料。
5. 每月比较 Search Console 的查询词、展示、点击、CTR 和平均排名，以及实际租赁咨询量。按真实客户问题持续补充内容，不承诺固定名次。

站外平台需由拥有对应账号权限的人操作；本次代码修改不代表已经验证、提交或部署。

## 验证

```sh
npm run typecheck
node scripts/i18n-audit.mjs
# 先运行本地 npm run dev，再执行只读验证：
node scripts/verify-seo.mjs http://127.0.0.1:8811
node scripts/verify-site.mjs --lang en
```

2026-10-31 本地验证：类型检查、翻译覆盖检查与 SEO 运行检查通过（28 个 HTML 响应，含 10 个 sitemap URL）；13 个页面 × 3 种视口未发现横向溢出或应翻译内容残留中文。浏览器检查另报告原有目录排序框 / 现货筛选在平板和桌面上的字号小于 16px；本机 origin 不在 dashboard CORS 白名单中，登录状态探测会失败，本地付款配置也不代表生产可用性。这些检查不证明线上爬虫已被放行或页面已收录。

官方参考：[Google AI 搜索与网站](https://developers.google.com/search/docs/appearance/ai-features)、[OpenAI 爬虫](https://developers.openai.com/api/docs/bots)、[规范网址](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)。Google 的 AI 搜索沿用 SEO 基础实践，不要求特殊 AI 标记，也不保证抓取、收录或展示。
