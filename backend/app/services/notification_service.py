"""Notification service — create, deduplicate, and deliver notifications.

Event types: NEW_PUBLICATION, SCOPUS_INDEXED, WOS_INDEXED, GOOGLE_SCHOLAR_INDEXED,
ORCID_PUBLICATION, CITATION_INCREASE, H_INDEX_CHANGE, I10_INDEX_CHANGE,
PROFILE_UPDATE, DATA_COLLECTION_ERROR, API_ERROR, API_RATE_LIMIT, IDENTITY_WARNING, SYSTEM_ALERT

Priority: LOW, MEDIUM, HIGH, CRITICAL

Duplicate prevention via deterministic event keys.
"""

from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models import notification_doc


EVENT_TYPES = {
    "NEW_PUBLICATION": "New publication detected",
    "SCOPUS_INDEXED": "New Scopus indexing",
    "WOS_INDEXED": "New Web of Science indexing",
    "GOOGLE_SCHOLAR_INDEXED": "New Google Scholar record",
    "ORCID_PUBLICATION": "New ORCID publication",
    "CITATION_INCREASE": "Citation count increased",
    "H_INDEX_CHANGE": "H-index changed",
    "I10_INDEX_CHANGE": "i10-index changed",
    "PROFILE_UPDATE": "Profile updated",
    "DATA_COLLECTION_ERROR": "Data collection error",
    "API_ERROR": "API error",
    "API_RATE_LIMIT": "API rate limit reached",
    "IDENTITY_WARNING": "Identity verification warning",
    "SYSTEM_ALERT": "System alert",
}

PRIORITY_MAP = {
    "NEW_PUBLICATION": "MEDIUM",
    "SCOPUS_INDEXED": "MEDIUM",
    "WOS_INDEXED": "MEDIUM",
    "GOOGLE_SCHOLAR_INDEXED": "MEDIUM",
    "ORCID_PUBLICATION": "MEDIUM",
    "CITATION_INCREASE": "LOW",
    "H_INDEX_CHANGE": "MEDIUM",
    "I10_INDEX_CHANGE": "LOW",
    "PROFILE_UPDATE": "LOW",
    "DATA_COLLECTION_ERROR": "HIGH",
    "API_ERROR": "HIGH",
    "API_RATE_LIMIT": "MEDIUM",
    "IDENTITY_WARNING": "HIGH",
    "SYSTEM_ALERT": "CRITICAL",
}


def _event_key(author_id: str | None, platform: str | None, event_type: str, paper_id: str | None = None) -> str:
    """Deterministic key for duplicate prevention."""
    parts = [event_type]
    if author_id:
        parts.append(author_id)
    if platform:
        parts.append(platform)
    if paper_id:
        parts.append(paper_id)
    return ":".join(parts)


async def create_notification(
    db: AsyncIOMotorDatabase,
    recipient_user_id: str,
    author_id: str | None,
    event_type: str,
    platform: str | None,
    title: str,
    message: str,
    paper_id: str | None = None,
    paper_title: str | None = None,
    metadata: dict | None = None,
    check_duplicate: bool = True,
) -> Optional[dict]:
    """Create a notification. Returns None if duplicate detected."""
    if check_duplicate:
        key = _event_key(author_id, platform, event_type, paper_id)
        existing = await db.notifications.find_one({"metadata.event_key": key})
        if existing:
            return None

    priority = PRIORITY_MAP.get(event_type, "MEDIUM")
    doc = notification_doc(
        recipient_user_id=recipient_user_id,
        author_id=author_id,
        event_type=event_type,
        platform=platform,
        priority=priority,
        title=title,
        message=message,
        paper_id=paper_id,
        paper_title=paper_title,
        metadata=metadata or {},
    )
    if check_duplicate:
        doc["metadata"]["event_key"] = key

    res = await db.notifications.insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    return doc


async def notify_faculty(
    db: AsyncIOMotorDatabase,
    author_id: str,
    event_type: str,
    platform: str | None,
    title: str,
    message: str,
    paper_id: str | None = None,
    paper_title: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Send notification to the faculty member linked to this author."""
    user = await db.users.find_one({"faculty_id": author_id, "active": True})
    if not user:
        return
    # Check preferences
    prefs = user.get("notification_preferences") or {}
    pref_key = event_type.lower()
    if prefs.get(pref_key, True) is False:
        return
    await create_notification(
        db, str(user["_id"]), author_id, event_type, platform,
        title, message, paper_id, paper_title, metadata,
    )


async def notify_admins(
    db: AsyncIOMotorDatabase,
    event_type: str,
    platform: str | None,
    title: str,
    message: str,
    author_id: str | None = None,
    paper_id: str | None = None,
    paper_title: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Send notification to all active admins."""
    admins = await db.users.find({"role": "ADMIN", "active": True}).to_list(length=100)
    for admin in admins:
        await create_notification(
            db, str(admin["_id"]), author_id, event_type, platform,
            title, message, paper_id, paper_title, metadata,
        )


async def get_user_notifications(
    db: AsyncIOMotorDatabase,
    user_id: str,
    limit: int = 50,
    unread_only: bool = False,
) -> list[dict]:
    """Get notifications for a user (admin sees all, faculty sees own)."""
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return []

    filt: dict = {}
    if user["role"] == "ADMIN":
        # Admins see system alerts + their own faculty notifications
        filt["$or"] = [
            {"recipient_user_id": str(user_id)},
            {"event_type": {"$in": ["DATA_COLLECTION_ERROR", "API_ERROR", "API_RATE_LIMIT", "SYSTEM_ALERT", "IDENTITY_WARNING"]}},
        ]
    else:
        filt["recipient_user_id"] = str(user_id)

    if unread_only:
        filt["is_read"] = False

    docs = await db.notifications.find(filt).sort("created_at", -1).limit(limit).to_list(length=limit)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


async def get_unread_count(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Get unread notification count for a user."""
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return 0

    filt: dict = {"is_read": False}
    if user["role"] == "ADMIN":
        filt["$or"] = [
            {"recipient_user_id": str(user_id)},
            {"event_type": {"$in": ["DATA_COLLECTION_ERROR", "API_ERROR", "API_RATE_LIMIT", "SYSTEM_ALERT", "IDENTITY_WARNING"]}},
        ]
    else:
        filt["recipient_user_id"] = str(user_id)

    return await db.notifications.count_documents(filt)


async def mark_as_read(db: AsyncIOMotorDatabase, user_id: str, notification_id: str) -> bool:
    """Mark a notification as read. Returns True if successful."""
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return False

    filt = {"_id": notification_id}
    if user["role"] != "ADMIN":
        filt["recipient_user_id"] = str(user_id)

    res = await db.notifications.update_one(
        filt,
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return res.modified_count > 0


async def mark_all_as_read(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Mark all notifications as read for a user. Returns count updated."""
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return 0

    filt: dict = {"is_read": False}
    if user["role"] == "ADMIN":
        filt["$or"] = [
            {"recipient_user_id": str(user_id)},
            {"event_type": {"$in": ["DATA_COLLECTION_ERROR", "API_ERROR", "API_RATE_LIMIT", "SYSTEM_ALERT", "IDENTITY_WARNING"]}},
        ]
    else:
        filt["recipient_user_id"] = str(user_id)

    res = await db.notifications.update_many(
        filt,
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return res.modified_count


async def update_notification_preferences(db: AsyncIOMotorDatabase, user_id: str, prefs: dict) -> None:
    """Update user notification preferences."""
    await db.users.update_one({"_id": user_id}, {"$set": {"notification_preferences": prefs}})
