import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});


