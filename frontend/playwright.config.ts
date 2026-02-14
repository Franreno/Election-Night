import { defineConfig, devices } from "@playwright/test";

const dbMode = process.env.E2E_DB; // "clean" | "seeded" | undefined

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,

  // When running as part of a merged run, output blob for later merging.
  // When running standalone, output html directly.
  // When running as part of clean/seeded cycle, output blob for later merging.
  // All blobs go to the same flat directory so merge-reports can find them.
  reporter: dbMode
    ? [["blob", { outputDir: "./blob-report" }], ["list"]]
    : "html",

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Uncomment to auto-start services with `docker compose up`
  // webServer: {
  //   command: "docker compose up",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  //   cwd: "..",
  // },
});
