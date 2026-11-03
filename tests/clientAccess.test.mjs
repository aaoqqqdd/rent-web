/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { buildSync } from 'esbuild'
import { Hono } from 'hono'

async function bundle(path) {
  const result = buildSync({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'browser'})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const {clientAccessMiddleware} = await bundle('src/clientAccessMiddleware.ts')
const {registerCustomer} = await bundle('src/auth.ts')
const {normalizeClientAccess,clientFeatureForPath,clientMaintenanceHtml} = await bundle('src/clientAccess.ts')

test('website closure precedes cached handlers and authenticates administrator bypass',async t=>{
  const sqlite = new DatabaseSync(':memory:');t.after(()=>sqlite.close())
  sqlite.exec(`CREATE TABLE systemSettings (key TEXT PRIMARY KEY,value TEXT,deleted_at TEXT);
    CREATE TABLE users (id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,status TEXT,account_type TEXT);
    CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
    INSERT INTO users VALUES ('admin','Admin','admin@example.test','ADMIN','active','formal'),('staff','Staff','staff@example.test','STAFF','active','formal')`)
  const db = {prepare(sql) {
    let values=[]
    const statement = {bind(...args){values=args;return statement},async first(){return sqlite.prepare(sql).get(...values)||null},async run(){return sqlite.prepare(sql).run(...values)}}
    return statement
  },async batch(statements){return Promise.all(statements.map(statement=>statement.run()))}}
  const cookies={}
  for(const id of ['admin','staff']) {
    const token=id.padEnd(40,'x');cookies[id]=`session=${token}`
    sqlite.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,'2099-01-01 00:00:00')
  }
  let handlerHits=0
  const app = new Hono()
  app.use('*',clientAccessMiddleware)
  app.all('*',c=>{handlerHits++;return c.json({ok:true})})
  const req=(path,actor='',method='GET')=>app.request(`https://web.example.test${path}`,{method,headers:{Cookie:cookies[actor]||''}},{RENT:db})
  const save=policy=>sqlite.prepare('INSERT INTO systemSettings VALUES (?,?,NULL) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('clientAccess',JSON.stringify(policy))
  assert.equal((await req('/products')).status,200)
  const policy=normalizeClientAccess({web:{enabled:false,message:'Closed <script>alert(1)</script>'}})
  save(policy)
  const before=handlerHits
  const response=await req('/products')
  assert.equal(response.status,503)
  assert.equal(handlerHits,before,'cached page handlers are never consulted during closure')
  assert.match(response.headers.get('cache-control'),/no-store/)
  assert.match(await response.text(),/&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.equal((await req('/products','staff')).status,503)
  assert.equal((await req('/products','admin')).status,200)
  for(const path of ['/api/rental-request','/api/rental-setup-intent','/register']) assert.equal((await req(path,'','POST')).status,503,path)
  for(const path of ['/login','/logout','/sso/start','/api/session','/healthz','/api/delivery/webhooks/zoom2u']) assert.equal((await req(path)).status,200,path)
  policy.web.enabled=true;policy.features.referralProgram=false;policy.features.giftCards=false;policy.features.newRentals=false
  save(policy)
  for(const path of ['/referral','/gift-cards','/products/x','/apply','/checkout','/api/rental-request','/api/device-availability']) assert.equal((await req(path)).status,503,path)
  policy.features.newRentals=true;save(policy)
  assert.equal((await req('/products')).status,200,'reopening takes effect without waiting for a cache TTL')
  policy.features.registration=false;save(policy)
  const registration=await registerCustomer({env:{RENT:db}}, {}, '127.0.0.1')
  assert.equal(registration.ok,false,'checkout auto-registration uses the same switch')
  assert.match(registration.message,/暂未开放/)
  sqlite.prepare("UPDATE systemSettings SET value='{' WHERE key='clientAccess'").run()
  assert.equal((await req('/products')).status,503,'broken policy cannot expose public pages')
  assert.equal((await req('/login')).status,200,'administrator login remains reachable')
})

test('public policy defaults and maintenance scripts',()=>{
  assert.equal(normalizeClientAccess(null).web.enabled,true)
  assert.equal(clientFeatureForPath('/api/square-gift-card-preview','web'),'giftCards')
  for(const custom of ['', '</script><script>alert(1)</script>']) {
    const html=clientMaintenanceHtml(custom)
    for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(()=>new Function(script[1]))
    assert.doesNotMatch(html,/<script>alert\(1\)/)
  }
})
