import { expect, test } from '@playwright/test'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd(), '..')
const sample = (name: string) => path.join(repoRoot, 'sample_data', name)

async function openWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/app')
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible()
  await expect(page.locator('input[type="file"]')).toHaveCount(1)
}

async function uploadSamples(page: import('@playwright/test').Page) {
  await page.locator('input[type="file"]').setInputFiles([
    sample('sales.csv'),
    sample('customers.csv'),
    sample('products.csv'),
  ])
  await expect(page.getByText('sales.csv', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('customers.csv', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('products.csv', { exact: true }).first()).toBeVisible()
}

test('uploads all sample files and renders schema profile cards', async ({ page }) => {
  await openWorkspace(page)
  await uploadSamples(page)

  await expect(page.getByText('2K rows · 9 cols', { exact: true })).toBeVisible()
})

test('provider failure is a clean UI error with Retry', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/sessions/*/chat', async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.abort('failed')
      return
    }
    const body = [
            'event: status',
            'data: {"message":"Received message"}',
            '',
            'event: final',
            'data: {"final":{"answer":"Recovered.","insights":[],"sql":"SELECT 1","pandas_code":null,"charts":[],"tables":[],"anomalies":[],"reasoning":[],"follow_up_suggestions":[]},"iterations":1}',
            '',
          ].join('\n')
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    })
  })

  await openWorkspace(page)
  await uploadSamples(page)
  await page.getByRole('textbox', { name: 'Message' }).fill('How many rows?')
  await page.getByRole('button', { name: 'Send message' }).click()

  const alert = page.getByRole('alert').filter({ hasText: 'Stream interrupted' })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible()
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect.poll(() => attempts).toBe(2)
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible()
})

test('Stop cancels an in-flight streaming request', async ({ page }) => {
  await page.route('**/api/sessions/*/chat', async () => {
    await new Promise<void>(() => undefined)
  })

  await openWorkspace(page)
  await uploadSamples(page)
  await page.getByRole('textbox', { name: 'Message' }).fill('Long running analysis')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop generating' }).click()
  await expect(page.getByText('Stopped. Ask a follow-up whenever you are ready.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
})
