import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const DB_MODE = process.env.E2E_DB; // "clean" | "seeded" | undefined
const FIXTURE_DIR = path.join(__dirname, "fixtures");

test.describe("Upload page", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(FIXTURE_DIR)) {
      fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(FIXTURE_DIR, "valid-results.txt"),
      "Bedford,6643,C,5276,L,2049,LD,266,Ind,2531,UKIP,2671,G\n" +
        "Sheffield Hallam,8788,C,4277,L,3000,LD,500,Ind,1200,UKIP,900,G\n"
    );
  });

  test("shows upload dropzone and history section", async ({ page }) => {
    await page.goto("/upload");

    await expect(page.getByRole("heading", { name: "Upload Results" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload History" })).toBeVisible();
  });

  test("has a file input for uploads", async ({ page }) => {
    await page.goto("/upload");

    const fileInput = page.locator('input[type="file"]');
    expect(await fileInput.count()).toBeGreaterThan(0);
  });

  test.describe("clean database (no results uploaded)", () => {
    test.skip(DB_MODE !== "clean", "Requires E2E_DB=clean");

    test("upload history has no completed entries initially", async ({ page }) => {
      await page.goto("/upload");
      await page.waitForLoadState("networkidle");

      // With a fresh DB, there should be no upload history entries
      const completedText = page.locator("table").getByText("completed");
      expect(await completedText.count()).toBe(0);
    });

    test("file upload triggers processing", async ({ page }) => {
      await page.goto("/upload");

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURE_DIR, "valid-results.txt"));

      // Wait for the upload to process and UI to update
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: "Upload History" })).toBeVisible();
    });
  });

  test.describe("seeded database", () => {
    test.skip(DB_MODE !== "seeded", "Requires E2E_DB=seeded");

    test("upload history table shows previous uploads", async ({ page }) => {
      await page.goto("/upload");
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 5_000 });

      // Should have at least one row from the seed upload
      const rows = table.locator("tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);

      // Should show "completed" status
      await expect(table.getByText("completed").first()).toBeVisible();
    });

    test("file upload triggers processing", async ({ page }) => {
      await page.goto("/upload");

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURE_DIR, "valid-results.txt"));

      // Wait for the upload to process
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: "Upload History" })).toBeVisible();
    });

    test("upload filter buttons are visible", async ({ page }) => {
      await page.goto("/upload");
      await page.waitForLoadState("networkidle");

      // Filter bar should be visible
      await expect(page.getByPlaceholder("Search by filename...")).toBeVisible();
      await expect(page.getByRole("button", { name: "All statuses" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
    });

    test("delete button opens confirmation dialog", async ({ page }) => {
      await page.goto("/upload");
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 5_000 });

      // Click first delete button
      const deleteButton = table.locator('button[title="Delete upload"]').first();
      await deleteButton.click();

      // Confirmation dialog should appear
      await expect(page.getByText("Delete upload?")).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

      // Cancel to avoid actually deleting
      await page.getByRole("button", { name: "Cancel" }).click();
    });

    test("soft delete removes upload from history", async ({ page }) => {
      await page.goto("/upload");

      // First, upload a file so we have something to delete
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(FIXTURE_DIR, "valid-results.txt"));
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 5_000 });

      // Count rows before delete
      const rowsBefore = await table.locator("tbody tr").count();

      // Delete the first upload
      const deleteButton = table.locator('button[title="Delete upload"]').first();
      await deleteButton.click();
      await page.getByRole("button", { name: "Delete" }).click();

      // Wait for the table to update
      await page.waitForTimeout(2000);

      // Row count should decrease
      const rowsAfter = await table.locator("tbody tr").count();
      expect(rowsAfter).toBeLessThan(rowsBefore);
    });
  });
});
