"""Print recent contact messages.  Run: python -m api.scripts.messages [--limit 20]"""

import argparse

from sqlalchemy import select

from api.db import SessionLocal
from api.models import ContactMessage


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    with SessionLocal() as s:
        rows = s.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc())
                         .limit(args.limit)).all()
    for m in rows:
        print(f"[{m.created_at:%Y-%m-%d %H:%M}] {m.name} <{m.email}>\n  {m.message}\n")
    if not rows:
        print("No messages yet.")


if __name__ == "__main__":
    main()
