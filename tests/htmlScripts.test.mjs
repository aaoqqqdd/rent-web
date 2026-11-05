import test from 'node:test'
import assert from 'node:assert/strict'
import { htmlScripts } from '../scripts/lib/html-scripts.mjs'

test('script extraction handles mixed case, quoted angles and malformed closing tags', () => {
  const markup = '<SCRIPT data-note=">">const literal = "&lt;script&gt;";</ScRiPt ignored="yes">'
  const html = `<p>before</p>${markup}<p>after</p>`
  const [script] = htmlScripts(html)
  assert.equal(script.code, 'const literal = "&lt;script&gt;";')
  assert.equal(script.attributes['data-note'], '>')
  assert.equal(html.slice(script.startIndex, script.endIndex), markup)
  assert.equal(html.slice(0, script.startIndex) + html.slice(script.endIndex), '<p>before</p><p>after</p>')
})

test('script extraction ignores comments and distinguishes external scripts and JSON-LD', () => {
  const scripts = htmlScripts(`<!-- <script>not code</script> --!>
    <script SRC="/external.js"></script >
    <script TYPE="application/ld+json">{"name":"Test"}</script>
    <script>const last = 1;</script>`)
  assert.equal(scripts.length, 3)
  assert.equal(scripts[0].attributes.src, '/external.js')
  assert.equal(scripts[1].attributes.type, 'application/ld+json')
  assert.deepEqual(JSON.parse(scripts[1].code), { name: 'Test' })
  assert.equal(scripts[2].code, 'const last = 1;')
})

test('script extraction preserves scripts that run to the end of a template chunk', () => {
  const html = '<p>before</p><script>if (value > 0) { value++ }'
  const [script] = htmlScripts(html)
  assert.equal(script.code, 'if (value > 0) { value++ }')
  assert.equal(script.endIndex, html.length)
})
