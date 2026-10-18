import { execFileSync } from "node:child_process";
import path from "node:path";

/** Undo what earlier runs did to the demo (check-ins, plans, updates), like the daily reset. */
export default function globalSetup() {
  const root = path.resolve(__dirname, "..", "..");
  const python = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  execFileSync(
    python,
    ["-c", "from datetime import date\nfrom api import demo\nfrom api.db import SessionLocal\nwith SessionLocal() as s:\n    demo.reset(s, date.today())"],
    { cwd: root, stdio: "inherit" },
  );
}
