import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";
async function bundle(path) {
  const result = buildSync({ entryPoints: [path], bundle: true, write: false, format: "esm", platform: "browser" });
  return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
}
const { TRANSLATION_CLIENT_SCRIPT } = await bundle("src/translationClient.ts");
function browser() {
  const jobs = /* @__PURE__ */ new Map(), observers = [], events = /* @__PURE__ */ new Map();
  let sequence = 0, finish;
  const calls = [];
  const device = { children: [], textContent: "\u516C\u5F00\u8BBE\u5907", closest: () => null };
  Object.defineProperty(device, "innerHTML", { set() {
    throw new Error("Translations must be plain text");
  } });
  const privateText = { textContent: "\u5BA2\u6237\u79C1\u5BC6\u8D44\u6599" };
  const document = {
    documentElement: { lang: "en" },
    body: {},
    readyState: "complete",
    querySelectorAll(selector) {
      assert.equal(selector, "[data-api-translate]");
      return [device];
    }
  };
  const window = { addEventListener(name, callback) {
    events.set(name, callback);
  } };
  runInNewContext(TRANSLATION_CLIENT_SCRIPT, {
    document,
    window,
    TextEncoder,
    console,
    fetch(url, init) {
      calls.push({ url, ...init });
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    setTimeout(callback) {
      const id = ++sequence;
      jobs.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      jobs.delete(id);
    },
    MutationObserver: class {
      constructor(callback) {
        observers.push(callback);
      }
      observe() {
      }
    }
  });
  async function flush() {
    for (let i = 0; i < 5; i++) {
      const pending = [...jobs.values()];
      jobs.clear();
      pending.forEach((job) => job());
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  return { calls, device, privateText, window, document, observers, events, flush, respond(text) {
    finish(Response.json({ ok: true, translations: [{ text }] }));
  } };
}
test("only explicitly marked public text is translated, restored on Chinese, and rendered as text", async () => {
  const b = browser();
  await b.flush();
  assert.equal(b.calls.length, 1);
  assert.deepEqual(JSON.parse(b.calls[0].body).texts, ["\u516C\u5F00\u8BBE\u5907"]);
  assert.equal(b.calls[0].url, "/api/translate");
  b.respond("<img src=x onerror=alert(1)>");
  await b.flush();
  assert.equal(b.device.textContent, "<img src=x onerror=alert(1)>");
  assert.equal(b.privateText.textContent, "\u5BA2\u6237\u79C1\u5BC6\u8D44\u6599");
  b.document.documentElement.lang = "zh-CN";
  b.observers[0]();
  await b.flush();
  assert.equal(b.device.textContent, "\u516C\u5F00\u8BBE\u5907");
  b.document.documentElement.lang = "en";
  b.events.get("geekslope:language-change")();
  await b.flush();
  assert.equal(b.calls.length, 1);
  assert.equal(b.device.textContent, "<img src=x onerror=alert(1)>");
});
test("a late API response cannot change a page that has switched back to Chinese", async () => {
  const b = browser();
  await b.flush();
  b.document.documentElement.lang = "zh-CN";
  b.events.get("site-language-change")();
  await b.flush();
  b.respond("Public computer");
  await b.flush();
  assert.equal(b.device.textContent, "\u516C\u5F00\u8BBE\u5907");
  b.document.documentElement.lang = "en";
  b.observers[0]();
  await b.flush();
  assert.equal(b.device.textContent, "Public computer");
  assert.equal(b.calls.length, 1);
});
test("the public browser API coalesces identical in-flight calls", async () => {
  const b = browser();
  const first = b.window.SiteTranslation.translate(["\u516C\u5F00\u8BBE\u5907"]);
  const second = b.window.SiteTranslation.translate(["\u516C\u5F00\u8BBE\u5907"]);
  assert.equal(first, second);
  assert.equal(b.calls.length, 1);
  b.respond("Public computer");
  assert.deepEqual(Array.from(await first), ["Public computer"]);
});
