import { expect, test } from "@playwright/test";
import { persona, signInAs } from "./helpers";

test("shows response rate, department bars and who hasn't responded", async ({ page }) => {
  const quiet = await persona(page, "not_answered");
  const name = quiet.label.split(" · ")[0];
  await signInAs(page, "hr");
  await page.goto("/hr/check-ins");

  await expect(page.getByRole("heading", { level: 1, name: "Check-ins" })).toBeVisible();
  await expect(page.getByTestId("response-rate")).toHaveText(/\d+%/);
  const bars = page.getByTestId("dept-bar");
  await expect(bars.first()).toBeVisible();
  await expect(bars.first()).toContainText(/\d+ of \d+ answered/);

  // Demo names can repeat across the company, so any matching row will do.
  const link = page.getByTestId("missing").getByRole("link", { name: new RegExp(name) }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /^\/hr\/people\/\d+$/);
});

test("posting an update puts it at the top and reaches that department", async ({ page }) => {
  const quiet = await persona(page, "not_answered");
  const department = quiet.label.split(" · ")[1];
  const said = `Meetings eat our focus time ${Date.now()}`;
  const did = "Wednesdays are now meeting-free.";

  await signInAs(page, "hr");
  await page.goto("/hr/check-ins");
  await page.getByLabel("Department").selectOption(department);
  await page.getByRole("textbox", { name: "You said" }).fill(said);
  await expect(page.getByTestId("said-count")).toHaveText(`${said.length}/280`);
  await page.getByRole("textbox", { name: "We did" }).fill(did);
  await expect(page.getByTestId("did-count")).toHaveText(`${did.length}/280`);
  await page.getByRole("button", { name: "Post update" }).click();

  const first = page.getByTestId("update").first();
  await expect(first).toContainText(said);
  await expect(first).toContainText(did);
  await expect(first).toContainText(department);
  await expect(page.getByRole("textbox", { name: "You said" })).toHaveValue("");

  // Survives a reload, still newest first.
  await page.reload();
  await expect(page.getByTestId("update").first()).toContainText(said);

  // An employee in that department now sees it.
  await page.context().clearCookies();
  await signInAs(page, "not_answered");
  const me = await page.evaluate(async () => (await fetch("/api/me")).json());
  expect(me.updates.map((u: { said: string }) => u.said)).toContain(said);
});

test("the composer won't post an empty update or go past 280 characters", async ({ page }) => {
  await signInAs(page, "hr");
  await page.goto("/hr/check-ins");
  await expect(page.getByRole("button", { name: "Post update" })).toBeDisabled();
  await page.getByRole("textbox", { name: "You said" }).fill("x".repeat(300));
  await expect(page.getByRole("textbox", { name: "You said" })).toHaveValue("x".repeat(280));
  await expect(page.getByTestId("said-count")).toHaveText("280/280");
});

test("no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "hr");
  await page.goto("/hr/check-ins");
  await expect(page.getByTestId("response-rate")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(await page.locator("main").innerText()).not.toMatch(/\btry\b/i);
});
