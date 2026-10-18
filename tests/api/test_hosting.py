from api.routes.contact import client_ip
from api.settings import Settings


def test_plain_postgres_url_uses_psycopg_driver():
    s = Settings(database_url="postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require")
    assert s.database_url == "postgresql+psycopg://u:p@ep-x.neon.tech/neondb?sslmode=require"
    assert Settings(database_url="postgres://u:p@h/db").database_url.startswith("postgresql+psycopg://")


def test_cors_origins_accept_comma_separated_and_strip_slashes():
    s = Settings(cors_origins="https://retain-web.onrender.com/, http://localhost:3000")
    assert s.cors_origins == ["https://retain-web.onrender.com", "http://localhost:3000"]
    assert Settings(cors_origins='["https://a.example"]').cors_origins == ["https://a.example"]


class _Req:
    def __init__(self, headers, host="10.0.0.1"):
        self.headers = headers
        self.client = type("C", (), {"host": host})()


def test_client_ip_trusts_edge_header_then_rightmost_forwarded_hop():
    edge = _Req({"cf-connecting-ip": "198.51.100.9", "x-forwarded-for": "1.1.1.1"})
    assert client_ip(edge) == "198.51.100.9"
    # A client can prepend fake hops; the proxy appends the real one on the right.
    assert client_ip(_Req({"x-forwarded-for": "6.6.6.6, 203.0.113.7"})) == "203.0.113.7"
    assert client_ip(_Req({})) == "10.0.0.1"


def test_cors_origins_from_env_comma_separated(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://retain-web.onrender.com/,http://localhost:3000")
    assert Settings().cors_origins == ["https://retain-web.onrender.com", "http://localhost:3000"]
