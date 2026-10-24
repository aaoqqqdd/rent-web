// 全站统一反馈层：Toast 通知 + 高危操作确认弹窗（原生 <dialog>）。
// 由 layout.ts 注入每个页面，页面脚本通过 window.GeekSlopeUI 调用：
//   GeekSlopeUI.toast(message, { type, title, duration })
//   GeekSlopeUI.confirm({ title, message, details, confirmText, cancelText, variant })
// 现代浏览器一律使用原生 <dialog> 与自绘 Toast，不依赖任何第三方库；
// 仅当 <dialog> 不可用时，确认框才回退到 window.confirm()。
//
// i18n：本组件整体标记 data-no-translate，由 layout 的 DOM 翻译器跳过，
// 避免「先翻译一次、观察器再翻译一次」的双重翻译；这里在渲染时通过
// window.GeekSlopeI18n.t()/bilingual() 翻译，并在语言切换时重绘打开的
// Toast / 弹窗。文案可以传普通字符串，也可以传 { zh, en } 双语对象
// （跨语言切换时后者才能精确还原）。

export function renderFeedbackUi(): string {
  return /* html */ `
<div class="gs-toast-region" id="gs-toast-region" role="region" aria-label="通知" aria-live="polite" data-no-translate></div>
<dialog class="gs-dialog" id="gs-confirm-dialog" aria-labelledby="gs-dialog-title" aria-describedby="gs-dialog-message" data-no-translate>
  <form method="dialog" class="gs-dialog-card">
    <div class="gs-dialog-head">
      <span class="gs-dialog-icon" id="gs-dialog-icon" aria-hidden="true"></span>
      <div class="gs-dialog-copy">
        <h2 id="gs-dialog-title"></h2>
        <p id="gs-dialog-message"></p>
      </div>
    </div>
    <div class="gs-dialog-details" id="gs-dialog-details" hidden></div>
    <div class="gs-dialog-actions">
      <button type="submit" class="btn btn-ghost" id="gs-dialog-cancel" value="cancel"></button>
      <button type="submit" class="btn btn-primary" id="gs-dialog-confirm" value="confirm"></button>
    </div>
  </form>
</dialog>`
}

export const FEEDBACK_SCRIPT = /* html */ `<script>
(() => {
  'use strict';
  var region = document.getElementById('gs-toast-region');
  var dialog = document.getElementById('gs-confirm-dialog');
  var dialogTitle = document.getElementById('gs-dialog-title');
  var dialogMessage = document.getElementById('gs-dialog-message');
  var dialogDetails = document.getElementById('gs-dialog-details');
  var dialogIcon = document.getElementById('gs-dialog-icon');
  var dialogCancel = document.getElementById('gs-dialog-cancel');
  var dialogConfirm = document.getElementById('gs-dialog-confirm');
  var hasDialog = Boolean(dialog && dialogTitle && dialogConfirm && typeof dialog.showModal === 'function');

  function isEnglish() {
    return Boolean(window.GeekSlopeI18n && window.GeekSlopeI18n.language() === 'en');
  }
  function bilingual(chinese, english) {
    return isEnglish() ? english : chinese;
  }
  // Resolve a message that is either a bilingual { zh, en } pair or a plain
  // Chinese/English string (plain strings go through the shared catalogue).
  function resolveText(value) {
    if (value == null) return '';
    if (typeof value === 'object') {
      var english = isEnglish();
      var preferred = english ? value.en : value.zh;
      var fallback = english ? value.zh : value.en;
      return String(preferred != null ? preferred : fallback != null ? fallback : '');
    }
    var text = String(value);
    if (!window.GeekSlopeI18n) return text;
    return window.GeekSlopeI18n.t(text) || text;
  }

  var toastIcons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12.2 2.6 2.6L16.4 9"></path></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"></path></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4M12 16.6h.01"></path></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>'
  };
  var dialogIcons = { info: toastIcons.info, warning: toastIcons.warning, error: toastIcons.error };

  var toastTimers = new WeakMap();
  var toastStates = new WeakMap();

  function clearToastTimer(toast) {
    var timer = toastTimers.get(toast);
    if (timer) {
      window.clearTimeout(timer);
      toastTimers.delete(toast);
    }
  }
  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    clearToastTimer(toast);
    toast.classList.add('is-leaving');
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
  }
  function armToastTimer(toast, duration) {
    clearToastTimer(toast);
    if (!duration) return;
    toastTimers.set(toast, window.setTimeout(function () { dismissToast(toast); }, duration));
  }
  function renderToast(toast) {
    var state = toastStates.get(toast);
    if (!state) return;
    var heading = toast.querySelector('.gs-toast-heading');
    if (heading) heading.textContent = resolveText(state.title);
    var paragraph = toast.querySelector('p');
    if (paragraph) paragraph.textContent = resolveText(state.message);
    var close = toast.querySelector('.gs-toast-close');
    if (close) close.setAttribute('aria-label', bilingual('关闭通知', 'Close notification'));
    toast.setAttribute('data-gs-toast-message', resolveText(state.message));
  }
  function toast(message, options) {
    if (!region) return null;
    options = options || {};
    var type = options.type === 'success' || options.type === 'error' || options.type === 'warning' ? options.type : 'info';
    var text = resolveText(message);
    if (!text) return null;
    var duration = options.duration == null ? (type === 'error' || type === 'warning' ? 7000 : 4500) : Number(options.duration);
    var sourceKey = typeof message === 'object' && message !== null ? String(message.zh != null ? message.zh : message.en) : String(message);
    var existing = null;
    Array.prototype.slice.call(region.children).forEach(function (node) {
      if (!existing && node.getAttribute('data-gs-toast-source') === sourceKey + '\\u0000' + type) existing = node;
    });
    if (existing) {
      if (existing.classList.contains('is-leaving')) existing.remove();
      else {
        armToastTimer(existing, duration);
        return existing;
      }
    }

    var toastNode = document.createElement('div');
    toastNode.className = 'gs-toast gs-toast-' + type;
    toastNode.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toastNode.setAttribute('data-gs-toast-source', sourceKey + '\\u0000' + type);

    var icon = document.createElement('span');
    icon.className = 'gs-toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = toastIcons[type];

    var copyBox = document.createElement('div');
    copyBox.className = 'gs-toast-copy';
    if (options.title) {
      var heading = document.createElement('strong');
      heading.className = 'gs-toast-heading';
      copyBox.appendChild(heading);
    }
    var paragraph = document.createElement('p');
    copyBox.appendChild(paragraph);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'gs-toast-close';
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
    close.addEventListener('click', function () { dismissToast(toastNode); });

    toastNode.append(icon, copyBox, close);
    toastStates.set(toastNode, { message: message, title: options.title || '', type: type });
    renderToast(toastNode);
    region.appendChild(toastNode);
    while (region.children.length > 4) {
      var oldest = region.firstElementChild;
      if (!oldest) break;
      clearToastTimer(oldest);
      region.removeChild(oldest);
    }
    armToastTimer(toastNode, duration);
    toastNode.addEventListener('mouseenter', function () { clearToastTimer(toastNode); });
    toastNode.addEventListener('mouseleave', function () { armToastTimer(toastNode, duration); });
    toastNode.addEventListener('focusin', function () { clearToastTimer(toastNode); });
    toastNode.addEventListener('focusout', function (event) {
      if (!toastNode.contains(event.relatedTarget)) armToastTimer(toastNode, duration);
    });
    return toastNode;
  }

  var pendingConfirm = null;
  var dialogState = null;

  function renderDialog() {
    if (!dialogState || !hasDialog) return;
    var options = dialogState.options || {};
    var variant = options.variant === 'danger' ? 'danger' : options.variant === 'warning' ? 'warning' : 'primary';
    dialog.setAttribute('data-variant', variant);
    dialogTitle.textContent = options.title ? resolveText(options.title) : bilingual('确认操作', 'Confirm action');
    var message = options.message ? resolveText(options.message) : '';
    dialogMessage.textContent = message;
    dialogMessage.hidden = !message;
    dialogDetails.replaceChildren();
    var details = Array.isArray(options.details) ? options.details : [];
    details.forEach(function (row) {
      if (!row) return;
      var item = document.createElement('div');
      item.className = 'gs-dialog-detail';
      var label = document.createElement('span');
      label.textContent = resolveText(row.label);
      var value = document.createElement('strong');
      value.textContent = resolveText(row.value);
      item.append(label, value);
      dialogDetails.appendChild(item);
    });
    dialogDetails.hidden = details.length === 0;
    dialogIcon.innerHTML = dialogIcons[variant === 'danger' ? 'error' : variant === 'warning' ? 'warning' : 'info'];
    dialogConfirm.textContent = options.confirmText ? resolveText(options.confirmText) : bilingual('确认', 'Confirm');
    dialogConfirm.className = 'btn ' + (variant === 'danger' ? 'btn-danger' : 'btn-primary');
    dialogCancel.textContent = options.cancelText ? resolveText(options.cancelText) : bilingual('取消', 'Cancel');
  }

  function confirmAction(options) {
    options = options || {};
    if (!hasDialog) {
      var fallbackTitle = options.title ? resolveText(options.title) : bilingual('确认操作', 'Confirm action');
      var fallbackMessage = options.message ? resolveText(options.message) : '';
      return Promise.resolve(window.confirm(fallbackTitle + (fallbackMessage ? ' — ' + fallbackMessage : '')));
    }
    if (dialog.open) return Promise.resolve(false);
    dialogState = { options: options };
    renderDialog();
    return new Promise(function (resolve) {
      if (pendingConfirm) {
        var previous = pendingConfirm;
        pendingConfirm = null;
        previous(false);
      }
      pendingConfirm = resolve;
      dialog.returnValue = '';
      dialog.showModal();
      document.documentElement.classList.add('gs-dialog-open');
      window.setTimeout(function () { if (dialog.open) dialogCancel.focus(); }, 0);
    });
  }

  function renderShell() {
    if (region) region.setAttribute('aria-label', bilingual('通知', 'Notifications'));
    Array.prototype.slice.call(region ? region.children : []).forEach(renderToast);
    if (hasDialog && dialog.open) renderDialog();
  }

  if (hasDialog) {
    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('gs-dialog-open');
      dialogState = null;
      if (!pendingConfirm) return;
      var resolve = pendingConfirm;
      pendingConfirm = null;
      resolve(dialog.returnValue === 'confirm');
    });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      var rect = dialog.getBoundingClientRect();
      var inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) dialog.close('cancel');
    });
  }

  // 高危操作统一走弹窗：目前是顶栏「退出」（会同时结束官网与 rent 的登录态）。
  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-confirm-logout]') : null;
    if (!trigger) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    confirmAction({
      title: { zh: '退出登录？', en: 'Log out?' },
      message: { zh: '退出后，官网与用户中心的登录状态都会结束。如需继续使用，请重新登录。', en: 'You will be signed out of this website and the account centre. Log in again to continue.' },
      confirmText: { zh: '退出登录', en: 'Log out' },
      cancelText: { zh: '取消', en: 'Cancel' },
      variant: 'danger'
    }).then(function (confirmed) {
      if (confirmed) window.location.href = trigger.getAttribute('href') || '/logout';
    });
  });

  // 服务端渲染的一次性提示（例如登出、会话过期）在页面就绪后以 Toast 呈现。
  function showServerNotices() {
    document.querySelectorAll('[data-gs-notice]').forEach(function (node) {
      var message = node.getAttribute('data-message') || '';
      if (!message) return;
      toast(message, { type: node.getAttribute('data-type') || 'info' });
      node.hidden = true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showServerNotices);
  else showServerNotices();

  window.addEventListener('geekslope:language-change', renderShell);
  renderShell();
  window.GeekSlopeUI = { toast: toast, confirm: confirmAction };
})();
</script>`
