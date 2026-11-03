/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// Only explicitly marked public content is submitted; arbitrary page text is never scanned for translation.
export const TRANSLATION_CLIENT_SCRIPT = String.raw`(function () {
  'use strict';
  var memory = new Map(), pending = new Map(), state = new WeakMap(), timer;
  var english = function () { return /^en(?:-|$)/i.test(document.documentElement.lang || ''); };
  function translate(texts, options) {
    options = options || {};
    var payload = { texts: texts, sourceLang: options.sourceLang || 'zh', targetLang: options.targetLang || 'en' };
    if (options.provider) payload.provider = options.provider;
    var key = JSON.stringify(payload);
    if (pending.has(key)) return pending.get(key);
    var request = function (attempt) {
      return fetch('/api/translate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: key })
        .then(function (response) {
          if (response.status === 409 && attempt < 4) return new Promise(function (resolve) { setTimeout(resolve, [500, 1500, 3500, 7000][attempt]); }).then(function () { return request(attempt + 1); });
          return response.json().then(function (result) {
            if (!response.ok || !result.ok || !Array.isArray(result.translations) || result.translations.length !== texts.length) throw new Error(result.message || 'Translation unavailable');
            return result.translations.map(function (item) { if (typeof item.text !== 'string') throw new Error('Invalid translation'); return item.text; });
          });
        });
    };
    var promise = request(0).finally(function () { pending.delete(key); });
    pending.set(key, promise);
    return promise;
  }
  window.SiteTranslation = { translate: translate };
  function apply() {
    var missing = [], requested = new Set();
    document.querySelectorAll('[data-api-translate]').forEach(function (element) {
      if (element.children.length || element.closest('script,style,input,textarea,[contenteditable],[data-no-api-translate]')) return;
      var current = element.textContent || '', saved = state.get(element);
      if (!saved || saved.last !== current) { saved = { source: current, last: current }; state.set(element, saved); }
      if (!english()) { if (current !== saved.source) element.textContent = saved.source; saved.last = saved.source; return; }
      var source = saved.source;
      if (!/[\u3400-\u9fff]/.test(source) || !source.trim() || new TextEncoder().encode(source).length > 4096) return;
      if (memory.has(source)) { element.textContent = memory.get(source); saved.last = element.textContent; return; }
      if (!requested.has(source)) { missing.push(source); requested.add(source); }
    });
    while (missing.length) {
      var batch = [], size = 0;
      while (missing.length && batch.length < 20 && size + new TextEncoder().encode(missing[0]).length <= 10000) { var next = missing.shift(); batch.push(next); size += new TextEncoder().encode(next).length; }
      (function (texts) {
        translate(texts).then(function (results) { texts.forEach(function (text, index) { memory.set(text, results[index]); }); schedule(); }).catch(function () {});
      })(batch);
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(apply, 80); }
  function start() {
    schedule();
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    new MutationObserver(function (changes) {
      if (changes.some(function (change) { return Array.from(change.addedNodes).some(function (node) { return node.nodeType === 1 && (node.matches('[data-api-translate]') || node.querySelector('[data-api-translate]')); }); })) schedule();
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('site-language-change', schedule);
  window.addEventListener('geekslope:language-change', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();`
