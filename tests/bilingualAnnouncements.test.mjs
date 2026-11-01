import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'

const bundle = buildSync({ entryPoints: ['src/db.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { listPublicNotices } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

for (const bilingual of [false, true]) test(`public notices read separate English fields and keep expiry filtering (bilingual=${bilingual})`, async t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`CREATE TABLE notifications (id TEXT, type TEXT, title TEXT, message TEXT, created_at TEXT, expires_at TEXT, deleted_at TEXT, sender_id TEXT${bilingual ? ', title_en TEXT, message_en TEXT' : ''});
    INSERT INTO notifications (id, type, title, message, created_at, sender_id) VALUES ('notice', 'announcement', '假期通告', '<h2>休业</h2><p>完整中文正文</p>', CURRENT_TIMESTAMP, 'admin');
    INSERT INTO notifications (id, type, title, message, created_at, expires_at, sender_id) VALUES ('expired', 'announcement', '已下架', '不可见', CURRENT_TIMESTAMP, datetime('now', '-1 hour'), 'admin');`)
  if (bilingual) db.prepare('UPDATE notifications SET title_en = ?, message_en = ? WHERE id = ?').run('Holiday closure', '<h2>Holiday closure</h2><p>Complete English body</p><script>alert(1)</script>', 'notice')
  const env = { RENT: { prepare(sql) {
    let params = []
    const statement = { bind(...values) { params = values; return statement }, async all() { return { results: db.prepare(sql).all(...params) } } }
    return statement
  } } }
  const notices = await listPublicNotices(env)
  assert.equal(notices.length, 1)
  assert.match(notices[0].messageHtml, /<h2>休业<\/h2>/)
  if (bilingual) {
    assert.equal(notices[0].titleEn, 'Holiday closure')
    assert.match(notices[0].messageHtmlEn, /<p>Complete English body<\/p>/)
    assert.doesNotMatch(notices[0].messageHtmlEn, /script|alert\(1\)/)
  } else assert.equal(notices[0].messageEn, undefined)
})
