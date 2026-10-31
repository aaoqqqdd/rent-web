import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'

async function bundled(path) {
  const output = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
}
const { listProducts, getRentalConfig, productAvailabilityLabel } = await bundled('src/db.ts')
const { renderHome } = await bundled('src/pages/home.ts')
const { renderProducts } = await bundled('src/pages/products.ts')
const { renderProductDetail } = await bundled('src/pages/product-detail.ts')
const { handleRentalRequest } = await bundled('src/public-rental.ts')
const { ENGLISH_PATTERNS } = await bundled('src/i18n.ts')

function setup(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`CREATE TABLE devices (id TEXT, name TEXT, status TEXT, lifecycle_status TEXT, pricePerDay REAL, depositAmount REAL, demo_available_from TEXT, deleted_at TEXT);
    INSERT INTO devices VALUES ('demo', 'Demo laptop', 'available', 'READY', 20, 300, '2027-03-12', NULL);
    CREATE TABLE orders (deviceId TEXT, startDate TEXT, endDate TEXT, startPeriod TEXT, endPeriod TEXT, status TEXT, deleted_at TEXT);
    CREATE TABLE systemSettings (key TEXT, value TEXT);`)
  const env = { RENT: { prepare(sql) {
    let values = []
    return { bind(...input) { values = input; return this }, async all() { return { results: db.prepare(sql).all(...values) } }, async first() { return db.prepare(sql).get(...values) || null }, async run() { return db.prepare(sql).run(...values) } }
  } } }
  return { db, env }
}

test('demo dates appear on home, catalogue and details with English translation', async t => {
  const { env, db } = setup(t)
  const [product] = await listProducts(env)
  assert.equal(product.available, false)
  assert.equal(product.demoAvailableFrom, '2027-03-12')
  const label = '2027-3-12后可用'
  assert.equal(productAvailabilityLabel(product), label)
  assert.equal((await listProducts(env))[0].demoAvailableFrom, product.demoAvailableFrom)
  const config = await getRentalConfig(env)
  const home = renderHome({ featured: [product], products: [product], minRate: 20, catalogMinRate: 20, config })
  const catalogue = renderProducts({ products: [product] })
  const detail = renderProductDetail({ product, config })
  for (const html of [home, catalogue, detail]) {
    assert.ok(html.includes(label))
    for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(script))
  }
  assert.match(catalogue, /data-available="false"/)
  assert.match(catalogue, /预约咨询/)
  assert.match(detail, /id="detail-add-cart"[^>]*disabled/)
  const pattern = ENGLISH_PATTERNS.find(([pattern]) => new RegExp(pattern).test(label))
  assert.ok(pattern)
  assert.equal(label.replace(new RegExp(pattern[0]), pattern[1]), 'Available after 2027-3-12')
  db.exec('UPDATE devices SET demo_available_from = NULL')
  const [normal] = await listProducts(env)
  assert.equal(normal.available, true)
  assert.equal(productAvailabilityLabel(normal), '现货可租')
})

test('demo devices reject direct online requests even when their real status is ready', async t => {
  const { env } = setup(t)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const date = offset => new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
  const response = await handleRentalRequest({ env, req: { header() {} }, json: (body, status) => Response.json(body, { status }) }, {
    deviceIds: ['demo'], startDate: date(10), endDate: date(15), startPeriod: 'AM', endPeriod: 'AM', firstName: 'Test', lastName: 'User', contactEmail: 'test@example.test', contactPhone: '0412345678', agree: '1', paymentMethod: 'balance', pickupTimeSlot: 'morning', returnTimeSlot: 'morning',
  })
  assert.equal(response.status, 409)
  assert.match((await response.json()).message, /当前仅可预约/)
})
