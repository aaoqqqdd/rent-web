/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 风险标记与黑名单 (完善.md / TODO.md P2 #10)
//
// 不是一个 is_blacklisted 布尔，而是带类型 / 严重程度 / 证据的标记表。
// 任意 HIGH 级标记，或命中硬拦截类型
// （拒付、疑似欺诈、设备未归还、付款风险）时阻止客户继续自助下单；
// 标记不会自动过期，只有管理员手动解除（status 置为 RESOLVED）才会失效。

export const RISK_FLAG_TYPES = ['PAYMENT_RISK', 'IDENTITY_RISK', 'DEVICE_NOT_RETURNED', 'SERIOUS_DAMAGE', 'CHARGEBACK', 'ABUSE', 'FRAUD_SUSPECTED', 'MANUAL_REVIEW'] as const
export type RiskFlagType = typeof RISK_FLAG_TYPES[number]
export const RISK_FLAG_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

export const ORDER_BLOCKING_RISK_FLAG_TYPES = new Set<RiskFlagType>(['PAYMENT_RISK', 'DEVICE_NOT_RETURNED', 'CHARGEBACK', 'FRAUD_SUSPECTED'])
export const RISK_SCORE_HIGH_THRESHOLD = 60

export interface CustomerRiskFacts {
  completedOrderCount?: number
  balance?: number
  identityStatus?: string | null
  failedPaymentCount?: number
  overdueOrderCount?: number
  notReturnedOrderCount?: number
  customerDamageCaseCount?: number
  depositDeductionOrderCount?: number
  paidAmount?: number
  refundedAmount?: number
  activeFlags?: RiskFlagLike[]
}

export type CustomerRiskLevel = 'VERY_LOW' | 'LOW' | 'NORMAL' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const CUSTOMER_RISK_LABELS: Record<CustomerRiskLevel, string> = { VERY_LOW: '极低风险', LOW: '低风险', NORMAL: '普通', MEDIUM: '中风险', HIGH: '高风险', CRITICAL: '极高风险' }
export const CUSTOMER_DEPOSIT_MULTIPLIERS: Record<CustomerRiskLevel, number> = { VERY_LOW: 0, LOW: 0.5, NORMAL: 1, MEDIUM: 1.25, HIGH: 1.5, CRITICAL: 2 }

export function riskAdjustedDeposit(baseDeposit: number, level: CustomerRiskLevel): number {
  if (!Number.isFinite(baseDeposit) || baseDeposit < 0 || !(level in CUSTOMER_DEPOSIT_MULTIPLIERS)) throw new Error('订单金额无效')
  return Math.round(Math.round(baseDeposit * 100) * CUSTOMER_DEPOSIT_MULTIPLIERS[level]) / 100
}

export function riskDepositSnapshot(baseDeposit: number, risk: CustomerRiskAssessment) {
  return { baseDepositAmount: baseDeposit, depositRiskLevel: risk.level, depositRiskScore: risk.score, depositMultiplier: CUSTOMER_DEPOSIT_MULTIPLIERS[risk.level], depositAmountBeforeWaiver: riskAdjustedDeposit(baseDeposit, risk.level) }
}

export interface CustomerRiskAssessment {
  score: number
  level: CustomerRiskLevel
  blocked: boolean
  reasons: string[]
  blockingFlag: RiskFlagLike | null
}

export interface ReferralRiskFacts {
  customerRiskScore?: number
  customerRiskBlocked?: boolean
  accountAgeDays?: number
  referralCount?: number
  duplicateIdentityCount?: number
  repeatedDeviceCount?: number
}

export interface ReferralRiskAssessment {
  score: number
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  requiresReview: boolean
  reasons: string[]
}

const RISK_FLAG_SCORE: Record<string, number> = {
  PAYMENT_RISK: 30,
  IDENTITY_RISK: 20,
  DEVICE_NOT_RETURNED: 35,
  SERIOUS_DAMAGE: 25,
  CHARGEBACK: 40,
  ABUSE: 25,
  FRAUD_SUSPECTED: 40,
  MANUAL_REVIEW: 10,
}

function addRisk(reasons: string[], label: string, points: number): number {
  if (points <= 0) return 0
  reasons.push(`${label} +${points}`)
  return points
}

export function calculateCustomerRiskAssessment(facts: CustomerRiskFacts, _now: Date = new Date()): CustomerRiskAssessment {
  const reasons: string[] = []
  const activeFlags = (facts.activeFlags || []).filter((flag) => isRiskFlagCurrentlyActive(flag))
  let score = 0

  if (Number(facts.balance || 0) < 0) score += addRisk(reasons, '账户余额为负', 30)
  score += addRisk(reasons, '付款失败历史', Math.min(30, Math.max(0, Number(facts.failedPaymentCount || 0)) * 10))
  score += addRisk(reasons, '逾期归还历史', Math.min(30, Math.max(0, Number(facts.overdueOrderCount || 0)) * 10))
  score += addRisk(reasons, '设备未归还历史', Math.min(40, Math.max(0, Number(facts.notReturnedOrderCount || 0)) * 20))
  score += addRisk(reasons, '客户责任损坏历史', Math.min(40, Math.max(0, Number(facts.customerDamageCaseCount || 0)) * 20))
  score += addRisk(reasons, '押金扣款历史', Math.min(20, Math.max(0, Number(facts.depositDeductionOrderCount || 0)) * 10))

  const paidAmount = Math.max(0, Number(facts.paidAmount || 0))
  const refundedAmount = Math.max(0, Number(facts.refundedAmount || 0))
  const refundRatio = paidAmount > 0 ? refundedAmount / paidAmount : 0
  if (paidAmount > 0 && refundRatio >= 0.5) score += addRisk(reasons, '退款比例异常', 25)
  else if (paidAmount > 0 && refundRatio >= 0.25) score += addRisk(reasons, '退款比例偏高', 10)

  if (['REJECTED', 'EXPIRED', 'FAILED'].includes(String(facts.identityStatus || '').toUpperCase())) {
    score += addRisk(reasons, '身份验证未通过', 20)
  }

  for (const flag of activeFlags) {
    const type = String(flag.flag_type || '').toUpperCase()
    score += addRisk(reasons, `风险标记 ${type || 'UNKNOWN'}`, RISK_FLAG_SCORE[type] || 10)
  }

  const blockingFlag = findBlockingRiskFlag(activeFlags)
  const blocked = Boolean(blockingFlag)
  const cappedScore = Math.min(100, Math.max(0, Math.round(score)))
  const trusted = cappedScore === 0 && !activeFlags.length && String(facts.identityStatus || '').toUpperCase() === 'VERIFIED'
  const completed = Math.max(0, Number(facts.completedOrderCount || 0))
  const level: CustomerRiskLevel = cappedScore >= 80 ? 'CRITICAL' : cappedScore >= RISK_SCORE_HIGH_THRESHOLD ? 'HIGH' : cappedScore >= 30 ? 'MEDIUM'
    : trusted && completed >= 5 ? 'VERY_LOW' : trusted && completed >= 2 ? 'LOW' : 'NORMAL'
  return { score: cappedScore, level, blocked, reasons, blockingFlag }
}

// 推荐风险沿用客户风险分，再叠加推荐关系本身的信号。相同 IP 不在这里计算，
// 因为宿舍、家庭和公共 Wi-Fi 都可能共享公网 IP；设备重复也只是风险信号，交给人工复核。
export function calculateReferralRiskAssessment(facts: ReferralRiskFacts): ReferralRiskAssessment {
  const reasons: string[] = []
  let score = Math.min(100, Math.max(0, Number(facts.customerRiskScore || 0)))
  if (facts.customerRiskBlocked || score >= RISK_SCORE_HIGH_THRESHOLD) {
    reasons.push(facts.customerRiskBlocked && score < RISK_SCORE_HIGH_THRESHOLD
      ? '客户命中风险拦截规则，推荐奖励需审核'
      : `客户风险分 ${Math.round(score)}，推荐奖励需审核`)
  }
  else if (score >= 30) reasons.push(`客户风险分 ${Math.round(score)}，推荐奖励加强审核`)

  const accountAgeDays = Math.max(0, Number(facts.accountAgeDays || 0))
  if (accountAgeDays < 7) { score += 20; reasons.push('账户创建未满 7 天 +20') }
  else if (accountAgeDays < 30) { score += 10; reasons.push('账户创建未满 30 天 +10') }

  const referralCount = Math.max(0, Number(facts.referralCount || 0))
  if (referralCount >= 10) { score += 25; reasons.push('推荐关系数量异常 +25') }
  else if (referralCount >= 5) { score += 10; reasons.push('推荐关系数量偏高 +10') }

  const duplicateIdentityCount = Math.max(0, Number(facts.duplicateIdentityCount || 0))
  if (duplicateIdentityCount > 0) {
    const points = Math.min(30, duplicateIdentityCount * 15)
    score += points
    reasons.push(`身份信息重复信号 +${points}`)
  }

  const repeatedDeviceCount = Math.max(0, Number(facts.repeatedDeviceCount || 0))
  if (repeatedDeviceCount > 0) {
    const points = Math.min(30, repeatedDeviceCount * 15)
    score += points
    reasons.push(`设备重复信号 +${points}`)
  }

  const cappedScore = Math.min(100, Math.max(0, Math.round(score)))
  const level = cappedScore >= 80 ? 'CRITICAL' : cappedScore >= RISK_SCORE_HIGH_THRESHOLD ? 'HIGH' : cappedScore >= 30 ? 'MEDIUM' : 'LOW'
  return { score: cappedScore, level, requiresReview: Boolean(facts.customerRiskBlocked) || cappedScore >= RISK_SCORE_HIGH_THRESHOLD, reasons }
}

export interface RiskFlagLike { flag_type?: string; severity?: string; status?: string; expires_at?: string | null }

export function isRiskFlagCurrentlyActive(flag: RiskFlagLike | null | undefined): boolean {
  return !!flag && String(flag.status || '').toUpperCase() === 'ACTIVE'
}

// 返回第一条会阻止客户自助下单的有效标记；没有则返回 null。
export function findBlockingRiskFlag<T extends RiskFlagLike>(flags: Array<T | null | undefined>): T | null {
  for (const flag of flags || []) {
    if (!isRiskFlagCurrentlyActive(flag)) continue
    const severity = String(flag!.severity || '').toUpperCase()
    const type = String(flag!.flag_type || '').toUpperCase() as RiskFlagType
    if (severity === 'HIGH' || ORDER_BLOCKING_RISK_FLAG_TYPES.has(type)) return flag as T
  }
  return null
}
