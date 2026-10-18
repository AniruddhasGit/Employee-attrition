import hashlib

from fastapi import APIRouter, HTTPException, Request
from pydantic import EmailStr, Field

from api import ratelimit
from api.db import SessionDep
from api.models import ContactMessage
from api.schemas import CamelModel
from api.settings import get_settings

router = APIRouter(prefix="/api")

LIMIT_PER_HOUR = 5


class ContactIn(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    message: str = Field(min_length=10, max_length=2000)
    consent: bool
    website: str = ""  # honeypot: humans never see this field

    def model_post_init(self, _ctx) -> None:
        if not self.consent:
            raise ValueError("Consent is required to send a message")


def client_ip(request: Request) -> str:
    """Real client IP. Behind a host's proxy (Render) every request comes from the proxy, so read
    the first X-Forwarded-For hop; otherwise all visitors would share one rate limit."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded.strip():
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def ip_hash(ip: str) -> str:
    return hashlib.sha256((get_settings().ip_hash_salt + ip).encode()).hexdigest()


@router.post("/contact")
def contact(body: ContactIn, request: Request, session: SessionDep) -> dict:
    if body.website:
        return {"ok": True}  # quietly drop bots
    key = ip_hash(client_ip(request))
    if not ratelimit.allow(f"contact:{key}", LIMIT_PER_HOUR, 3600):
        raise HTTPException(429, "Too many messages. Please try again later.")
    session.add(ContactMessage(name=body.name.strip(), email=str(body.email),
                               message=body.message.strip(), consent=True, ip_hash=key))
    session.commit()
    return {"ok": True}
