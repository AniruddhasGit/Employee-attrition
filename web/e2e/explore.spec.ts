import { expect, test } from "@playwright/test";

test("filtering to the high band shows only high-risk people", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: "High", exact: true }).click();
  const cards = page.getByTestId("person-card");
  await expect(cards.first()).toBeVisible();
  const bands = await cards.getByTestId("band").allTextContents();
  expect(bands.length).toBeGreaterThan(0);
  expect(new Set(bands)).toEqual(new Set(["High"]));
});

test("employee 1004: stored score, overtime off lowers it, scenario can be shared", async ({ page }) => {
  await page.goto("/explore/1004");
  const score = page.getByTestId("sim-after");
  await expect(score).toHaveText(/\d+%/);
  const stored = await page.getByTestId("sim-before").textContent();
  await expect(score).toHaveText(stored!);
  const toNumber = (s: string | null) => Number((s ?? "").replace("%", ""));

  await expect(page.getByRole("radio", { name: "No overtime" })).not.toBeChecked();
  await page.locator("label", { hasText: "No overtime" }).click();
  await expect.poll(async () => toNumber(await score.textContent())).toBeLessThan(toNumber(stored));
  await expect(page.getByText(/how the model responds/i)).toBeVisible();

  await page.getByRole("button", { name: /save & share/i }).click();
  await expect(page.getByTestId("share-link")).toHaveAttribute("href", /\/s\/[\w-]+$/);
});

test("unknown employee shows a friendly message", async ({ page }) => {
  await page.goto("/explore/99");
  await expect(page.getByText(/no employee 99/i)).toBeVisible();
});
