// Pickup time rules. All shop hours are Swedish local time; times sent to and
// from the client are UTC ISO strings, so the browser's time zone never matters.

export const TIME_ZONE = 'Europe/Stockholm'
export const SLOT_MINUTES = 15
export const LEAD_MINUTES = 60
export const DAYS_AHEAD = 7

type Hours = { opensAt: string; closesAt: string }

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

// The Swedish calendar date and wall-clock time of an instant
function localParts(instant: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

// Minutes Sweden is ahead of UTC at an instant (60 in winter, 120 in summer)
function offsetMinutes(instant: Date): number {
  const p = localParts(instant)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minutes)
  return Math.round((asUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000)
}

// The instant when Swedish clocks show this date and time
function localToInstant(year: number, month: number, day: number, minutes: number): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minutes)
  const first = new Date(guess - offsetMinutes(new Date(guess)) * 60000)
  // Re-check once in case the guess and the result fall either side of a clock change
  return new Date(guess - offsetMinutes(first) * 60000)
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

export type PickupDay = { date: string; slots: Date[] }

// Bookable pickup times for the next DAYS_AHEAD days, grouped by Swedish date.
// The last slot is SLOT_MINUTES before closing; the first is at least LEAD_MINUTES from now.
export function pickupSlots(hours: Hours, now: Date): PickupDay[] {
  const earliest = now.getTime() + LEAD_MINUTES * 60000
  const today = localParts(now)
  const days: PickupDay[] = []

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const calendarDay = new Date(Date.UTC(today.year, today.month - 1, today.day + offset))
    const [year, month, day] = [calendarDay.getUTCFullYear(), calendarDay.getUTCMonth() + 1, calendarDay.getUTCDate()]
    const slots: Date[] = []
    for (let m = toMinutes(hours.opensAt); m + SLOT_MINUTES <= toMinutes(hours.closesAt); m += SLOT_MINUTES) {
      const slot = localToInstant(year, month, day, m)
      if (slot.getTime() >= earliest) slots.push(slot)
    }
    if (slots.length > 0) days.push({ date: calendarDay.toISOString().slice(0, 10), slots })
  }
  return days
}

// The UTC instants when a Swedish calendar date ("YYYY-MM-DD") starts and the next one starts
export function shopDayRange(date: string): { start: Date; end: Date } {
  const [year, month, day] = date.split('-').map(Number)
  return { start: localToInstant(year, month, day, 0), end: localToInstant(year, month, day + 1, 0) }
}

// Today's date in Sweden, "YYYY-MM-DD"
export function shopToday(now: Date): string {
  const { year, month, day } = localParts(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isPickupAllowed(hours: Hours, pickupAt: Date, now: Date): boolean {
  return pickupSlots(hours, now).some((day) => day.slots.some((slot) => slot.getTime() === pickupAt.getTime()))
}
