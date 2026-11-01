/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function bundled(path) {
  const output = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
}
const { renderProductDetail } = await bundled('src/pages/product-detail.ts')
const { renderCartPage, renderApply } = await bundled('src/pages/apply.ts')
const product = { id:'pc', name:'PC', brand:'Test', model:'Test', description:'', category:'laptop', categoryLabel:'电脑', specs:[], available:true, bookable:true, pricePerDay:20, depositAmount:100, weeklyDiscountPercent:0, monthlyDiscountPercent:0 }
const config = { minimumRentalDays:1, bufferDays:0, unavailableDates:[], unavailableTimeSlots:{}, businessHours:{start:'09:00',end:'20:00'}, serviceFeeHours:[{start:'07:00',end:'08:00'},{start:'21:00',end:'23:00'}], unavailablePickupHours:[], unavailablePickupRanges:[], serviceFeeRate:0.1, pickupLocations:[], deliveryAreas:[], deliveryNote:'' }
const scriptOf = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1]
function harness(at, availability={}, overrides={}) {
  const elements = new Map()
  const element = id => { if (!elements.has(id)) elements.set(id,{value:'',min:'',dataset:{},error:'',setCustomValidity(message){this.error=message}});return elements.get(id) }
  class Clock extends Date { constructor(...args) { super(...(args.length?args:[at])) } }
  const context = () => ({ Date:Clock, Intl, document:{getElementById:element}, window:{} })
  const detail = context(), cart = context(), rules={...config,...overrides}
  const detailScript=scriptOf(renderProductDetail({product,config:rules}))
  const detailPrefix=detailScript.slice(0,detailScript.indexOf('  var renderPicker ='))
  const applyRules=detailScript.slice(detailScript.indexOf('  var applyDateRules ='),detailScript.indexOf('  start.min = today;'))
  runInNewContext(detailPrefix+applyRules+`availability=${JSON.stringify(availability)};availabilityReady=true;start.min=today;setDateValue(start,today);end.min=addDays(today,minimumDays);setDateValue(end,end.min);globalThis.check={preferredPeriod,isUnavailable,rangeUnavailable,pickerDateDisabled,applyDateRules};})();`,detail)
  const cartScript=scriptOf(renderCartPage([product],rules))
  runInNewContext(cartScript.slice(0,cartScript.indexOf('  function renderPicker'))+`availability=${JSON.stringify(availability)};availabilityReady=true;globalThis.check={preferredPeriod,dateUnavailable,termRangeUnavailable,defaultTerm,normalizeTerm,pickerDateDisabled};})();`,cart)
  return { detail:detail.check, cart:cart.check, elements }
}

for (const [at,period] of [['2026-10-31T23:00:00Z','AM'],['2026-11-01T01:00:00Z','PM'],['2026-11-01T04:47:00Z','PM']]) test(`today remains selectable with a future ${period} pickup at ${at}`,()=>{
  const {detail,cart,elements}=harness(at)
  assert.equal(detail.preferredPeriod('2026-11-01'),period)
  assert.equal(detail.isUnavailable('2026-11-01'),false)
  assert.equal(detail.pickerDateDisabled('start','2026-11-01'),false)
  detail.applyDateRules(true)
  assert.equal(elements.get('detail-start-date').value,'01/11/2026')
  assert.equal(elements.get('detail-end-date').value,'02/11/2026')
  assert.equal(elements.get('detail-start-date').error,'')
  assert.equal(elements.get('detail-end-date').error,'')
  assert.equal(cart.dateUnavailable('pc','2026-11-01'),false)
  const term=JSON.parse(JSON.stringify(cart.defaultTerm('pc')))
  assert.equal(term.startDate,'2026-11-01')
  assert.equal(term.startPeriod,period)
  assert.equal(cart.termRangeUnavailable('pc',term.startDate,term.endDate,term.startPeriod,term.endPeriod),false)
})

test('an occupied morning does not block an available afternoon, including cart handoff',()=>{
  const {detail,cart}=harness('2026-11-01T04:47:00Z',{pc:{unavailablePeriods:{'2026-11-01':['AM']}}})
  assert.equal(detail.preferredPeriod('2026-11-01'),'PM')
  assert.equal(detail.rangeUnavailable('2026-11-01','2026-11-02'),false)
  const term=cart.normalizeTerm('pc',{startDate:'2026-11-01',endDate:'2026-11-02',startPeriod:'AM',endPeriod:'AM'})
  assert.equal(term.startPeriod,'PM')
  assert.equal(cart.termRangeUnavailable('pc',term.startDate,term.endDate,term.startPeriod,term.endPeriod),false)
})

for (const overrides of [{}, {unavailablePickupRanges:[{start:'2026-11-01T13:00',end:'2026-11-01T23:00'}]}]) test(`today is disabled once no future pickup time remains (${Object.keys(overrides).length?'closed':'after last slot'})`,()=>{
  const {detail,cart,elements}=harness(Object.keys(overrides).length?'2026-11-01T04:47:00Z':'2026-11-01T11:45:00Z',{},overrides)
  assert.equal(detail.isUnavailable('2026-11-01'),true)
  assert.equal(cart.dateUnavailable('pc','2026-11-01'),true)
  detail.applyDateRules(true)
  assert.equal(elements.get('detail-start-date').value,'02/11/2026')
  assert.equal(elements.get('detail-end-date').value,'03/11/2026')
  assert.equal(elements.get('detail-end-date').error,'')
})

test('checkout filters past exact pickup times while keeping future afternoon times',()=>{
  const script=scriptOf(renderApply({products:[product],config,selectedId:'',appUrl:'',turnstileSiteKey:'',squareGiftCardConfig:null,deliveryQuoteEnabled:false}))
  const functionCode=script.slice(script.indexOf('  function slotUnavailable'),script.indexOf('  function periodUnavailable',script.indexOf('  function slotUnavailable')))
  const context={DEVICE_AVAILABILITY:{},UNAVAILABLE_TIME_SLOTS:{},today:'2026-11-01',melbourneMinutes:()=>947,timeToMinutes:value=>/^\d{2}:\d{2}$/.test(value)?Number(value.slice(0,2))*60+Number(value.slice(3)):-1,periodPassed:(date,period)=>date==='2026-11-01'&&period==='AM',slotInfo:value=>({value,period:value<'13:00'?'AM':'PM'}),pickupAvailability:{timeUnavailable:()=>false}}
  runInNewContext(functionCode,context)
  assert.equal(context.slotUnavailable('pc','2026-11-01','09:00'),true)
  assert.equal(context.slotUnavailable('pc','2026-11-01','15:30'),true)
  assert.equal(Boolean(context.slotUnavailable('pc','2026-11-01','16:00')),false)
  assert.equal(Boolean(context.slotUnavailable('pc','2026-11-02','09:00')),false)
})
