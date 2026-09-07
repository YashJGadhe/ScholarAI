"""Change detector — compares current polling results with previous snapshots
and creates notifications for meaningful events.

Detects: new papers, citation changes, h-index changes, i10-index changes,
platform indexing events.
"""

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from .notification_service import notify_admins, notify_faculty


async def detect_and_notify(
    db: AsyncIOMotorDatabase,
    author_id: str,
    author_name: str,
    platform: str,
    previous_summary: Optional[dict],
    current_summary: dict,
    new_papers: list[dict] | None = None,
) -> None:
    """Compare previous vs current summary and create notifications for changes."""
    if not previous_summary:
        # First poll — no notifications for initial data
        return

    prev = previous_summary.get(platform) or {}
    curr = current_summary.get(platform) or {}

    # Citation increase
    prev_citations = prev.get("citations")
    curr_citations = curr.get("citations")
    if prev_citations is not None and curr_citations is not None and curr_citations > prev_citations:
        platform_display = _platform_display(platform)
        await notify_faculty(
            db, author_id, "CITATION_INCREASE", platform,
            f"{platform_display} Citation Update",
            f"Your {platform_display} citation count increased from {prev_citations} to {curr_citations}.",
            metadata={"previous_count": prev_citations, "current_count": curr_citations},
        )
        await notify_admins(
            db, "CITATION_INCREASE", platform,
            f"Citation increase for {author_name}",
            f"{author_name}'s {platform_display} citations: {prev_citations} → {curr_citations}.",
            author_id=author_id,
            metadata={"previous_count": prev_citations, "current_count": curr_citations},
        )

    # H-index change
    prev_h = prev.get("h_index")
    curr_h = curr.get("h_index")
    if prev_h is not None and curr_h is not None and curr_h != prev_h:
        platform_display = _platform_display(platform)
        await notify_faculty(
            db, author_id, "H_INDEX_CHANGE", platform,
            f"{platform_display} H-index Update",
            f"Your {platform_display} H-index changed from {prev_h} to {curr_h}.",
            metadata={"previous_value": prev_h, "current_value": curr_h},
        )
        await notify_admins(
            db, "H_INDEX_CHANGE", platform,
            f"H-index change for {author_name}",
            f"{author_name}'s {platform_display} H-index: {prev_h} → {curr_h}.",
            author_id=author_id,
            metadata={"previous_value": prev_h, "current_value": curr_h},
        )

    # i10-index change (Google Scholar only)
    if platform == "GOOGLE_SCHOLAR":
        prev_i10 = prev.get("i10_index")
        curr_i10 = curr.get("i10_index")
        if prev_i10 is not None and curr_i10 is not None and curr_i10 != prev_i10:
            await notify_faculty(
                db, author_id, "I10_INDEX_CHANGE", platform,
                "Google Scholar i10-index Update",
                f"Your Google Scholar i10-index changed from {prev_i10} to {curr_i10}.",
                metadata={"previous_value": prev_i10, "current_value": curr_i10},
            )

    # New papers
    if new_papers:
        for paper in new_papers:
            platform_display = _platform_display(platform)
            event_type = f"{platform}_INDEXED" if platform != "GOOGLE_SCHOLAR" else "GOOGLE_SCHOLAR_INDEXED"
            if platform == "ORCID":
                event_type = "ORCID_PUBLICATION"
            elif platform == "SCOPUS":
                event_type = "SCOPUS_INDEXED"
            elif platform == "WOS":
                event_type = "WOS_INDEXED"

            await notify_faculty(
                db, author_id, event_type, platform,
                f"New {platform_display} Publication",
                f"Your paper '{paper.get('title', 'Untitled')}' has been indexed in {platform_display}.",
                paper_id=paper.get("_id"),
                paper_title=paper.get("title"),
                metadata={"doi": paper.get("doi")},
            )
            await notify_admins(
                db, event_type, platform,
                f"New publication for {author_name}",
                f"{author_name} has a new paper indexed in {platform_display}: '{paper.get('title', 'Untitled')}'.",
                author_id=author_id,
                paper_id=paper.get("_id"),
                paper_title=paper.get("title"),
                metadata={"doi": paper.get("doi")},
            )


async def notify_platform_error(
    db: AsyncIOMotorDatabase,
    platform: str,
    error_message: str,
    author_id: str | None = None,
) -> None:
    """Notify admins of platform/API failures."""
    platform_display = _platform_display(platform)
    await notify_admins(
        db, "API_ERROR", platform,
        f"{platform_display} API Error",
        error_message,
        author_id=author_id,
    )


async def notify_rate_limit(
    db: AsyncIOMotorDatabase,
    platform: str,
) -> None:
    """Notify admins of rate limit issues."""
    platform_display = _platform_display(platform)
    await notify_admins(
        db, "API_RATE_LIMIT", platform,
        f"{platform_display} Rate Limit",
        f"{platform_display} API quota exceeded. Data collection paused for this platform.",
    )


async def notify_identity_warning(
    db: AsyncIOMotorDatabase,
    author_id: str,
    author_name: str,
    warning: str,
) -> None:
    """Notify admins of identity verification issues."""
    await notify_admins(
        db, "IDENTITY_WARNING", None,
        f"Identity verification warning for {author_name}",
        warning,
        author_id=author_id,
    )


def _platform_display(platform: str) -> str:
    return {
        "SCOPUS": "Scopus",
        "WOS": "Web of Science",
        "GOOGLE_SCHOLAR": "Google Scholar",
        "ORCID": "ORCID",
        "RESEARCHGATE": "ResearchGate",
    }.get(platform, platform)
