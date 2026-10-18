import { expect, test } from "@playwright/test";

const API = "http://localhost:8010";

test("workforce map: heatmap cell, cost lens scales with the assumption", async ({ page }) => {
  await page.goto("/workforce");
  await expect(page.getByTestId("heat-cell").filter({ hasText: "Sales Executive" }).first()).toBeVisible();
  const total = page.getByTestId("cost-total");
  await expect(total).toHaveAttribute("data-value", /\d/);
  const at50 = Number(await total.getAttribute("data-value"));
  await page.getByLabel(/replacement cost/i).fill("100");
  await expect.poll(async () => Number(await total.getAttribute("data-value"))).toBeCloseTo(at50 * 2, -2);
});

test("segment compare shows both sides", async ({ page }) => {
  await page.goto("/workforce");
  const cmp = page.getByTestId("segment-compare");
  await cmp.scrollIntoViewIfNeeded();
  await expect(cmp.getByTestId("segment-a")).toContainText(/people/i);
  await expect(cmp.getByTestId("segment-b")).toContainText(/people/i);
});

test("honesty page: real metric with its interval, threshold slider moves recall", async ({ page, request }) => {
  const m = await (await request.get(`${API}/api/model/metrics`)).json();
  await page.goto("/honesty");
  const tile = page.getByTestId("metric-roc_auc");
  await expect(tile).toContainText(m.after.roc_auc.toFixed(3));
  const [lo, hi] = m.after.ci.roc_auc;
  await expect(tile).toContainText(`${lo.toFixed(2)} to ${hi.toFixed(2)}`);
  const recall = page.getByTestId("threshold-recall");
  const before = await recall.textContent();
  await page.getByLabel(/decision threshold/i).fill("0.7");
  await expect(recall).not.toHaveText(before!);
  await expect(page.getByTestId("fairness-table")).toContainText(/Female/);
});
