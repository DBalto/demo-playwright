import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  // The assignment brief specifies the exact filename
  // `test_assignment-workflow_spec.ts`, which uses an underscore rather than
  // a dot before "spec" - broaden Playwright's default *.spec.ts pattern so
  // that file (and any siblings following the same convention) is picked up.
  testMatch: /.*[_.](test|spec)\.[jt]s$/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'https://everwrite.app.newsela.com/assignments',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Only used in sandboxed CI/dev environments that ship a pre-installed
        // Chromium and block the normal Playwright browser download; harmless
        // no-op (undefined) everywhere else, including a normal `npm install`
        // + `npx playwright install` setup.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : undefined,
      },
    },
  ],
});
