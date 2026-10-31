import test from 'node:test'
import assert from 'node:assert/strict'
import { pbkdf2Sync } from 'node:crypto'
import { buildSync } from 'esbuild'

const output = buildSync({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', minify: true })
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const origin = 'https://geekslope.de5.net'
const password = 'Login-regression-7!'
const salt = '0123456789abcdef0123456789abcdef'
const hash = `pbkdf2$100000$${salt}$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`

function environment(overrides = {}) {
  const sessions = []
  const user = { id: 'test-user', name: 'Test User', email: 'login@example.test', phone: '0400000000', role: 'CUSTOMER', status: 'active', account_type: 'formal', password_hash: hash, password_salt: null, ...overrides }
  const env = { APP_URL: 'https://dashboard.geekslope.de5.net', RENT: {
    prepare(sql) {
      return {
        values: [],
        bind(...values) { this.values = values; return this },
        async first() {
          if (sql.includes('FROM users WHERE lower(email)')) {
            return this.values[0].toLowerCase() === user.email || this.values[1] === user.phone ? user : null
          }
          return null
        },
        async run() {
          if (sql.includes('INSERT INTO auth_sessions')) sessions.push(this.values)
          return { success: true }
        },
      }
    },
    async batch() { return [] },
  } }
  return { env, sessions }
}

function login(env, enteredPassword, account = 'login@example.test') {
  return worker.fetch(new Request(`${origin}/login`, {
    method: 'POST', headers: { Origin: origin },
    body: new URLSearchParams({ account, password: enteredPassword }),
  }), env)
}

test('website login accepts the same password with surrounding whitespace as dashboard', async () => {
  for (const enteredPassword of [password, ` ${password} `, `\t${password}\r\n`, `\u00a0${password}\u3000`]) {
    const { env, sessions } = environment()
    const response = await login(env, enteredPassword)
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), '/sso/start')
    assert.match(response.headers.get('set-cookie'), /^session=[A-Za-z0-9_-]+;.*HttpOnly;.*Secure/)
    assert.equal(sessions.length, 1)
    assert.equal(sessions[0][1], 'test-user')
  }
})

test('email and phone login both retain dashboard password normalization', async () => {
  for (const account of [' LOGIN@EXAMPLE.TEST ', '0400000000']) {
    const { env } = environment()
    assert.equal((await login(env, ` ${password} `, account)).status, 302)
  }
})

test('wrong passwords and internal whitespace never create a session', async () => {
  for (const enteredPassword of ['Wrong-password-7!', 'Login- regression-7!']) {
    const { env, sessions } = environment()
    const response = await login(env, enteredPassword)
    assert.equal(response.status, 401)
    assert.match(await response.text(), /账号或密码错误/)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(sessions.length, 0)
  }
})

test('inactive and guest accounts remain blocked even with the correct password', async () => {
  for (const overrides of [{ status: 'inactive' }, { account_type: 'guest' }, { account_type: 'deleted_guest' }]) {
    const { env, sessions } = environment(overrides)
    assert.equal((await login(env, password)).status, 401)
    assert.equal(sessions.length, 0)
  }
})

test('whitespace-only passwords are rejected as empty', async () => {
  const { env, sessions } = environment()
  const response = await login(env, ' \t\r\n ')
  assert.equal(response.status, 400)
  assert.match(await response.text(), /请输入账号和密码/)
  assert.equal(sessions.length, 0)
})
