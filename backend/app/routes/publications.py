"""/publications + /citations — authenticated read endpoints."""

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.dependencies import get_current_user
from ..database.mongodb import get_db

router = APIRouter(tags=["publications"])


def _na(v):
    return v if v is not None else None  # JSON null → UI renders NA


@router.get("/publications")
async def list_publications(
    q: str | None = Query(None), year: int | None = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user),
):
    filt: dict = {}
    if year:
        filt["publication_year"] = year
    if q:
        filt["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"doi": {"$regex": q, "$options": "i"}}]
    total = await db.papers.count_documents(filt)
    docs = [_doc(d) async for d in db.papers.find(filt).sort("publication_year", -1).skip(skip).limit(limit)]
    return {"total": total, "items": docs}


@router.get("/publications/{paper_id}")
async def get_publication(paper_id: str, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    d = await db.papers.find_one({"_id": paper_id})
    if not d:
        raise HTTPException(404, "Publication not found.")
    return _doc(d)


@router.get("/citations")
async def citations_matrix(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    """Citation Management matrix — source metrics verbatim, NA stays NA."""
    rows = []
    async for a in db.authors.find({}):
        rows.append(_citation_row(a))
    return {"rows": rows}


@router.get("/citations/{faculty_id}")
async def citations_for(faculty_id: str, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    try:
        a = await db.authors.find_one({"_id": ObjectId(faculty_id)})
    except Exception:
        a = None
    if not a:
        raise HTTPException(404, "Researcher not found.")
    return _citation_row(a)


def _doc(d: dict) -> dict:
    d = dict(d)
    if isinstance(d.get("_id"), ObjectId):
        d["_id"] = str(d["_id"])
    return d


def _citation_row(a: dict) -> dict:
    pm = a.get("platform_metrics") or {}

    def m(plat, key):
        return _na((pm.get(plat) or {}).get(key))

    return {
        "author_id": str(a["_id"]),
        "name": a.get("name"),
        "designation": a.get("designation"),
        "department": a.get("department"),
        "wos": {"papers": m("WOS", "papers"), "citations": m("WOS", "citations"), "h_index": m("WOS", "h_index")},
        "scopus": {"papers": m("SCOPUS", "papers"), "citations": m("SCOPUS", "citations"), "h_index": m("SCOPUS", "h_index")},
        "google_scholar": {"papers": m("GOOGLE_SCHOLAR", "papers"), "citations": m("GOOGLE_SCHOLAR", "citations"),
                           "h_index": m("GOOGLE_SCHOLAR", "h_index"), "i10_index": m("GOOGLE_SCHOLAR", "i10_index")},
        "links": a.get("profile_urls") or {},
    }
