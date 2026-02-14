import { test, expect } from "@playwright/test";

const DB_MODE = process.env.E2E_DB; // "clean" | "seeded" | undefined

test.describe("Dashboard", () => {
  test("shows heading after page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "UK Election Results" })).toBeVisible();
  });

  test("shows correct state based on database", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // After migration, 650 constituencies exist so the dashboard always shows data layout.
    // Wait for the subtitle with "constituencies declared" to appear.
    await expect(
      page.getByText(/\d+.*constituencies declared/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test.describe("clean database (no results uploaded)", () => {
    test.skip(DB_MODE !== "clean", "Requires E2E_DB=clean");

    test("shows 0 total votes with no results", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/\d+.*constituencies declared/)).toBeVisible({ timeout: 10_000 });

      // Stat cards are visible but total votes should be 0
      await expect(page.getByText("Total Votes Cast")).toBeVisible();
      await expect(page.getByText("Leading Party")).toBeVisible();
    });
  });

  test.describe("seeded database", () => {
    test.skip(DB_MODE !== "seeded", "Requires E2E_DB=seeded");

    test("displays stat cards with real data", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/\d+.*constituencies declared/)).toBeVisible({ timeout: 10_000 });

      await expect(page.getByText("Total Votes Cast")).toBeVisible();
      await expect(page.getByText("Leading Party", { exact: true })).toBeVisible();
    });

    test("displays government status section", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/\d+.*constituencies declared/)).toBeVisible({ timeout: 10_000 });

      await expect(page.getByText("Government Status")).toBeVisible();
      await expect(page.getByText("Majority threshold")).toBeVisible();
    });
  });
});
