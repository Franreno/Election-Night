import { test, expect } from "@playwright/test";

const DB_MODE = process.env.E2E_DB; // "clean" | "seeded" | undefined

test.describe("Constituencies page", () => {
  test("shows heading and search input", async ({ page }) => {
    await page.goto("/constituencies");

    await expect(page.getByRole("heading", { name: "Constituencies" })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("shows constituencies table after loading", async ({ page }) => {
    await page.goto("/constituencies");
    await page.waitForLoadState("networkidle");

    // After migration, 650 constituencies are seeded — table should always appear
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
  });

  test.describe("clean database (no results uploaded)", () => {
    test.skip(DB_MODE !== "clean", "Requires E2E_DB=clean");

    test("shows constituencies table with seeded data", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 10_000 });

      // Constituencies exist from migration, but have no votes yet
      const rows = table.locator("tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    });

    test("search filters constituencies by name", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill("Bedford");

      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("table").getByText("Bedford", { exact: true })).toBeVisible();
    });
  });

  test.describe("seeded database", () => {
    test.skip(DB_MODE !== "seeded", "Requires E2E_DB=seeded");

    test("shows constituencies table with vote data", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 10_000 });

      const rows = table.locator("tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    });

    test("search filters constituencies by name", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill("Bedford");

      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("table").getByText("Bedford", { exact: true })).toBeVisible();
    });

    test("search with no results shows empty state", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill("zzzznonexistent");

      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("No results found")).toBeVisible();
    });

    test("clicking a constituency row navigates to detail page", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 10_000 });

      // Rows use onClick with router.push, not <a> links
      const firstRow = table.locator("tbody tr").first();
      await expect(firstRow).toBeVisible();
      await firstRow.click();

      await expect(page).toHaveURL(/\/constituencies\/\d+/);
    });

    test("pagination shows when many results exist", async ({ page }) => {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // With 650 constituencies and default page size, pagination should exist
      const pagination = page.getByRole("button", { name: /next/i })
        .or(page.getByText(/page/i));
      await expect(pagination.first()).toBeVisible();
    });
  });
});
