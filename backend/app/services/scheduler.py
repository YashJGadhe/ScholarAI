"""Background scheduler for automatic polling and notification monitoring.

Runs periodically according to POLLING_INTERVAL_MINUTES configuration.
Uses Summary Check-First to minimize API calls.
Does not require manual intervention — works independently of the UI.
"""

import asyncio
import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from .notification_service import notify_admins
from .polling_service import poll_author

logger = logging.getLogger("scholarai.scheduler")


class PollingScheduler:
    """Background scheduler that automatically polls all researchers."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.running = False
        self.task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the background polling loop."""
        settings = get_settings()
        if not settings.POLLING_ENABLED:
            logger.info("Polling scheduler disabled (POLLING_ENABLED=false)")
            return

        self.running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info(f"Polling scheduler started (interval={settings.POLLING_INTERVAL_MINUTES}m)")

    async def stop(self) -> None:
        """Stop the background polling loop."""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Polling scheduler stopped")

    async def _run_loop(self) -> None:
        """Main polling loop — runs every POLLING_INTERVAL_MINUTES."""
        settings = get_settings()
        interval_seconds = settings.POLLING_INTERVAL_MINUTES * 60

        while self.running:
            try:
                await self._poll_all_authors()
            except Exception as e:
                logger.error(f"Scheduler error: {e}", exc_info=True)
                await notify_admins(
                    self.db, "SYSTEM_ALERT", None,
                    "Scheduler Error",
                    f"Background polling encountered an error: {str(e)}",
                )

            # Wait for next interval
            await asyncio.sleep(interval_seconds)

    async def _poll_all_authors(self) -> None:
        """Poll all active authors with configured platform IDs."""
        authors = await self.db.authors.find({}).to_list(length=2000)
        logger.info(f"Scheduler: polling {len(authors)} authors")

        success_count = 0
        error_count = 0

        for author in authors:
            if not self.running:
                break

            # Check if author has any platform IDs configured
            ids = author.get("identifiers") or {}
            has_platform = any([
                ids.get("scopus_id"),
                ids.get("google_scholar_id"),
                ids.get("wos_id"),
                ids.get("orcid"),
            ])

            if not has_platform:
                continue

            try:
                result = await poll_author(self.db, str(author["_id"]), "scheduler")
                if result["result"] == "CHANGED":
                    success_count += 1
                    logger.info(f"Scheduler: {author.get('name')} — changes detected")
                else:
                    logger.debug(f"Scheduler: {author.get('name')} — unchanged")
            except LookupError:
                logger.warning(f"Scheduler: author {author['_id']} not found")
            except Exception as e:
                error_count += 1
                logger.error(f"Scheduler: error polling {author.get('name')}: {e}")
                await notify_admins(
                    self.db, "DATA_COLLECTION_ERROR", None,
                    f"Polling failed for {author.get('name')}",
                    str(e),
                    author_id=str(author["_id"]),
                )

            # Small delay between authors to respect rate limits
            await asyncio.sleep(1)

        logger.info(f"Scheduler: completed — {success_count} changed, {error_count} errors")
