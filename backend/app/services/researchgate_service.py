"""ResearchGate connector — COMPLIANT MODES ONLY.

ResearchGate offers no general public API. This service therefore supports:
  OFF                           → never touches ResearchGate (default)
  MANUAL_IMPORT                 → admin records verified figures by hand
  AUTHORIZED_ACCESS             → institutionally authorized access (bring your own contract)
  EXTERNAL_AUTHORIZED_PROVIDER  → licensed third-party provider

No CAPTCHA bypassing, no anti-bot evasion, no unauthorized scraping.
When data is unavailable the connector returns NOT_AVAILABLE — never fabricated metrics.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..models import platform_metrics_doc


def current_mode() -> str:
    return get_settings().RESEARCHGATE_MODE


async def probe(db: AsyncIOMotorDatabase, profile_id: str | None) -> dict:
    mode = current_mode()
    if mode == "OFF":
        return {"source": "RESEARCHGATE", "status": "NOT_AVAILABLE",
                "message": "Connector is OFF — no data requested (compliant mode)."}
    if not profile_id:
        return {"source": "RESEARCHGATE", "status": "NOT_AVAILABLE", "message": "No ResearchGate profile supplied."}
    if mode == "MANUAL_IMPORT":
        return {"source": "RESEARCHGATE", "status": "NOT_AVAILABLE",
                "message": "Automated fetch disabled. Use Manual Import to record verified figures."}
    # AUTHORIZED_ACCESS / EXTERNAL_AUTHORIZED_PROVIDER:
    # integrate the institution's authorized client here. Without a real client we
    # refuse to guess.
    return {"source": "RESEARCHGATE", "status": "NOT_AVAILABLE",
            "message": f"Mode {mode} requires an authorized client integration — nothing fetched."}


async def manual_import(db: AsyncIOMotorDatabase, author_id: str, papers: int | None, citations: int | None) -> None:
    """Admin-supplied verified figures (MANUAL_IMPORT mode). Provenance records the source."""
    if current_mode() != "MANUAL_IMPORT":
        raise PermissionError("RESEARCHGATE_MODE must be MANUAL_IMPORT for manual entries.")
    await db.authors.update_one(
        {"_id": author_id},
        {"$set": {"platform_metrics.RESEARCHGATE": platform_metrics_doc(
            "MANUAL", papers, citations, None, note="Manually recorded from ResearchGate profile (MANUAL_IMPORT mode)")}},
    )
