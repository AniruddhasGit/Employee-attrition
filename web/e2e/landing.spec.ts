import { expect, test } from "@playwright/test";

test("hero shows headline, feature index and primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/why people leave/i);
  for (const label of ["Check in", "Predict", "Act", "Retain"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /^sign in/i }).first()).toBeVisible();
});

test("before/after story moves from the leaky numbers to the honest ones", async ({ page }) => {
  const { metrics: m } = await (await page.request.get("http://localhost:8010/api/public/summary")).json();
  await page.goto("/");
  const story = page.getByTestId("before-after");
  const slider = story.getByRole("slider", { name: "Compare the original notebook with the honest model" });
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuetext", "Honest model");
  await expect(story).toContainText(m.after.roc_auc.toFixed(3));
  await expect(story).toContainText(/zeroed/i);
  await slider.press("Home");
  await expect(slider).toHaveAttribute("aria-valuetext", "Original notebook");
  await expect(story).toContainText(m.before.roc_auc.toFixed(3));
});

test("no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
