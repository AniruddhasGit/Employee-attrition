from api.net import client_ip
from api.settings import get_settings


class _Req:
    def __init__(self, headers, host="10.0.0.1"):
        self.headers = headers
        self.client = type("C", (), {"host": host})()


def test_forwarded_ip_requires_secret(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "proxy_secret", "s")
    fwd = {"x-retain-client-ip": "9.9.9.9", "x-retain-proxy-secret": "s"}
    assert client_ip(_Req(fwd)) == "9.9.9.9"
    assert client_ip(_Req({**fwd, "x-retain-proxy-secret": "wrong"})) == "10.0.0.1"
    assert client_ip(_Req({"x-retain-client-ip": "9.9.9.9"})) == "10.0.0.1"
    monkeypatch.setattr(settings, "proxy_secret", "")
    assert client_ip(_Req({**fwd, "x-retain-proxy-secret": ""})) == "10.0.0.1"


def test_falls_back_to_edge_then_rightmost_hop():
    assert client_ip(_Req({"cf-connecting-ip": "198.51.100.9"})) == "198.51.100.9"
    assert client_ip(_Req({"x-forwarded-for": "6.6.6.6, 203.0.113.7"})) == "203.0.113.7"
