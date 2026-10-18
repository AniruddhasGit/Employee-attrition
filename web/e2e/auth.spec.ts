import { expect, test } from "@playwright/test";
import { persona, signInAs } from "./helpers";

test("hr account lands on /hr", async ({ page }) => {
  await signInAs(page, "hr");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});

test("employee account lands on /me", async ({ page }) => {
  await signInAs(page, "stable");
  await expect(page.getByRole("link", { name: "Check-in" })).toBeVisible();
});

test("the sign-in page lists no accounts", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in." })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("@retain.demo")).toHaveCount(0);
  await expect(page.getByText("Sign in as")).toHaveCount(0);
  expect(await page.content()).not.toContain("@retain.demo");
});

test("wrong password shows inline error", async ({ page }) => {
  const p = await persona(page, "hr");
  await page.goto("/login");
  await page.getByLabel("Email").fill(p.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is wrong.");
});

test("signed-out /hr redirects to /login", async ({ page }) => {
  await page.goto("/hr");
  await expect(page).toHaveURL(/\/login\?next=%2Fhr/);
});

test("employee visiting /hr is sent to /me", async ({ page }) => {
  await signInAs(page, "stable");
  await page.goto("/hr");
  await expect(page).toHaveURL(/\/me$/);
});

test("sign out returns to the login page", async ({ page }) => {
  await signInAs(page, "hr");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/hr");
  await expect(page).toHaveURL(/\/login/);
});

test("no page says Try", async ({ page }) => {
  const check = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.locator("body").innerText()).not.toMatch(/\btry\b/i);
  };
  await check("/");
  await check("/login");
  await signInAs(page, "hr");
  await check("/hr");
  await check("/hr/check-ins");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await signInAs(page, "not_answered");
  await check("/me");
  await check("/me/check-in");
});

test("after signing out, another account can sign in and sees only its own area", async ({ page }) => {
  await signInAs(page, "hr");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await signInAs(page, "stable");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check-in" })).toBeVisible();
});

test("an ended session sends the visitor to sign in instead of a dead error", async ({ page, context }) => {
  await signInAs(page, "hr");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await context.clearCookies();
  // Any API call now gets a 401; the page must go to sign in, remembering where it was.
  await page.getByRole("searchbox").first().fill("a");
  await expect(page).toHaveURL(/\/login\?next=%2Fhr/);
});
