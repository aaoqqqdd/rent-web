import { NOTICE_ENGLISH_UNAVAILABLE } from '../notice-content'

function renderNoticeUi(advertisement: boolean): string {
  const prefix = advertisement ? 'gs-advertisement' : 'gs-announcement'
  const label = advertisement ? '官网广告' : '网站通告'
  const close = advertisement ? '关闭广告' : '关闭通知'
  return `<dialog class="notice-dialog" id="${prefix}-dialog" aria-labelledby="${prefix}-title" data-no-translate>
  <div class="notice-dialog-shell">
    <header class="notice-dialog-header">
      <div class="notice-dialog-heading">
        <p class="notice-dialog-kicker" data-announcement-kicker>${label}</p>
        <h2 id="${prefix}-title" tabindex="-1"></h2>
      </div>
      <div class="notice-dialog-controls">
        <div class="language-switcher" role="group" aria-label="语言" data-announcement-language>
          <button type="button" data-language="zh" lang="zh-CN">中</button>
          <button type="button" data-language="en" lang="en">EN</button>
        </div>
        <button type="button" class="notice-dialog-close" data-announcement-close aria-label="${close}"><span aria-hidden="true">×</span></button>
      </div>
    </header>
    <div class="notice-dialog-body">
      <div class="legal-document__content notice-rich-content" data-announcement-lang="zh" lang="zh-CN"></div>
      <div class="legal-document__content notice-rich-content" data-announcement-lang="en" lang="en" hidden></div>
    </div>
    <footer class="notice-dialog-footer">
      <a class="btn btn-ghost" data-announcement-detail href="/announcements">查看详情</a>
      <button class="btn btn-primary" type="button" data-announcement-close data-announcement-dismiss>${close}</button>
    </footer>
  </div>
</dialog>`
}

export function renderAnnouncementUi(): string { return renderNoticeUi(false) }
export function renderAdvertisementUi(): string { return renderNoticeUi(true) }

function readerScript(advertisement: boolean): string {
  const prefix = advertisement ? 'gs-advertisement' : 'gs-announcement'
  const label = advertisement ? ['官网广告', 'Website advertisement'] : ['网站通告', 'Site announcement']
  const close = advertisement ? ['关闭广告', 'Close advertisement'] : ['关闭通知', 'Close notification']
  return `<script>
(() => {
  var dialog = document.getElementById('${prefix}-dialog');
  var notice = null;
  var title = document.getElementById('${prefix}-title');
  var zh = dialog.querySelector('[data-announcement-lang="zh"]');
  var en = dialog.querySelector('[data-announcement-lang="en"]');
  function renderLanguage() {
    var english = window.GeekSlopeI18n && window.GeekSlopeI18n.language() === 'en';
    title.textContent = english ? (notice && notice.titleEn || ${JSON.stringify(label[1])}) : (notice && notice.title || ${JSON.stringify(label[0])});
    zh.hidden = Boolean(english);
    en.hidden = !english;
    dialog.querySelector('[data-announcement-kicker]').textContent = english ? ${JSON.stringify(label[1])} : ${JSON.stringify(label[0])};
    dialog.querySelector('[data-announcement-detail]').textContent = english ? 'View details' : '查看详情';
    dialog.querySelector('[data-announcement-dismiss]').textContent = english ? ${JSON.stringify(close[1])} : ${JSON.stringify(close[0])};
    dialog.querySelector('[data-announcement-language]').setAttribute('aria-label', english ? 'Language' : '语言');
    dialog.querySelectorAll('[data-announcement-close]').forEach(function (button) {
      button.setAttribute('aria-label', english ? ${JSON.stringify(close[1])} : ${JSON.stringify(close[0])});
    });
  }
  function show(item) {
    if (document.querySelector('dialog[open]')) return false;
    var href = '/announcements/' + encodeURIComponent(item.id);
    if (typeof dialog.showModal !== 'function') { window.location.href = href; return false; }
    notice = item;
    // Only use the server-sanitized rich fields, never raw message HTML.
    if (item.messageHtml) zh.innerHTML = item.messageHtml;
    else zh.textContent = item.message || '';
    en.innerHTML = item.messageHtmlEn || ${JSON.stringify(NOTICE_ENGLISH_UNAVAILABLE)};
    [zh, en].forEach(function (body, index) {
      var first = body.firstElementChild;
      var heading = index ? item.titleEn : item.title;
      if (first && /^H[1-4]$/.test(first.tagName) && first.textContent.trim() === heading) first.hidden = true;
    });
    dialog.querySelector('[data-announcement-detail]').href = href;
    renderLanguage();
    dialog.querySelector('.notice-dialog-body').scrollTop = 0;
    dialog.showModal();
    document.documentElement.classList.add('gs-dialog-open');
    title.focus({ preventScroll: true });
    return true;
  }
  dialog.querySelectorAll('[data-announcement-close]').forEach(function (button) {
    button.addEventListener('click', function () { dialog.close(); });
  });
  dialog.addEventListener('close', function () {
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('gs-dialog-open');
  });
  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    var rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  window.addEventListener('geekslope:language-change', renderLanguage);
  window.${advertisement ? 'GeekSlopeAdvertisement' : 'GeekSlopeAnnouncement'} = { show: show };
})();
</script>`
}

export const ANNOUNCEMENT_SCRIPT = readerScript(false)
export const ADVERTISEMENT_SCRIPT = readerScript(true)
