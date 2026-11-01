/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export type PickupClosure = { start: string; end: string }
export interface PickupAvailabilityConfig {
  businessHours: { start: string; end: string }
  serviceFeeHours: Array<{ start: string; end: string }>
  unavailablePickupHours?: Array<{ weekday: number; start: string; end: string }>
  unavailablePickupRanges?: PickupClosure[]
}

/** 共享 D1 中的墨尔本本地日期时间，最长一个日历年。 */
export function readPickupClosures(value: unknown): PickupClosure[] {
  if (!Array.isArray(value)) return []
  const validDateTime = (input: unknown): input is string => typeof input === 'string'
    && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):(?:00|30)$/.test(input)
    && Number.isFinite(Date.parse(`${input}:00Z`)) && new Date(`${input}:00Z`).toISOString().slice(0, 16) === input
  return value.filter((range): range is PickupClosure => {
    if (!range || !validDateTime(range.start) || !validDateTime(range.end) || range.end <= range.start) return false
    const year = Number(range.start.slice(0, 4)) + 1, month = Number(range.start.slice(5, 7))
    const day = Math.min(Number(range.start.slice(8, 10)), new Date(Date.UTC(year, month, 0)).getUTCDate())
    const limit = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}${range.start.slice(10)}`
    return range.end <= limit
  }).slice(0, 50).map(range => ({ start: range.start, end: range.end }))
}

/** 自包含实现，供服务器与内联日历共用；休业只限制取还端点。 */
export function createPickupAvailability(config: PickupAvailabilityConfig) {
  const { category, timeUnavailable, periodUnavailable, dateUnavailable } = {
    category(time: string): string {
      for (const range of config.serviceFeeHours) if (range.start <= time && time < range.end) {
        if (range.end <= config.businessHours.start) return 'morning_service'
        if (range.start >= config.businessHours.end) return 'evening_service'
        return 'service_fee'
      }
      return config.businessHours.start <= time && time < config.businessHours.end ? time < '13:00' ? 'morning' : 'afternoon' : ''
    },
    timeUnavailable(date: string, slot: string, blockedSlots: string[] = []): boolean {
      if (blockedSlots.includes(slot)) return true
      if (!/^([01]\d|2[0-3]):(?:00|30)$/.test(slot)) {
        const options = times.filter(time => category(time) === slot)
        return options.length === 0 || options.every(time => timeUnavailable(date, time, blockedSlots))
      }
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
      return blockedSlots.includes(category(slot))
        || (config.unavailablePickupRanges || []).some(range => range.start <= `${date}T${slot}` && `${date}T${slot}` < range.end)
        || (config.unavailablePickupHours || []).some(range => Number(range.weekday) === weekday && range.start <= slot && slot < range.end)
    },
    periodUnavailable(date: string, period: string, blockedSlots: string[] = []): boolean {
      return times.filter(time => (time < '13:00' ? 'AM' : 'PM') === period).every(time => timeUnavailable(date, time, blockedSlots))
    },
    dateUnavailable(date: string, blockedSlots: string[] = []): boolean {
      return times.every(time => timeUnavailable(date, time, blockedSlots))
    },
  }
  const times = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`).filter(time => Boolean(category(time)))
  return { timeUnavailable, periodUnavailable, dateUnavailable }
}
