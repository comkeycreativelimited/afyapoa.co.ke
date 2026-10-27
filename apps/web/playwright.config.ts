import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Desktop Workstation',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Clinical Tablet',
      use: { ...devices['iPad Pro 11'], defaultBrowserType: 'chromium', viewport: { width: 834, height: 1194 } },
    },
    {
      name: 'Low-End Android Device',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run start',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
