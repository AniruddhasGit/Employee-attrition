import { expect, test, type Page } from "@playwright/test";
import { persona, signInAs, type Story } from "./helpers";

// The first visit compiles the page in dev, which is slow while other suites share the server.
test.describe.configure({ timeout: 120_000 });

/** Sign in as HR and open the person page of a demo persona. */
async function openPerson(page: Page, story: Story) {
  await signInAs(page, "hr");
  const name = (await persona(page, story)).label.split(" · ")[0];
  const res = await page.request.get(`/api/hr/people?search=${encodeURIComponent(name)}`);
  const { items } = await res.json();
  await page.goto(`/hr/people/${items[0].id}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 60_000 });
}

test("plan_worked shows a done pay review whose actual change is a fall", async ({ page }) => {
  await openPerson(page, "plan_worked");
  const plan = page.getByTestId("plan").filter({ hasText: "Pay review" });
  await expect(plan).toContainText("Done");
  await expect(plan.getByTestId("plan-actual")).toContainText(/fell \d+ pts/i);
});

test("sharp_drop shows the change sentence", async ({ page }) => {
  await openPerson(page, "sharp_drop");
  await expect(page.getByTestId("change")).toContainText(/since \d{4}-Q\d/);
});

test("a reduce overtime plan shows the estimate, and marking it done moves the header score", async ({ page }) => {
  await openPerson(page, "sharp_drop");
  const score = page.getByTestId("person-score");
  await expect(score).toHaveText(/\d+%/);
  const before = await score.textContent();

  await page.getByRole("radio", { name: "Reduce overtime" }).check();
  await page.getByRole("button", { name: "Add plan" }).click();
  const plan = page.getByTestId("plan").filter({ hasText: "Reduce overtime" }).first();
  await expect(plan).toContainText(/Model's estimate: \d+% → \d+%/);
  await expect(plan).toContainText("Waiting for next check-in");

  await plan.getByRole("button", { name: "Mark done" }).click();
  await expect(plan).toContainText("Done");
  await expect(score).not.toHaveText(before ?? "");
});

test("what-if responds to a lever", async ({ page }) => {
  await openPerson(page, "sharp_drop");
  const after = page.getByTestId("sim-after");
  await expect(after).toHaveText(/\d+%/);
  const before = await after.textContent();
  await page.getByRole("radio", { name: "Frequently" }).check();
  await expect(after).not.toHaveText(before ?? "");
});

test("the person page has no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPerson(page, "sharp_drop");
  await expect(page.getByTestId("risk-history")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
