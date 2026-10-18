import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// Generous: the dev server may be recompiling when a route is first visited.
const NAV = { timeout: 45_000 };

const NOTICE =
  "Your HR team sees your answers, with your name, so they can act on them. Your manager does not. You will never be shown a score.";

// The second test submits a check-in, so order matters.
test.describe.configure({ mode: "serial" });

/** Employees never see a score, a percentage or the word "risk". */
async function expectNoScores(page: Page) {
  await page.waitForLoadState("networkidle");
  expect(await page.locator("body").innerText()).not.toMatch(/\d+%|risk/i);
}

test("an employee who has not answered sees the open check-in", async ({ page }) => {
  await signInAs(page, "not_answered");
  await expect(page.getByRole("link", { name: /Start this quarter's check-in/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What would keep you here" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You said, we did" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your past answers" })).toBeVisible();
  await expectNoScores(page);
});

test("completing all nine steps returns home in the done state", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAs(page, "not_answered");
  await page.getByRole("link", { name: /Start this quarter's check-in/ }).click();
  await expect(page).toHaveURL(/\/me\/check-in$/, NAV);
  await expect(page.getByText(NOTICE, { exact: true })).toBeVisible(NAV);
  await expectNoScores(page);

  const next = page.getByRole("button", { name: "Next", exact: true });

  // Step 1: arrow keys move between options.
  const group = page.getByRole("radiogroup");
  await group.getByRole("radio").first().click();
  await expect(group.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio").nth(1)).toBeFocused();
  await next.click();

  // Back keeps the answer.
  await expect(page.getByText("2 of 9")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("radiogroup").getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  await next.click();

  // Steps 2 to 8.
  for (let step = 2; step <= 8; step++) {
    await expect(page.getByText(`${step} of 9`)).toBeVisible();
    await expect(next).toBeDisabled();
    await page.getByRole("radiogroup").getByRole("radio").last().click();
    await next.click();
  }

  // Step 9: what would keep you here.
  await expect(page.getByRole("heading", { name: "What would keep you here" })).toBeVisible();
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await page.getByRole("button", { name: "Less overtime" }).click();
  await page.getByRole("button", { name: "Recognition" }).click();
  await expect(page.getByRole("button", { name: "Job security" })).toBeDisabled();
  await page.getByLabel(/Anything else/).fill("A quieter office.");
  await expect(page.getByText("17 / 500")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await expect(page).toHaveURL(/\/me$/, NAV);
  await expect(page.getByText(/Done for .+\. You can update it until the quarter ends\./)).toBeVisible();
  const picks = page.getByRole("region", { name: "What would keep you here" });
  await expect(picks.getByText("Pay", { exact: true })).toBeVisible();
  await expect(picks.getByText("Less overtime")).toBeVisible();
  await expect(picks.getByText("Recognition")).toBeVisible();
  await expect(picks.getByText("A quieter office.")).toBeVisible();
  await expectNoScores(page);

  // Re-taking prefills this quarter's answers.
  await page.getByRole("link", { name: /Update my answers/ }).click();
  await expect(page).toHaveURL(/\/me\/check-in$/, NAV);
  await expect(page.getByRole("radiogroup").getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(next).toBeEnabled();
});
