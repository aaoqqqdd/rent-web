import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'

const bundle = buildSync({ entryPoints: ['src/public-rental.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { authorizeCardForOrder, settleRejectedApplication } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

function setup(t, overrides = {}) {
  const calls = [], statements = []
  let created
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const path = String(url).replace('https://api.stripe.com/v1/', '')
    const params = new URLSearchParams(init?.body)
    calls.push({ path, params })
    if (path === 'payment_intents') {
      created = { id: 'pi_test', amount: Number(params.get('amount')), currency: 'aud', status: 'requires_confirmation' }
      return Response.json(created)
    }
    if (path.endsWith('/confirm')) return Response.json({ ...created, status: 'requires_capture', ...overrides })
    if (path.endsWith('/cancel')) return Response.json({ ...created, status: 'canceled' })
    throw new Error('Unexpected Stripe request: ' + path)
  })
  const context = { env: {
    STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_PUBLISHABLE_KEY: 'pk_test_fake',
    RENT: {
      prepare(sql) {
        const statement = { sql, values: [], bind(...values) { this.values = values; return this }, async run() { statements.push(this); return { success: true } } }
        return statement
      },
      async batch(batch) { return Promise.all(batch.map(statement => statement.run())) },
    },
  } }
  return { context, calls, statements }
}

test('short Stripe rental authorizes rent, deposit and rent fee in one PaymentIntent', async t => {
  const { context, calls, statements } = setup(t)
  await authorizeCardForOrder(context, 'order', 'customer', 1000, 'pm_test', 'visa', 1, 'cus_test', { amount: 50, feeRate: 0.025 })
  const params = calls[0].params
  assert.equal(params.get('amount'), '105125')
  assert.equal(params.get('capture_method'), 'manual')
  assert.equal(params.get('metadata[type]'), 'rental_authorization')
  assert.equal(params.get('metadata[order_id]'), 'order')
  assert.equal(params.get('metadata[customer_id]'), 'customer')
  assert.equal(params.get('metadata[rental_amount]'), '5000')
  assert.equal(params.get('metadata[deposit_amount]'), '100000')
  assert.equal(params.get('metadata[processing_fee]'), '125')
  assert.equal(calls.filter(call => call.path === 'payment_intents').length, 1)
  assert.ok(!calls.some(call => call.path.endsWith('/capture')))
  const payment = statements.find(statement => statement.sql.includes('INSERT OR IGNORE INTO payments'))
  assert.deepEqual(payment.values.slice(3, 7), [1051.25, 1000, 50, 1.25])
})

test('gift card orders retain a separate deposit-only card authorization', async t => {
  const { context, calls, statements } = setup(t)
  await authorizeCardForOrder(context, 'order', 'customer', 1000, 'pm_test', 'visa', 1, 'cus_test')
  assert.equal(calls[0].params.get('amount'), '100000')
  assert.equal(calls[0].params.get('metadata[type]'), 'deposit_authorization')
  assert.deepEqual(statements[0].values.slice(3, 7), [1000, 1000, 0, 0])
})

test('invalid upstream amounts are rejected before writing a payment', async t => {
  const { context, statements } = setup(t, { amount: 100000 })
  await assert.rejects(() => authorizeCardForOrder(context, 'order', 'customer', 1000, 'pm_test', 'visa', 1, 'cus_test', { amount: 50, feeRate: 0.025 }), /金额或币种不匹配/)
  assert.equal(statements.length, 0)
})

test('unsupported extended authorization releases the full hold and falls back to a saved card', async t => {
  const { context, calls, statements } = setup(t)
  await authorizeCardForOrder(context, 'order', 'customer', 1000, 'pm_test', 'visa', 10, 'cus_test', { amount: 500, feeRate: 0.025 })
  assert.equal(calls[0].params.get('amount'), '151250')
  assert.ok(calls.some(call => call.path.endsWith('/cancel')))
  assert.ok(statements.some(statement => statement.sql.includes("deposit_payment_mode = 'SETUP_INTENT'")))
  assert.ok(!statements.some(statement => statement.sql.includes('INSERT OR IGNORE INTO payments')))
})

test('checkout renders valid scripts and shows the combined authorization summary', async () => {
  const pageBundle = buildSync({ entryPoints: ['src/pages/apply.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  const { renderApply } = await import('data:text/javascript;base64,' + Buffer.from(pageBundle.outputFiles[0].text).toString('base64'))
  const html = renderApply({ products: [{ id: 'device', name: '电脑', brand: 'Test', model: '', cpu: '', ram: '', storage: '', gpu: '', os: '', pricePerDay: 50, weeklyDiscountPercent: 0, monthlyDiscountPercent: 0, depositAmount: 1000, description: '', available: true, category: 'ultrabook', categoryLabel: '笔记本', specs: [] }], selectedId: 'device', config: { minimumRentalDays: 1, bufferDays: 0, unavailableDates: [], unavailableTimeSlots: {}, serviceFeeHours: [], unavailablePickupHours: [], businessHours: { start: '09:00', end: '17:00' }, serviceFeeRate: 0, pickupLocations: ['门店'], deliveryAreas: [], deliveryNote: '' }, appUrl: 'https://rent.example.test', turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false })
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1])
  assert.ok(scripts.length)
  for (const script of scripts) assert.doesNotThrow(() => new Function(script))
  assert.match(html, /预计预授权总额/)
  assert.doesNotMatch(html, /仅用于押金预授权，不会立即收取租金/)
})

test('automatic rejection releases the entire uncaptured authorization without capture or refund', async t => {
  const { context, statements } = setup(t)
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), method: init.method, key: init.headers['Idempotency-Key'] })
    return Response.json({ id: 'pi_hold', status: String(url).endsWith('/cancel') ? 'canceled' : 'requires_capture' })
  })
  await settleRejectedApplication(context, { id: 'loser', userId: 'customer', stripe_deposit_payment_intent_id: 'pi_hold' })
  assert.deepEqual(calls.map(call => call.method), ['GET', 'POST'])
  assert.equal(calls[1].url, 'https://api.stripe.com/v1/payment_intents/pi_hold/cancel')
  assert.equal(calls[1].key, 'web-conflict-release-loser')
  assert.ok(statements.some(statement => statement.sql.includes("status = 'failed'") && statement.values[0] === 'loser'))
  assert.ok(statements.some(statement => statement.sql.includes('deposit_held_amount = 0')))
})

test('already released authorizations can be settled again without another cancellation', async t => {
  const { context, statements } = setup(t)
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(init.method)
    return Response.json({ id: 'pi_hold', status: 'canceled' })
  })
  await settleRejectedApplication(context, { id: 'loser', userId: 'customer', stripe_deposit_payment_intent_id: 'pi_hold' })
  assert.deepEqual(calls, ['GET'])
  assert.equal(statements.length, 2)
})

test('a captured or unsuccessfully cancelled authorization is kept for review', async t => {
  for (const status of ['succeeded', 'requires_capture']) {
    const { context, statements } = setup(t)
    t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'pi_hold', status }))
    await assert.rejects(() => settleRejectedApplication(context, { id: 'loser', userId: 'customer', stripe_deposit_payment_intent_id: 'pi_hold' }))
    assert.equal(statements.length, 0)
  }
})
