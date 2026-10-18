import { execFileSync } from "node:child_process";
import path from "node:path";

/** Undo what earlier runs did to the demo (check-ins, plans, updates), like the daily reset. */
export default function globalSetup() {
  // Parallel runs against one server: skip the reset, which signs everyone out.
  if (process.env.E2E_SKIP_RESET === "1") return;
  const root = path.resolve(__dirname, "..", "..");
  const python = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  execFileSync(
    python,
    ["-c", "from datetime import date\nfrom api import demo\nfrom api.db import SessionLocal\nwith SessionLocal() as s:\n    demo.reset(s, date.today())"],
    { cwd: root, stdio: "inherit" },
  );
}
