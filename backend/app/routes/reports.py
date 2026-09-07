"""/reports — dedicated report generation endpoints.

Supports Year-Wise, Month-Wise, and Custom Date Range reports for
WOS, Scopus, and Google Scholar (no ResearchGate, no ORCID in citations).
"""

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.dependencies import get_current_user, require_roles
from ..database.mongodb import get_db
from ..services import csv_report_service, excel_report_service, pdf_report_service, report_service

router = APIRouter(prefix="/reports", tags=["reports"])

SUPPORTED_PLATFORMS = ["WOS", "SCOPUS", "GOOGLE_SCHOLAR"]
DEFAULT_PLATFORMS = ["WOS", "SCOPUS", "GOOGLE_SCHOLAR"]


def _validate_platforms(platforms: str | None) -> list[str]:
    if not platforms or platforms.lower() == "all":
        return DEFAULT_PLATFORMS
    parts = [p.strip().upper() for p in platforms.split(",")]
    valid = [p for p in parts if p in SUPPORTED_PLATFORMS]
    if not valid:
        raise HTTPException(422, f"Invalid platforms. Supported: {', '.join(SUPPORTED_PLATFORMS)}")
    return valid


def _validate_department(db, department: str):
    """Validate department exists."""
    return department  # Could add validation here if needed


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


# ---------- Year-Wise ----------

@router.get("/year-wise")
async def year_wise_preview(
    department: str = Query(...),
    start_year: int = Query(..., ge=2000, le=2100),
    end_year: int = Query(..., ge=2000, le=2100),
    platforms: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_roles("ADMIN", "FACULTY")),
):
    """Preview year-wise report data."""
    if start_year > end_year:
        raise HTTPException(422, "Start year cannot be greater than end year.")
    plats = _validate_platforms(platforms)
    _validate_department(db, department)
    return await report_service.get_year_wise_report(db, department, start_year, end_year, plats)


@router.get("/year-wise/download")
async def year_wise_download(
    department: str = Query(...),
    start_year: int = Query(...),
    end_year: int = Query(...),
    platforms: str | None = Query(None),
    fmt: str = Query("excel", pattern="^(excel|csv|pdf)$"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_roles("ADMIN", "FACULTY")),
):
    """Download year-wise report."""
    if start_year > end_year:
        raise HTTPException(422, "Start year cannot be greater than end year.")
    plats = _validate_platforms(platforms)
    report = await report_service.get_year_wise_report(db, department, start_year, end_year, plats)

    filename = f"{_slug(department)}_Citation_Report_{start_year}_{end_year}"

    if fmt == "excel":
        content = excel_report_service.generate_year_wise_excel(report)
        return Response(
            content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
        )
    elif fmt == "csv":
        content = csv_report_service.generate_year_wise_csv(report)
        return Response(
            content.encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    else:  # pdf
        content = pdf_report_service.generate_year_wise_pdf(report)
        return Response(
            content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )


# ---------- Month-Wise ----------

@router.get("/month-wise")
async def month_wise_preview(
    department: str = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    start_month: int = Query(1, ge=1, le=12),
    end_month: int = Query(12, ge=1, le=12),
    platforms: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_roles("ADMIN", "FACULTY")),
):
    """Preview month-wise report data."""
    if start_month > end_month:
        raise HTTPException(422, "Start month cannot be greater than end month.")
    plats = _validate_platforms(platforms)
    return await report_service.get_month_wise_report(db, department, year, start_month, end_month, plats)


@router.get("/month-wise/download")
async def month_wise_download(
    department: str = Query(...),
    year: int = Query(...),
    start_month: int = Query(1, ge=1, le=12),
    end_month: int = Query(12, ge=1, le=12),
    platforms: str | None = Query(None),
    fmt: str = Query("excel", pattern="^(excel|csv|pdf)$"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_roles("ADMIN", "FACULTY")),
):
    """Download month-wise report."""
    if start_month > end_month:
        raise HTTPException(422, "Start month cannot be greater than end month.")
    plats = _validate_platforms(platforms)
    report = await report_service.get_month_wise_report(db, department, year, start_month, end_month, plats)

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    filename = f"{_slug(department)}_Citation_Report_{month_names[start_month]}_{month_names[end_month]}_{year}"

    if fmt == "excel":
        content = excel_report_service.generate_month_wise_excel(report)
        return Response(
            content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
        )
    elif fmt == "csv":
        content = csv_report_service.generate_month_wise_csv(report)
        return Response(
            content.encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    else:
        content = pdf_report_service.generate_month_wise_pdf(report)
        return Response(
            content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )


# ---------- Custom Date Range ----------

@router.get("/date-range")
async def date_range_preview(
    department: str = Query(...),
    from_date: str = Query(...),
    to_date: str = Query(...),
    platforms: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_roles("ADMIN", "FACULTY")),
):
    """Preview date-range report data."""
    try:
        from_dt = datetime.fromisoformat(from_date)
        to_dt = datetime.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(422, "Invalid date format. Use YYYY-MM-DD.")
    if from_dt > to_dt:
        raise HTTPException(422, "From date cannot be later than to date.")
    plats = _validate_platforms(platforms)
    return await report_service.get_date_range_report(db, department, from_date, to_date, plats)


@router.get("/date-range/download")
async def date_range_download(
    department: str = Query(...),
    from_date: str = Query(...),
    to_date: str = Query(...),
    platforms: str | None = Query(None),
    fmt: str = Query("excel", pattern="^(excel|csv|pdf)$"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(require_roles("ADMIN", "FACULTY")),
):
    """Download date-range report."""
    try:
        from_dt = datetime.fromisoformat(from_date)
        to_dt = datetime.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(422, "Invalid date format. Use YYYY-MM-DD.")
    if from_dt > to_dt:
        raise HTTPException(422, "From date cannot be later than to date.")
    plats = _validate_platforms(platforms)
    report = await report_service.get_date_range_report(db, department, from_date, to_date, plats)

    filename = f"{_slug(department)}_Citation_Report_{from_date}_to_{to_date}"

    if fmt == "excel":
        content = excel_report_service.generate_date_range_excel(report)
        return Response(
            content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
        )
    elif fmt == "csv":
        content = csv_report_service.generate_date_range_csv(report)
        return Response(
            content.encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    else:
        content = pdf_report_service.generate_date_range_pdf(report)
        return Response(
            content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )


# ---------- Departments list ----------

@router.get("/departments")
async def list_departments(
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """List all departments with faculty counts."""
    pipeline = [
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": [("_id", 1)]},
    ]
    results = await db.authors.aggregate(pipeline).to_list(length=100)
    return [{"name": r["_id"] or "Unassigned", "faculty_count": r["count"]} for r in results]
