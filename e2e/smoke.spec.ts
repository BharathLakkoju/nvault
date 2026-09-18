import { test, expect } from "@playwright/test";

test.describe("marketing pages", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("CLI page describes device-code login", async ({ page }) => {
    await page.goto("/cli");
    await expect(page.getByText(/device-code/i)).toBeVisible();
    await expect(page.getByText("nvault login")).toBeVisible();
  });

  test("login page is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});

test.describe("API health", () => {
  test("health endpoint returns database status", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.status()).toBeLessThan(500);
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("db");
    expect(body).toHaveProperty("timestamp");
  });
});
