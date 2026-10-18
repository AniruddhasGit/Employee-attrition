import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export type Story = "hr" | "sharp_drop" | "stable" | "not_answered" | "plan_worked";

type Persona = { story: Story; email: string; label: string; role: string };

let cache: Persona[] | null = null;

/** The seeded demo personas, read from the local database (the sign-in page no longer lists them). */
function personas(): Persona[] {
  if (cache) return cache;
  const root = path.resolve(__dirname, "..", "..");
  const python = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const out = execFileSync(
    python,
    [
      "-c",
      "import json\nfrom api import demo\nfrom api.db import SessionLocal\nwith SessionLocal() as s:\n    print(json.dumps(demo.personas(s)))",
    ],
    { cwd: root, encoding: "utf8" },
  );
  cache = JSON.parse(out.trim().split("\n").pop()!) as Persona[];
  return cache;
}

/** The demo persona for a story, straight from the seeded demo state. */
export async function persona(page: Page, story: Story) {
  const p = personas().find((x) => x.story === story);
  if (!p) throw new Error(`No seeded persona for story "${story}"`);
  return { email: p.email, label: p.label, role: p.role };
}

/** Sign in through the real login page with that persona's email and the demo password. */
export async function signInAs(page: Page, story: Story) {
  const p = await persona(page, story);
  await page.goto("/login");
  await page.getByLabel("Email").fill(p.email);
  await page.getByLabel("Password").fill(process.env.E2E_DEMO_PASSWORD ?? "retain-demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(story === "hr" ? /\/hr$/ : /\/me$/);
  return p;
}
