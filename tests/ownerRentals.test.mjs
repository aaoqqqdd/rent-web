/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { htmlScripts } from '../scripts/lib/html-scripts.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'

async function bundle(path){const result=buildSync({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'browser'});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))}
const {listProducts}=await bundle('src/db.ts')
const {ownerRentals,ownerRentalRevision}=await bundle('src/ownerRentals.ts')
const {renderProducts}=await bundle('src/pages/products.ts')
const {renderProductDetail}=await bundle('src/pages/product-detail.ts')
const {handleRentalRequest}=await bundle('src/public-rental.ts')

function setup(t){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close())
  db.exec(`CREATE TABLE systemSettings (key TEXT,value TEXT,deleted_at TEXT);
    CREATE TABLE users (id TEXT,status TEXT,deleted_at TEXT);
    CREATE TABLE devices (id TEXT,name TEXT,model TEXT,pricePerDay REAL,depositAmount REAL,status TEXT,lifecycle_status TEXT,deleted_at TEXT);
    CREATE TABLE c2c_listings (device_id TEXT,owner_id TEXT,status TEXT,listing_mode TEXT,pickup_address TEXT,pickup_address_json TEXT,public_city TEXT,photos_json TEXT,custody_received_at TEXT);
    CREATE TABLE c2c_memberships (user_id TEXT,mode TEXT);
    CREATE TABLE c2c_settings (managed_commission_bps INTEGER);
    CREATE TABLE c2c_photos (id TEXT,owner_id TEXT,slot TEXT,url TEXT);
    INSERT INTO users VALUES ('owner','active',NULL);
    INSERT INTO c2c_memberships VALUES ('owner','self');INSERT INTO c2c_settings VALUES (1500);
    INSERT INTO devices VALUES ('platform','Platform PC','M3',20,100,'available','READY',NULL),('d-c2c-owned','Owner PC','M4',25,200,'available','READY',NULL);
    INSERT INTO c2c_listings VALUES ('d-c2c-owned','owner','approved','self','Level 1\n123 Test Street\nCarlton VIC 3053','{}','墨尔本','{}',NULL);`)
  const photos={}
  for(const [i,slot] of ['a','b','c','d','power'].entries()){
    const id='c2cp-'+String(i).padStart(16,'0'),url=`https://res.cloudinary.com/demo/image/upload/test-${slot}.jpg`
    photos[slot]={id,url};db.prepare('INSERT INTO c2c_photos VALUES (?,?,?,?)').run(id,'owner',slot,url)
  }
  db.prepare('UPDATE c2c_listings SET photos_json=?').run(JSON.stringify(photos))
  const env={RENT:{prepare(sql){let values=[];const statement={bind(...args){values=args;return statement},async all(){return {results:db.prepare(sql).all(...values)}},async first(){return db.prepare(sql).get(...values)||null},async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}}}};return statement}}}
  return {db,env,photos}
}

test('catalogue shows reviewed owner devices with verified Cloudinary photos and fulfilment mode',async t=>{
  const {db,env,photos}=setup(t)
  let products=await listProducts(env)
  assert.equal(products.length,2)
  const owner=products.find(product=>product.id==='d-c2c-owned')
  assert.equal(owner.ownerRental.mode,'self');assert.equal(owner.ownerRental.photos.length,5)
  assert.match(renderProducts({products}),/个人设备 · 自行交付/)
  assert.match(renderProducts({products}),/https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/test-a\.jpg/)
  const originalRevision=await ownerRentalRevision(env)
  for(const status of ['pending','rejected','paused']){
    db.prepare('UPDATE c2c_listings SET status=?').run(status)
    assert.deepEqual((await listProducts(env)).map(product=>product.id),['platform'],status)
    assert.notEqual(await ownerRentalRevision(env),originalRevision,'cached public catalogue cannot revive a withdrawn listing')
  }
  db.exec("UPDATE c2c_listings SET status='approved';UPDATE users SET status='inactive'")
  assert.equal((await listProducts(env)).length,1)
  db.exec("UPDATE users SET status='active';UPDATE c2c_listings SET listing_mode='managed'")
  assert.equal((await listProducts(env)).length,1,'mode mismatch is hidden')
  db.exec("UPDATE c2c_memberships SET mode='managed'")
  assert.equal((await listProducts(env)).length,1,'custody receipt is required')
  db.exec("UPDATE c2c_listings SET custody_received_at=CURRENT_TIMESTAMP")
  products=await listProducts(env);assert.equal(products.length,2)
  assert.match(renderProducts({products}),/个人设备 · 平台托管/)
  db.exec('UPDATE c2c_settings SET managed_commission_bps=NULL')
  assert.equal((await listProducts(env)).length,1,'managed fee must be configured')
  db.exec('UPDATE c2c_settings SET managed_commission_bps=1500')
  db.prepare("UPDATE c2c_photos SET owner_id='other' WHERE slot='power'").run()
  assert.equal((await listProducts(env)).length,1,'all photos must belong to this owner')
  db.prepare("UPDATE c2c_photos SET owner_id='owner' WHERE slot='power'").run()
  photos.a.url='javascript:alert(1)';db.prepare('UPDATE c2c_listings SET photos_json=?').run(JSON.stringify(photos))
  assert.equal((await listProducts(env)).length,1,'unsafe photos cannot become public')
})

test('owner preview shows gallery and city only; full pickup address stays in console checkout',async t=>{
  const {env}=setup(t);const product=(await listProducts(env)).find(product=>product.ownerRental)
  assert.equal('pickupAddress' in product.ownerRental,false)
  assert.equal(product.ownerRental.city,'墨尔本')
  const config={pickupLocations:[],deliveryAreas:[],deliveryNote:'',minimumRentalDays:1,unavailableDates:[],unavailableTimeSlots:{}}
  const html=renderProductDetail({product,config,appUrl:'https://console.example.test'})
  assert.match(html,/href="https:\/\/console.example.test\/customer\/rent\/d-c2c-owned"/)
  assert.match(html,/屏幕开机画面/);assert.match(html,/墨尔本/);assert.doesNotMatch(html,/123 Test Street|Carlton VIC 3053/)
  assert.doesNotMatch(html,/id="detail-add-cart"/)
  for(const { code } of htmlScripts(html)) assert.doesNotThrow(()=>new Function(code))
  const response=await handleRentalRequest({env,req:{header(){return ''}},json(body,status){return Response.json(body,{status})}},{deviceIds:['d-c2c-owned']})
  assert.equal(response.status,409)
  assert.match((await response.json()).redirectUrl,/\/customer\/rent\/d-c2c-owned$/)
  assert.equal((await ownerRentals(env)).size,1)
})
