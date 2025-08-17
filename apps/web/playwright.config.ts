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
  // Start both the Next.js dev server and the signaling server automatically
  webServer: [
    {
      command: 'npm run dev',
      url: (process.env.PW_BASE_URL || 'http://localhost:3000') + '/supichat/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Run signaling from repo root using --prefix to avoid workspace resolution issues
      command: 'npm --prefix ../../services/signaling start',
      url: 'http://localhost:4001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});


