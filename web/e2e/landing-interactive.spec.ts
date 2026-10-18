import { expect, test } from "@playwright/test";

test("questions carousel advances by button and by drag", async ({ page }) => {
  await page.goto("/");
  const carousel = page.getByTestId("questions");
  await carousel.scrollIntoViewIfNeeded();
  const status = carousel.getByTestId("carousel-status");
  await expect(status).toHaveText("Question 1 of 4");
  await carousel.getByRole("button", { name: /next question/i }).click();
  await expect(status).toHaveText("Question 2 of 4");
  const track = carousel.getByTestId("carousel-track");
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, box.y + 80, { steps: 12 });
  await page.mouse.up();
  await expect(status).toHaveText("Question 3 of 4");
});

test("contact form shows the sent state", async ({ page }) => {
  await page.route("**/api/contact", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }),
  );
  await page.goto("/#contact");
  const form = page.getByTestId("contact-form");
  await form.getByLabel("Name", { exact: true }).fill("Mira Okafor");
  await form.getByLabel("Email", { exact: true }).fill("mira@example.com");
  await form.getByLabel("Message", { exact: true }).fill("Curious how you handled calibration.");
  await form.getByLabel(/agree/i).check();
  await form.getByRole("button", { name: /send message/i }).click();
  await expect(form).toContainText(/message received/i);
});

test("footer carries the get-in-touch wordmark and code link", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: /get in touch/i })).toBeVisible();
  await expect(footer.getByRole("link", { name: /github/i })).toBeVisible();
});
