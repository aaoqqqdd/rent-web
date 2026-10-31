# 墨尔本电脑租赁 SEO

官网规范域名为 `https://geekslope.de5.net`，集中定义在 `src/seo.ts`。所有部署别名输出相同的 canonical、结构化数据与 sitemap URL，迁移域名时应一起更新。语言仍按项目约定：中文 SSR，英文由浏览器切换；没有独立英文 URL，因此不伪造 hreflang 页面。

## 关键词与内容

- 首页：墨尔本电脑租赁、墨尔本租电脑、墨尔本华人电脑租赁、电脑租赁中文服务。
- 设备库与详情：电脑租赁、笔记本租赁、游戏本租赁、电竞电脑租赁、商务笔记本租赁、台式工作站租赁。
- 用途介绍：留学生租电脑、办公电脑短租、电脑送修临时租赁、剪辑渲染电脑租赁。
- 租赁指南：电脑日租、电脑周租、电脑月租、押金、墨尔本配送、预约自取。
- 英文展示：Melbourne computer rental、computer hire Melbourne、laptop hire Melbourne、gaming laptop rental Melbourne、workstation hire Melbourne。

这些词按真实服务自然分布在标题、正文、FAQ 与内部链接中。不要堆砌关键词、隐藏文字、虚构评价，或批量生成只有地名不同的空洞页面。面向全国的“电脑租赁”竞争范围很大，优先衡量带 Melbourne / 墨尔本、设备类型及用途的搜索。

## 抓取与索引

- `/robots.txt` 以 UTF-8 `text/plain` 返回 HTTP 200。通配规则允许公开页面；OAI-SearchBot、Claude-SearchBot、PerplexityBot 与 ChatGPT-User、Claude-User、Perplexity-User 各有显式放行组。每组均重复排除 API、SSO、退出与健康检查路径，避免专属组覆盖通配组后丢失限制。这些路径仍返回 `X-Robots-Tag: noindex`。
- 显式禁止 GPTBot、ClaudeBot、Google-Extended、Applebot-Extended、CCBot、Bytespider、Amazonbot，以及旧 Claude-Web token。Claude 当前搜索与用户访问使用上面单独放行的 token；不把旧 token 当作当前搜索能力。Google-Extended 同时涵盖训练与部分 Gemini grounding，因此禁止它也会限制后者，但不影响 Google 搜索收录。依据：[Google 爬虫说明](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)、[Anthropic 爬虫说明](https://privacy.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)。部分用户触发的抓取可能不遵循 robots，真实访问控制仍由服务端完成。
- 同一 `User-agent: *` 区块声明 `Content-Signal: ai-train=no, search=yes, ai-input=yes`：禁止模型训练、允许搜索索引与生成式 AI 答案使用，以支持网站的搜索曝光目标。这里的 `ai-input=yes` 包括 RAG / grounding 等实时引用；`search=yes` 本身不包含生成式摘要。这是使用偏好声明，不是访问控制，是否遵守取决于爬虫。含义见 [Content Signals 文档](https://contentsignals.org/)。
- 登录、结账、申请和订单查询输出 noindex，但不禁止抓取，让搜索引擎能读到指令。robots.txt 不承担权限控制。
- `/sitemap.xml` 以 UTF-8 XML 返回 HTTP 200，使用标准 sitemap namespace；包含公开主页面、当前设备详情、有效通告与已有正文的法律文档，并对 URL 去重、转义。每次请求读取当前发布状态，公开缓存 60 秒。未发布的法律占位页 noindex，不进入 sitemap；不捏造 lastmod。robots 中引用 `https://geekslope.de5.net/sitemap.xml`。
- `/llms.txt` 提供中英文业务摘要和实时页面索引，不复制可能过时的价格、库存、地址或最短租期。它是辅助资料，不能保证排名或 AI 引用。
- 公开内容页支持同一 URL 的 Markdown 内容协商：显式请求 `Accept: text/markdown` 且其权重不低于 HTML 时，返回 `Content-Type: text/markdown; charset=utf-8`；无该请求头、通配符或浏览器优先 HTML 时仍返回 HTML。覆盖首页、目录、设备详情、通告、指南、关于、礼品卡、推广说明与法律文档（含现有别名）。Markdown 来自同一份中文 SSR 正文，保留元信息、规格、价格、FAQ、绝对链接和 JSON-LD，移除导航、跟踪脚本、隐藏内容及交互控件；登录、结账、订单查询、API 和静态文件保持原响应。
- 两种格式分别使用边缘缓存键，并返回 `Vary: Accept, Cookie`；携带 session 的请求继续绕过共享缓存并返回 `private, no-store`。Markdown 的 `X-Robots-Tag` 继承源页面索引策略；HTML 与 Markdown 都返回相同的 `Content-Signal`，避免 Cloudflare 的自动转换另行使用默认许可。项目没有精确 tokenizer，因此不伪造 `x-markdown-tokens` 数值。可用 `curl -H 'Accept: text/markdown' https://geekslope.de5.net/` 在部署后验证；线上扫描需重新发布后执行。参考 [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)。
- Organization / Service / WebPage / Product / FAQ 信息对应可见正文；不把默认占位联系方式标成真实商家数据，不编造地址、评分或营业时间。

## 代理发现文档

- `/.well-known/api-catalog`：RFC 9727 Linkset，媒体类型为 `application/linkset+json`，带 RFC profile；列出实际存在的设备页面、档期查询与公开通告。每项含 OpenAPI、说明文档和 Worker 存活检查链接。GET / HEAD 均可读取。
- `/openapi.json`：OpenAPI 3.1，仅描述现有公开只读操作和实际响应格式。设备页支持 HTML / Markdown，不伪装成 JSON 库存接口。接口的 noindex / robots 路径规则和现有权限保持原样。
- `/api-docs.md`：接口用途、参数、数据兜底、档期非预订、价格非最终报价及现有业务边界。
- `/auth.md`：面向代理的公开访问、人工注册、浏览器 session 与 SSO 说明。当前没有代理自动注册或 OAuth 发行者，因此不发布虚假的 OAuth 元数据或 `agent_auth` 能力声明。
- 首页和 API Catalog 的最终响应注入 `Link`，包含 `api-catalog`、`service-desc`、`service-doc`、`describedby`。HTML、Markdown、缓存命中、HEAD 和会话绕缓存都保留发现信息；链接统一指向官网规范域名。

本轮范围经确认仅为真实发现文档，保持现有付款流程。不创建 ACP / UCP 发现文件、AP2 / A2A 能力或 MPP / x402 支付声明；这些需要对应的真实交易接口、授权验证与商户配置，不能靠静态文件宣称实现。现有 Stripe 卡验证 / 预授权和 HTTP 402 业务错误也不代表支持这些协议。因此支付类扫描项可能继续显示未实现，这与本轮范围一致。

发布后，先检查所有发现链接与文档状态，再按需执行 AgentReady 扫描。未部署的本地修改不能证明线上扫描已通过；Auth.md 文件存在也不代表具备代理注册能力。

## 发布后的站外工作

1. 在 Google Search Console 验证官网域名，提交 `https://geekslope.de5.net/sitemap.xml`；用 URL Inspection 检查首页、设备库与实际设备详情。
2. 在 Bing Webmaster Tools 验证并提交相同 sitemap，查看抓取与索引错误。
3. 在 Cloudflare 检查 Bot / WAF 配置与 Security Events，确认真实 Googlebot、Bingbot 与所需 AI 搜索爬虫未被挑战或拦截。代码里的 robots 规则无法覆盖边缘规则；核对官方 IP 或验证方式，不要只信 User-Agent，也不要关闭全站防护。
4. 若符合条件，建立并验证 Google Business Profile；名称、真实电话、公开地址或服务区域与网站保持一致。向真实客户邀请真实评价，并在相关本地商家目录与华人社区建立有用的品牌资料。
5. 每月比较 Search Console 的查询词、展示、点击、CTR 和平均排名，以及实际租赁咨询量。按真实客户问题持续补充内容，不承诺固定名次。

站外平台需由拥有对应账号权限的人操作；本次代码修改不代表已经验证、提交或部署。

## 验证

```sh
npm run typecheck
node --test tests/markdown.test.mjs
node --test tests/discovery.test.mjs
node --test tests/crawlers.test.mjs
node scripts/i18n-audit.mjs
# 先运行本地 npm run dev，再执行只读验证：
node scripts/verify-seo.mjs http://127.0.0.1:8811
node scripts/verify-site.mjs --lang en
```

2026-10-31 本地验证：类型检查、翻译覆盖检查与 SEO 运行检查通过（28 个 HTML 响应，含 10 个 sitemap URL）；13 个页面 × 3 种视口未发现横向溢出或应翻译内容残留中文。浏览器检查另报告原有目录排序框 / 现货筛选在平板和桌面上的字号小于 16px；本机 origin 不在 dashboard CORS 白名单中，登录状态探测会失败，本地付款配置也不代表生产可用性。这些检查不证明线上爬虫已被放行或页面已收录。

官方参考：[Google AI 搜索与网站](https://developers.google.com/search/docs/appearance/ai-features)、[OpenAI 爬虫](https://developers.openai.com/api/docs/bots)、[规范网址](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)。Google 的 AI 搜索沿用 SEO 基础实践，不要求特殊 AI 标记，也不保证抓取、收录或展示。
