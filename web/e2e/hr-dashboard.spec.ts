import { expect, test } from "@playwright/test";
import { persona, signInAs } from "./helpers";

const nameOf = (label: string) => label.split(" · ")[0];

test.beforeEach(async ({ page }) => {
  await signInAs(page, "hr");
});

test("sharp drops section names the sharp_drop persona", async ({ page }) => {
  const p = await persona(page, "sharp_drop");
  const section = page.getByRole("region", { name: "Sharp drops since last check-in" });
  await expect(section).toBeVisible();
  await expect(section.getByText(nameOf(p.label), { exact: true })).toBeVisible();
});

test("cost at stake follows the replacement slider", async ({ page }) => {
  const cost = page.getByTestId("cost-at-stake");
  await expect(cost).toHaveAttribute("data-value", /\d+/);
  const before = await cost.getAttribute("data-value");
  const slider = page.getByLabel("Replacement cost");
  await slider.focus();
  for (let i = 0; i < 5; i++) await slider.press("ArrowRight");
  await expect(cost).not.toHaveAttribute("data-value", before!);
  expect(Number(await cost.getAttribute("data-value"))).toBeGreaterThan(Number(before));
});

test("searching a surname filters the people table", async ({ page }) => {
  const p = await persona(page, "stable");
  const name = nameOf(p.label);
  const surname = name.split(" ").at(-1)!;
  await page.getByRole("searchbox", { name: "Search people" }).fill(surname);
  const rows = page.getByTestId("person-row");
  await expect(rows.filter({ hasText: name })).toHaveCount(1);
  for (const text of await rows.allTextContents()) expect(text).toContain(surname);
});

test("clicking a row opens that person's page", async ({ page }) => {
  const first = page.getByTestId("person-row").first();
  await expect(first).toBeVisible();
  const id = await first.getAttribute("data-id");
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/hr/people/${id}$`));
});

test("dashboard has no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("cost-at-stake")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
