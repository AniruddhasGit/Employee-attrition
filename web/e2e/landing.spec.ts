import { expect, test } from "@playwright/test";

test("hero shows headline, feature index and primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/why people leave/i);
  for (const label of ["Predict", "Simulate", "Explain", "Retain"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /open the explorer/i }).first()).toBeVisible();
});

test("before/after story moves from the leaky numbers to the honest ones", async ({ page }) => {
  await page.goto("/");
  const story = page.getByTestId("before-after");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toContainText("0.964");
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="before-after"]') as HTMLElement;
    window.scrollTo(0, el.offsetTop + el.offsetHeight - window.innerHeight);
  });
  const after = (await (await page.request.get("http://localhost:8010/api/model/metrics")).json()).after.roc_auc;
  await expect(story).toContainText(after.toFixed(3));
  await expect(story).toContainText(/zeroed/i);
});

test("no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
