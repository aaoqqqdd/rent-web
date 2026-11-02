import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { DatabaseSync } from 'node:sqlite'

async function bundle(path) {
  const result = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true, keepNames: true })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { rentalPriceBreakdown, firstRentalInstallment, allocateRentalDiscount, rentalPaymentPlan } = await bundle('src/rental-pricing.ts')
const { renderApply, renderCartPage } = await bundle('src/pages/apply.ts')
const { listProducts, getRentalConfig } = await bundle('src/db.ts')
const { renderProducts } = await bundle('src/pages/products.ts')
const { renderProductDetail } = await bundle('src/pages/product-detail.ts')
const { previewRentalCoupon } = await bundle('src/public-rental.ts')
const product = { id: 'pc', name: 'PC', model: '', specs: [], pricePerDay: 25, weeklyDiscountPercent: 10, monthlyDiscountPercent: 20, depositAmount: 300, available: true }
const config = { minimumRentalDays: 1, bufferDays: 0, unavailableDates: [], unavailableTimeSlots: {}, serviceFeeHours: [], unavailablePickupHours: [], businessHours: { start: '09:00', end: '20:00' }, serviceFeeRate: 0.1, pickupLocations: [], deliveryAreas: [], deliveryNote: '' }
const scriptOf = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('function rentalFee') || script.includes('function checkoutAmounts'))
const script = scriptOf(renderApply({ products: [product], config, selectedId: '', appUrl: '', turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false }))

function pricingSetup(t, { overrides = true } = {}) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`CREATE TABLE systemSettings (key TEXT, value TEXT);
    INSERT INTO systemSettings VALUES ('rentalRules', '{"weeklyDiscountPercent":10,"monthlyDiscountPercent":20}');
    CREATE TABLE devices (id TEXT, name TEXT, status TEXT, pricePerDay REAL, depositAmount REAL, weekly_discount_percent REAL, monthly_discount_percent REAL);
    INSERT INTO devices VALUES ('pc', 'PC', 'available', 25, 300, 0, 0);
    CREATE TABLE coupons (code TEXT, active INTEGER, starts_at TEXT, expires_at TEXT, max_uses INTEGER, used_count INTEGER, discount_type TEXT, discount_value REAL);
    INSERT INTO coupons VALUES ('TEST10', 1, NULL, NULL, NULL, 0, 'percent', 10);`)
  if (overrides) db.exec('ALTER TABLE devices ADD COLUMN weekly_discount_override REAL; ALTER TABLE devices ADD COLUMN monthly_discount_override REAL')
  const env = { RENT: { prepare(sql) {
    let values = []
    return { bind(...args) { values = args; return this }, async all() { return { results: db.prepare(sql).all(...values) } }, async first() { return db.prepare(sql).get(...values) || null }, async run() { return db.prepare(sql).run(...values) } }
  } } }
  return { db, env }
}

test('NULL device overrides inherit global discounts across product pages, checkout and coupon previews', async t => {
  const { db, env } = pricingSetup(t)
  // Stale legacy columns must not override the newer NULL inheritance setting.
  db.exec('UPDATE devices SET weekly_discount_percent = 5, monthly_discount_percent = 5')
  const [selected] = await listProducts(env)
  assert.equal(selected.weeklyDiscountPercent, 10)
  assert.equal(selected.monthlyDiscountPercent, 20)
  const rules = await getRentalConfig(env)
  assert.equal(rules.weeklyDiscountPercent, 10)
  assert.equal(rules.monthlyDiscountPercent, 20)
  const catalog = renderProducts({ products: [selected] })
  assert.match(catalog, /\$157\.5\/week/)
  assert.match(catalog, /\$600\/month/)
  const detail = renderProductDetail({ product: selected, config: rules })
  assert.match(detail, /<strong>\$157\.5<\/strong>/)
  assert.match(detail, /<strong>\$600<\/strong>/)
  for (const html of [renderCartPage([selected], rules), renderApply({ products: [selected], config: rules, selectedId: '', appUrl: '', turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false })]) {
    assert.match(html, /"weeklyDiscountPercent":10/)
    assert.match(html, /"monthlyDiscountPercent":20/)
    for (const [, code] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new Function(code)
  }
  const context = { env, req: { header() {} } }
  for (const [days, rent, discount] of [[7, 157.5, 15.75], [30, 600, 60]]) {
    const preview = await previewRentalCoupon(context, ['pc'], days, 'TEST10')
    assert.equal(preview.ok, true)
    assert.equal(preview.rent, rent)
    assert.equal(preview.discount, discount)
  }
  db.exec(`UPDATE systemSettings SET value = '{"weeklyDiscountPercent":15,"monthlyDiscountPercent":30}'`)
  assert.equal((await listProducts(env))[0].monthlyDiscountPercent, 30)
})

test('explicit device discounts, including zero, take precedence over global rules', async t => {
  const { db, env } = pricingSetup(t)
  db.exec('UPDATE devices SET weekly_discount_override = 0, monthly_discount_override = 25')
  let [selected] = await listProducts(env)
  assert.equal(rentalPriceBreakdown(selected, 7).total, 175)
  assert.equal(rentalPriceBreakdown(selected, 30).total, 562.5)
  db.exec('UPDATE devices SET weekly_discount_override = 15, monthly_discount_override = 0')
  ;[selected] = await listProducts(env)
  assert.equal(rentalPriceBreakdown(selected, 7).total, 148.75)
  assert.equal(rentalPriceBreakdown(selected, 30).total, 750)
})

test('legacy discount columns and missing or malformed settings remain supported', async t => {
  const { db, env } = pricingSetup(t, { overrides: false })
  db.exec('UPDATE devices SET weekly_discount_percent = 5, monthly_discount_percent = 0')
  let [selected] = await listProducts(env)
  assert.equal(selected.weeklyDiscountPercent, 5)
  assert.equal(selected.monthlyDiscountPercent, 0)
  db.exec('ALTER TABLE devices ADD COLUMN weekly_discount_override REAL; ALTER TABLE devices ADD COLUMN monthly_discount_override REAL')
  for (const value of ['{}', '{invalid']) {
    db.prepare('UPDATE systemSettings SET value = ?').run(value)
    ;[selected] = await listProducts(env)
    assert.equal(selected.weeklyDiscountPercent, 0)
    assert.equal(selected.monthlyDiscountPercent, 0)
  }
  db.exec('DROP TABLE systemSettings')
  assert.equal((await listProducts(env))[0].monthlyDiscountPercent, 0)
})

test('115 days uses monthly proration while 110 days uses a weekly remainder', () => {
  assert.deepEqual(rentalPriceBreakdown(product, 115), { monthlyDays: 115, weeklyDays: 0, dailyDays: 0, monthlyRate: 600, originalAmount: 2875, monthlyDiscountAmount: 575, weeklyDiscountAmount: 0, total: 2300 })
  assert.deepEqual(rentalPriceBreakdown(product, 110), { monthlyDays: 90, weeklyDays: 20, dailyDays: 0, monthlyRate: 600, originalAmount: 2750, monthlyDiscountAmount: 450, weeklyDiscountAmount: 50, total: 2250 })
  for (const [days, total] of [[5,125],[6,150],[7,157.5],[20,465],[21,472.5],[23,522.5],[24,547.5],[30,600],[31,622.5],[35,712.5],[36,735],[53,1060],[54,1080],[120,2400],[110.5,2261.25],[111,2220]]) {
    assert.equal(rentalPriceBreakdown(product, days).total, total, `${days} days`)
  }
})

test('discount rows reconcile to original rent, including fractional days and fractional cents', () => {
  for (let days = 0.5; days <= 365; days += 0.5) {
    const price = rentalPriceBreakdown({ ...product, pricePerDay: 19.99, weeklyDiscountPercent: 11.5, monthlyDiscountPercent: 27 }, days)
    assert.equal(Math.round((price.originalAmount - price.monthlyDiscountAmount - price.weeklyDiscountAmount) * 100), Math.round(price.total * 100))
  }
  const cartScript = scriptOf(renderCartPage([product], config))
  new Function(cartScript)
  new Function(script)
  const feeCode = cartScript.slice(cartScript.indexOf('  function rentalFee'), cartScript.indexOf('  function pickerDateDisabled'))
  const context = {}
  runInNewContext(feeCode, context)
  for (const days of [6,24,31,110,115,120]) assert.equal(context.rentalFee({ ...product, day: 25 }, days), rentalPriceBreakdown(product, days).total)
})

test('coupons are allocated only to eligible devices and first-month rent is charged once', () => {
  assert.deepEqual(allocateRentalDiscount([600,2250,100], [0,1], 101), [21.26,79.74,0])
  assert.deepEqual(allocateRentalDiscount([0,0], [0,1], 100), [0,0])
  assert.equal(firstRentalInstallment(2250,110,600),600)
  assert.equal(firstRentalInstallment(2300,115,600),600)
  assert.equal(firstRentalInstallment(2400,120,600,120),570)
})

function checkout(days, { payment = 'card', discount = 0, feeRate = 0, timeFee = false, language = 'zh', billing = 'FULL', extraDays = null } = {}) {
  const selected = { ...product, day: product.pricePerDay, deposit: product.depositAmount }
  const context = {
    cartIds: ['pc'], productMap: new Map([['pc',selected]]), termFor: () => ({ days }), termDays: term => term.days,
    form: { querySelector: selector => ({ value: selector.includes('billingMode') ? billing : payment }) }, method: { value: 'Pickup' }, pickupTimeSlot: { value: '09:00' }, returnTimeSlot: { value: '17:00' }, serviceFeeSlot: slot => timeFee && slot === '09:00',
    appliedDiscount: discount, appliedDeviceDiscounts: { pc: discount }, stripeFeeRate: feeRate, squareProcessingFeeRate: 0.022,
    deliveryQuoteAmount: 0, deliveryQuoteState: 'ready', squareGiftCardBalance: null, squareGiftCardVerified: false,
    accountBalance: null, summary: {}, refreshPickupTimeOptions() {}, updatePaymentMethodNote() {}, refreshBillingOptions() {},
    uiText: (zh,en) => language === 'en' ? en : zh,
  }
  if (extraDays !== null) {
    context.cartIds.push('short'); context.productMap.set('short', selected);
    context.termFor = id => ({ days: id === 'short' ? extraDays : days });
  }
  const plan = script.slice(script.indexOf('  function paymentPlanFor'), script.indexOf('  function refreshBillingOptions'));
  const row = script.slice(script.indexOf('  function summaryRow'), script.indexOf('  function refreshPickupTimeOptions'))
  const summary = script.slice(script.indexOf('  function refreshSummary'), script.indexOf('  function renderCart'))
  runInNewContext(plan + row + summary + ';refreshSummary();', context)
  return context
}

test('checkout shows original rent and exact savings, then only first-month rent plus deposit', () => {
  const result = checkout(120, { billing: 'MONTHLY' })
  assert.match(result.summary.innerHTML, /租金原价<\/span><span>\$3000\.00/)
  assert.match(result.summary.innerHTML, /月租优惠<\/span><span>−\$600\.00/)
  assert.match(result.summary.innerHTML, /首期租金<\/span><span>\$600\.00/)
  assert.match(result.summary.innerHTML, /首期应付<\/span><span>\$900\.00/)
  assert.match(result.summary.innerHTML, /每 30 天/)
  assert.equal(result.calculateRentalPayable(),900)
  const mixed = checkout(110, { billing: 'MONTHLY' })
  assert.match(mixed.summary.innerHTML, /月租优惠<\/span><span>−\$450\.00/)
  assert.match(mixed.summary.innerHTML, /周租优惠<\/span><span>−\$50\.00/)
  assert.equal(mixed.calculateRentalPayable(),900)
})

test('first payment includes coupon allocation, extras and its own payment fee', () => {
  assert.equal(checkout(120, { billing: 'MONTHLY', discount: 120, feeRate: 0.025 }).calculateRentalPayable(),891.75)
  assert.equal(checkout(120, { billing: 'MONTHLY', feeRate: 0.025, timeFee: true }).calculateRentalPayable(),1168.5)
  assert.equal(checkout(7).calculateRentalPayable(),157.5)
  assert.equal(checkout(120, { payment: 'balance' }).calculateRentalPayable(),2400)
  assert.equal(checkout(120, { payment: 'square' }).calculateRentalPayable(),2452.8)
  assert.doesNotMatch(checkout(110, { language: 'en' }).summary.innerHTML, /[\u3400-\u9fff]/)
})


test('full payment keeps deposits below 60 days and waives them from 60 days', () => {
  for (const days of [1, 7, 30, 59, 60, 120]) {
    const full = checkout(days)
    assert.equal(full.checkoutAmounts().deposit, days < 60 ? 300 : 0)
    assert.equal(full.checkoutAmounts().hasMonthly, false)
    assert.equal(full.cardAuthorizationDeposit(), days < 30 ? 300 : 0)
    assert.equal(full.calculateRentalPayable(), rentalPriceBreakdown(product, days).total)
  }
  assert.equal(checkout(120, { discount: 120, feeRate: 0.025, timeFee: true }).calculateRentalPayable(), 2583)
  const paid = checkout(60, { language: 'en' })
  assert.match(paid.summary.innerHTML, /Waived/)
  assert.doesNotMatch(paid.summary.innerHTML, /every 30 days|[\u3400-\u9fff]/)
  assert.equal(checkout(59, { billing: 'MONTHLY' }).checkoutAmounts().hasMonthly, false)
  assert.equal(checkout(59).checkoutAmounts().deposit, 300)
  assert.equal(checkout(60).checkoutAmounts().deposit, 0)
  assert.equal(checkout(60, { billing: 'MONTHLY' }).checkoutAmounts().deposit, 300)
  const mixed = checkout(120, { billing: 'MONTHLY', extraDays: 7 })
  assert.equal(mixed.checkoutAmounts().deposit, 600)
  assert.equal(mixed.cardAuthorizationDeposit(), 300)
  assert.equal(mixed.calculateRentalPayable(), 1057.5)
  const fullMixed = checkout(120, { extraDays: 45 })
  assert.equal(fullMixed.checkoutAmounts().hasMonthly, false)
  assert.equal(fullMixed.checkoutAmounts().deposit, 300)
})

test('server plans enforce the monthly boundary and never trust a client deposit amount', () => {
  for (const days of [1, 7, 29, 30, 59]) {
    assert.deepEqual(rentalPaymentPlan(days, 'MONTHLY', 'stripe', 300), { billingMode: 'FULL', deposit: 300, prepaid: false })
  }
  for (const days of [1, 7, 59, 60, 120]) {
    assert.deepEqual(rentalPaymentPlan(days, 'FULL', 'stripe', 300), { billingMode: 'FULL', deposit: days < 60 ? 300 : 0, prepaid: days >= 60 })
  }
  assert.deepEqual(rentalPaymentPlan(60, 'MONTHLY', 'stripe', 300), { billingMode: 'MONTHLY', deposit: 300, prepaid: false })
  assert.equal(rentalPaymentPlan(120, 'invalid', 'stripe', 300).billingMode, 'FULL')
  for (const provider of ['square', 'internal']) assert.equal(rentalPaymentPlan(60, 'MONTHLY', provider, 300).deposit, 0)
})


test('billing choices are hidden when only full payment is available', () => {
  const code = script.slice(script.indexOf('  function refreshBillingOptions'), script.indexOf('  function summaryRow'))
  for (const [days, payment, expectedHidden] of [[59, 'card', true], [60, 'card', false], [90, 'balance', true]]) {
    const box = {}, monthly = {}, full = { checked: false }, refund = {}, note = {}
    const context = { cartIds: ['pc'], termFor: () => ({ days }), termDays: term => term.days,
      form: { querySelector: selector => selector.includes('paymentMethod') ? { value: payment } : selector.includes('billingMode') ? full : refund },
      document: { getElementById: id => ({ 'rental-billing-options': box, 'monthly-billing-option': monthly, 'submission-payment-note': note })[id] },
      paymentPlanFor: () => rentalPaymentPlan(days, 'FULL', payment === 'card' ? 'stripe' : 'internal', 300), cardAuthorizationDeposit: () => 0, uiText: zh => zh,
    }
    runInNewContext(code + ';refreshBillingOptions();', context)
    assert.equal(box.hidden, expectedHidden)
    if (expectedHidden) assert.equal(full.checked, true)
  }
  assert.doesNotMatch(script, /不足 60 天需押金，满 60 天免押金/)
})
