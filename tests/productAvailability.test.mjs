import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function bundled(path) {
  const output = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
}
const { listProducts, getDeviceAvailability, getRentalConfig, productAvailabilityLabel } = await bundled('src/db.ts')
const { renderProducts } = await bundled('src/pages/products.ts')
const { renderProductDetail } = await bundled('src/pages/product-detail.ts')
const { renderCartPage, renderApply } = await bundled('src/pages/apply.ts')
const { handleRentalRequest } = await bundled('src/public-rental.ts')
const { ENGLISH_PATTERNS } = await bundled('src/i18n.ts')

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function date(offset) { return new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10) }
function setup(t) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE devices (id TEXT, name TEXT, status TEXT, lifecycle_status TEXT, pricePerDay REAL, depositAmount REAL, deleted_at TEXT);
    INSERT INTO devices VALUES ('pc', 'HP EliteBook 840', 'rented', 'RETURNED', 20, 300, NULL);
    CREATE TABLE orders (deviceId TEXT, startDate TEXT, endDate TEXT, startPeriod TEXT, endPeriod TEXT, status TEXT, deleted_at TEXT);
    CREATE TABLE device_unavailable_dates (device_id TEXT, unavailable_date TEXT, deleted_at TEXT);
    CREATE TABLE device_unavailable_time_slots (device_id TEXT, unavailable_date TEXT, time_slot TEXT, deleted_at TEXT);
    CREATE TABLE systemSettings (key TEXT, value TEXT);
    CREATE TABLE users (email TEXT, role TEXT);
    INSERT INTO users VALUES ('test@example.test', 'STAFF');`)
  const env = { RENT: { prepare(sql) {
    let values = []
    return { bind(...input) { values = input; return this }, async all() { return { results: db.prepare(sql).all(...values) } }, async first() { return db.prepare(sql).get(...values) || null }, async run() { return db.prepare(sql).run(...values) } }
  } } }
  const order = (start, end, status = 'active', deleted = null, endPeriod = 'AM') => db.prepare("INSERT INTO orders VALUES ('pc', ?, ?, 'AM', ?, ?, ?)").run(start, end, endPeriod, status, deleted)
  const request = (start, end) => handleRentalRequest({ env, req: { header() {} }, json: (body, status) => Response.json(body, { status }) }, {
    deviceIds: ['pc'], startDate: start, endDate: end, startPeriod: 'AM', endPeriod: 'AM', firstName: 'Test', lastName: 'User', contactEmail: 'test@example.test', contactPhone: '0412345678', agree: '1', paymentMethod: 'balance', pickupTimeSlot: 'morning', returnTimeSlot: 'morning',
  })
  t.after(() => db.close())
  return { db, env, order, request }
}

test('completed, cancelled and deleted orders release their dates despite stale device lifecycle', async t => {
  const { env, order } = setup(t)
  order(date(-1), date(5), 'completed')
  order(date(-1), date(6), 'cancelled')
  order(date(-1), date(7), 'active', today)
  const [product] = await listProducts(env)
  assert.equal(product.available, true)
  assert.equal(product.bookable, true)
  assert.equal(product.availableFrom, undefined)
  assert.equal(productAvailabilityLabel(product), '现货可租')
  const calendar = (await getDeviceAvailability(env, ['pc'])).pc
  assert.deepEqual(calendar.rentalRanges, [])
  assert.deepEqual(calendar.unavailablePeriods, {})
})

test('current and consecutive rentals show the next free date and remain bookable online', async t => {
  const { env, order } = setup(t)
  order(date(-1), date(3))
  order(date(3), date(5), 'pending_approval')
  order(date(10), date(12))
  const [product] = await listProducts(env)
  assert.equal(product.available, false)
  assert.equal(product.bookable, true)
  assert.equal(product.availableFrom, date(5))
  const label = `${date(5)} 后可租`
  assert.equal(productAvailabilityLabel(product), label)
  const html = renderProducts({ products: [product] })
  assert.ok(html.includes(label))
  assert.match(html, /href="\/products\/pc">选择租期/)
  assert.doesNotMatch(html, /预约咨询/)
  const config = await getRentalConfig(env)
  const detail = renderProductDetail({ product, config })
  assert.ok(detail.includes(label))
  const checkout = renderApply({ products: [product], config, selectedId: '', appUrl: '', turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false })
  for (const page of [html, detail, renderCartPage([product], config), checkout]) {
    for (const [, script] of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(script))
  }
  for (const page of [renderCartPage([product], config), checkout]) assert.match(page, /"available":true/)
  const pattern = ENGLISH_PATTERNS.find(([pattern]) => new RegExp(pattern).test(label))
  assert.ok(pattern)
  assert.equal(label.replace(new RegExp(pattern[0]), pattern[1]), `Available after ${date(5)}`)
})

test('future bookings only block their own dates and turnover buffers extend the next date', async t => {
  const { env, db, order } = setup(t)
  order(date(5), date(8))
  assert.equal((await listProducts(env))[0].available, true)
  order(date(-3), date(1))
  db.exec(`INSERT INTO systemSettings VALUES ('rentalRules', '{"bufferDays":1}')`)
  assert.equal((await listProducts(env))[0].availableFrom, date(3))
  const calendar = (await getDeviceAvailability(env, ['pc'], 1)).pc
  assert.deepEqual(calendar.unavailablePeriods[date(1)], ['AM', 'PM'])
  assert.deepEqual(calendar.unavailablePeriods[date(2)], ['AM'])
})

test('calendar and server reject occupied terms but allow a later free term through date validation', async t => {
  const { env, order, request } = setup(t)
  order(date(-1), date(3))
  const calendar = (await getDeviceAvailability(env, ['pc'])).pc
  assert.deepEqual(calendar.unavailablePeriods[date(1)], ['AM', 'PM'])
  assert.equal(calendar.unavailablePeriods[date(4)], undefined)
  const conflict = await request(date(1), date(2))
  assert.equal(conflict.status, 409)
  assert.match((await conflict.json()).message, /已有订单/)
  const free = await request(date(4), date(6))
  assert.equal(free.status, 403)
  // The staff fixture reaches account validation only after passing device/date checks.
  assert.equal((await free.json()).message, '该账号当前无法下单，请联系客服。')
})

test('pending applications still block the calendar and later overlapping submissions, including longer rentals', async t => {
  const { env, order, request } = setup(t)
  order(date(2), date(4), 'pending_approval')
  const calendar = (await getDeviceAvailability(env, ['pc'])).pc
  assert.deepEqual(calendar.unavailablePeriods[date(3)], ['AM', 'PM'])
  const response = await request(date(1), date(15))
  assert.equal(response.status, 409)
  assert.match((await response.json()).message, /已有订单/)
})

test('unknown return dates block the calendar and server while maintenance remains unavailable', async t => {
  const { env, db, order, request } = setup(t)
  order(null, null)
  assert.equal((await listProducts(env))[0].bookable, false)
  assert.equal((await getDeviceAvailability(env, ['pc'])).pc.unavailable, true)
  assert.equal((await request(date(4), date(6))).status, 409)
  db.exec("DELETE FROM orders; UPDATE devices SET status = 'maintenance', lifecycle_status = 'MAINTENANCE'")
  const [product] = await listProducts(env)
  assert.equal(product.available, false)
  assert.equal(product.bookable, false)
  assert.equal((await request(date(4), date(6))).status, 409)
})

// Exercise the actual bundled detail script: endpoints outside a booking must
// still reject a term that spans it, and the occupied calendar cell is disabled.
test('detail calendar disables occupied dates and dates that cross another rental', async t => {
  const { env, order } = setup(t)
  order(date(5), date(8))
  const [product] = await listProducts(env)
  const config = await getRentalConfig(env)
  const html = renderProductDetail({ product, config })
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1]
  const prefix = script.slice(0, script.indexOf('  var renderPicker ='))
  const elements = new Map()
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', min: '', dataset: {}, addEventListener() {}, setCustomValidity() {} })
    return elements.get(id)
  }
  const context = { document: { getElementById: element }, window: {}, Intl, Date }
  runInNewContext(prefix + `availability = ${JSON.stringify(await getDeviceAvailability(env, ['pc']))}; availabilityReady = true; start.min = ${JSON.stringify(date(1))}; end.min = ${JSON.stringify(date(2))}; start.value = ${JSON.stringify(date(1).split('-').reverse().join('/'))}; globalThis.check = pickerDateDisabled; })();`, context)
  assert.equal(context.check('start', date(6)), true)
  assert.equal(context.check('start', date(9)), false)
  assert.equal(context.check('end', date(9)), true)
  assert.equal(context.check('end', date(3)), false)
})
