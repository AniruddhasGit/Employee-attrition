import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const python = JSON.stringify(
  path.resolve(__dirname, "..", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `${python} -m uvicorn api.main:app --port 8010`,
      cwd: "..",
      url: "http://localhost:8010/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      env: { API_ORIGIN: "http://localhost:8010" },
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
