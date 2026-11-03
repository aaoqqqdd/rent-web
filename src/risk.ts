/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 客户与推荐风险的统一数据采集层。评分规则在 domain/riskFlags.ts，
// 这里只负责从 D1 取当前数据，保证每次业务操作都会得到最新结果。

import type { Context } from 'hono'
import {
  calculateCustomerRiskAssessment,
  calculateReferralRiskAssessment,
} from './risk-rules'
import type {
  CustomerRiskAssessment,
  CustomerRiskFacts,
  ReferralRiskAssessment,
  ReferralRiskFacts,
  RiskFlagLike,
} from './risk-rules'

export async function getCustomerRiskAssessment(c: Context, customerId: string): Promise<CustomerRiskAssessment> {
  const [account, orderStats, paymentStats, refundStats, damageStats, flags] = await Promise.all([
    c.env.RENT.prepare("SELECT balance, identity_status FROM users WHERE id = ? AND role = 'CUSTOMER'").bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT
      SUM(CASE WHEN status = 'completed' AND payment_status = 'PAID' AND COALESCE(handover_overdue, 0) = 0 AND COALESCE(deposit_deduction_amount, 0) = 0 THEN 1 ELSE 0 END) AS completed_orders,
      SUM(CASE WHEN status = 'overdue' OR handover_overdue = 1 THEN 1 ELSE 0 END) AS overdue_orders,
      SUM(CASE WHEN status IN ('overdue', 'suspended') THEN 1 ELSE 0 END) AS not_returned_orders,
      SUM(CASE WHEN deposit_deduction_amount > 0 THEN 1 ELSE 0 END) AS deposit_deduction_orders
      FROM orders WHERE userId = ?`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_payments,
      SUM(CASE WHEN status IN ('paid', 'refunded') THEN COALESCE(amount, 0) ELSE 0 END) AS paid_amount
      FROM payments WHERE customer_id = ?`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COALESCE(SUM(refund_amount), 0) AS refunded_amount
      FROM payment_refunds
      WHERE status = 'succeeded' AND type <> 'deposit' AND order_id IN (SELECT id FROM orders WHERE userId = ?)`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COUNT(*) AS customer_damage_cases
      FROM damage_cases
      WHERE liability_status = 'CUSTOMER'
        AND order_id IN (SELECT id FROM orders WHERE userId = ?)`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT flag_type, severity, status, expires_at
      FROM risk_flags
      WHERE customer_id = ? AND status = 'ACTIVE'
      ORDER BY created_at DESC`).bind(customerId).all(),
  ])

  if (!account) {
    return { score: 100, level: 'CRITICAL', blocked: true, reasons: ['客户资料不存在'], blockingFlag: null }
  }

  const facts: CustomerRiskFacts = {
    completedOrderCount: Number(orderStats?.completed_orders || 0),
    balance: Number(account.balance || 0),
    identityStatus: account.identity_status,
    failedPaymentCount: Number(paymentStats?.failed_payments || 0),
    overdueOrderCount: Number(orderStats?.overdue_orders || 0),
    notReturnedOrderCount: Number(orderStats?.not_returned_orders || 0),
    customerDamageCaseCount: Number(damageStats?.customer_damage_cases || 0),
    depositDeductionOrderCount: Number(orderStats?.deposit_deduction_orders || 0),
    paidAmount: Number(paymentStats?.paid_amount || 0),
    refundedAmount: Number(refundStats?.refunded_amount || 0),
    activeFlags: (flags.results || []) as RiskFlagLike[],
  }
  return calculateCustomerRiskAssessment(facts)
}

/**
 * 批量客户风险分级（列表页用）。
 *
 * 逐个调用 getCustomerRiskAssessment 是 6 条 SQL × 客户数（/admin/users 一页 50 行
 * 就是 300 条 D1 查询），这里改成 5 条聚合 SQL：orders / payments / payment_refunds /
 * damage_cases / risk_flags 各扫一次，按 customer_id 归并后在内存里套同一套评分规则
 * （calculateCustomerRiskAssessment），分数与逐条计算完全一致。
 */
export async function getCustomerRiskLevels(c: Context, customerIds: string[]): Promise<Map<string, CustomerRiskAssessment>> {
  const ids = Array.from(new Set(customerIds.filter(Boolean)))
  const result = new Map<string, CustomerRiskAssessment>()
  if (!ids.length) return result
  const placeholders = ids.map(() => '?').join(', ')

  const [accounts, orderStats, paymentStats, refundStats, damageStats, flags] = await Promise.all([
    c.env.RENT.prepare(`SELECT id, balance, identity_status FROM users WHERE role = 'CUSTOMER' AND id IN (${placeholders})`).bind(...ids).all() as Promise<any>,
    c.env.RENT.prepare(`SELECT userId AS customer_id,
      SUM(CASE WHEN status = 'completed' AND payment_status = 'PAID' AND COALESCE(handover_overdue, 0) = 0 AND COALESCE(deposit_deduction_amount, 0) = 0 THEN 1 ELSE 0 END) AS completed_orders,
      SUM(CASE WHEN status = 'overdue' OR handover_overdue = 1 THEN 1 ELSE 0 END) AS overdue_orders,
      SUM(CASE WHEN status IN ('overdue', 'suspended') THEN 1 ELSE 0 END) AS not_returned_orders,
      SUM(CASE WHEN deposit_deduction_amount > 0 THEN 1 ELSE 0 END) AS deposit_deduction_orders
      FROM orders WHERE userId IN (${placeholders}) GROUP BY userId`).bind(...ids).all() as Promise<any>,
    c.env.RENT.prepare(`SELECT customer_id,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_payments,
      SUM(CASE WHEN status IN ('paid', 'refunded') THEN COALESCE(amount, 0) ELSE 0 END) AS paid_amount
      FROM payments WHERE customer_id IN (${placeholders}) GROUP BY customer_id`).bind(...ids).all() as Promise<any>,
    c.env.RENT.prepare(`SELECT o.userId AS customer_id, COALESCE(SUM(r.refund_amount), 0) AS refunded_amount
      FROM payment_refunds r JOIN orders o ON o.id = r.order_id
      WHERE r.status = 'succeeded' AND r.type <> 'deposit' AND o.userId IN (${placeholders}) GROUP BY o.userId`).bind(...ids).all() as Promise<any>,
    c.env.RENT.prepare(`SELECT o.userId AS customer_id, COUNT(*) AS customer_damage_cases
      FROM damage_cases dc JOIN orders o ON o.id = dc.order_id
      WHERE dc.liability_status = 'CUSTOMER' AND o.userId IN (${placeholders}) GROUP BY o.userId`).bind(...ids).all() as Promise<any>,
    c.env.RENT.prepare(`SELECT customer_id, flag_type, severity, status, expires_at
      FROM risk_flags WHERE status = 'ACTIVE' AND customer_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all() as Promise<any>,
  ])

  const accountById = new Map<string, any>((accounts.results || []).map((row: any) => [String(row.id), row]))
  const orderById = new Map<string, any>((orderStats.results || []).map((row: any) => [String(row.customer_id), row]))
  const paymentById = new Map<string, any>((paymentStats.results || []).map((row: any) => [String(row.customer_id), row]))
  const refundById = new Map<string, any>((refundStats.results || []).map((row: any) => [String(row.customer_id), row]))
  const damageById = new Map<string, any>((damageStats.results || []).map((row: any) => [String(row.customer_id), row]))
  const flagsById = new Map<string, RiskFlagLike[]>()
  for (const flag of (flags.results || []) as any[]) {
    const key = String(flag.customer_id)
    flagsById.set(key, [...(flagsById.get(key) || []), flag as RiskFlagLike])
  }

  for (const id of ids) {
    const account = accountById.get(id)
    const order = orderById.get(id) || {}
    const payment = paymentById.get(id) || {}
    const facts: CustomerRiskFacts = {
      completedOrderCount: Number(order.completed_orders || 0),
      balance: Number(account?.balance || 0),
      identityStatus: account?.identity_status,
      failedPaymentCount: Number(payment.failed_payments || 0),
      overdueOrderCount: Number(order.overdue_orders || 0),
      notReturnedOrderCount: Number(order.not_returned_orders || 0),
      customerDamageCaseCount: Number(damageById.get(id)?.customer_damage_cases || 0),
      depositDeductionOrderCount: Number(order.deposit_deduction_orders || 0),
      paidAmount: Number(payment.paid_amount || 0),
      refundedAmount: Number(refundById.get(id)?.refunded_amount || 0),
      activeFlags: flagsById.get(id) || [],
    }
    result.set(id, account ? calculateCustomerRiskAssessment(facts) : { score: 100, level: 'CRITICAL', blocked: true, reasons: ['客户资料不存在'], blockingFlag: null })
  }
  return result
}

function daysSince(value: unknown): number {
  const timestamp = new Date(String(value || '')).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, (Date.now() - timestamp) / 86400000)
}

export async function getReferralRiskAssessment(c: Context, customerId: string): Promise<ReferralRiskAssessment> {
  const [customerRisk, account, referralStats, duplicateIdentity, repeatedDevice] = await Promise.all([
    getCustomerRiskAssessment(c, customerId),
    c.env.RENT.prepare('SELECT created_at, identity_document_last4 FROM users WHERE id = ? AND role = \'CUSTOMER\'').bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COUNT(*) AS referral_count
      FROM referrals
      WHERE referrer_customer_id = ? AND status NOT IN ('CANCELLED', 'INVALID')`).bind(customerId).first() as Promise<any>,
    c.env.RENT.prepare(`SELECT COUNT(*) AS duplicate_identity_count
      FROM users other
      JOIN users current ON current.id = ?
      WHERE other.role = 'CUSTOMER' AND other.id <> current.id
        AND current.identity_document_last4 IS NOT NULL
        AND current.identity_document_last4 <> ''
        AND other.identity_document_last4 = current.identity_document_last4`).bind(customerId).first() as Promise<any>,
    // 只比较设备，不比较 IP。设备重复是风险信号，不能单独认定欺诈。
    c.env.RENT.prepare(`SELECT COUNT(DISTINCT referrer_order.deviceId) AS repeated_device_count
      FROM orders referrer_order
      JOIN referrals r ON r.referrer_customer_id = referrer_order.userId
      JOIN orders referee_order ON referee_order.userId = r.referee_customer_id
        AND referee_order.deviceId = referrer_order.deviceId
      WHERE referrer_order.userId = ?
        AND referrer_order.deviceId IS NOT NULL
        AND referrer_order.deviceId <> ''`).bind(customerId).first() as Promise<any>,
  ])

  const facts: ReferralRiskFacts = {
    customerRiskScore: customerRisk.score,
    customerRiskBlocked: customerRisk.blocked,
    accountAgeDays: daysSince(account?.created_at),
    referralCount: Number(referralStats?.referral_count || 0),
    duplicateIdentityCount: Number(duplicateIdentity?.duplicate_identity_count || 0),
    repeatedDeviceCount: Number(repeatedDevice?.repeated_device_count || 0),
  }
  return calculateReferralRiskAssessment(facts)
}
