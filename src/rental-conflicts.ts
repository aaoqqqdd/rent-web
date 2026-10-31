// Only unconfirmed, unpaid applications may compete for a device. A saved card
// or an uncaptured authorization is not a confirmed rental.
function competingApplicationSql(alias: string): string {
  return `(${alias}.status = 'pending_approval' AND COALESCE(${alias}.contractId, '') = ''
    AND COALESCE(${alias}.contractSigned, 0) = 0 AND COALESCE(${alias}.payment_status, 'UNPAID') = 'UNPAID'
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = ${alias}.id AND p.status = 'paid'))`
}

function preparingApplicationSql(alias: string): string {
  return `(${alias}.status = 'draft' AND ${alias}.rentalNote LIKE '【官网申请 %')`
}

function boundary(alias: string, end: boolean): string {
  return `(julianday(${alias}.${end ? 'endDate' : 'startDate'}) * 2
    + CASE WHEN ${alias}.${end ? 'endPeriod' : 'startPeriod'} = 'PM' THEN 1 ELSE 0 END)`
}

function duration(alias: string): string {
  return `(${boundary(alias, true)} - ${boundary(alias, false)})`
}

function overlaps(left: string, right: string, bufferDays: number): string {
  // Apply the existing full-day AM/PM buffer in both directions so the
  // outcome cannot depend on which concurrent request finishes first.
  const expandedStart = (alias: string) => bufferDays ? `(julianday(${alias}.startDate) * 2 - ${bufferDays * 2})` : boundary(alias, false)
  const expandedEnd = (alias: string) => bufferDays ? `(julianday(${alias}.endDate) * 2 + ${bufferDays * 2 + 1})` : boundary(alias, true)
  return `(${left}.deviceId = ${right}.deviceId AND (${right}.startDate IS NULL OR ${right}.endDate IS NULL
    OR (${expandedStart(left)} < ${boundary(right, true)} AND ${boundary(right, false)} < ${expandedEnd(left)})
    OR (${expandedStart(right)} < ${boundary(left, true)} AND ${boundary(left, false)} < ${expandedEnd(right)})))`
}

function higherPriority(left: string, right: string): string {
  // Compare actual half-days, not rounded billing days. Normalize SQLite and ISO
  // timestamps; the rowid is a stable insertion-order tie breaker.
  return `(${duration(left)} > ${duration(right)} OR (${duration(left)} = ${duration(right)} AND
    (COALESCE(julianday(${left}.createdAt), 0) < COALESCE(julianday(${right}.createdAt), 0)
    OR (COALESCE(julianday(${left}.createdAt), 0) = COALESCE(julianday(${right}.createdAt), 0)
    AND ${left}.rowid < ${right}.rowid))))`
}

export const APPLICATION_REJECTION_REASON = '设备档期冲突，系统优先保留租期较长的申请；租期相同时保留先提交的申请。'

export interface RejectedApplication {
  id: string
  userId: string
  stripe_deposit_payment_intent_id: string | null
}

export async function cancelPreparingApplications(db: D1Database, orderIds: string[]): Promise<RejectedApplication[]> {
  if (!orderIds.length) return []
  const results = await db.batch(orderIds.map(orderId => db.prepare(`UPDATE orders SET status = 'cancelled',
    order_status = 'CANCELLED', payment_status = 'PAYMENT_FAILED', rental_status = 'CANCELLED', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND ${preparingApplicationSql('orders')} RETURNING id, userId, stripe_deposit_payment_intent_id`).bind(orderId)))
  return results.flatMap(result => result.results as RejectedApplication[])
}

/** All payment setup must finish while the new orders are drafts. The batch
 * chooses winners and cancels losers atomically, even across Worker isolates. */
export async function finalizeRentalApplications(db: D1Database, orderIds: string[], bufferDays: number): Promise<{ acceptedIds: string[]; rejected: RejectedApplication[] }> {
  const buffer = Math.max(0, Math.floor(bufferDays))
  const statements: D1PreparedStatement[] = []
  for (const orderId of orderIds) {
    statements.push(
      db.prepare(`UPDATE orders SET status = 'pending_approval', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND ${preparingApplicationSql('orders')} AND NOT EXISTS (
          SELECT 1 FROM orders candidate JOIN orders existing ON ${overlaps('candidate', 'existing', buffer)}
          WHERE candidate.id = orders.id AND existing.id <> candidate.id AND existing.deleted_at IS NULL
          AND existing.status NOT IN ('completed', 'cancelled') AND NOT ${preparingApplicationSql('existing')}
          AND (NOT ${competingApplicationSql('existing')} OR ${higherPriority('existing', 'candidate')})
        ) RETURNING id`).bind(orderId),
      db.prepare(`UPDATE orders SET status = 'cancelled', order_status = 'CANCELLED', payment_status = 'PAYMENT_FAILED',
        rental_status = 'CANCELLED', updatedAt = CURRENT_TIMESTAMP,
        rentalNote = COALESCE(rentalNote, '') || char(10) || ?
        WHERE deleted_at IS NULL AND ${competingApplicationSql('orders')} AND id <> ? AND EXISTS (
          SELECT 1 FROM orders winner WHERE winner.id = ? AND winner.status = 'pending_approval'
          AND ${overlaps('winner', 'orders', buffer)} AND ${higherPriority('winner', 'orders')}
        ) RETURNING id, userId, stripe_deposit_payment_intent_id`).bind(APPLICATION_REJECTION_REASON, orderId, orderId),
      db.prepare(`UPDATE orders SET status = 'cancelled', order_status = 'CANCELLED', payment_status = 'PAYMENT_FAILED',
        rental_status = 'CANCELLED', updatedAt = CURRENT_TIMESTAMP,
        rentalNote = COALESCE(rentalNote, '') || char(10) || ?
        WHERE id = ? AND ${preparingApplicationSql('orders')}
        RETURNING id, userId, stripe_deposit_payment_intent_id`).bind(APPLICATION_REJECTION_REASON, orderId),
    )
  }
  if (!statements.length) return { acceptedIds: [], rejected: [] }
  const results = await db.batch(statements)
  return {
    acceptedIds: results.flatMap((result, index) => index % 3 === 0 ? (result.results as { id: string }[]).map(row => row.id) : []),
    rejected: results.flatMap((result, index) => index % 3 !== 0 ? result.results as RejectedApplication[] : []),
  }
}
