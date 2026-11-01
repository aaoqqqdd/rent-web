import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { runInNewContext } from 'node:vm'

const output = buildSync({ entryPoints: ['src/pickup-availability.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true, keepNames: true })
const { readPickupClosures, createPickupAvailability } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const config = { businessHours: { start: '09:00', end: '20:00' }, serviceFeeHours: [{ start: '07:00', end: '08:00' }, { start: '21:00', end: '23:00' }], unavailablePickupHours: [], unavailablePickupRanges: [{ start: '2090-01-04T19:00', end: '2090-01-06T09:30' }] }

test('shared D1 closures retain valid ranges up to one calendar year', () => {
  assert.deepEqual(readPickupClosures([{ start: '2028-02-29T09:00', end: '2029-02-28T09:00' }]), [{ start: '2028-02-29T09:00', end: '2029-02-28T09:00' }])
  for (const range of [{ start: '2027-02-29T09:00', end: '2027-03-01T09:00' }, { start: '2027-01-01T09:00', end: '2028-01-01T09:30' }, { start: '2027-01-01T09:15', end: '2027-01-02T09:00' }]) assert.deepEqual(readPickupClosures([range]), [])
  assert.deepEqual(readPickupClosures(undefined), [])
})

test('bundled availability is self-contained and enforces closures, weekly hours and exact end boundaries', () => {
  const availability = runInNewContext(`(${createPickupAvailability.toString()})(${JSON.stringify(config)})`)
  assert.equal(availability.timeUnavailable('2090-01-04', '18:30'), false)
  assert.equal(availability.timeUnavailable('2090-01-04', '19:00'), true)
  assert.equal(availability.timeUnavailable('2090-01-04', '21:30'), true)
  assert.equal(availability.dateUnavailable('2090-01-05'), true)
  assert.equal(availability.timeUnavailable('2090-01-05', 'morning'), true)
  assert.equal(availability.timeUnavailable('2090-01-06', '09:00'), true)
  assert.equal(availability.timeUnavailable('2090-01-06', '09:30'), false)
  assert.equal(availability.periodUnavailable('2090-01-06', 'AM'), false)
  assert.equal(availability.timeUnavailable('2090-01-06', '09:30', ['morning']), true)
  const weekday = new Date('2090-01-03T00:00:00Z').getUTCDay()
  const weekly = createPickupAvailability({ ...config, unavailablePickupHours: [{ weekday, start: '10:00', end: '11:00' }] })
  assert.equal(weekly.timeUnavailable('2090-01-03', '10:00'), true)
  assert.equal(weekly.timeUnavailable('2090-01-03', '11:00'), false)
})


test('checkout switches an unavailable default to open business hours instead of adding a service fee', async () => {
  const result = buildSync({ entryPoints: ['src/pages/apply.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  const { renderApply } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
  const product = { id: 'pc', name: 'PC', model: '', specs: [], pricePerDay: 20, depositAmount: 100, available: true }
  const html = renderApply({ products: [product], config: { ...config, minimumRentalDays: 1, bufferDays: 0, unavailableDates: [], unavailableTimeSlots: {}, serviceFeeRate: 0.1, pickupLocations: [], deliveryAreas: [], deliveryNote: '' }, selectedId: '', appUrl: '', turnstileSiteKey: '', squareGiftCardConfig: null, deliveryQuoteEnabled: false })
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1]
  const code = script.slice(script.indexOf('  function refreshPickupTimeOptions'), script.indexOf('  function refreshSummary'))
  const pickup = { value: '09:00', options: ['07:00', '09:00', '10:00'].map(value => ({ value })), parentElement: { querySelector() { return null } } }
  const returned = { value: '10:00', options: [{ value: '10:00' }], parentElement: { querySelector() { return null } } }
  const context = { pickupTimeSlot: pickup, returnTimeSlot: returned, method: { value: 'Pickup' }, cartIds: ['pc'], termFor: () => ({ startDate: '2090-01-01', endDate: '2090-01-02' }), slotUnavailable: (_id, _date, slot) => slot === '09:00', serviceFeeSlot: slot => slot === '07:00', deviceTermsInput: {} }
  runInNewContext(code + ';refreshPickupTimeOptions();', context)
  assert.equal(pickup.value, '10:00')
  assert.equal(pickup.options.find(option => option.value === '09:00').hidden, true)
})
