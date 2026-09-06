"""/admin — user management with hard safety rules, settings, logs.

Safety rules enforced server-side:
  1. Admin cannot delete themselves.
  2. Admin cannot change their own role.
  3. The last remaining ADMIN cannot be deleted.
  4. The last remaining ADMIN cannot be downgraded.
  5. Only ADMIN may reach any of these routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..core.dependencies import require_roles
from ..core.security import hash_password
from ..database.mongodb import get_db
from ..schemas import SettingsIn, UserInviteIn, UserUpdateIn

router = APIRouter(prefix="/admin", tags=["admin"])


def _pub(u: dict) -> dict:
    return {k: u.get(k) for k in ("_id", "name", "email", "role", "active", "faculty_id", "created_at", "last_login_at")}


async def _admin_users(db) -> list[dict]:
    return [_pub({**u, "_id": str(u["_id"])}) async for u in db.users.find({})]


@router.get("/users")
async def list_users(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    return await _admin_users(db)


@router.post("/users", status_code=201)
async def invite_user(body: UserInviteIn, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    from datetime import datetime, timezone

    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already registered.")
    res = await db.users.insert_one({
        "name": body.name.strip(), "email": body.email.lower(), "password_hash": hash_password(body.password),
        "role": body.role, "active": True, "faculty_id": body.faculty_id,
        "created_at": datetime.now(timezone.utc).isoformat(), "last_login_at": None,
    })
    return {"_id": str(res.inserted_id)}


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateIn, db: AsyncIOMotorDatabase = Depends(get_db), admin: dict = Depends(require_roles("ADMIN"))):
    from bson import ObjectId

    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found.")
    is_self = str(target["_id"]) == str(admin["_id"])

    if body.role and body.role != target.get("role"):
        if is_self:
            raise HTTPException(403, "You cannot change your own role.")
        if target.get("role") == "ADMIN":
            admins = await db.users.count_documents({"role": "ADMIN", "active": True})
            if admins <= 1 and body.role != "ADMIN":
                raise HTTPException(403, "The last remaining ADMIN cannot be downgraded.")
    if body.active is False and is_self:
        raise HTTPException(403, "You cannot deactivate your own account.")
    if body.active is False and target.get("role") == "ADMIN" and target.get("active"):
        admins = await db.users.count_documents({"role": "ADMIN", "active": True})
        if admins <= 1:
            raise HTTPException(403, "The last active ADMIN cannot be deactivated.")

    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if patch:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": patch})
    return await _admin_users(db)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: dict = Depends(require_roles("ADMIN"))):
    from bson import ObjectId

    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found.")
    if str(target["_id"]) == str(admin["_id"]):
        raise HTTPException(403, "An admin cannot delete their own account.")
    if target.get("role") == "ADMIN":
        admins = await db.users.count_documents({"role": "ADMIN"})
        if admins <= 1:
            raise HTTPException(403, "The last remaining ADMIN cannot be deleted.")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return await _admin_users(db)


# ---------- settings / observability ----------

@router.get("/settings")
async def get_settings_route(_: dict = Depends(require_roles("ADMIN"))):
    s = get_settings()
    return {
        "orcid_configured": bool(s.ORCID_CLIENT_ID),
        "scopus_configured": bool(s.SCOPUS_API_KEY),
        "wos_configured": bool(s.WOS_API_KEY),
        "serpapi_configured": bool(s.SERPAPI_API_KEY),
        "researchgate_mode": s.RESEARCHGATE_MODE,
        "allowed_email_domains": s.allowed_email_domains,
        "student_email_domains": s.student_email_domains,
    }


@router.put("/settings")
async def update_settings_route(body: SettingsIn, _: dict = Depends(require_roles("ADMIN"))):
    """Runtime overrides are written to the process env (deployments should prefer .env)."""
    import os

    mapping = {
        "orcid_client_id": "ORCID_CLIENT_ID", "scopus_api_key": "SCOPUS_API_KEY",
        "wos_api_key": "WOS_API_KEY", "serpapi_api_key": "SERPAPI_API_KEY",
        "researchgate_mode": "RESEARCHGATE_MODE",
    }
    for field, env in mapping.items():
        val = getattr(body, field)
        if val is not None:
            os.environ[env] = val
    get_settings.cache_clear()
    return {"ok": True}


@router.get("/polling-logs")
async def polling_logs(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    docs = [_pub_doc(d) async for d in db.polling_logs.find({}).sort("at", -1).limit(50)]
    return docs


@router.get("/api-usage")
async def api_usage(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    return [_pub_doc(d) async for d in db.api_usage.find({}).sort("at", -1).limit(100)]


def _pub_doc(d: dict) -> dict:
    d = dict(d)
    d["_id"] = str(d["_id"])
    return d
