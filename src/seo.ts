// All deployment aliases share the public marketing site's canonical URLs.
export const SITE_URL = 'https://geekslope.de5.net'
export const CONTENT_SIGNAL = 'ai-train=no, search=yes, ai-input=yes'

// Specific bot groups do not inherit wildcard rules. Reuse the same exclusions
// so allowing AI search never also grants permission to crawl account APIs.
const PUBLIC_CRAWL_RULES = `Content-Signal: ${CONTENT_SIGNAL}
Allow: /
Disallow: /api/
Disallow: /sso/
Disallow: /logout
Disallow: /healthz`

const SEARCH_AND_USER_AGENTS = [
  'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot',
  'ChatGPT-User', 'Claude-User', 'Perplexity-User',
]
const BLOCKED_AGENTS = [
  'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended',
  'CCBot', 'Bytespider', 'Amazonbot',
  // Legacy token requested by the site owner; current Claude search and user
  // fetchers are explicitly allowed above instead of granting this old token.
  'Claude-Web',
]

export const ROBOTS_TXT = `User-agent: *
${PUBLIC_CRAWL_RULES}

# Search indexing and user-requested retrieval of public pages.
${SEARCH_AND_USER_AGENTS.map((agent) => `User-agent: ${agent}\n${PUBLIC_CRAWL_RULES}`).join('\n\n')}

# Model training and legacy crawlers. Google-Extended also controls Gemini
# grounding; blocking it preserves the training opt-out, not all Gemini uses.
${BLOCKED_AGENTS.map((agent) => `User-agent: ${agent}\nContent-Signal: ${CONTENT_SIGNAL}\nDisallow: /`).join('\n\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`

// A supplementary reading index, not a ranking signal or access-control policy.
// Link to live prices and rules instead of copying values that can go stale.
export const LLMS_TXT = `# GeekSlope — 墨尔本电脑租赁 / Melbourne computer rental

> GeekSlope 提供墨尔本电脑租赁，包括游戏笔记本、轻薄商务本与台式工作站，提供中文与英文服务。
> Computer and laptop hire in Melbourne, Australia, with Chinese and English service.

## 服务说明 / Service facts

- 适合课程作业、留学生临时用机、办公、游戏、视频剪辑和开发项目。
- 日租、周租及月租价格、押金、配置和库存请查看实时设备页面。金额为澳元（AUD）。
- 送货上门仅限墨尔本 CBD 及周边地区；其他墨尔本郊区可预约自取。具体地址、费用与档期需确认。
- 提交申请不会立即扣款。管理员确认档期与费用后，才签约、付款与交付。
- 具体最短租期、配送区域、自取点与服务条款以当前页面和确认后的合同为准。
- Delivery is limited to Melbourne CBD and nearby areas; pickup can be arranged for other Melbourne suburbs.
- Applications are reviewed before contract signing and payment. Confirm availability and final fees with GeekSlope.

## 官方页面 / Official pages

- [首页 / Home](${SITE_URL}/): 墨尔本电脑租赁、中文服务与服务概览。
- [设备库 / Computer and laptop hire](${SITE_URL}/products): 实时配置、日租、周租、月租与库存；链接到每台设备详情。
- [租赁指南 / Rental guide](${SITE_URL}/rental-guide): 最短租期、押金、配送、自取、续租与常见问题。
- [联系我们 / Contact](${SITE_URL}/about#contact): 当前官方联系方式与交付咨询。
- [通告 / Announcements](${SITE_URL}/announcements): 当前有效的公告与优惠。
- [服务条款 / Service terms](${SITE_URL}/service-terms)
- [隐私政策 / Privacy](${SITE_URL}/privacy)
- [站点地图 / Sitemap](${SITE_URL}/sitemap.xml)
- [API 目录 / API catalog](${SITE_URL}/.well-known/api-catalog)
- [公开接口说明 / Public API documentation](${SITE_URL}/api-docs.md)
- [认证说明 / Authentication](${SITE_URL}/auth.md)
`
