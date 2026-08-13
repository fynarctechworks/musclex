import { defineConfig, devices } from '@playwright/test';

/**
 * MuscleX admin E2E. Assumes:
 *   - backend running on :4000  (npm --prefix backend run start:dev)
 *   - frontend running on :3000 (npm --prefix frontend run dev)
 * Next dev compiles on first hit, so timeouts are generous.
 */
export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
export const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:4000';
export const E2E_OWNER = {
  email: process.env.E2E_OWNER_EMAIL || 'e2e-owner@musclex.test',
  password: process.env.E2E_OWNER_PASSWORD || 'E2eOwner@12345',
  studioId: process.env.E2E_STUDIO_ID || '00ca8c7f-9df3-4791-95a7-8002c604cead',
  gymSlug: process.env.E2E_GYM_SLUG || 'mama',
};

// Second real owner/studio for genuine cross-tenant isolation tests.
export const E2E_OWNER_B = {
  email: 'e2e-owner-b@musclex.test',
  password: 'E2eOwner@12345',
  studioId: 'e2e00000-0000-4000-8000-0000000000b2',
  gymSlug: 'e2e-studio-b',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'e2e-results.json' }]],
  use: {
    baseURL: FRONTEND_URL,
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
