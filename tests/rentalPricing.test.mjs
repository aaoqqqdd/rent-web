import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function bundle(path) {
  const result = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true, keepNames: true })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { rentalPriceBreakdown, firstRentalInstallment, allocateRentalDiscount, rentalPaymentPlan } = await bundle('src/rental-pricing.ts')
const { renderApply, renderCartPage } = await bundle('src/pages/apply.ts')
const product = { id: 'pc', name: 'PC', model: '', specs: [], pricePerDay: 25, weeklyDiscountPercent: 10, monthlyDiscountPercent: 20, depositAmount: 300, available: true }
const config = { minimumRentalDays: 1, bufferDays: 0, unavailableDates: [], unavailableTimeSlots: {}, serviceFeeHours: [], unavailablePickupHours: [], businessHours: { start: '09:00', end: '20:00' }, serviceFeeRate: 0.1, pickupLocations: [], deliveryAreas: [], deliveryNote: '' }
const scriptOf = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('function rentalFee') || script.includes('function checkoutAmounts'))
const script = scriptOf(renderApply({ products: [product], config, selectedId: '', appUrl: '', turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false }))

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

function checkout(days, { payment = 'card', discount = 0, feeRate = 0, timeFee = false, language = 'zh', billing = 'MONTHLY', extraDays = null } = {}) {
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
  const result = checkout(120)
  assert.match(result.summary.innerHTML, /租金原价<\/span><span>\$3000\.00/)
  assert.match(result.summary.innerHTML, /月租优惠<\/span><span>−\$600\.00/)
  assert.match(result.summary.innerHTML, /首期租金<\/span><span>\$600\.00/)
  assert.match(result.summary.innerHTML, /首期应付<\/span><span>\$900\.00/)
  assert.match(result.summary.innerHTML, /每 30 天/)
  assert.equal(result.calculateRentalPayable(),900)
  const mixed = checkout(110)
  assert.match(mixed.summary.innerHTML, /月租优惠<\/span><span>−\$450\.00/)
  assert.match(mixed.summary.innerHTML, /周租优惠<\/span><span>−\$50\.00/)
  assert.equal(mixed.calculateRentalPayable(),900)
})

test('first payment includes coupon allocation, extras and its own payment fee', () => {
  assert.equal(checkout(120, { discount: 120, feeRate: 0.025 }).calculateRentalPayable(),891.75)
  assert.equal(checkout(120, { feeRate: 0.025, timeFee: true }).calculateRentalPayable(),1168.5)
  assert.equal(checkout(7).calculateRentalPayable(),157.5)
  assert.equal(checkout(120, { payment: 'balance' }).calculateRentalPayable(),2400)
  assert.equal(checkout(120, { payment: 'square' }).calculateRentalPayable(),2452.8)
  assert.doesNotMatch(checkout(110, { language: 'en' }).summary.innerHTML, /[\u3400-\u9fff]/)
})


test('full payment waives only eligible deposits and charges all discounted rent plus fees', () => {
  assert.equal(checkout(60, { billing: 'FULL' }).calculateRentalPayable(), 1200)
  assert.equal(checkout(120, { billing: 'FULL', discount: 120, feeRate: 0.025, timeFee: true }).calculateRentalPayable(), 2583)
  const paid = checkout(120, { billing: 'FULL', language: 'en' })
  assert.equal(paid.checkoutAmounts().deposit, 0)
  assert.match(paid.summary.innerHTML, /Waived/)
  assert.doesNotMatch(paid.summary.innerHTML, /every 30 days|[\u3400-\u9fff]/)
  assert.equal(checkout(59, { billing: 'FULL' }).calculateRentalPayable(), 900)
  assert.equal(checkout(59, { billing: 'FULL' }).checkoutAmounts().deposit, 300)
  const mixed = checkout(120, { billing: 'FULL', extraDays: 7 })
  assert.equal(mixed.checkoutAmounts().deposit, 300)
  assert.equal(mixed.cardAuthorizationDeposit(), 300)
  assert.equal(mixed.calculateRentalPayable(), 2557.5)
  const monthlyMixed = checkout(120, { billing: 'FULL', extraDays: 45 })
  assert.equal(monthlyMixed.checkoutAmounts().hasMonthly, true)
  assert.equal(monthlyMixed.checkoutAmounts().deposit, 300)
})

test('server payment plans ignore tampered deposit and invalid billing choices', () => {
  for (const days of [0, 7, 29, 30, 59]) assert.equal(rentalPaymentPlan(days, 'FULL', 'stripe', 300).deposit, 300)
  assert.deepEqual(rentalPaymentPlan(60, 'FULL', 'stripe', 300), { billingMode: 'FULL', deposit: 0, prepaid: true })
  assert.deepEqual(rentalPaymentPlan(120, 'MONTHLY', 'stripe', 300), { billingMode: 'MONTHLY', deposit: 300, prepaid: false })
  assert.equal(rentalPaymentPlan(120, 'invalid', 'stripe', 300).billingMode, 'MONTHLY')
  for (const provider of ['square', 'internal']) assert.equal(rentalPaymentPlan(60, 'MONTHLY', provider, 300).deposit, 0)
})
