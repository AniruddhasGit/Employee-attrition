import { expect, test, type Page } from "@playwright/test";
import { persona, signInAs } from "./helpers";

// First visits compile pages in dev, and the add-person round trip scores a new row.
test.describe.configure({ timeout: 120_000 });

/** Fill the add-person form with a valid new joiner; returns the temporary password it generated. */
async function fillPerson(page: Page, name: string, email: string) {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Generate" }).click();
  const password = await page.getByLabel("Temporary password").inputValue();
  expect(password).toMatch(/^[a-z2-9]{12}$/);
  await page.getByLabel("Department", { exact: true }).selectOption("Sales");
  await page.getByLabel("Job role").selectOption("Sales Executive");
  await page.getByRole("radio", { name: "2", exact: true }).check();
  await page.getByLabel("Monthly income").fill("5,400");
  await page.getByLabel("Years at the company").fill("0");
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.getByRole("radio", { name: "Often" }).check();
  return password;
}

async function signInWith(page: Page, email: string, password: string, path = "/login") {
  await page.goto(path);
  // Typing before hydration is lost when React takes over the inputs; let the page settle first.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("HR adds a person, who signs in on the temporary password and chooses their own", async ({ page }) => {
  const email = `alex.e2e.${Date.now()}@company.com`;
  await signInAs(page, "hr");
  await page.getByRole("link", { name: "Add person" }).click();
  await expect(page).toHaveURL(/\/hr\/people\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "Add a person." })).toBeVisible({ timeout: 60_000 });
  // The dashboard tab stays lit on this page.
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");

  const temp = await fillPerson(page, "Alex Testcase", email);
  await page.getByRole("button", { name: "Add person" }).click();

  const added = page.getByTestId("added");
  await expect(added).toBeVisible();
  await expect(added.getByRole("heading", { name: "Alex Testcase is in." })).toBeVisible();
  await expect(added).toContainText(email);
  await expect(added.getByTestId("temp-password")).toHaveText(temp);
  await expect(added).toContainText("Share these with Alex. They'll choose their own password on first sign-in.");
  await expect(added.getByTestId("band")).toBeVisible();
  await expect(added.getByTestId("added-score")).toHaveText(/^\d+%$/);
  await expect(added.getByRole("link", { name: "Open Alex's page" })).toHaveAttribute("href", /\/hr\/people\/\d+$/);

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  // A ?next= into the employee area can't skip choosing a password.
  await signInWith(page, email, temp, "/login?next=%2Fme");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1, name: "Make it yours." })).toBeVisible();
  await expect(page.getByText("Welcome, Alex.")).toBeVisible();

  // The employee area sends a temporary password back here.
  await page.goto("/me");
  await expect(page).toHaveURL(/\/welcome$/);

  const mine = "a long sentence of mine";
  await page.getByLabel("New password").fill(mine);
  await page.getByLabel("Confirm password").fill("a long sentence of nine");
  await expect(page.getByText("The two passwords don't match.")).toBeVisible();
  await page.getByLabel("Confirm password").fill(mine);
  await expect(page.getByText("The two passwords don't match.")).toHaveCount(0);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("link", { name: "Check-in" })).toBeVisible();

  // Done once: /welcome now sends them home, and the new password signs them in.
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await signInWith(page, email, mine);
  await expect(page).toHaveURL(/\/me$/);
});

test("the add-person form says what's missing before sending", async ({ page }) => {
  await signInAs(page, "hr");
  await page.goto("/hr/people/new");
  await expect(page.getByRole("heading", { level: 1, name: "Add a person." })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Use 2 to 80 characters.")).toBeVisible();
  await expect(page.getByText("Pick a department.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await expect(page.getByTestId("added")).toHaveCount(0);
});

test("an email that already has an account is named on the field", async ({ page }) => {
  const hr = await persona(page, "hr");
  await signInAs(page, "hr");
  await page.goto("/hr/people/new");
  await expect(page.getByRole("heading", { level: 1, name: "Add a person." })).toBeVisible({ timeout: 60_000 });
  await fillPerson(page, "Sam Duplicate", hr.email);
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("That email already has an account.")).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeFocused();
});

test("sign-in waits quietly while the server wakes up", async ({ page }) => {
  const hr = await persona(page, "hr");
  let refused = 0;
  await page.route("**/api/auth/login", async (route) => {
    if (refused < 2) {
      refused++;
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ detail: "Can't reach the model right now." }) });
    } else {
      await route.continue();
    }
  });
  await signInWith(page, hr.email, process.env.E2E_DEMO_PASSWORD ?? "retain-demo");
  // Busy, with a calm line instead of an error, until the third attempt (about 10 s) gets through.
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Starting the server. This takes about a minute on the first visit.");
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/hr$/, { timeout: 30_000 });
  expect(refused).toBe(2);
});

test("the add-person page has no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "hr");
  await page.goto("/hr/people/new");
  await expect(page.getByLabel("Job role")).toBeVisible({ timeout: 60_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
