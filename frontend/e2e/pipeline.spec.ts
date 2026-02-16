import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const DB_MODE = process.env.E2E_DB;
const FIXTURE_DIR = path.join(__dirname, "fixtures");

/**
 * Full pipeline E2E test:
 *   1. Verify clean state (no votes)
 *   2. Upload file 1 (12 constituencies, one per region)
 *   3. Verify upload processed correctly
 *   4. Verify each constituency has correct data & winner
 *   5. Upload file 2 (6 updates + 6 new)
 *   6. Verify updates, untouched, and new constituencies
 *   7. Delete upload 1 → verify soft-delete invalidates results
 */

// --- Test Data ---

interface ConstituencyExpectation {
  name: string;
  regionId: number;
  winner: string; // Full party name as displayed in PartyBadge
  totalVotes: number;
}

// File 1: 12 constituencies, one per region
const FILE_1_DATA: ConstituencyExpectation[] = [
  { name: "Berwick-upon-Tweed", regionId: 1, winner: "Conservative Party", totalVotes: 16800 },
  { name: "Barrow and Furness", regionId: 2, winner: "Labour Party", totalVotes: 17500 },
  { name: "Barnsley Central", regionId: 3, winner: "Labour Party", totalVotes: 16200 },
  { name: "Amber Valley", regionId: 4, winner: "Conservative Party", totalVotes: 17600 },
  { name: "Aldridge-Brownhills", regionId: 5, winner: "Conservative Party", totalVotes: 15650 },
  { name: "Bedford", regionId: 6, winner: "Labour Party", totalVotes: 15300 },
  { name: "Barking", regionId: 7, winner: "Labour Party", totalVotes: 18200 },
  { name: "Aldershot", regionId: 8, winner: "Conservative Party", totalVotes: 19500 },
  { name: "Bath", regionId: 9, winner: "Liberal Democrats", totalVotes: 18100 },
  { name: "Aberavon", regionId: 10, winner: "Labour Party", totalVotes: 15650 },
  { name: "Aberdeen North", regionId: 11, winner: "SNP", totalVotes: 17000 },
  { name: "Belfast East", regionId: 12, winner: "Conservative Party", totalVotes: 16500 },
];

// File 2: 6 updates to existing + 6 brand new
const FILE_2_UPDATES: ConstituencyExpectation[] = [
  { name: "Berwick-upon-Tweed", regionId: 1, winner: "Labour Party", totalVotes: 17800 },
  { name: "Barrow and Furness", regionId: 2, winner: "Conservative Party", totalVotes: 18500 },
  { name: "Barnsley Central", regionId: 3, winner: "Labour Party", totalVotes: 18500 },
  { name: "Amber Valley", regionId: 4, winner: "Conservative Party", totalVotes: 19900 },
  { name: "Aldridge-Brownhills", regionId: 5, winner: "Conservative Party", totalVotes: 17000 },
  { name: "Bedford", regionId: 6, winner: "Labour Party", totalVotes: 18100 },
];

const FILE_2_NEW: ConstituencyExpectation[] = [
  { name: "Bishop Auckland", regionId: 1, winner: "Labour Party", totalVotes: 15500 },
  { name: "Ashton-under-Lyne", regionId: 2, winner: "Labour Party", totalVotes: 14800 },
  { name: "Batley and Spen", regionId: 3, winner: "Labour Party", totalVotes: 16300 },
  { name: "Ashfield", regionId: 4, winner: "Conservative Party", totalVotes: 16300 },
  { name: "Braintree", regionId: 6, winner: "Conservative Party", totalVotes: 15700 },
  { name: "Battersea", regionId: 7, winner: "Labour Party", totalVotes: 18200 },
];

// The 6 constituencies from file 1 that are NOT in file 2 (only touched by upload 1)
const FILE_1_ONLY = FILE_1_DATA.filter(
  (c) => !FILE_2_UPDATES.some((u) => u.name === c.name)
);

const FILE_1_CONTENT = [
  "Berwick-upon-Tweed,8000,C,5000,L,2000,LD,500,Ind,300,UKIP,1000,G",
  "Barrow and Furness,4000,C,9000,L,3000,LD,200,Ind,500,UKIP,800,G",
  "Barnsley Central,3000,C,10000,L,1500,LD,400,Ind,600,UKIP,700,G",
  "Amber Valley,7500,C,6000,L,2500,LD,300,Ind,400,UKIP,900,G",
  "Aldridge-Brownhills,8500,C,4000,L,1800,LD,250,Ind,350,UKIP,750,G",
  "Bedford,5000,C,7000,L,2000,LD,300,Ind,400,UKIP,600,G",
  "Barking,3500,C,11000,L,2500,LD,600,Ind,200,UKIP,400,G",
  "Aldershot,9500,C,5500,L,3000,LD,400,Ind,250,UKIP,850,G",
  "Bath,4000,C,5000,L,8000,LD,300,Ind,200,UKIP,600,G",
  "Aberavon,2000,C,10500,L,1500,LD,800,Ind,350,UKIP,500,G",
  "Aberdeen North,2500,C,4000,L,1000,LD,300,Ind,200,UKIP,9000,SNP",
  "Belfast East,7000,C,5000,L,3000,LD,500,Ind,400,UKIP,600,G",
].join("\n") + "\n";

const FILE_2_CONTENT = [
  // 6 updates (same names, different votes)
  "Berwick-upon-Tweed,5000,C,9000,L,2000,LD,500,Ind,300,UKIP,1000,G",
  "Barrow and Furness,10000,C,4000,L,3000,LD,200,Ind,500,UKIP,800,G",
  "Barnsley Central,3500,C,11000,L,2000,LD,500,Ind,700,UKIP,800,G",
  "Amber Valley,8000,C,7000,L,3000,LD,400,Ind,500,UKIP,1000,G",
  "Aldridge-Brownhills,9000,C,4500,L,2000,LD,300,Ind,400,UKIP,800,G",
  "Bedford,6000,C,8000,L,2500,LD,400,Ind,500,UKIP,700,G",
  // 6 new constituencies
  "Bishop Auckland,6000,C,7000,L,1500,LD,300,Ind,200,UKIP,500,G",
  "Ashton-under-Lyne,3000,C,8500,L,2000,LD,400,Ind,300,UKIP,600,G",
  "Batley and Spen,5500,C,6500,L,3000,LD,200,Ind,400,UKIP,700,G",
  "Ashfield,7000,C,5500,L,2500,LD,300,Ind,200,UKIP,800,G",
  "Braintree,8000,C,4500,L,2000,LD,250,Ind,350,UKIP,600,G",
  "Battersea,4000,C,9500,L,3500,LD,500,Ind,300,UKIP,400,G",
].join("\n") + "\n";

const FILE_1_NAME = "pipeline-upload-1.txt";
const FILE_2_NAME = "pipeline-upload-2.txt";

// --- Helpers ---

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

// --- Tests ---

test.describe("Full pipeline", () => {
  test.skip(DB_MODE !== "clean", "Requires E2E_DB=clean");

  test.beforeAll(() => {
    if (!fs.existsSync(FIXTURE_DIR)) {
      fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(FIXTURE_DIR, FILE_1_NAME), FILE_1_CONTENT);
    fs.writeFileSync(path.join(FIXTURE_DIR, FILE_2_NAME), FILE_2_CONTENT);
  });

  test("step 1: clean state — constituencies have no votes", async ({ page }) => {
    await page.goto("/constituencies");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

    // Search for a known constituency
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("Berwick-upon-Tweed");
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle");

    // Should exist but have 0 total votes
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Berwick-upon-Tweed")).toBeVisible();
    await expect(row.getByText("0")).toBeVisible();
  });

  test("step 2: upload file 1 — 12 constituencies processed", async ({ page }) => {
    await page.goto("/upload");
    await page.waitForLoadState("networkidle");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURE_DIR, FILE_1_NAME));

    // Wait for upload to complete
    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("12 lines processed")).toBeVisible();

    // Verify upload appears in history as completed
    await expect(page.locator("table").getByText("completed").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("table").getByText(FILE_1_NAME).first()).toBeVisible();
  });

  test("step 3: verify upload 1 data — each constituency has correct winner", async ({ page }) => {
    for (const c of FILE_1_DATA) {
      await page.goto(`/constituencies?regions=${c.regionId}`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText(c.winner)).toBeVisible();
      await expect(row.getByText(formatNumber(c.totalVotes))).toBeVisible();
    }
  });

  test("step 4: upload file 2 — 6 updates + 6 new processed", async ({ page }) => {
    await page.goto("/upload");
    await page.waitForLoadState("networkidle");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURE_DIR, FILE_2_NAME));

    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("12 lines processed")).toBeVisible();

    await expect(page.locator("table").getByText(FILE_2_NAME).first()).toBeVisible({ timeout: 5_000 });
  });

  test("step 5: verify updated constituencies have new values", async ({ page }) => {
    for (const c of FILE_2_UPDATES) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText(c.winner)).toBeVisible();
      await expect(row.getByText(formatNumber(c.totalVotes))).toBeVisible();
    }
  });

  test("step 6: verify untouched constituencies retain original values", async ({ page }) => {
    for (const c of FILE_1_ONLY) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText(c.winner)).toBeVisible();
      await expect(row.getByText(formatNumber(c.totalVotes))).toBeVisible();
    }
  });

  test("step 7: verify new constituencies from file 2 exist", async ({ page }) => {
    for (const c of FILE_2_NEW) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText(c.winner)).toBeVisible();
      await expect(row.getByText(formatNumber(c.totalVotes))).toBeVisible();
    }
  });

  test("step 8: delete upload 1 from history", async ({ page }) => {
    await page.goto("/upload");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 5_000 });

    // Count rows before delete
    const rowsBefore = await table.locator("tbody tr").count();

    // Find the first row with file 1 name and delete it
    const file1Row = table.locator("tbody tr", { hasText: FILE_1_NAME }).first();
    await expect(file1Row).toBeVisible();

    const deleteButton = file1Row.locator('button[title="Delete upload"]');
    await deleteButton.click();

    // Confirm deletion
    await expect(page.getByText("Delete upload?")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Wait for table to refresh
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    // Row count should decrease by 1
    const rowsAfter = await table.locator("tbody tr").count();
    expect(rowsAfter).toBe(rowsBefore - 1);

    // File 2 should still be there
    await expect(table.getByText(FILE_2_NAME).first()).toBeVisible();
  });

  test("step 9a: after delete — upload-1-only constituencies have 0 votes", async ({ page }) => {
    // The 6 constituencies that were only in upload 1 should now show 0 votes
    // because their results are linked to the soft-deleted upload
    for (const c of FILE_1_ONLY) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      // Total votes should now be 0
      await expect(row.getByText("0")).toBeVisible();
    }
  });

  test("step 9b: after delete — updated constituencies keep file 2 values", async ({ page }) => {
    // The 6 constituencies updated by file 2 should retain file 2 values
    // because their results' upload_id points to upload 2 (not deleted)
    for (const c of FILE_2_UPDATES) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText(c.winner)).toBeVisible();
      await expect(row.getByText(formatNumber(c.totalVotes))).toBeVisible();
    }
  });

  test("step 9c: after delete — new constituencies from file 2 unchanged", async ({ page }) => {
    // The 6 new constituencies from file 2 should be completely unaffected
    for (const c of FILE_2_NEW) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText(c.winner)).toBeVisible();
      await expect(row.getByText(formatNumber(c.totalVotes))).toBeVisible();
    }
  });

  test("step 10: cleanup — delete upload 2 to return to empty state", async ({ page }) => {
    await page.goto("/upload");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 5_000 });

    // Delete remaining upload(s) one by one
    let deleteButton = table.locator('button[title="Delete upload"]').first();
    while (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      await expect(page.getByText("Delete upload?")).toBeVisible();
      await page.getByRole("button", { name: "Delete" }).click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle");
      deleteButton = table.locator('button[title="Delete upload"]').first();
    }

    // Verify empty state — no upload history
    await expect(page.getByText("No uploads yet")).toBeVisible({ timeout: 5_000 });

    // Verify ALL constituencies are back to 0 votes — check every constituency
    // that was touched by either upload (file 1 + file 2 updates + file 2 new)
    const allConstituencies = [...FILE_1_DATA, ...FILE_2_NEW];
    for (const c of allConstituencies) {
      await page.goto("/constituencies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill(c.name);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");

      const row = page.locator("table tbody tr").first();
      await expect(row.getByText(c.name)).toBeVisible({ timeout: 5_000 });
      await expect(row.getByText("0")).toBeVisible();
    }
  });
});
