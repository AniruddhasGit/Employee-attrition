import { expect, type Page } from "@playwright/test";

export type Story = "hr" | "sharp_drop" | "stable" | "not_answered" | "plan_worked";

/** The demo persona for a story, straight from the seeded demo state. */
export async function persona(page: Page, story: Story) {
  const res = await page.request.get("http://localhost:8010/api/auth/demo-accounts");
  const accounts: { email: string; label: string; role: string }[] = await res.json();
  const order: Story[] = ["hr", "sharp_drop", "stable", "not_answered", "plan_worked"];
  return accounts[order.indexOf(story)];
}

/** Sign in through the real login page with that persona's demo button. */
export async function signInAs(page: Page, story: Story) {
  const p = await persona(page, story);
  await page.goto("/login");
  await page.getByRole("button", { name: `Sign in as ${p.label}` }).click();
  await expect(page).toHaveURL(story === "hr" ? /\/hr$/ : /\/me$/);
  return p;
}
