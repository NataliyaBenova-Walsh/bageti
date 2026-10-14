import assert from 'node:assert/strict'
import { test } from 'vitest'
import { DAYS_AHEAD, isPickupAllowed, pickupSlots, shopDayRange, shopToday } from './pickup.js'

const hours = { opensAt: '08:00', closesAt: '18:00' }

test('slots use Swedish time in summer (UTC+2)', () => {
  // 06:00 in Sweden on a July morning, before opening
  const days = pickupSlots(hours, new Date('2026-07-15T04:00:00Z'))
  assert.equal(days[0].date, '2026-07-15')
  assert.equal(days[0].slots[0].toISOString(), '2026-07-15T06:00:00.000Z') // 08:00
  assert.equal(days[0].slots.at(-1)?.toISOString(), '2026-07-15T15:45:00.000Z') // 17:45
  assert.equal(days[0].slots.length, 40)
})

test('slots use Swedish time in winter (UTC+1)', () => {
  const days = pickupSlots(hours, new Date('2026-12-01T05:00:00Z'))
  assert.equal(days[0].slots[0].toISOString(), '2026-12-01T07:00:00.000Z') // 08:00
})

test('the first slot is at least an hour away, on a slot boundary', () => {
  // 10:05, so 11:05 is the earliest and 11:15 the first slot
  const days = pickupSlots(hours, new Date('2026-07-15T08:05:00Z'))
  assert.equal(days[0].slots[0].toISOString(), '2026-07-15T09:15:00.000Z')
})

test('late in the afternoon, today is skipped', () => {
  // 17:30: no slot today is an hour away
  const days = pickupSlots(hours, new Date('2026-07-15T15:30:00Z'))
  assert.equal(days[0].date, '2026-07-16')
  assert.equal(days.length, DAYS_AHEAD - 1)
})

test('the week ahead crosses the clocks going back in October', () => {
  const days = pickupSlots(hours, new Date('2026-10-22T05:00:00Z'))
  const afterChange = days.find((day) => day.date === '2026-10-26')
  assert.equal(afterChange?.slots[0].toISOString(), '2026-10-26T07:00:00.000Z') // 08:00, now UTC+1
})

test('isPickupAllowed accepts real slots and rejects everything else', () => {
  const now = new Date('2026-07-15T04:00:00Z')
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T06:00:00Z'), now), true)
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T06:05:00Z'), now), false) // not on a slot
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T16:00:00Z'), now), false) // 18:00, closing time
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T05:30:00Z'), now), false) // before opening
  assert.equal(isPickupAllowed(hours, new Date('2026-07-25T06:00:00Z'), now), false) // too far ahead
})

test('shopDayRange covers one Swedish day, including the 25-hour day when clocks go back', () => {
  const summer = shopDayRange('2026-07-15')
  assert.equal(summer.start.toISOString(), '2026-07-14T22:00:00.000Z')
  assert.equal(summer.end.toISOString(), '2026-07-15T22:00:00.000Z')
  const change = shopDayRange('2026-10-25')
  assert.equal(change.end.getTime() - change.start.getTime(), 25 * 60 * 60 * 1000)
})

test('shopToday is already the next day just after midnight Swedish time', () => {
  assert.equal(shopToday(new Date('2026-07-15T22:30:00Z')), '2026-07-16')
})
