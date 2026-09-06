"""Create (or reset) the default ADMIN account.

Usage:  python -m scripts.seed_admin            (from backend/, with .env present)
        python -m scripts.seed_admin --email a@b.edu --password 'S3curePass!'
"""

import argparse
import asyncio
from datetime import datetime, timezone

from app.core.security import hash_password
from app.database.mongodb import connect_db, close_db


async def main(email: str, password: str) -> None:
    db = connect_db()
    existing = await db.users.find_one({"email": email.lower()})
    doc = {
        "name": "Admin", "email": email.lower(), "password_hash": hash_password(password),
        "role": "ADMIN", "active": True, "faculty_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(), "last_login_at": None,
    }
    if existing:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": doc})
        print(f"[seed_admin] Updated existing admin: {email}")
    else:
        await db.users.insert_one(doc)
        print(f"[seed_admin] Created admin: {email}")
    close_db()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--email", default="admin@raisoni.net")
    p.add_argument("--password", default="Admin@123")
    args = p.parse_args()
    asyncio.run(main(args.email, args.password))
