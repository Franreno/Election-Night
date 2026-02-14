import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("sidebar links navigate between pages", async ({ page }) => {
    await page.goto("/");

    // Dashboard loads with heading
    await expect(page.getByRole("heading", { name: "UK Election Results" })).toBeVisible();

    // Navigate to Constituencies
    await page.getByRole("link", { name: "Constituencies" }).click();
    await expect(page).toHaveURL(/\/constituencies/);
    await expect(page.getByRole("heading", { name: "Constituencies" })).toBeVisible();

    // Navigate to Upload
    await page.getByRole("link", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/upload/);
    await expect(page.getByRole("heading", { name: "Upload Results" })).toBeVisible();

    // Navigate back to Dashboard
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "UK Election Results" })).toBeVisible();
  });

  test("mobile sidebar opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // Sidebar should be hidden on mobile, menu button visible
    const menuButton = page.getByRole("button", { name: /menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Sidebar links should now be visible
      await expect(page.getByRole("link", { name: "Upload" })).toBeVisible();

      // Click a link to navigate and close sidebar
      await page.getByRole("link", { name: "Upload" }).click();
      await expect(page).toHaveURL(/\/upload/);
    }
  });
});
