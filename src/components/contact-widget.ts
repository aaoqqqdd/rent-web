// 右下角悬浮通讯软件入口：主流聊天 App，rent 后台未填链接的渠道整项隐藏。
// WhatsApp 已在 footer 展示过，这里不再重复显示悬浮按钮。
import { esc } from '../escape'
import type { SiteContact } from '../db'
import { publicHttpsUrl } from './site-footer'
import { CONTACT_CHANNEL_ICONS, type ContactChannelKey } from './contact-icons'

const CHANNELS: Array<{ key: ContactChannelKey; field: keyof SiteContact; label: string }> = [
  { key: 'telegram', field: 'telegramUrl', label: 'Telegram' },
  { key: 'messenger', field: 'messengerUrl', label: 'Messenger' },
  { key: 'line', field: 'lineUrl', label: 'Line' },
  { key: 'viber', field: 'viberUrl', label: 'Viber' },
]

const CHAT_BUBBLE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4c-1.6 1.9-4.1 3.1-6.9 3.1a9 9 0 0 1-2.9-.5L4 21l1.3-4a8.1 8.1 0 0 1-1.8-5.1C3.5 7.2 7.3 4 12 4s9 3.2 9 7.5Z"/></svg>'
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>'

function channelButton(channel: { key: ContactChannelKey; label: string; url: string }): string {
  const icon = CONTACT_CHANNEL_ICONS[channel.key]
  return `<a class="gs-contact-item" style="--gs-contact-color:${icon.color}" href="${esc(channel.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(channel.label)}" title="${esc(channel.label)}"><span class="gs-contact-icon">${icon.svg}</span><span class="gs-contact-label">${esc(channel.label)}</span></a>`
}

export function renderContactWidget(contact: SiteContact): string {
  const items = CHANNELS
    .map((channel) => ({ ...channel, url: publicHttpsUrl(contact[channel.field] as string | undefined) }))
    .filter((channel) => channel.url)
  if (!items.length) return ''

  if (items.length === 1) {
    const icon = CONTACT_CHANNEL_ICONS[items[0].key]
    return /* html */ `
<div class="gs-contact-widget" data-contact-widget>
  <a class="gs-contact-item gs-contact-primary" style="--gs-contact-color:${icon.color}" href="${esc(items[0].url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(items[0].label)}" title="${esc(items[0].label)}">${icon.svg}</a>
</div>`
  }

  return /* html */ `
<div class="gs-contact-widget" data-contact-widget>
  <div class="gs-contact-list" data-contact-list hidden>${items.map(channelButton).join('')}</div>
  <button type="button" class="gs-contact-item gs-contact-primary gs-contact-fab" data-contact-toggle aria-label="联系我们" aria-expanded="false">
    <span class="gs-contact-fab-open">${CHAT_BUBBLE_ICON}</span>
    <span class="gs-contact-fab-close">${CLOSE_ICON}</span>
  </button>
</div>`
}

export const CONTACT_WIDGET_SCRIPT = /* html */ `<script>
(() => {
  var widget = document.querySelector('[data-contact-widget]');
  if (!widget) return;
  var toggle = widget.querySelector('[data-contact-toggle]');
  var list = widget.querySelector('[data-contact-list]');
  if (!toggle || !list) return;
  toggle.addEventListener('click', function () {
    var open = widget.classList.toggle('is-open');
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (event) {
    if (!widget.classList.contains('is-open')) return;
    if (widget.contains(event.target)) return;
    widget.classList.remove('is-open');
    list.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });
})();
</script>`
