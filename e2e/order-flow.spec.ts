import { expect, test } from '@playwright/test'
import { STAFF_LOGIN } from './accounts'

test('a customer orders, and staff start preparing the order', async ({ page, browser }) => {
  // Customer: fill the cart from the menu
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Cinnamon Bun to cart' }).click()
  await page.getByRole('button', { name: 'Add Cinnamon Bun to cart' }).click()
  await page.getByRole('button', { name: 'Add Croissant to cart' }).click()
  await expect(page.getByRole('link', { name: /Cart/ })).toContainText('3')

  // Checkout: shop, first available day and time, contact details
  await page.getByRole('link', { name: /Cart/ }).click()
  await page.getByLabel(/Fika Gothenburg/).check()
  const day = page.getByLabel('Day')
  await expect(day).toBeEnabled()
  const pickupDate = await day.inputValue()
  await page.getByLabel('Time').selectOption({ index: 1 })
  await page.getByLabel('Name').fill('Astrid Lindqvist')
  await page.getByLabel('Email').fill('astrid@example.com')
  await page.getByLabel('Phone').fill('+46 70 174 06 05')
  await expect(page.getByRole('button', { name: /Place order/ })).toContainText('108 kr') // 2 × 38 + 32
  await page.getByRole('button', { name: /Place order/ }).click()

  // Confirmation with the order code; the cart is now empty
  await expect(page.getByRole('heading', { name: 'Thank you, Astrid Lindqvist!' })).toBeVisible()
  const code = (await page.getByText(/^FK-/).innerText()).trim()
  await expect(page.getByText('Fika Gothenburg', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: /Cart/ })).not.toContainText('(')

  // Staff, in a separate browser session: log in, find the order, start preparing it
  const staff = await (await browser.newContext()).newPage()
  await staff.goto('/admin')
  await expect(staff).toHaveURL(/\/admin\/login/)
  await staff.getByLabel('Email').fill(STAFF_LOGIN.email)
  await staff.getByLabel('Password').fill(STAFF_LOGIN.password)
  await staff.getByRole('button', { name: 'Log in' }).click()
  await expect(staff.getByRole('heading', { name: 'Orders' })).toBeVisible()
  await staff.getByLabel('Day').fill(pickupDate)

  const card = staff.getByRole('listitem').filter({ hasText: code })
  await expect(card).toContainText('Astrid Lindqvist')
  await expect(card).toContainText('New')
  await card.getByRole('button', { name: 'Start preparing' }).click()
  await expect(card).toContainText('Preparing')
  await expect(card.getByRole('button', { name: 'Mark ready' })).toBeVisible()

  // Staff can't edit product details
  await staff.getByRole('link', { name: 'Products' }).click()
  await expect(staff.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(staff.getByRole('button', { name: 'Edit' })).toHaveCount(0)
})
