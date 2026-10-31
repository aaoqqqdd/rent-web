// Check the rendered checkout script, including template-string regex escaping.
// Usage: node scripts/verify-wallet-contact.mjs
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [new URL('../src/pages/apply.ts', import.meta.url).pathname],
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { renderApply } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const html = renderApply({
  products: [{ id: 'test-device', name: 'Test device', pricePerDay: 10 }],
  selectedId: 'test-device', appUrl: 'https://dashboard.geekslope.de5.net',
  turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false,
  config: {
    pickupLocations: [], minimumRentalDays: 1, serviceFeeRate: 0,
    businessHours: { start: '09:00', end: '17:00' }, serviceFeeHours: [],
    unavailableDates: [], unavailableTimeSlots: [], unavailablePickupHours: [],
  },
})
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs]) => !attrs.includes('src=') && !attrs.includes('application/ld+json'))
  .map(([, , script]) => script)
assert.ok(scripts.length > 0)
scripts.forEach((script) => new Function(script))
const checkout = scripts.find((script) => script.includes('function applyWalletContact('))
assert.ok(checkout, 'Checkout script must be rendered')
const names = checkout.match(/  function splitContactName\(value\) \{[\s\S]*?(?=  function todayStr\()/)?.[0]
const wallet = checkout.match(/      function applyWalletContact\(event\) \{[\s\S]*?(?=      walletElement\.on\('confirm')/)?.[0]
assert.ok(names && wallet, 'Contact functions must exist in the rendered script')
const first = { value: '' }
const last = { value: '' }
const apply = new Function('contactFirstName', 'contactLastName', 'document', 'method',
  `${names}\n${wallet}\nreturn applyWalletContact;`)(first, last, {}, { value: 'Pickup' })

for (const [name, firstName, lastName] of [
  ['John Smith', 'John', 'Smith'],
  ['James Wilson', 'James', 'Wilson'],
  ['  Mary   Jane Watson  ', 'Mary Jane', 'Watson'],
  ['John\tSmith', 'John', 'Smith'],
  ['John\u00a0Smith', 'John', 'Smith'],
  ['张三', '三', '张'],
  ['Sam', 'Sam', ''],
]) {
  for (const source of ['billingDetails', 'shippingAddress']) {
    first.value = 'previous first'; last.value = 'previous last'
    apply({ [source]: { name } })
    assert.equal(first.value, firstName, `${source} ${name}: given name`)
    assert.equal(last.value, lastName, `${source} ${name}: family name`)
  }
}
console.log('PASS: rendered script syntax and wallet name autofill (billing/shipping, whitespace, Chinese, single name)')
