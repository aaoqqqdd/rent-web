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
