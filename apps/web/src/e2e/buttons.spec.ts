import { test, expect } from '@playwright/test';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '/supichat';

test.describe('UI clickability & basic behaviors', () => {
  test('Home -> create room -> lobby controls -> join -> in-call controls', async ({ page, context }) => {
    // Home
    await page.goto(`${BASE}`);
    await expect(page.getByRole('heading', { name: /SupiChat/i })).toBeVisible();
    await page.getByRole('button', { name: /start a room/i }).click();
    // Add e2e=1 to enable mocked lobby readiness
    await page.waitForURL('**/room/*');
    const current = page.url();
    const withFlag = current.includes('?') ? `${current}&e2e=1` : `${current}?e2e=1`;
    await page.goto(withFlag);

    // We will land in a room path; allow camera/mic prompt to be ignored in headless
    // Lobby controls visible
    await expect(page.getByTestId('name')).toBeVisible();
    await expect(page.getByTestId('lang')).toBeVisible();
    await expect(page.getByTestId('mic-device')).toBeVisible();
    await expect(page.getByTestId('cam-device')).toBeVisible();
    await expect(page.getByTestId('spk-device')).toBeVisible();
    await expect(page.getByTestId('copy-room-link')).toBeVisible();

    // Fill and join (join becomes enabled once ready=true with fake media)
    await page.getByTestId('name').fill('Tester');
    await page.getByTestId('lang').selectOption('en');
    await page.getByTestId('join-btn').waitFor({ state: 'attached' });
    await expect(page.getByTestId('join-btn')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('join-btn').click();

    // In-call top bar & buttons
    await expect(page.getByText(/Room/)).toBeVisible();
    await page.getByTestId('copy-link').click();

    // Bottom controls
    await page.getByTestId('open-chat').click();
    await expect(page.getByTestId('chat-list')).toBeVisible();
    await page.getByTestId('open-people').click();
    await expect(page.getByText(/in room/)).toBeVisible();

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


