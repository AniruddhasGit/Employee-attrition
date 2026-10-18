import { expect, test } from "@playwright/test";

test("explorer shows a calm error when the API is down", async ({ page }) => {
  await page.route("http://localhost:8010/**", (route) => route.abort());
  await page.goto("/explore");
  await expect(page.getByRole("alert").filter({ hasText: "Can't reach the model right now" })).toBeVisible();
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
});

test("reduced motion: hero letters are not transformed", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/");
  await page.waitForTimeout(500);
  const transforms = await page.evaluate(() =>
    [...document.querySelectorAll("#main section:first-of-type span.inline-block span.inline-block")]
      .map((el) => getComputedStyle(el).transform)
      .filter((t) => t !== "none"),
  );
  expect(transforms).toEqual([]);
  await context.close();
});

test("a shared scenario renders its before and after", async ({ page, request }) => {
  const res = await request.post("http://localhost:8010/api/scenarios", {
    data: { employeeId: 1004, levers: { overTime: "No" } },
  });
  const { publicId } = await res.json();
  await page.goto(`/s/${publicId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/research scientist/i);
  await expect(page.getByText("No overtime")).toBeVisible();
  await expect(page.getByTestId("scenario-after")).toHaveText(/\d+%/);
});

test("an unknown share link is a friendly 404", async ({ page }) => {
  await page.goto("/s/not-a-real-one");
  await expect(page.getByText(/scenario isn't here/i)).toBeVisible();
});

test("unknown routes get the site's not-found page", async ({ page }) => {
  const res = await page.goto("/nope-nothing-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /back to the start/i })).toBeVisible();
});
