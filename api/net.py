import hmac

from api.settings import get_settings


def client_ip(request) -> str:
    """The real client IP.

    The web app proxies every browser request, so the API normally sees the web server. The proxy
    forwards the browser's IP with a shared secret; the IP is trusted only when the secret matches.
    Otherwise use what the host's edge says (Render sits behind Cloudflare): edge-set headers first,
    because clients cannot forge them through the proxy, then the rightmost X-Forwarded-For hop
    (proxies append on the right; clients can only prepend).
    """
    secret = get_settings().proxy_secret
    sent = request.headers.get("x-retain-proxy-secret", "")
    forwarded = request.headers.get("x-retain-client-ip", "").strip()
    if secret and forwarded and hmac.compare_digest(sent.encode(), secret.encode()):
        return forwarded
    for header in ("cf-connecting-ip", "true-client-ip"):
        if request.headers.get(header):
            return request.headers[header].strip()
    hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    if hops:
        return hops[-1]
    return request.client.host if request.client else "unknown"
