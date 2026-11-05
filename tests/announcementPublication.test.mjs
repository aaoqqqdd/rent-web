import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'

const bundle = buildSync({ entryPoints: ['src/db.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })
const { listPublicNotices, getPublicNotice } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

for (const hasExpiry of [true, false]) test(`admin announcements retain the seven-day limit and manual unpublishing (expiry column=${hasExpiry})`, async t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`CREATE TABLE notifications (id TEXT, type TEXT, title TEXT, message TEXT, created_at TEXT, deleted_at TEXT, sender_id TEXT${hasExpiry ? ', expires_at TEXT' : ''});
    INSERT INTO notifications (id, type, title, message, created_at, sender_id) VALUES
      ('old', 'announcement', 'Older announcement', 'Still published', datetime('now', '-30 days'), 'admin'),
      ('new', 'announcement', 'Newer announcement', 'Also published', CURRENT_TIMESTAMP, 'admin'),
      ('boundary', 'announcement', 'Seven days old', 'Expired automatically', datetime('now', '-7 days'), 'admin'),
      ('policy', 'policy_update', 'Old policy update', 'Old update', datetime('now', '-4 days'), 'admin'),
      ('removed', 'announcement', 'Removed', 'Withdrawn', CURRENT_TIMESTAMP, 'admin');
    UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE id = 'removed';`)
  if (hasExpiry) db.exec(`INSERT INTO notifications (id, type, title, message, created_at, sender_id, expires_at) VALUES
    ('expired', 'announcement', 'Expired', 'Past expiry', CURRENT_TIMESTAMP, 'admin', datetime('now', '-1 hour')),
    ('future', 'announcement', 'Future expiry', 'Still active', datetime('now', '-2 days'), 'admin', datetime('now', '+1 day')),
    ('old-future', 'announcement', 'Old with future expiry', 'Seven day limit still applies', datetime('now', '-30 days'), 'admin', datetime('now', '+1 day')),
    ('private', 'announcement', 'Private', 'Customer message', CURRENT_TIMESTAMP, NULL, NULL);`)
  const env = { RENT: { prepare(sql) {
    let params = []
    const statement = { bind(...values) { params = values; return statement }, async all() { return { results: db.prepare(sql).all(...params) } } }
    return statement
  } } }
  const notices = await listPublicNotices(env)
  assert.deepEqual(notices.map(notice => notice.id).sort(), (hasExpiry
    ? ['announcement:future', 'announcement:new']
    : ['announcement:new']).sort())
  assert.ok(notices.find(notice => notice.id === 'announcement:new').expiresAt)
  if (hasExpiry) assert.ok(notices.find(notice => notice.id === 'announcement:future').expiresAt)
})

test('website ads read only published, unexpired bilingual content and sanitize the separate reader', async t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`CREATE TABLE website_advertisements (id TEXT, title TEXT, message TEXT, title_en TEXT, message_en TEXT, active INTEGER, expires_at TEXT, created_at TEXT, created_by TEXT);
    INSERT INTO website_advertisements VALUES
      ('live', '官网促销', '<h2>官网促销</h2><p>内容</p><script>alert(1)</script>', 'Website offer', '<p>Offer body</p>', 1, NULL, CURRENT_TIMESTAMP, 'admin-private-id'),
      ('hidden', '下架广告', 'Hidden', 'Hidden', 'Hidden', 0, NULL, CURRENT_TIMESTAMP, 'admin'),
      ('expired', '过期广告', 'Expired', 'Expired', 'Expired', 1, datetime('now', '-1 hour'), CURRENT_TIMESTAMP, 'admin');`)
  const env = { RENT: { prepare(sql) {
    let params = []
    const statement = { bind(...values) { params = values; return statement }, async all() { return { results: db.prepare(sql).all(...params) } } }
    return statement
  } } }
  const notices = await listPublicNotices(env)
  assert.equal(notices.length, 1)
  assert.equal(notices[0].kind, 'advertisement')
  assert.equal(notices[0].titleEn, 'Website offer')
  assert.match(notices[0].messageHtmlEn, /<p>Offer body<\/p>/)
  assert.doesNotMatch(JSON.stringify(notices), /<script\b[^>]*>|admin-private-id/i)
  assert.equal((await getPublicNotice(env, 'advertisement:live')).title, '官网促销')
  assert.equal(await getPublicNotice(env, 'advertisement:hidden'), null)
  assert.equal(await getPublicNotice(env, 'advertisement:expired'), null)
})
