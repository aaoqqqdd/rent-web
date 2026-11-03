import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { buildSync } from "esbuild";
async function bundle(path) {
  const result = buildSync({ entryPoints: [path], bundle: true, write: false, format: "esm", platform: "browser" });
  return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
}
const { getTranslationConfig, getTranslationConfigSummary, saveTranslationConfig } = await bundle("src/translationConfig.ts");
const { translateTexts, handleTranslation, TranslationError, readTranslationJson } = await bundle("src/translation.ts");
async function setup(t, options = {}) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE systemSettings (key TEXT PRIMARY KEY, value TEXT, updatedAt TEXT, deleted_at TEXT)");
  sqlite.exec(readFileSync(new URL("./fixtures/translation-cache.sql", import.meta.url), "utf8"));
  const db = { prepare(sql) {
    let values = [];
    return {
      bind(...args) {
        values = args;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...values) || null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...values) };
      },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { meta: { changes: Number(result.changes) } };
      }
    };
  }, async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  } };
  const c = { env: { RENT: db, SETTINGS_ENCRYPTION_KEY: "translation-test-master" } };
  await saveTranslationConfig(c, { enabled: true, provider: "deepl", deeplApiKey: "test-deepl-secret:fx", googleApiKey: "test-google-secret", ...options });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), headers: new Headers(init.headers), body });
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(body.text ? { translations: body.text.map((text) => ({ text: `English ${text}` })) } : { data: { translations: body.q.map(() => ({ translatedText: "Tom &amp; Jerry &#39;PC&#39; &#x1F4BB;" })) } });
  });
  const input = (texts, extra = {}) => ({ texts, sourceLang: "zh", targetLang: "en", ...extra });
  return { sqlite, c, calls, input };
}
test("translation keys are encrypted, masked, preserved when blank, and cleared individually", async (t) => {
  const { c, sqlite } = await setup(t);
  const stored = String(sqlite.prepare("SELECT value FROM systemSettings WHERE key='translationConfig'").get().value);
  assert.doesNotMatch(stored, /test-deepl-secret|test-google-secret/);
  assert.equal((await getTranslationConfig(c)).deeplApiKey, "test-deepl-secret:fx");
  assert.doesNotMatch(JSON.stringify(await getTranslationConfigSummary(c)), /test-deepl-secret|test-google-secret/);
  await saveTranslationConfig(c, { deeplApiKey: "", provider: "google", deeplPlan: "pro", dailyByteLimit: 3e3 });
  assert.equal((await getTranslationConfig(c)).deeplApiKey, "test-deepl-secret:fx");
  await saveTranslationConfig(c, { clearDeepl: true });
  assert.equal((await getTranslationConfig(c)).deeplApiKey, "");
  assert.equal((await getTranslationConfig(c)).googleApiKey, "test-google-secret");
  await assert.rejects(() => saveTranslationConfig(c, { dailyByteLimit: -1 }));
  await assert.rejects(() => saveTranslationConfig(c, { googleApiKey: "key\nsecret" }));
  const wrongKey = { env: { ...c.env, SETTINGS_ENCRYPTION_KEY: "different" } };
  assert.equal((await getTranslationConfig(wrongKey)).googleApiKey, "");
});
test("DeepL translates only distinct missing text and persists exact UTF-8 byte counts", async (t) => {
  const { c, sqlite, calls, input } = await setup(t);
  const first = await translateTexts(c, input(["\u4F60\u597D", "\u7535\u8111\u{1F4BB}", "\u4F60\u597D"]));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api-free.deepl.com/v2/translate");
  assert.equal(calls[0].headers.get("Authorization"), "DeepL-Auth-Key test-deepl-secret:fx");
  assert.deepEqual(calls[0].body, { text: ["\u4F60\u597D", "\u7535\u8111\u{1F4BB}"], source_lang: "ZH", target_lang: "EN-GB" });
  assert.equal(first.translations[0].sourceBytes, 6);
  assert.equal(first.translations[1].sourceBytes, 10);
  assert.equal(first.translations[0].translatedBytes, new TextEncoder().encode("English \u4F60\u597D").length);
  assert.ok(first.translations.every((row) => !row.cached));
  const second = await translateTexts(c, input(["\u4F60\u597D", "\u7535\u8111\u{1F4BB}"]));
  assert.ok(second.translations.every((row) => row.cached));
  assert.equal(calls.length, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM translation_cache").get().n, 2);
  assert.equal(sqlite.prepare("SELECT source_bytes FROM translation_daily_usage").get().source_bytes, 16);
  await translateTexts(c, input(["\u4F60\u597D", "\u65B0\u589E\u5185\u5BB9"]));
  assert.deepEqual(calls[1].body.text, ["\u65B0\u589E\u5185\u5BB9"]);
});
test("Google uses its own cache, authenticates in a header and decodes escaped text safely", async (t) => {
  const { c, calls, input } = await setup(t, { provider: "google" });
  const result = await translateTexts(c, input(["\u7535\u8111"]));
  assert.equal(calls[0].url, "https://translation.googleapis.com/language/translate/v2");
  assert.equal(calls[0].headers.get("X-Goog-Api-Key"), "test-google-secret");
  assert.deepEqual(calls[0].body, { q: ["\u7535\u8111"], source: "zh", target: "en", format: "text" });
  assert.equal(result.translations[0].text, "Tom & Jerry 'PC' \u{1F4BB}");
  await translateTexts(c, input(["\u7535\u8111"]), "deepl");
  assert.equal(calls.length, 2);
  await translateTexts(c, input(["\u7535\u8111"]));
  assert.equal(calls.length, 2);
});
test("cache keys distinguish exact source text and language pairs; auto detection omits source", async (t) => {
  const { c, calls, input } = await setup(t, { deeplPlan: "pro" });
  await translateTexts(c, input(["\u7535\u8111"]));
  await translateTexts(c, input(["\u7535\u8111 "]));
  await translateTexts(c, input(["\u7535\u8111"], { targetLang: "ja" }));
  await translateTexts(c, input(["\u7535\u8111"], { sourceLang: "auto" }));
  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, "https://api.deepl.com/v2/translate");
  assert.equal(calls[3].body.source_lang, void 0);
});
test("existing translations remain usable with API disabled or the daily budget exhausted", async (t) => {
  const { c, calls, input } = await setup(t, { dailyByteLimit: 6 });
  await translateTexts(c, input(["\u4F60\u597D"]));
  await assert.rejects(() => translateTexts(c, input(["\u65B0\u589E"])), (error) => error.status === 429);
  assert.equal(calls.length, 1);
  await saveTranslationConfig(c, { enabled: false, dailyByteLimit: 0, clearDeepl: true });
  const cached = await translateTexts(c, input(["\u4F60\u597D"]));
  assert.equal(cached.translations[0].cached, true);
  await assert.rejects(() => translateTexts(c, input(["\u672A\u7FFB\u8BD1"])), (error) => error.status === 503);
  assert.equal(calls.length, 1);
});
test("concurrent workers cannot pay to translate the same missing phrase twice", async (t) => {
  const { c, calls, input } = await setup(t);
  let finish, started;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const beginning = new Promise((resolve) => {
    started = resolve;
  });
  t.mock.method(globalThis, "fetch", async () => {
    started();
    await gate;
    calls.push({});
    return Response.json({ translations: [{ text: "Computer" }] });
  });
  const first = translateTexts(c, input(["\u7535\u8111"]));
  await beginning;
  await assert.rejects(() => translateTexts(c, input(["\u7535\u8111"])), (error) => error.status === 409);
  finish();
  await first;
  assert.equal((await translateTexts(c, input(["\u7535\u8111"]))).translations[0].cached, true);
  assert.equal(calls.length, 1);
});
test("provider failures never enter the cache, expose secrets or leave an unrecoverable lock", async (t) => {
  const { c, sqlite, input } = await setup(t);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("secret upstream key");
  });
  await assert.rejects(() => translateTexts(c, input(["\u7535\u8111"])), (error) => error.status === 502 && !error.message.includes("secret"));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM translation_cache").get().n, 0);
  t.mock.method(globalThis, "fetch", async () => Response.json({ translations: [] }));
  await assert.rejects(() => translateTexts(c, input(["\u7535\u8111"])), (error) => error.status === 502);
  t.mock.method(globalThis, "fetch", async () => Response.json({ translations: [{ text: "Computer" }] }));
  assert.equal((await translateTexts(c, input(["\u7535\u8111"]))).translations[0].text, "Computer");
});
test("translation API validates batches, providers, languages and streamed body byte limits", async (t) => {
  const { c, calls, input } = await setup(t);
  for (const body of [null, {}, { texts: [] }, input([""]), input(Array(21).fill("\u7535\u8111")), input(["\u4F60".repeat(1366)]), input(["x"], { provider: "https://evil.test" }), input(["x"], { targetLang: "auto" }), input(["x"], { targetLang: "unknown" })]) {
    await assert.rejects(() => translateTexts(c, body), TranslationError);
  }
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(9e3));
    controller.enqueue(new Uint8Array(9e3));
    controller.close();
  } });
  await assert.rejects(() => readTranslationJson(stream), (error) => error.status === 413);
  assert.equal(calls.length, 0);
  const app = new Hono();
  app.post("/api/translate/:provider", (context) => {
    Object.assign(context.env, c.env);
    return handleTranslation(context);
  });
  const request = (provider, body) => app.request("/api/translate/" + provider, { method: "POST", body, headers: { "Content-Type": "application/json" } }, {});
  assert.equal((await request("deepl", "{")).status, 400);
  const response = await request("google", JSON.stringify(input(["\u7535\u8111"])));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).provider, "google");
});
