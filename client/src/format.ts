// Shop times are shown in Swedish time, whatever the visitor's own time zone is
const TIME_ZONE = 'Europe/Stockholm'

// Swedish style, e.g. "45 kr". Menu prices are whole kronor.
const priceFormat = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 })
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
const longDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' })
const isoDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }) // en-CA gives YYYY-MM-DD

export const formatPrice = (cents: number) => priceFormat.format(cents / 100)
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

// "Today", "Tomorrow" or e.g. "Fri 16 Oct", from a Swedish date and one of its slots
export function formatDay(date: string, sampleSlot: string): string {
  const today = isoDateFormat.format(new Date())
  const tomorrow = isoDateFormat.format(new Date(Date.now() + 24 * 60 * 60 * 1000))
  if (date === today) return 'Today'
  if (date === tomorrow) return 'Tomorrow'
  return dayFormat.format(new Date(sampleSlot))
}

export const formatPickup = (iso: string) => `${longDateFormat.format(new Date(iso))} at ${formatTime(iso)}`

// Today's date in Sweden, "YYYY-MM-DD"
export const shopToday = () => isoDateFormat.format(new Date())

export const formatDate = (iso: string) => longDateFormat.format(new Date(iso))
