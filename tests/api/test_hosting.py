from api.routes.contact import client_ip
from api.settings import Settings


def test_plain_postgres_url_uses_psycopg_driver():
    s = Settings(database_url="postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require")
    assert s.database_url == "postgresql+psycopg://u:p@ep-x.neon.tech/neondb?sslmode=require"
    assert Settings(database_url="postgres://u:p@h/db").database_url.startswith("postgresql+psycopg://")


class _Req:
    def __init__(self, headers, host="10.0.0.1"):
        self.headers = headers
        self.client = type("C", (), {"host": host})()


def test_client_ip_prefers_forwarded_for_behind_proxy():
    assert client_ip(_Req({"x-forwarded-for": "203.0.113.7, 10.0.0.2"})) == "203.0.113.7"
    assert client_ip(_Req({})) == "10.0.0.1"
