import { expect, test } from "@playwright/test";

test("hero draws the crowd on a canvas and no longer carries the drawn ellipse", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("section[aria-labelledby='hero-title']");
  await expect(hero).toBeVisible();
  await expect(hero.locator("ellipse")).toHaveCount(0);

  const crowd = hero.locator("canvas[data-hero-crowd]");
  await expect(crowd).toHaveAttribute("aria-hidden", "true");
  const box = (await crowd.boundingBox())!;
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
  // The crowd actually painted something.
  await expect
    .poll(() => crowd.getAttribute("data-count"))
    .toBe("1233");
});

test("crowd thins out on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const crowd = page.locator("canvas[data-hero-crowd]");
  await expect.poll(() => crowd.getAttribute("data-count")).toBe("400");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("reduced motion paints a single still frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const crowd = page.locator("canvas[data-hero-crowd]");
  await expect.poll(() => crowd.getAttribute("data-frames")).toBe("1");
  await page.waitForTimeout(400);
  await expect(crowd).toHaveAttribute("data-frames", "1");
});
