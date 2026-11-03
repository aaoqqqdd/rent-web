/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
const result = buildSync({ entryPoints: ['src/risk-rules.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })
const { calculateCustomerRiskAssessment, calculateReferralRiskAssessment, riskAdjustedDeposit, riskDepositSnapshot } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))

const NOW = new Date('2026-09-07T00:00:00Z')

test('risk score is calculated from historical behaviour', () => {
  const result = calculateCustomerRiskAssessment({
    failedPaymentCount: 2,
    overdueOrderCount: 1,
    customerDamageCaseCount: 1,
  }, NOW)
  assert.equal(result.score, 50)
  assert.equal(result.level, 'MEDIUM')
  assert.equal(result.blocked, false)
})

test('high risk uses increased deposit without overriding hard flags', () => {
  const result = calculateCustomerRiskAssessment({ balance: -1, failedPaymentCount: 3 }, NOW)
  assert.equal(result.score, 60)
  assert.equal(result.level, 'HIGH')
  assert.equal(result.blocked, false)
})

test('high and hard-block risk flags block regardless of score', () => {
  assert.equal(calculateCustomerRiskAssessment({ activeFlags: [{ flag_type: 'MANUAL_REVIEW', severity: 'HIGH', status: 'ACTIVE' }] }, NOW).blocked, true)
  assert.equal(calculateCustomerRiskAssessment({ activeFlags: [{ flag_type: 'CHARGEBACK', severity: 'LOW', status: 'ACTIVE' }] }, NOW).blocked, true)
})

test('expired timestamps do not clear active flags; only resolution does', () => {
  const result = calculateCustomerRiskAssessment({
    activeFlags: [
      { flag_type: 'CHARGEBACK', severity: 'HIGH', status: 'ACTIVE', expires_at: '2026-01-01 00:00:00' },
      { flag_type: 'FRAUD_SUSPECTED', severity: 'HIGH', status: 'RESOLVED', expires_at: null },
    ],
  }, NOW)
  assert.equal(result.score, 40)
  assert.equal(result.blocked, true)
})

test('high referral risk goes to manual review', () => {
  const result = calculateReferralRiskAssessment({
    customerRiskScore: 25,
    accountAgeDays: 3,
    repeatedDeviceCount: 1,
  })
  assert.equal(result.score, 60)
  assert.equal(result.level, 'HIGH')
  assert.equal(result.requiresReview, true)
})

test('shared IP is not a referral risk factor', () => {
  const result = calculateReferralRiskAssessment({ customerRiskScore: 0, accountAgeDays: 90, referralCount: 1 })
  assert.equal(result.score, 0)
  assert.equal(result.requiresReview, false)
})

test('a hard-block customer flag also requires referral review below the score threshold', () => {
  const result = calculateReferralRiskAssessment({ customerRiskScore: 30, customerRiskBlocked: true })
  assert.equal(result.requiresReview, true)
})


test('new customers default to NORMAL with no deposit adjustment', () => {
  const risk = calculateCustomerRiskAssessment({})
  assert.equal(risk.level, 'NORMAL')
  assert.equal(riskAdjustedDeposit(300, risk.level), 300)
  assert.equal(calculateCustomerRiskAssessment({ identityStatus: 'VERIFIED' }).level, 'NORMAL')
})

test('deposit reductions require verified identity and a clean completed rental history', () => {
  assert.equal(calculateCustomerRiskAssessment({ completedOrderCount: 5 }).level, 'NORMAL')
  for (const [completedOrderCount, expected] of [[1, 'NORMAL'], [2, 'LOW'], [4, 'LOW'], [5, 'VERY_LOW']]) {
    assert.equal(calculateCustomerRiskAssessment({ identityStatus: 'VERIFIED', completedOrderCount }).level, expected)
  }
  for (const facts of [{ failedPaymentCount: 1 }, { overdueOrderCount: 1 }, { customerDamageCaseCount: 1 }, { activeFlags: [{ flag_type: 'MANUAL_REVIEW', status: 'ACTIVE', severity: 'LOW' }] }]) {
    const risk = calculateCustomerRiskAssessment({ identityStatus: 'VERIFIED', completedOrderCount: 10, ...facts })
    assert.notEqual(risk.level, 'LOW')
    assert.notEqual(risk.level, 'VERY_LOW')
  }
})

test('six deposit tiers use device base price and round to cents', () => {
  for (const [level, expected] of [['VERY_LOW', 0], ['LOW', 150], ['NORMAL', 300], ['MEDIUM', 375], ['HIGH', 450], ['CRITICAL', 600]]) {
    assert.equal(riskAdjustedDeposit(300, level), expected)
    assert.equal(riskAdjustedDeposit(0, level), 0)
  }
  assert.equal(riskAdjustedDeposit(123.45, 'LOW'), 61.73)
  assert.equal(riskAdjustedDeposit(123.45, 'MEDIUM'), 154.31)
  for (const invalid of [NaN, Infinity, -1]) assert.throws(() => riskAdjustedDeposit(invalid, 'NORMAL'))
  const snapshot = riskDepositSnapshot(300, calculateCustomerRiskAssessment({ balance: -1 }))
  assert.deepEqual(snapshot, { baseDepositAmount: 300, depositRiskLevel: 'MEDIUM', depositRiskScore: 30, depositMultiplier: 1.25, depositAmountBeforeWaiver: 375 })
})

test('risk bands change at 30, 60 and 80 without removing explicit account restrictions', () => {
  for (const [facts, score, level] of [
    [{ failedPaymentCount: 2 }, 20, 'NORMAL'],
    [{ failedPaymentCount: 3 }, 30, 'MEDIUM'],
    [{ failedPaymentCount: 3, balance: -1 }, 60, 'HIGH'],
    [{ failedPaymentCount: 3, balance: -1, notReturnedOrderCount: 1 }, 80, 'CRITICAL'],
  ]) {
    const risk = calculateCustomerRiskAssessment(facts)
    assert.equal(risk.score, score)
    assert.equal(risk.level, level)
    assert.equal(risk.blocked, false)
  }
})
