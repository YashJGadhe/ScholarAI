"""/notifications — user notification center with read/unread management.

Faculty sees own research alerts; Admin sees system-wide + own.
"""

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.dependencies import get_current_user
from ..database.mongodb import get_db
from ..schemas import NotificationPreferencesIn
from ..services.notification_service import (
    get_unread_count,
    get_user_notifications,
    mark_all_as_read,
    mark_as_read,
    update_notification_preferences,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get notifications for the current user (admin sees system-wide)."""
    return await get_user_notifications(db, user["_id"], limit=limit, unread_only=unread_only)


@router.get("/unread-count")
async def unread_count(
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get unread notification count for the current user."""
    count = await get_unread_count(db, user["_id"])
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Mark a notification as read."""
    success = await mark_as_read(db, user["_id"], notification_id)
    if not success:
        raise HTTPException(404, "Notification not found or access denied.")
    return {"ok": True}


@router.put("/read-all")
async def mark_all_read(
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    count = await mark_all_as_read(db, user["_id"])
    return {"ok": True, "updated": count}


@router.get("/preferences")
async def get_preferences(
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get user notification preferences."""
    prefs = user.get("notification_preferences") or {}
    return prefs


@router.put("/preferences")
async def set_preferences(
    body: NotificationPreferencesIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Update user notification preferences."""
    await update_notification_preferences(db, user["_id"], body.model_dump())
    return {"ok": True}
