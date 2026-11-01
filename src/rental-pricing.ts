export interface RentalPricingDevice {
  pricePerDay?: unknown
  price_per_day?: unknown
  day?: unknown
  weeklyDiscountPercent?: unknown
  weekly_discount_percent?: unknown
  monthlyDiscountPercent?: unknown
  monthly_discount_percent?: unknown
}

/** Self-contained so cart and checkout can use the server calculation in their scripts. */
export function rentalPriceBreakdown(device: RentalPricingDevice, rentalDays: number) {
  const number = (...values: unknown[]) => {
    for (const value of values) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return 0
  }
  const money = (value: number) => Number(value.toFixed(2))
  const days = Math.max(0, number(rentalDays))
  const daily = Math.max(0, number(device.pricePerDay, device.price_per_day, device.day))
  const weeklyDiscount = Math.min(100, Math.max(0, number(device.weeklyDiscountPercent, device.weekly_discount_percent)))
  const monthlyDiscount = Math.min(100, Math.max(0, number(device.monthlyDiscountPercent, device.monthly_discount_percent)))
  const monthlyRate = money(daily * 30 * (1 - monthlyDiscount / 100))
  const weeklyRate = money(daily * 7 * (1 - weeklyDiscount / 100))
  const remainder = days % 30
  const monthlyDays = days >= 30 ? Math.floor(days / 30) * 30 + (remainder >= 21 ? remainder : 0) : 0
  const remainingDays = days - monthlyDays
  const weeklyDays = days >= 30 ? remainingDays : Math.floor(remainingDays / 7) * 7
  const dailyDays = remainingDays - weeklyDays
  const monthlyFee = money(monthlyDays / 30 * monthlyRate)
  const weeklyFee = money(weeklyDays / 7 * weeklyRate)
  const originalAmount = money(days * daily)
  const monthlyDiscountAmount = money(monthlyDays * daily - monthlyFee)
  const weeklyDiscountAmount = money(weeklyDays * daily - weeklyFee)
  return {
    monthlyDays, weeklyDays, dailyDays, monthlyRate,
    originalAmount, monthlyDiscountAmount, weeklyDiscountAmount,
    total: money(originalAmount - monthlyDiscountAmount - weeklyDiscountAmount),
  }
}

/** Coupon allocation follows the main app's proportional installment allocation. */
export function firstRentalInstallment(total: number, days: number, monthlyRate: number, discount = 0): number {
  const cents = (amount: number) => Math.round(amount * 100)
  const net = Math.max(0, cents(total) - cents(discount))
  if (days <= 30 || !total) return net / 100
  return Math.min(net, Math.round(net * cents(monthlyRate) / cents(total))) / 100
}

export function allocateRentalDiscount(fees: number[], eligible: number[], discount: number): number[] {
  const amounts = fees.map(() => 0)
  const base = eligible.reduce((sum, index) => sum + fees[index], 0)
  let remaining = Math.min(base, Math.max(0, discount))
  const total = remaining
  eligible.forEach((index, position) => {
    amounts[index] = position === eligible.length - 1 ? remaining : Math.round(Math.min(fees[index], base ? total * fees[index] / base : 0) * 100) / 100
    remaining = Math.round((remaining - amounts[index]) * 100) / 100
  })
  return amounts
}
