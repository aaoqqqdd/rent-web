import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function bundle(path) {
  const result = buildSync({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { listOrdersForUser, lookupOrderByCredentials } = await bundle('src/orders.ts')
const { renderOrderLookup } = await bundle('src/pages/content.ts')
const dashboard = 'https://dashboard.geekslope.de5.net'
function environment(rows) {
  const queries = []
  const env = { RENT: { prepare(sql) {
    let values = []
    const statement = {
      bind(...args) { values = args; queries.push({ sql, values }); return statement },
      async all() { return { results: sql.startsWith('SELECT o.*') ? rows : [] } },
      async first() { return rows[0] || null },
      async run() { throw new Error('Refund entry must not write to the database') },
    }
    return statement
  } } }
  return { env, queries }
}
const row = (status, extra = {}) => ({ id: 'order/' + status, orderNo: 'OD-' + status, status, userId: 'owner', email: 'owner@example.test', device_name: 'Laptop', totalAmount: 100, depositAmount: 20, ...extra })

test('each open uncollected order gets a dashboard refund entry, regardless of payment state', async () => {
  const statuses = ['draft', 'pending_approval', 'approved', 'awaiting_signature', 'pending_payment', 'paid', 'pending_pickup']
  const { env, queries } = environment(statuses.map(status => row(status)))
  const orders = await listOrdersForUser(env, 'owner', dashboard)
  assert.equal(orders.length, statuses.length)
  for (const order of orders) assert.equal(order.refundUrl, `${dashboard}/customer/orders/${encodeURIComponent(order.id)}/refund-request`)
  assert.deepEqual(queries[0].values, ['owner'])
  const html = renderOrderLookup(dashboard, orders)
  assert.equal((html.match(/class="btn btn-ghost order-refund-action"/g) || []).length, statuses.length)
})

test('handover timestamps, rental and ended statuses suppress the entry', async () => {
  const rows = ['active', 'extended', 'overdue', 'suspended', 'pending_return', 'returned', 'completed', 'cancelled', 'refund_pending'].map(status => row(status))
  rows.push(row('paid', { handover_completed_at: '2026-11-01 12:00:00' }), row('pending_pickup', { handoverCompletedAt: '2026-11-01' }), row('paid', { deleted_at: '2026-11-01' }))
  const { env } = environment(rows)
  const orders = await listOrdersForUser(env, 'owner', dashboard)
  assert.ok(orders.every(order => !order.refundUrl))
  const html = renderOrderLookup(dashboard, orders)
  assert.doesNotMatch(html, /class="btn btn-ghost order-refund-action"/)
})

class Element {
  constructor(tag) { this.tagName = tag; this.children = [] }
  append(...children) { this.children.push(...children) }
  appendChild(child) { this.children.push(child) }
  all() { return [this, ...this.children.flatMap(child => child.all())] }
}

test('public lookup and dynamically rendered order info use the same login-protected refund destination', async () => {
  const { env, queries } = environment([row('paid', { id: 'order-1', account_type: 'formal' })])
  const result = await lookupOrderByCredentials(env, 'od-paid', 'OWNER@example.test', dashboard)
  assert.deepEqual(queries[0].values, ['OD-PAID', 'owner@example.test'])
  assert.equal(result.order.refundUrl, `${dashboard}/customer/orders/order-1/refund-request`)
  const html = renderOrderLookup(dashboard)
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('function renderOrder'))
  assert.doesNotThrow(() => new Function(script))
  const rendering = script.slice(script.indexOf('  function formatDate'), script.indexOf('  form.addEventListener'))
  const context = { document: { createElement: tag => new Element(tag) } }
  runInNewContext(rendering, context)
  const refundLinks = context.renderOrder(result.order).all().filter(node => node.className === 'btn btn-ghost order-refund-action')
  assert.equal(refundLinks.length, 1)
  assert.equal(refundLinks[0].href, result.order.refundUrl)
  assert.equal(refundLinks[0].textContent, '申请退款')
  assert.equal(context.renderOrder({ ...result.order, refundUrl: undefined }).all().filter(node => node.className === 'btn btn-ghost order-refund-action').length, 0)
})
