// 订单查询层：官网与 rent 共用同一个 D1，只返回订单所有者可见的字段。

import type { Env } from './index'
import { hashPassword } from './auth'

export interface OrderContractView {
  id: string
  number: string
  status: string
  statusLabel: string
  signedAt: string
  url?: string
}

export interface OrderView {
  id: string
  orderNo: string
  status: string
  statusLabel: string
  accountType: string
  accountEmail: string
  createdAt: string
  startDate: string
  endDate: string
  startPeriod: string
  endPeriod: string
  rentalPeriod: number
  deliveryMethod: string
  deliveryFee: number
  pickupLocation: string
  returnLocation: string
  pickupTimeSlot: string
  returnTimeSlot: string
  rentalNote: string
  totalAmount: number
  depositAmount: number
  amountDue: number
  paymentStatus: string
  depositStatus: string
  device: {
    name: string
    model: string
    serialNumber: string
    cpu: string
    ram: string
    storage: string
    gpu: string
    os: string
  }
  contract?: OrderContractView
  windowsUsername?: string
  windowsPassword?: string
}

export interface PublicOrderLookupResult {
  order: OrderView
  temporaryPassword?: string
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_approval: '审核中',
  approved: '已确认',
  pending_payment: '待付款',
  awaiting_signature: '待签署',
  pending_refund: '待退款',
  refund_pending: '待退款',
  paid: '已付款',
  pending_pickup: '待取货',
  active: '租赁中',
  extended: '租赁中（已延期）',
  overdue: '租赁逾期',
  suspended: '租赁已暂停',
  pending_return: '待归还',
  returned: '已归还',
  completed: '已完成',
  cancelled: '已取消',
  canceled: '已取消',
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_sign: '待签署',
  signed: '已签署',
  completed: '已签署',
  cancelled: '已取消',
  expired: '已过期',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '待付款',
  pending: '处理中',
  paid: '已付款',
  succeeded: '已付款',
  failed: '付款失败',
  refunded: '已退款',
}

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: '无需押金',
  PENDING: '待支付',
  PAID: '已支付',
  HELD: '已收取，待归还验机',
  PARTIALLY_DEDUCTED: '部分扣除',
  REFUND_PENDING: '待退款',
  PARTIALLY_REFUNDED: '部分已退款',
  REFUNDED: '已退款',
  FORFEITED: '已扣除',
}

function value(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const current = row[key]
    if (current !== undefined && current !== null && String(current) !== '') return String(current)
  }
  return ''
}

function numberValue(row: Record<string, unknown>, ...keys: string[]): number {
  const parsed = Number(value(row, ...keys))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseContractData(row: Record<string, unknown>): { windowsUsername?: string; windowsPassword?: string } {
  const raw = value(row, 'contract_data', 'contractData')
  if (!raw) return {}
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const windowsUsername = value(data, 'windows_username', 'windowsUsername')
    const windowsPassword = value(data, 'windows_password', 'windowsPassword')
    return {
      windowsUsername: windowsUsername || undefined,
      windowsPassword: windowsPassword || undefined,
    }
  } catch {
    return {}
  }
}

function isFuture(valueToCheck: string): boolean {
  if (!valueToCheck) return true
  const timestamp = new Date(valueToCheck.includes('T') ? valueToCheck : `${valueToCheck.replace(' ', 'T')}Z`).getTime()
  return !Number.isFinite(timestamp) || timestamp > Date.now()
}

async function hydrateOrders(env: Env, rows: Record<string, unknown>[], appUrl: string): Promise<OrderView[]> {
  if (!rows.length) return []
  const ids = rows.map((row) => value(row, 'id')).filter(Boolean)
  const placeholders = ids.map(() => '?').join(',')
  const [contractRows, refundRows] = await Promise.all([
    (async () => {
      try {
        return (await env.RENT.prepare(`SELECT * FROM contracts WHERE orderId IN (${placeholders})`).bind(...ids).all<Record<string, unknown>>()).results ?? []
      } catch {
        return []
      }
    })(),
    (async () => {
      try {
        return (await env.RENT.prepare(`SELECT * FROM payment_refunds WHERE order_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all<Record<string, unknown>>()).results ?? []
      } catch {
        return []
      }
    })(),
  ])
  const contracts = new Map<string, Record<string, unknown>>()
  for (const row of contractRows) {
    const orderId = value(row, 'orderId', 'order_id', 'rentalId', 'rental_id')
    if (orderId && !contracts.has(orderId)) contracts.set(orderId, row)
  }
  const refunds = new Map<string, Record<string, unknown>>()
  for (const row of refundRows) {
    const orderId = value(row, 'order_id', 'orderId')
    if (orderId && !refunds.has(orderId)) refunds.set(orderId, row)
  }

  return rows.map((row) => {
    const id = value(row, 'id')
    const rawStatus = value(row, 'status', 'order_status').toLowerCase()
    const refund = refunds.get(id)
    const refundPending = ['pending', 'processing'].includes(value(refund || {}, 'status').toLowerCase())
      || ['REFUND_PENDING', 'PARTIALLY_DEDUCTED'].includes(value(row, 'deposit_status', 'depositStatus').toUpperCase())
    const contractRow = contracts.get(id)
    const contractStatus = value(contractRow || {}, 'status').toLowerCase()
    const contractData = contractRow ? parseContractData(contractRow) : {}
    const contractId = value(contractRow || {}, 'id')
    const signToken = value(contractRow || {}, 'signToken', 'sign_token')
    const signExpiresAt = value(contractRow || {}, 'signExpiresAt', 'sign_expires_at')
    const contract: OrderContractView | undefined = contractRow ? {
      id: contractId,
      number: value(contractRow, 'contractNumber', 'contract_number'),
      status: contractStatus,
      statusLabel: CONTRACT_STATUS_LABELS[contractStatus] || contractStatus || '处理中',
      signedAt: value(contractRow, 'signedAt', 'signed_at'),
      url: contractStatus === 'pending_sign' && signToken && isFuture(signExpiresAt)
        ? `${appUrl}/contract/sign?token=${encodeURIComponent(signToken)}`
        : ['signed', 'completed'].includes(contractStatus) && contractId
          ? `${appUrl}/contract/view/${encodeURIComponent(contractId)}`
          : undefined,
    } : undefined
    const contractPending = contractStatus === 'pending_sign'
    const contractSigned = ['signed', 'completed'].includes(contractStatus)
    const statusLabel = refundPending && !['cancelled', 'canceled'].includes(rawStatus)
      ? '待退款'
      : contractPending && ['approved', 'awaiting_signature'].includes(rawStatus)
        ? '已确认 · 待签署'
        : contractPending
          ? '待签署'
          : contractSigned && ['approved', 'pending_pickup'].includes(rawStatus)
            ? '已签署 · 待取货'
            : contractSigned && ['awaiting_signature', 'pending_payment'].includes(rawStatus)
              ? '已签署'
          : ORDER_STATUS_LABELS[rawStatus] || rawStatus || '处理中'

    return {
      id,
      orderNo: value(row, 'orderNo', 'order_no') || '付款后生成',
      status: rawStatus,
      statusLabel,
      accountType: value(row, 'account_type', 'accountType') || 'formal',
      accountEmail: value(row, 'email'),
      createdAt: value(row, 'createdAt', 'created_at'),
      startDate: value(row, 'startDate', 'start_date'),
      endDate: value(row, 'endDate', 'end_date'),
      startPeriod: value(row, 'startPeriod', 'start_period') || 'AM',
      endPeriod: value(row, 'endPeriod', 'end_period') || 'AM',
      rentalPeriod: numberValue(row, 'rentalPeriod', 'rental_period'),
      deliveryMethod: value(row, 'deliveryMethod', 'delivery_method') || 'Pickup',
      deliveryFee: numberValue(row, 'deliveryFee', 'delivery_fee'),
      pickupLocation: value(row, 'pickupLocation', 'pickup_location'),
      returnLocation: value(row, 'returnLocation', 'return_location'),
      pickupTimeSlot: value(row, 'pickupTimeSlot', 'pickup_time_slot'),
      returnTimeSlot: value(row, 'returnTimeSlot', 'return_time_slot'),
      rentalNote: value(row, 'rentalNote', 'rental_note'),
      totalAmount: numberValue(row, 'totalAmount', 'total_amount'),
      depositAmount: numberValue(row, 'depositAmount', 'deposit_amount'),
      amountDue: numberValue(row, 'amount_due', 'amountDue'),
      paymentStatus: PAYMENT_STATUS_LABELS[value(row, 'payment_status', 'paymentStatus').toLowerCase()] || value(row, 'payment_status', 'paymentStatus'),
      depositStatus: DEPOSIT_STATUS_LABELS[value(row, 'deposit_status', 'depositStatus').toUpperCase()] || value(row, 'deposit_status', 'depositStatus'),
      device: {
        name: value(row, 'device_name') || '设备',
        model: value(row, 'device_model'),
        serialNumber: value(row, 'serial_number', 'serialNumber'),
        cpu: value(row, 'device_cpu', 'cpu'),
        ram: value(row, 'device_ram', 'ram'),
        storage: value(row, 'device_storage', 'storage'),
        gpu: value(row, 'device_gpu', 'gpu'),
        os: value(row, 'device_os', 'os'),
      },
      contract,
      ...contractData,
    }
  })
}

const ORDER_SELECT = `SELECT o.*, u.email AS email, u.account_type AS account_type,
  d.name AS device_name, d.model AS device_model, d.serialNumber AS serial_number,
  d.cpu AS device_cpu, d.ram AS device_ram, d.storage AS device_storage,
  d.gpu AS device_gpu, d.os AS device_os
  FROM orders o JOIN users u ON u.id = o.userId
  LEFT JOIN devices d ON d.id = o.deviceId`

export async function listOrdersForUser(env: Env, userId: string, appUrl: string): Promise<OrderView[]> {
  try {
    const result = await env.RENT.prepare(`${ORDER_SELECT} WHERE o.userId = ? ORDER BY o.createdAt DESC LIMIT 50`)
      .bind(userId)
      .all<Record<string, unknown>>()
    return hydrateOrders(env, result.results ?? [], appUrl)
  } catch (error) {
    console.error('web order list failed:', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function lookupOrderByCredentials(env: Env, orderNo: string, email: string, appUrl: string): Promise<PublicOrderLookupResult | null> {
  const row = await env.RENT.prepare(`${ORDER_SELECT} WHERE UPPER(o.orderNo) = ? AND lower(u.email) = ? LIMIT 1`)
    .bind(orderNo.trim().toUpperCase().slice(0, 100), email.trim().toLowerCase().slice(0, 254))
    .first<Record<string, unknown>>()
  if (!row) return null

  let temporaryPassword: string | undefined
  if ((value(row, 'account_type', 'accountType') || 'formal') === 'guest') {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    const bytes = new Uint8Array(10)
    crypto.getRandomValues(bytes)
    temporaryPassword = `Gs${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}!`
    await env.RENT.prepare("UPDATE users SET password_hash = ?, password_salt = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_type = 'guest'")
      .bind(await hashPassword(temporaryPassword), value(row, 'userId', 'user_id'))
      .run()
  }

  const [order] = await hydrateOrders(env, [row], appUrl)
  return order ? { order, temporaryPassword } : null
}
