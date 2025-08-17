import { test, expect } from '@playwright/test';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '/supichat';

test.describe('UI clickability & basic behaviors', () => {
  test('Home -> create room -> lobby controls -> join -> in-call controls', async ({ page }) => {
    // Home
    await page.goto(`${BASE}`);
    await expect(page.getByRole('heading', { name: /SupiChat/i })).toBeVisible();
    await page.getByRole('button', { name: /New meeting/i }).click();

    // Add e2e=1 to enable mocked lobby readiness
    await page.waitForURL('**/room/*');
    const current = page.url();
    const withFlag = current.includes('?') ? `${current}&e2e=1` : `${current}?e2e=1`;
    await page.goto(withFlag);

    // Lobby controls visible
    await expect(page.getByTestId('name')).toBeVisible();
    await expect(page.getByTestId('lang')).toBeVisible();
    await expect(page.getByTestId('mic-device')).toBeVisible();
    await expect(page.getByTestId('cam-device')).toBeVisible();
    await expect(page.getByTestId('join-btn')).toBeDisabled();

    // Top bar copy button (visible in lobby as well)
    await expect(page.getByTestId('copy-link')).toBeVisible();

    // Fill and join (join becomes enabled once ready=true with fake media)
    await page.getByTestId('name').fill('Tester');
    await page.getByTestId('lang').selectOption('en');
    await expect(page.getByTestId('join-btn')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('join-btn').click();

    // In-call top bar & buttons
    await expect(page.getByTestId('copy-link')).toBeVisible();
    await page.getByTestId('copy-link').click();

    // Bottom controls
    await page.getByTestId('open-chat').click();
    await expect(page.getByTestId('chat-list')).toBeVisible();
  await page.getByTestId('open-people').click();
  await expect(page.getByRole('button', { name: 'Close sidebar' })).toBeVisible();

    // Toggle mic/cam
    await page.getByTestId('toggle-mic').click();
    await page.getByTestId('toggle-cam').click();

    // Send a message
    await page.getByTestId('open-chat').click();
    await page.getByTestId('chat-input').fill('Hello from E2E');
    await page.getByTestId('chat-input').press('Enter');
    await expect(page.getByTestId('chat-list')).toContainText('Hello from E2E');
  });
});


