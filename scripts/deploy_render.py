"""Create or update the two Render image services (free plan) and wire them together.

The images are built and pushed from your machine first (scripts/build_images.sh), so Render
only pulls and runs them: no repo access, no build minutes, no training on Render.

Usage (secrets stay in your shell or a git-ignored .env.deploy, never in the repo):
    RENDER_API_KEY=... DATABASE_URL=... python scripts/deploy_render.py
or put KEY=value lines in .env.deploy at the repo root and run it with no variables.
Optional: TAG (defaults to `git rev-parse --short HEAD`), IP_HASH_SALT and PROXY_SECRET
(kept from the running service, or generated once).

Re-runnable: existing image services are found by name, get fresh env vars and are redeployed
with the new tag. A service of the same name that Render builds from the repo is never touched;
the script stops and asks you to delete it in the dashboard first.
"""

import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.deploy"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and not key.startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))

REGISTRY = "ghcr.io/aniruddhasgit"  # GHCR paths must be lowercase
REGION = "singapore"
PROJECT = "Retain"
API_NAME, WEB_NAME = "retain-api", "retain-web"
HEALTH = {API_NAME: "/api/health"}
# The hosted demo uses a private password: set DEMO_PASSWORD in the env or .env.deploy.
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "retain-demo")
KEY = os.environ.get("RENDER_API_KEY", "")


def image_ref(name: str, tag: str) -> str:
    return f"{REGISTRY}/{name}:{tag}"


def api_env(database_url: str, salt: str, proxy_secret: str, site_origin: str) -> dict:
    return {
        "DATABASE_URL": database_url,
        "IP_HASH_SALT": salt,
        "PROXY_SECRET": proxy_secret,
        "SITE_ORIGINS": site_origin,
        "COOKIE_SECURE": "true",
        "DEMO_PASSWORD": DEMO_PASSWORD,
    }


def web_env(api_origin: str, proxy_secret: str) -> dict:
    return {"API_ORIGIN": api_origin, "PROXY_SECRET": proxy_secret}


def service_payload(
    name: str, image: str, env: dict, owner: str, environment_id: str | None = None
) -> dict:
    """The POST /services body for a free web service that pulls a prebuilt public image."""
    details = {"runtime": "image", "plan": "free", "region": REGION}
    if name in HEALTH:
        details["healthCheckPath"] = HEALTH[name]
    payload = {
        "type": "web_service", "name": name, "ownerId": owner, "autoDeploy": "no",
        "image": {"ownerId": owner, "imagePath": image},
        "serviceDetails": details,
        "envVars": [{"key": k, "value": v} for k, v in env.items()],
    }
    if environment_id:
        payload["environmentId"] = environment_id
    return payload


def require_image_service(svc: dict) -> None:
    """Stop if a same-named service is built from the repo (a runtime cannot be switched)."""
    if svc.get("repo") or svc.get("serviceDetails", {}).get("runtime") != "image":
        sys.exit(
            f"'{svc['name']}' already exists on Render as a repo-built service. Delete it in the "
            "Render dashboard (Settings > Delete service), then run this script again. "
            "Nothing was changed."
        )


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
    if status != 200:
        sys.exit(f"Listing Render services failed ({status}): {out}")
    for item in out or []:
        if item["service"]["name"] == name:
            return item["service"]
    return None


def current_env(svc: dict | None) -> dict:
    if svc is None:
        return {}
    _, out = call("GET", f"/services/{svc['id']}/env-vars?limit=50")
    return {e["envVar"]["key"]: e["envVar"]["value"] for e in out or [] if isinstance(e, dict)}


def find_environment() -> str | None:
    """The first environment of the Render project named Retain, if it exists."""
    status, out = call("GET", "/projects?limit=50")
    if status != 200:
        return None
    for item in out or []:
        project = item.get("project", {})
        if project.get("name", "").lower() == PROJECT.lower() and project.get("environmentIds"):
            return project["environmentIds"][0]
    return None


def ensure(svc: dict | None, name: str, image: str, env: dict, owner: str,
           environment_id: str | None):
    """Create the service, or replace its env vars and deploy the new image. Never prints values."""
    if svc is None:
        payload = service_payload(name, image, env, owner, environment_id)
        status, out = call("POST", "/services", payload)
        if status not in (200, 201):
            sys.exit(f"Creating {name} failed ({status}): {out}")
        print(f"created {name} from {image}")
        return out["service"], True
    status, out = call("PUT", f"/services/{svc['id']}/env-vars",
                       [{"key": k, "value": v} for k, v in env.items()])
    if status != 200:
        sys.exit(f"Updating env for {name} failed ({status}): {out}")
    print(f"updated env for {name} ({', '.join(env)})")
    return svc, False


def deploy_and_wait(svc: dict, image: str | None, timeout_s: int = 900) -> None:
    deploy_id = None
    if image:
        status, out = call("POST", f"/services/{svc['id']}/deploys", {"imageUrl": image})
        if status not in (200, 201, 202):  # 202: queued behind a running deploy
            sys.exit(f"Deploying {svc['name']} failed ({status}): {out}")
        deploy_id = out.get("id") if isinstance(out, dict) else None
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
        time.sleep(15)
    sys.exit(f"{svc['name']} not live after {timeout_s}s")


def get_ok(url: str) -> int:
    for _ in range(12):  # free instances can take a while to wake
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.status
        except Exception:
            time.sleep(10)
    return 0


def git_tag() -> str:
    return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, check=True,
                          capture_output=True, text=True).stdout.strip()


def main() -> None:
    if not KEY or not os.environ.get("DATABASE_URL"):
        sys.exit("Set RENDER_API_KEY and DATABASE_URL in the environment or .env.deploy first.")
    status, owners = call("GET", "/owners?limit=5")
    if status != 200 or not owners:
        sys.exit(f"Render rejected the API key ({status}). Check RENDER_API_KEY.")
    owner = owners[0]["owner"]["id"]
    tag = os.environ.get("TAG") or git_tag()
    api_image, web_image = image_ref(API_NAME, tag), image_ref(WEB_NAME, tag)

    # Check both names before changing anything, so a refusal leaves Render untouched.
    api_svc, web_svc = find(API_NAME), find(WEB_NAME)
    for svc in (api_svc, web_svc):
        if svc is not None:
            require_image_service(svc)
    environment_id = find_environment()

    # Secrets: the environment wins, then what the running API already has, then a fresh one.
    existing = current_env(api_svc)
    salt = (os.environ.get("IP_HASH_SALT") or existing.get("IP_HASH_SALT")
            or secrets.token_urlsafe(32))
    proxy_secret = (os.environ.get("PROXY_SECRET") or existing.get("PROXY_SECRET")
                    or secrets.token_urlsafe(32))
    web_url = web_svc["serviceDetails"]["url"] if web_svc else f"https://{WEB_NAME}.onrender.com"

    api_env_vars = api_env(os.environ["DATABASE_URL"], salt, proxy_secret, web_url)
    api, api_new = ensure(api_svc, API_NAME, api_image, api_env_vars, owner, environment_id)
    api_url = api["serviceDetails"]["url"]
    web, web_new = ensure(web_svc, WEB_NAME, web_image, web_env(api_url, proxy_secret), owner,
                          environment_id)

    # Render may add a suffix if the name was taken; the CSRF check needs the real site origin.
    real_web_url = web["serviceDetails"]["url"]
    if real_web_url != web_url:
        api_env_vars["SITE_ORIGINS"] = real_web_url
        ensure(api, API_NAME, api_image, api_env_vars, owner, environment_id)
        api_new = False  # env changed after the first deploy started, so deploy again

    deploy_and_wait(api, None if api_new else api_image)
    deploy_and_wait(web, None if web_new else web_image)
    print("health:", get_ok(f"{api_url}/api/health"), "| site:", get_ok(real_web_url))
    print(f"\nSite: {real_web_url}\nAPI:  {api_url}/docs")


if __name__ == "__main__":
    main()
