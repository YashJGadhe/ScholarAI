"""/auth — register, login, me. Domain policy + ORCID/Scopus mandatory at API level."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..core.dependencies import get_current_user
from ..core.security import create_access_token, hash_password, verify_password
from ..database.mongodb import get_db
from ..schemas import LoginIn, RegisterIn
from ..utils.identifiers import normalize_orcid, normalize_scopus_id, orcid_checksum_valid

router = APIRouter(prefix="/auth", tags=["auth"])


def _domain_ok(email: str, role: str) -> bool:
    s = get_settings()
    allowed = s.allowed_email_domains
    if allowed and not any(email.endswith("@" + d) for d in allowed):
        return False
    if role == "STUDENT" and s.student_email_domains:
        return any(email.endswith("@" + d) for d in s.student_email_domains)
    return True


def _public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("_id", "name", "email", "role", "active", "faculty_id", "created_at", "last_login_at")}


@router.post("/register")
async def register(body: RegisterIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    if not _domain_ok(email, body.role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Registration for {body.role} is not allowed from this email domain.")
    orcid = normalize_orcid(body.orcid)
    scopus_id = normalize_scopus_id(body.scopus_id)
    if not orcid or not orcid_checksum_valid(orcid):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "ORCID ID is mandatory and must pass checksum validation.")
    if not scopus_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Scopus Author ID is mandatory (9–12 digits).")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": body.name.strip(), "email": email, "password_hash": hash_password(body.password),
        "role": body.role, "active": True, "faculty_id": None, "created_at": now, "last_login_at": now,
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    return {"access_token": create_access_token(doc["_id"], body.role), "token_type": "bearer", "user": _public_user(doc)}


@router.post("/login")
async def login(body: LoginIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    if not user.get("active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}})
    return {"access_token": create_access_token(str(user["_id"]), user["role"]), "token_type": "bearer",
            "user": _public_user({**user, "_id": str(user["_id"])})}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _public_user({**user, "_id": str(user["_id"])})
