import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'

const bundle = buildSync({ entryPoints: ['src/rental-conflicts.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })
const { finalizeRentalApplications, cancelPreparingApplications, APPLICATION_REJECTION_REASON } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const requestBundle = buildSync({ entryPoints: ['src/public-rental.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })
const { handleRentalRequest } = await import('data:text/javascript;base64,' + Buffer.from(requestBundle.outputFiles[0].text).toString('base64'))

function setup(t) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, userId TEXT, deviceId TEXT, startDate TEXT, endDate TEXT,
    startPeriod TEXT DEFAULT 'AM', endPeriod TEXT DEFAULT 'AM', status TEXT DEFAULT 'draft',
    contractId TEXT DEFAULT '', contractSigned INTEGER DEFAULT 0, payment_status TEXT DEFAULT 'UNPAID',
    order_status TEXT DEFAULT 'PENDING', rental_status TEXT DEFAULT 'PENDING', rentalNote TEXT DEFAULT '【官网申请 test】',
    createdAt TEXT, updatedAt TEXT, deleted_at TEXT, stripe_deposit_payment_intent_id TEXT);
    CREATE TABLE payments (rental_id TEXT, status TEXT);`)
  let afterRead = async () => {}
  const rent = {
    prepare(sql) {
      let values = []
      return {
        bind(...args) { values = args; return this },
        execute() { return { results: db.prepare(sql).all(...values) } },
        async all() { const result = this.execute(); await afterRead(sql, values); return result },
        async first() { return db.prepare(sql).get(...values) || null },
        async run() { const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } } },
      }
    },
    async batch(statements) {
      db.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(statement.execute())
        db.exec('COMMIT')
        return results
      } catch (error) { db.exec('ROLLBACK'); throw error }
    },
  }
  function order(id, { start = '2030-01-01', end = '2030-01-08', created = '2029-12-01T10:00:00Z', status = 'draft', device = 'pc', startPeriod = 'AM', endPeriod = 'AM', ...extra } = {}) {
    db.prepare('INSERT INTO orders (id, userId, deviceId, startDate, endDate, startPeriod, endPeriod, createdAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, `customer-${id}`, device, start, end, startPeriod, endPeriod, created, status)
    for (const [column, value] of Object.entries(extra)) db.prepare(`UPDATE orders SET ${column} = ? WHERE id = ?`).run(value, id)
  }
  const status = id => db.prepare('SELECT status FROM orders WHERE id = ?').get(id).status
  t.after(() => db.close())
  return { db, rent, order, status, afterRead(fn) { afterRead = fn } }
}

test('equal overlapping terms keep the earlier submission regardless of finalization order', async t => {
  for (const sequence of [['earlier', 'later'], ['later', 'earlier']]) {
    const { db, rent, order, status } = setup(t)
    order('earlier')
    order('later', { created: '2029-12-01T10:00:01Z' })
    const rejected = []
    for (const id of sequence) rejected.push(...(await finalizeRentalApplications(rent, [id], 0)).rejected)
    assert.equal(status('earlier'), 'pending_approval')
    assert.equal(status('later'), 'cancelled')
    assert.deepEqual(rejected.map(row => row.id), ['later'])
    const row = db.prepare("SELECT * FROM orders WHERE id = 'later'").get()
    assert.equal(row.order_status, 'CANCELLED')
    assert.equal(row.rental_status, 'CANCELLED')
    assert.equal(row.payment_status, 'PAYMENT_FAILED')
    assert.ok(row.rentalNote.includes(APPLICATION_REJECTION_REASON))
  }
})

test('a longer term wins on different dates and submission times in either finalization order', async t => {
  for (const sequence of [['short', 'long'], ['long', 'short']]) {
    const { rent, order, status } = setup(t)
    order('short', { end: '2030-01-05' })
    order('long', { start: '2030-01-03', end: '2030-01-15', created: '2029-12-02T23:00:00Z' })
    for (const id of sequence) await finalizeRentalApplications(rent, [id], 0)
    assert.equal(status('long'), 'pending_approval')
    assert.equal(status('short'), 'cancelled')
  }
})

test('actual half-day duration wins even when billing rounds both rentals to one day', async t => {
  const { rent, order, status } = setup(t)
  order('short', { end: '2030-01-01', endPeriod: 'PM' })
  order('long', { end: '2030-01-02', created: '2029-12-01T10:01:00Z' })
  await finalizeRentalApplications(rent, ['short'], 0)
  await finalizeRentalApplications(rent, ['long'], 0)
  assert.equal(status('short'), 'cancelled')
  assert.equal(status('long'), 'pending_approval')
})

test('equal lengths normalize timestamp formats and use insertion order for exact ties', async t => {
  const { rent, order, status } = setup(t)
  order('first', { created: '2029-12-01 10:00:00' })
  order('second', { start: '2030-01-02', end: '2030-01-09', created: '2029-12-01T10:00:00.000Z' })
  await finalizeRentalApplications(rent, ['second'], 0)
  await finalizeRentalApplications(rent, ['first'], 0)
  assert.equal(status('first'), 'pending_approval')
  assert.equal(status('second'), 'cancelled')
})

test('non-overlapping rentals, adjacent periods and different devices coexist', async t => {
  const { rent, order, status } = setup(t)
  order('first', { end: '2030-01-02', endPeriod: 'PM' })
  order('adjacent', { start: '2030-01-02', startPeriod: 'PM', end: '2030-01-05' })
  order('later', { start: '2030-02-01', end: '2030-02-03' })
  order('other', { device: 'another' })
  await finalizeRentalApplications(rent, ['first', 'adjacent', 'later', 'other'], 0)
  for (const id of ['first', 'adjacent', 'later', 'other']) assert.equal(status(id), 'pending_approval')
})

test('turnover buffers participate in overlap checks without increasing rental duration', async t => {
  const { rent, order, status } = setup(t)
  order('short', { end: '2030-01-02' })
  order('long', { start: '2030-01-03', end: '2030-01-10' })
  await finalizeRentalApplications(rent, ['short'], 1)
  await finalizeRentalApplications(rent, ['long'], 1)
  assert.equal(status('short'), 'cancelled')
  assert.equal(status('long'), 'pending_approval')
})

test('confirmed, signed, paid and ordinary draft orders cannot be displaced', async t => {
  for (const extra of [{ status: 'approved' }, { status: 'active' }, { status: 'draft', rentalNote: '普通草稿' },
    { status: 'pending_approval', contractId: 'contract' }, { status: 'pending_approval', contractSigned: 1 },
    { status: 'pending_approval', payment_status: 'PAID' }, { status: 'pending_approval', paid: true },
    { status: 'active', start: null, end: null }]) {
    const { db, rent, order, status } = setup(t)
    const { paid, ...fields } = extra
    order('existing', { end: '2030-01-02', ...fields })
    if (paid) db.exec("INSERT INTO payments VALUES ('existing', 'paid')")
    order('new', { end: '2030-01-30' })
    const result = await finalizeRentalApplications(rent, ['new'], 0)
    assert.deepEqual(result.acceptedIds, [])
    assert.equal(status('new'), 'cancelled')
    assert.equal(status('existing'), extra.status)
  }
})

test('cancelled, completed and deleted bookings do not prevent submission', async t => {
  const { rent, order, status } = setup(t)
  order('cancelled', { status: 'cancelled' })
  order('completed', { status: 'completed' })
  order('deleted', { status: 'active', deleted_at: '2029-12-01' })
  order('new')
  await finalizeRentalApplications(rent, ['new'], 0)
  assert.equal(status('new'), 'pending_approval')
})

test('batch failure rolls back promotion and rejection together', async t => {
  const { db, rent, order, status } = setup(t)
  order('short', { status: 'pending_approval', end: '2030-01-02' })
  order('long')
  db.exec("CREATE TRIGGER fail_cancel BEFORE UPDATE ON orders WHEN NEW.status = 'cancelled' BEGIN SELECT RAISE(ABORT, 'forced failure'); END")
  await assert.rejects(() => finalizeRentalApplications(rent, ['long'], 0), /forced failure/)
  assert.equal(status('short'), 'pending_approval')
  assert.equal(status('long'), 'draft')
})

test('cleanup only cancels unfinished website orders and preserves their authorization IDs', async t => {
  const { rent, order, status } = setup(t)
  order('unfinished', { stripe_deposit_payment_intent_id: 'pi_hold' })
  order('ready', { status: 'pending_approval' })
  const result = await cancelPreparingApplications(rent, ['unfinished', 'ready'])
  assert.equal(status('unfinished'), 'cancelled')
  assert.equal(status('ready'), 'pending_approval')
  assert.deepEqual(result.map(row => ({ ...row })), [{ id: 'unfinished', userId: 'customer-unfinished', stripe_deposit_payment_intent_id: 'pi_hold' }])
  assert.deepEqual(await cancelPreparingApplications(rent, ['unfinished']), [])
  assert.deepEqual((await finalizeRentalApplications(rent, ['ready'], 0)).rejected, [])
})

function requestSetup(t) {
  const fixture = setup(t)
  const { db, rent } = fixture
  for (const column of ['orderNo TEXT', 'rentalPeriod INTEGER', 'totalAmount REAL', 'depositAmount REAL', 'paymentMethod TEXT',
    'pickupTimeSlot TEXT', 'returnTimeSlot TEXT', 'pickupLocation TEXT', 'returnLocation TEXT', 'deliveryMethod TEXT',
    'deliveryFee REAL', 'coupon_code TEXT', 'discount_amount REAL', 'serviceFee REAL', 'payment_provider TEXT',
    'refundMethod TEXT', 'stripe_payment_method_id TEXT', 'stripe_setup_intent_id TEXT', 'deposit_payment_mode TEXT',
    'deposit_status TEXT', 'deposit_held_amount REAL', 'settlement_status TEXT']) db.exec(`ALTER TABLE orders ADD COLUMN ${column}`)
  db.exec(`CREATE TABLE devices (id TEXT, name TEXT, status TEXT, lifecycle_status TEXT, pricePerDay REAL, depositAmount REAL, deleted_at TEXT);
    INSERT INTO devices VALUES ('pc', 'Computer', 'available', 'READY', 20, 300, NULL), ('other', 'Other computer', 'available', 'READY', 30, 400, NULL);
    CREATE TABLE users (id TEXT, email TEXT, name TEXT, phone TEXT, first_name TEXT, last_name TEXT, role TEXT, status TEXT, account_type TEXT);
    INSERT INTO users VALUES ('customer', 'test@example.test', 'Test User', '0412345678', 'Test', 'User', 'CUSTOMER', 'active', 'formal');
    INSERT INTO users VALUES ('admin', 'admin@example.test', 'Admin', '', '', '', 'ADMIN', 'active', 'formal');
    CREATE TABLE systemSettings (key TEXT, value TEXT);
    CREATE TABLE coupons (id TEXT, used_count INTEGER, updated_at TEXT, restore_on_cancellation INTEGER);
    CREATE TABLE coupon_redemptions (coupon_id TEXT, order_id TEXT, status TEXT, cancelled_at TEXT);
    CREATE TABLE notifications (id TEXT, recipient_id TEXT, type TEXT, title TEXT, message TEXT, order_id TEXT, deleted_at TEXT);`)
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('/setup_intents/')) return Response.json({ id: 'seti_test', status: 'succeeded', payment_method: 'pm_test' })
    if (String(url).includes('/payment_methods/')) return Response.json({ id: 'pm_test', customer: 'cus_test', card: { brand: 'visa' } })
    throw new Error('Unexpected payment request: ' + url)
  })
  const today = new Date().toISOString().slice(0, 10)
  const date = days => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
  const env = { RENT: rent, STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_PUBLISHABLE_KEY: 'pk_test_fake' }
  const request = (days, ids = ['pc']) => handleRentalRequest({ env, req: { header() {} }, json: (body, status) => Response.json(body, { status }) }, {
    deviceIds: ids, startDate: date(10), endDate: date(10 + days), startPeriod: 'AM', endPeriod: 'AM',
    firstName: 'Test', lastName: 'User', contactEmail: 'test@example.test', contactPhone: '0412345678',
    agree: '1', paymentMethod: 'card', stripeSetupIntentId: 'seti_test', pickupTimeSlot: 'morning', returnTimeSlot: 'morning',
  })
  return { ...fixture, request }
}

test('request handler arbitrates concurrent submissions, not ordinary later applications', async t => {
  const { db, request, afterRead } = requestSetup(t)
  let readers = 0
  let release
  const barrier = new Promise(resolve => { release = resolve })
  afterRead(async sql => {
    if (!sql.startsWith('SELECT startDate, endDate, startPeriod, endPeriod FROM orders WHERE deviceId')) return
    if (++readers === 2) release()
    await barrier
  })
  const responses = await Promise.all([request(30), request(45)])
  assert.ok(responses.every(response => [200, 409].includes(response.status)))
  const rows = db.prepare('SELECT * FROM orders ORDER BY rentalPeriod').all()
  assert.equal(rows.length, 2)
  assert.equal(rows[0].status, 'cancelled')
  assert.equal(rows[1].status, 'pending_approval')
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'rental_application_rejected'").get().count, 1)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE order_id = ? AND type = 'rental_application' AND deleted_at IS NULL").get(rows[0].id).count, 0)
  const later = await request(90)
  assert.equal(later.status, 409)
  assert.match((await later.json()).message, /已有订单/)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 2)
})

test('a cart with one concurrent conflict keeps its unrelated device and reports only accepted orders', async t => {
  const { db, request, afterRead } = requestSetup(t)
  let checked = 0
  let release
  const barrier = new Promise(resolve => { release = resolve })
  afterRead(async (sql, values) => {
    if (!sql.startsWith('SELECT startDate, endDate, startPeriod, endPeriod FROM orders WHERE deviceId') || values[0] !== 'pc') return
    if (++checked === 2) release()
    await barrier
  })
  const [longResponse, cartResponse] = await Promise.all([request(45), request(30, ['pc', 'other'])])
  assert.equal(longResponse.status, 200)
  assert.equal(cartResponse.status, 200)
  const result = await cartResponse.json()
  assert.equal(result.orderCount, 1)
  assert.equal(result.orderIds.length, 1)
  assert.equal(result.rejectedOrderIds.length, 1)
  assert.match(result.message, /1 台设备的申请已提交，1 台设备因档期冲突已自动拒绝/)
  const accepted = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.orderIds[0])
  assert.equal(accepted.deviceId, 'other')
  assert.equal(accepted.status, 'pending_approval')
})
