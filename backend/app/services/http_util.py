"""Shared connector HTTP handling — timeouts, quota, JSON errors, usage logging.

Every connector failure returns a structured error and never crashes the pipeline:
{"source": ..., "status": "UNAVAILABLE"|"RATE_LIMITED"|"NOT_CONFIGURED", "message": ...}
"""

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..models import api_usage_doc


async def log_usage(db: AsyncIOMotorDatabase, platform: str, endpoint: str,
                    success: bool, status_code: int, estimated_usage: int) -> None:
    await db.api_usage.insert_one(api_usage_doc(platform, endpoint, success, status_code, estimated_usage))


async def connector_get(db: AsyncIOMotorDatabase, platform: str, url: str, endpoint: str,
                        headers: dict | None = None, params: dict | None = None) -> dict:
    """GET with uniform failure handling. Returns {"ok": bool, "status": str, "http": int, "json": dict|None, "message": str}."""
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=s.CONNECTOR_TIMEOUT_SECONDS, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers, params=params)
    except httpx.TimeoutException:
        await log_usage(db, platform, endpoint, False, 0, 0)
        return {"ok": False, "status": "UNAVAILABLE", "http": 0, "json": None, "message": "Request timed out"}
    except httpx.HTTPError as exc:
        await log_usage(db, platform, endpoint, False, 0, 0)
        return {"ok": False, "status": "UNAVAILABLE", "http": 0, "json": None, "message": f"Transport error: {exc}"}

    if resp.status_code == 401:
        await log_usage(db, platform, endpoint, False, 401, 0)
        return {"ok": False, "status": "UNAUTHORIZED", "http": 401, "json": None, "message": "API key rejected (HTTP 401)"}
    if resp.status_code == 403:
        await log_usage(db, platform, endpoint, False, 403, 0)
        return {"ok": False, "status": "FORBIDDEN", "http": 403, "json": None, "message": "Access forbidden (HTTP 403)"}
    if resp.status_code == 404:
        await log_usage(db, platform, endpoint, False, 404, 0)
        return {"ok": False, "status": "UNAVAILABLE", "http": 404, "json": None, "message": "Record not found (HTTP 404)"}
    if resp.status_code == 429:
        await log_usage(db, platform, endpoint, False, 429, 0)
        return {"ok": False, "status": "RATE_LIMITED", "http": 429, "json": None, "message": "API quota exceeded (HTTP 429)"}
    if resp.status_code >= 500:
        await log_usage(db, platform, endpoint, False, resp.status_code, 0)
        return {"ok": False, "status": "UNAVAILABLE", "http": resp.status_code, "json": None, "message": f"Server error (HTTP {resp.status_code})"}

    try:
        data = resp.json()
    except ValueError:
        await log_usage(db, platform, endpoint, False, resp.status_code, 0)
        return {"ok": False, "status": "UNAVAILABLE", "http": resp.status_code, "json": None, "message": "Invalid JSON response"}

    await log_usage(db, platform, endpoint, True, resp.status_code, 1)
    return {"ok": True, "status": "OK", "http": resp.status_code, "json": data, "message": ""}
