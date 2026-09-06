"""/faculty — CRUD, Validate & Fetch Data (preview ONLY), on-demand polling.

Fetch-data never writes the researcher; it validates identifiers, previews source
metrics, resolves identity and scans duplicates. POST /faculty performs the final
database insertion from a confirmed preview payload.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.dependencies import get_current_user, require_roles
from ..database.mongodb import get_db
from ..models import author_doc, platform_metrics_doc
from ..schemas import FacultyCreateIn, FacultyUpdateIn
from ..services import google_scholar_service, orcid_service, researchgate_service, scopus_service, wos_service
from ..services.identity_service import resolve_identity
from ..services.polling_service import poll_author
from ..utils.identifiers import (
    extract_scholar_id, normalize_doi, normalize_orcid, normalize_scopus_id,
    orcid_checksum_valid, scopus_url_matches_id,
)

router = APIRouter(prefix="/faculty", tags=["faculty"])


def _str_ids(d: dict) -> dict:
    d = dict(d)
    d["_id"] = str(d["_id"])
    return d


@router.get("")
async def list_faculty(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    return [_str_ids(a) async for a in db.authors.find({})]


@router.get("/me")
async def my_faculty(db: AsyncIOMotorDatabase = Depends(get_db), user: dict = Depends(get_current_user)):
    fid = user.get("faculty_id")
    if not fid:
        raise HTTPException(404, "No linked researcher profile.")
    a = await db.authors.find_one({"_id": ObjectId(fid)})
    if not a:
        raise HTTPException(404, "Linked researcher record not found.")
    return _str_ids(a)


@router.get("/{faculty_id}")
async def get_faculty(faculty_id: str, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    try:
        a = await db.authors.find_one({"_id": ObjectId(faculty_id)})
    except Exception:
        a = None
    if not a:
        raise HTTPException(404, "Researcher not found.")
    return _str_ids(a)


@router.post("/fetch-data")
async def fetch_data(body: FacultyCreateIn, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    """Validate + preview ONLY. Nothing is persisted by this endpoint."""
    orcid = normalize_orcid(body.orcid)
    scopus_id = normalize_scopus_id(body.scopus_id)
    validation = {
        "name": None if len(body.name.strip()) >= 3 else "Researcher name is required (min 3 characters).",
        "orcid": None if orcid and orcid_checksum_valid(orcid) else "ORCID failed checksum validation (ISO 7064 MOD 11-2).",
        "scopus_id": None if scopus_id else "Scopus ID must be 9–12 digits.",
        "scopus_url": None if scopus_url_matches_id(body.scopus_url, scopus_id) else "Scopus profile URL does not match the Scopus ID.",
    }
    if any(validation.values()):
        return {"validation": validation, "platforms": {}, "identity": {"status": "NOT_VERIFIED", "evidence": {}},
                "papers_preview": [], "duplicates": [], "fetched_at": datetime.now(timezone.utc).isoformat()}

    if await db.authors.find_one({"identifiers.orcid": orcid}) or await db.authors.find_one({"identifiers.scopus_id": scopus_id}):
        validation["orcid"] = "This ORCID/Scopus ID already exists in the database."
        return {"validation": validation, "platforms": {}, "identity": {"status": "NOT_VERIFIED", "evidence": {}},
                "papers_preview": [], "duplicates": [], "fetched_at": datetime.now(timezone.utc).isoformat()}

    platforms: dict = {}
    s_res = await scopus_service.fetch_summary(db, scopus_id)
    platforms["SCOPUS"] = {"status": s_res["status"], "message": s_res.get("message"),
                           "metrics": {k: s_res.get("data", {}).get(k) for k in ("papers", "citations", "h_index")} if s_res["status"] == "OK" else None}
    orcid_res = await orcid_service.fetch_profile(db, orcid)
    platforms["ORCID"] = {"status": orcid_res["status"], "message": orcid_res.get("message"),
                          "metrics": {"papers": orcid_res.get("data", {}).get("works_count"), "citations": None, "h_index": None} if orcid_res["status"] == "OK" else None}
    scholar_id = extract_scholar_id(body.scholar_url)
    g_res = await google_scholar_service.fetch_summary(db, scholar_id) if scholar_id else {"status": "NOT_CONFIGURED", "message": "No Google Scholar URL"}
    platforms["GOOGLE_SCHOLAR"] = {"status": g_res["status"], "message": g_res.get("message"),
                                   "metrics": {k: g_res.get("data", {}).get(k) for k in ("papers", "citations", "h_index", "i10_index")} if g_res["status"] == "OK" else None}
    w_res = await wos_service.fetch_documents(db, body.wos_url.split("/")[-1], page=1, limit=1) if body.wos_url else {"status": "NOT_CONFIGURED", "message": "No WoS URL"}
    platforms["WOS"] = {"status": w_res["status"], "message": w_res.get("message"),
                        "metrics": {"papers": w_res.get("data", {}).get("total"), "citations": None, "h_index": None} if w_res["status"] == "OK" else None}
    rg = await researchgate_service.probe(db, (body.researchgate_url or "").rstrip("/").split("/")[-1] or None)
    platforms["RESEARCHGATE"] = {"status": rg["status"], "message": rg.get("message"), "metrics": None}

    common_dois = len({normalize_doi(d) for d in (orcid_res.get("data") or {}).get("dois", []) if normalize_doi(d)})
    identity = resolve_identity(orcid, scopus_id, body.scopus_url, body.name,
                                profile_name=(s_res.get("data") or {}).get("name"),
                                common_dois=common_dois, publication_overlap=common_dois)

    return {"validation": validation, "platforms": platforms, "identity": identity,
            "papers_preview": [], "duplicates": [], "fetched_at": datetime.now(timezone.utc).isoformat()}


@router.post("", status_code=201)
async def create_faculty(body: FacultyCreateIn, db: AsyncIOMotorDatabase = Depends(get_db), admin: dict = Depends(require_roles("ADMIN"))):
    """Final database insertion — called only after admin confirms a preview."""
    orcid = normalize_orcid(body.orcid)
    scopus_id = normalize_scopus_id(body.scopus_id)
    if await db.authors.find_one({"identifiers.orcid": orcid}):
        raise HTTPException(409, "A researcher with this ORCID already exists.")
    identity = resolve_identity(orcid, scopus_id, body.scopus_url, body.name)
    doc = author_doc(
        body.name.strip(), body.department, body.designation, body.email,
        identifiers={"orcid": orcid, "scopus_id": scopus_id,
                     "google_scholar_id": extract_scholar_id(body.scholar_url),
                     "wos_id": None, "researchgate_id": None},
        profile_urls={"orcid": f"https://orcid.org/{orcid}", "scopus": body.scopus_url,
                      "google_scholar": body.scholar_url, "researchgate": body.researchgate_url, "wos": body.wos_url},
        identity=identity,
    )
    doc["research_areas"] = body.research_areas
    res = await db.authors.insert_one(doc)
    return {"_id": str(res.inserted_id), "identity": identity}


@router.put("/{faculty_id}")
async def update_faculty(faculty_id: str, body: FacultyUpdateIn,
                         db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.authors.update_one({"_id": ObjectId(faculty_id)}, {"$set": patch})
    if not res.matched_count:
        raise HTTPException(404, "Researcher not found.")
    return {"ok": True}


@router.delete("/{faculty_id}")
async def delete_faculty(faculty_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: dict = Depends(require_roles("ADMIN"))):
    """Soft delete → deleted_authors (restorable)."""
    a = await db.authors.find_one({"_id": ObjectId(faculty_id)})
    if not a:
        raise HTTPException(404, "Researcher not found.")
    a["deleted_at"] = datetime.now(timezone.utc).isoformat()
    a["deleted_by"] = admin.get("email")
    await db.deleted_authors.insert_one(a)
    await db.authors.delete_one({"_id": ObjectId(faculty_id)})
    return {"ok": True}


@router.post("/{faculty_id}/restore")
async def restore_faculty(faculty_id: str, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    a = await db.deleted_authors.find_one({"_id": ObjectId(faculty_id)})
    if not a:
        raise HTTPException(404, "Deleted record not found.")
    a.pop("deleted_at", None); a.pop("deleted_by", None)
    await db.authors.insert_one(a)
    await db.deleted_authors.delete_one({"_id": ObjectId(faculty_id)})
    return {"ok": True}


@router.get("/deleted/list")
async def list_deleted(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    return [_str_ids(a) async for a in db.deleted_authors.find({})]


@router.post("/{faculty_id}/poll")
async def poll(faculty_id: str, db: AsyncIOMotorDatabase = Depends(get_db), user: dict = Depends(require_roles("ADMIN"))):
    """Summary Check-First on-demand polling."""
    try:
        return await poll_author(db, faculty_id, user.get("email", "admin"))
    except LookupError:
        raise HTTPException(404, "Researcher not found.")
