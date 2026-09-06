"""Create all MongoDB indexes manually (also runs automatically at app startup).

Usage:  python -m scripts.create_indexes   (from backend/, with .env present)
"""

import asyncio

from app.database.indexes import create_indexes
from app.database.mongodb import connect_db, close_db


async def main() -> None:
    db = connect_db()
    await create_indexes(db)
    print("[indexes] All ScholarAI indexes ensured.")
    close_db()


if __name__ == "__main__":
    asyncio.run(main())
