import { test, expect } from '@playwright/test';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '/supichat';

test('Two clients join and see 2 participants', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  // Create room on page1
  await page1.goto(`${BASE}`);
  await page1.getByRole('button', { name: /New meeting/i }).click();
  await page1.waitForURL('**/room/*');
  await page1.goto(page1.url() + (page1.url().includes('?') ? '&' : '?') + 'e2e=1');
  await page1.getByTestId('name').fill('Host');
  await page1.getByTestId('lang').selectOption('en');
  await expect(page1.getByTestId('join-btn')).toBeEnabled({ timeout: 15000 });
  await page1.getByTestId('join-btn').click();

  // Join same room on page2
  const roomUrl = page1.url();
  await page2.goto(roomUrl);
  await page2.goto(page2.url() + (page2.url().includes('?') ? '&' : '?') + 'e2e=1');
  await page2.getByTestId('name').fill('Guest');
  await page2.getByTestId('lang').selectOption('en');
  await expect(page2.getByTestId('join-btn')).toBeEnabled({ timeout: 15000 });
  await page2.getByTestId('join-btn').click();

  // Check participants badge shows 2 on both
  await page1.getByTestId('open-people').click();
  await expect(page1.getByRole('button', { name: 'Close sidebar' })).toBeVisible();
  await expect(page1.getByTestId('open-people').getByText('2')).toBeVisible();

  await page2.getByTestId('open-people').click();
  await expect(page2.getByRole('button', { name: 'Close sidebar' })).toBeVisible();
  await expect(page2.getByTestId('open-people').getByText('2')).toBeVisible();
});
