"""Unit tests for the Render deploy script's pure helpers (no network)."""

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "deploy_render.py"


@pytest.fixture(scope="module")
def deploy():
    spec = importlib.util.spec_from_file_location("deploy_render", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_service_payload_is_an_image_service(deploy):
    image = "ghcr.io/aniruddhasgit/retain-api:abc1234"
    payload = deploy.service_payload("retain-api", image, {"A": "1", "B": "2"}, "own-1")

    assert payload["type"] == "web_service"
    assert payload["name"] == "retain-api"
    assert payload["ownerId"] == "own-1"
    assert payload["image"]["imagePath"] == image
    assert payload["autoDeploy"] == "no"
    assert "repo" not in payload and "branch" not in payload
    details = payload["serviceDetails"]
    assert details["runtime"] == "image"
    assert details["plan"] == "free"
    assert details["region"] == "singapore"
    assert payload["envVars"] == [{"key": "A", "value": "1"}, {"key": "B", "value": "2"}]


def test_api_payload_has_health_check(deploy):
    payload = deploy.service_payload("retain-api", "x:1", {}, "o")
    assert payload["serviceDetails"]["healthCheckPath"] == "/api/health"


def test_image_refs_use_lowercase_ghcr_paths(deploy):
    assert deploy.image_ref("retain-api", "abc1234") == "ghcr.io/aniruddhasgit/retain-api:abc1234"
    assert deploy.image_ref("retain-web", "abc1234") == "ghcr.io/aniruddhasgit/retain-web:abc1234"


def test_api_env_has_production_settings(deploy):
    env = deploy.api_env("postgres://db", "salt", "secret", "https://retain-web.onrender.com")
    assert env == {
        "DATABASE_URL": "postgres://db",
        "IP_HASH_SALT": "salt",
        "PROXY_SECRET": "secret",
        "SITE_ORIGINS": "https://retain-web.onrender.com",
        "COOKIE_SECURE": "true",
        "DEMO_PASSWORD": "retain-demo",
    }


def test_web_env_shares_the_proxy_secret(deploy):
    assert deploy.web_env("https://retain-api.onrender.com", "secret") == {
        "API_ORIGIN": "https://retain-api.onrender.com",
        "PROXY_SECRET": "secret",
    }


def test_repo_built_service_is_refused(deploy):
    repo_built = {"name": "retain-api", "repo": "https://github.com/x/y",
                  "serviceDetails": {"runtime": "docker"}}
    with pytest.raises(SystemExit) as exc:
        deploy.require_image_service(repo_built)
    assert "delete" in str(exc.value).lower() and "retain-api" in str(exc.value)


def test_image_service_is_accepted(deploy):
    deploy.require_image_service({"name": "retain-api", "serviceDetails": {"runtime": "image"}})
