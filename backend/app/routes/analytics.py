"""/analytics + /reports — bibliometrics, network, AI insights, exports."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.dependencies import get_current_user, require_roles
from ..database.mongodb import get_db
from ..services import analytics_service, export_service

router = APIRouter(tags=["analytics"])


@router.get("/analytics/overview")
async def analytics_overview(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    return await analytics_service.overview(db)


@router.get("/analytics/faculty/{author_id}")
async def analytics_faculty(author_id: str, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    res = await analytics_service.faculty_analytics(db, author_id)
    if res is None:
        return {"detail": "Researcher not found."}
    res["author"]["_id"] = str(res["author"]["_id"])
    return res


@router.get("/analytics/department/{department}")
async def analytics_department(department: str, db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    authors = await db.authors.find({"department": department}).to_list(length=1000)
    ids = {str(a["_id"]) for a in authors}
    papers = await db.papers.find({"faculty_ids": {"$in": list(ids)}}).to_list(length=10000)
    ov = await analytics_service.overview(db)
    dept = next((d for d in ov["departments"] if d["name"] == department), None)
    return {"department": department, "summary": dept, "faculty": [{**a, "_id": str(a["_id"])} for a in authors], "papers": len(papers)}


@router.get("/analytics/network")
async def network(db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(get_current_user)):
    return await analytics_service.collaboration_network(db)


# ---------- reports ----------

@router.get("/reports/faculty/{author_id}")
async def report_faculty(author_id: str, fmt: str = Query("csv", pattern="^(csv|excel|json)$"),
                         db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN", "FACULTY"))):
    title, columns, rows = await export_service.faculty_report(db, author_id)
    return _respond(title, columns, rows, fmt)


@router.get("/reports/citations")
async def report_citations(fmt: str = Query("csv", pattern="^(csv|excel|json)$"),
                           db: AsyncIOMotorDatabase = Depends(get_db), _: dict = Depends(require_roles("ADMIN"))):
    title, columns, rows = await export_service.citation_report(db)
    return _respond(title, columns, rows, fmt)


def _respond(title: str, columns: list, rows: list, fmt: str) -> Response:
    if fmt == "json":
        return Response(export_service.build_json(title, columns, rows), media_type="application/json",
                        headers=_dl(title, "json"))
    content = export_service.build_csv(columns, rows, excel=(fmt == "excel"))
    return Response(content, media_type="text/csv; charset=utf-8", headers=_dl(title, "csv"))


def _dl(title: str, ext: str) -> dict:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
    return {"Content-Disposition": f'attachment; filename="{slug}.{ext}"'}
