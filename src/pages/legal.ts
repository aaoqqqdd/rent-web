// 法律 / 合规文档页：正文来自 rent 的 D1（systemSettings），见 db.getLegalDoc()。
// 文档 HTML 已含自己的 <h1> 与版本行，这里只负责套壳与排版。

import { esc } from '../layout'

export function renderLegalDoc(opts: { code: string; contentHtml: string }): string {
  return /* html */ `
<section class="section">
  <div class="wrap doc legal-doc">
    <div class="kicker" style="color:var(--primary);font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">${esc(opts.code)}</div>
    <div class="legal-doc__body">
${opts.contentHtml}
    </div>
  </div>
</section>`
}

/** 管理员尚未在后台发布该文档时的占位页。 */
export function renderLegalMissing(title: string, appUrl: string): string {
  return /* html */ `
<section class="section">
  <div class="wrap doc">
    <h1>${esc(title)}</h1>
    <p class="lead">该文档正在整理中。</p>
    <p>如需完整的《${esc(title)}》文本，请通过页脚的联系方式与我们联系，或前往<a href="${esc(appUrl)}" style="color:var(--primary)">租赁平台</a>查看最新版本。</p>
    <p style="margin-top:32px"><a class="btn btn-primary" href="/">返回首页</a></p>
  </div>
</section>`
}
