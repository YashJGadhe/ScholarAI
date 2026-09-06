"""MongoDB indexes (run at startup; also available via scripts/create_indexes.py)."""

import pymongo
from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    # users — unique login email
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")

    # authors — identity lookups
    await db.authors.create_index("identifiers.orcid", sparse=True)
    await db.authors.create_index("identifiers.scopus_id", sparse=True)
    await db.authors.create_index("identifiers.google_scholar_id", sparse=True)
    await db.authors.create_index("identifiers.wos_id", sparse=True)
    await db.authors.create_index("department")
    await db.authors.create_index([("name", pymongo.TEXT)])

    # papers — DOI is the canonical unique key; title/year for dedupe scans
    await db.papers.create_index("doi", unique=True, sparse=True)
    await db.papers.create_index("title")
    await db.papers.create_index("publication_year")
    await db.papers.create_index("source_records.platform")
    await db.papers.create_index("faculty_ids")

    # history / logs
    await db.metrics_history.create_index([("author_id", 1), ("platform", 1), ("date", 1)])
    await db.polling_logs.create_index([("author_id", 1), ("at", -1)])
    await db.api_usage.create_index([("platform", 1), ("at", -1)])
    await db.deleted_authors.create_index("_id")
