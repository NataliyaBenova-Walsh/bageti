import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DAYS_AHEAD, isPickupAllowed, pickupSlots } from './pickup.js'

const hours = { opensAt: '08:00', closesAt: '20:00' }

test('slots use Sofia time in summer (UTC+3)', () => {
  // 06:00 Sofia on a July morning, before opening
  const days = pickupSlots(hours, new Date('2026-07-15T03:00:00Z'))
  assert.equal(days[0].date, '2026-07-15')
  assert.equal(days[0].slots[0].toISOString(), '2026-07-15T05:00:00.000Z') // 08:00 Sofia
  assert.equal(days[0].slots.at(-1)?.toISOString(), '2026-07-15T16:45:00.000Z') // 19:45 Sofia
  assert.equal(days[0].slots.length, 48)
})

test('slots use Sofia time in winter (UTC+2)', () => {
  const days = pickupSlots(hours, new Date('2026-12-01T04:00:00Z'))
  assert.equal(days[0].slots[0].toISOString(), '2026-12-01T06:00:00.000Z') // 08:00 Sofia
})

test('the first slot is at least an hour away, on a slot boundary', () => {
  // 10:05 Sofia, so 11:05 is the earliest and 11:15 the first slot
  const days = pickupSlots(hours, new Date('2026-07-15T07:05:00Z'))
  assert.equal(days[0].slots[0].toISOString(), '2026-07-15T08:15:00.000Z')
})

test('late in the evening, today is skipped', () => {
  // 19:30 Sofia: no slot today is an hour away
  const days = pickupSlots(hours, new Date('2026-07-15T16:30:00Z'))
  assert.equal(days[0].date, '2026-07-16')
  assert.equal(days.length, DAYS_AHEAD - 1)
})

test('the week ahead crosses the clocks going back in October', () => {
  const days = pickupSlots(hours, new Date('2026-10-22T05:00:00Z'))
  const afterChange = days.find((day) => day.date === '2026-10-26')
  assert.equal(afterChange?.slots[0].toISOString(), '2026-10-26T06:00:00.000Z') // 08:00 Sofia, now UTC+2
})

test('isPickupAllowed accepts real slots and rejects everything else', () => {
  const now = new Date('2026-07-15T03:00:00Z')
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T05:00:00Z'), now), true)
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T05:05:00Z'), now), false) // not on a slot
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T17:00:00Z'), now), false) // 20:00, closing time
  assert.equal(isPickupAllowed(hours, new Date('2026-07-15T03:30:00Z'), now), false) // before opening
  assert.equal(isPickupAllowed(hours, new Date('2026-07-25T05:00:00Z'), now), false) // too far ahead
})
