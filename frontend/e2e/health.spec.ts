import { test, expect } from "@playwright/test";

test.describe("API Health", () => {
  test("backend health endpoint returns ok", async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const resp = await request.get(`${apiBase}/api/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe("ok");
  });
});
