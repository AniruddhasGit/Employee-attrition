"""Create or update the two Render services (free plan) and wire them together.

Usage (PowerShell or bash; secrets stay in your shell, never in the repo):
    RENDER_API_KEY=... DATABASE_URL=... python scripts/deploy_render.py

Re-runnable: existing services are found by name and only their env vars are updated.
Needs Render access to the GitHub repo (public repo, or Render's GitHub app granted access).
"""

import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request

REPO = "https://github.com/AniruddhasGit/Employee-attrition"
BRANCH = "main"
REGION = "singapore"
API_NAME, WEB_NAME = "retain-api", "retain-web"
KEY = os.environ.get("RENDER_API_KEY", "")


def call(method: str, path: str, body: object = None):
    req = urllib.request.Request(
        f"https://api.render.com/v1{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def find(name: str):
    status, out = call("GET", f"/services?name={name}&limit=20")
    for item in out or []:
        if item["service"]["name"] == name:
            return item["service"]
    return None


def ensure(name: str, dockerfile: str, context: str, health: str | None, env: dict, owner: str):
    svc = find(name)
    env_list = [{"key": k, "value": v} for k, v in env.items()]
    if svc is None:
        details = {"runtime": "docker", "plan": "free", "region": REGION,
                   "envSpecificDetails": {"dockerfilePath": dockerfile, "dockerContext": context}}
        if health:
            details["healthCheckPath"] = health
        status, out = call("POST", "/services", {
            "type": "web_service", "name": name, "ownerId": owner, "repo": REPO,
            "branch": BRANCH, "autoDeploy": "yes", "serviceDetails": details, "envVars": env_list,
        })
        if status not in (200, 201):
            sys.exit(f"Creating {name} failed ({status}): {out}")
        print(f"created {name}")
        return out["service"]
    status, out = call("PUT", f"/services/{svc['id']}/env-vars", env_list)
    if status != 200:
        sys.exit(f"Updating env for {name} failed ({status}): {out}")
    print(f"updated env for {name}")
    return svc


def deploy_and_wait(svc: dict, timeout_s: int = 1500) -> None:
    status, out = call("POST", f"/services/{svc['id']}/deploys", {"clearCache": "do_not_clear"})
    deploy_id = out["id"] if status in (200, 201) else None
    started = time.time()
    while time.time() - started < timeout_s:
        _, deploys = call("GET", f"/services/{svc['id']}/deploys?limit=1")
        latest = deploys[0]["deploy"] if deploys else {}
        state = latest.get("status")
        if (deploy_id is None or latest.get("id") == deploy_id) and state == "live":
            print(f"{svc['name']} is live")
            return
        if state in ("build_failed", "update_failed", "canceled", "pre_deploy_failed"):
            sys.exit(f"{svc['name']} deploy ended with {state}; see the Render dashboard logs")
        time.sleep(20)
    sys.exit(f"{svc['name']} not live after {timeout_s}s")


def get_ok(url: str) -> int:
    for _ in range(12):  # free instances can take a while to wake
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.status
        except Exception:
            time.sleep(10)
    return 0


def main() -> None:
    if not KEY or not os.environ.get("DATABASE_URL"):
        sys.exit("Set RENDER_API_KEY and DATABASE_URL in the environment first.")
    status, owners = call("GET", "/owners?limit=5")
    if status != 200 or not owners:
        sys.exit(f"Render rejected the API key ({status}). Check RENDER_API_KEY.")
    owner = owners[0]["owner"]["id"]

    api = find(API_NAME) or ensure(API_NAME, "./api/Dockerfile", ".", "/api/health", {
        "DATABASE_URL": os.environ["DATABASE_URL"],
        "IP_HASH_SALT": secrets.token_urlsafe(32),
        "CORS_ORIGINS": f"https://{WEB_NAME}.onrender.com",
    }, owner)
    api_url = api["serviceDetails"]["url"]

    web_env = {"NEXT_PUBLIC_API_URL": api_url}
    web = ensure(WEB_NAME, "./web/Dockerfile", "./web", None, web_env, owner)
    web_url = web["serviceDetails"]["url"]

    # Point CORS at the web service's real URL (Render may add a suffix if the name was taken).
    _, current = call("GET", f"/services/{api['id']}/env-vars?limit=50")
    env = {e["envVar"]["key"]: e["envVar"]["value"] for e in current or []}
    env["CORS_ORIGINS"] = web_url
    ensure(API_NAME, "./api/Dockerfile", ".", "/api/health", env, owner)

    deploy_and_wait(api)
    deploy_and_wait(web)
    print("health:", get_ok(f"{api_url}/api/health"), "| site:", get_ok(web_url))
    print(f"\nSite: {web_url}\nAPI:  {api_url}/docs")


if __name__ == "__main__":
    main()
