import { expect, test } from "@playwright/test";

test("landing shows a calm error when the API is down", async ({ page }) => {
  await page.route("**/api/public/summary", (route) => route.abort());
  await page.goto("/");
  await page.getByTestId("before-after").scrollIntoViewIfNeeded();
  await expect(page.getByRole("alert").filter({ hasText: "Can't reach the model right now" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /reload/i }).first()).toBeVisible();
});

test("reduced motion: hero letters are not transformed", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/");
  await page.waitForTimeout(500);
  const transforms = await page.evaluate(() =>
    [...document.querySelectorAll("#main section:first-of-type span.inline-block span.inline-block")]
      .map((el) => getComputedStyle(el).transform)
      .filter((t) => t !== "none"),
  );
  expect(transforms).toEqual([]);
  await context.close();
});

test("unknown routes get the site's not-found page", async ({ page }) => {
  const res = await page.goto("/nope-nothing-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /back to the start/i })).toBeVisible();
});
