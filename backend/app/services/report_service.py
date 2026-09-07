"""Report generation service — Year-Wise, Month-Wise, Custom Date Range.

Aggregates citation/publication data from MongoDB for all faculty in a department.
Uses MongoDB aggregation pipelines for efficiency.

Platforms: WOS, SCOPUS, GOOGLE_SCHOLAR only (no ResearchGate, no ORCID in citations).
"""

from datetime import datetime
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


async def get_year_wise_report(
    db: AsyncIOMotorDatabase,
    department: str | None,
    start_year: int,
    end_year: int,
    platforms: list[str] = ["WOS", "SCOPUS", "GOOGLE_SCHOLAR"],
) -> dict:
    """Generate year-wise citation report for all faculty in a department.

    Returns structured data with faculty × platform × year matrix.
    If department is None, includes all faculty across all departments.
    """
    # Get all faculty in department (or all faculty if department is None)
    query = {"department": department} if department else {}
    faculty = await db.authors.find(query).to_list(length=1000)
    if not faculty:
        return {"error": "No faculty found" + (f" in department {department}" if department else ""), "rows": []}

    # Build aggregation pipeline to get citations by year for each faculty/platform
    # For each paper, sum citations by publication_year and platform
    pipeline = [
        {"$unwind": "$source_records"},
        {
            "$match": {
                "source_records.platform": {"$in": platforms},
                "publication_year": {"$gte": start_year, "$lte": end_year},
            }
        },
        {
            "$group": {
                "_id": {
                    "faculty_id": {"$arrayElemAt": ["$faculty_ids", 0]},
                    "platform": "$source_records.platform",
                    "year": "$publication_year",
                },
                "citations": {"$sum": "$source_records.citation_count"},
            }
        },
        {"$sort": [("_id.faculty_id", 1), ("_id.platform", 1), ("_id.year", 1)]},
    ]

    results = await db.papers.aggregate(pipeline).to_list(length=100000)

    # Build lookup: faculty_id -> platform -> year -> citations
    data: dict[str, dict[str, dict[int, int]]] = {}
    for r in results:
        fid = str(r["_id"]["faculty_id"])
        plat = r["_id"]["platform"]
        year = r["_id"]["year"]
        cites = r["citations"] or 0

        if fid not in data:
            data[fid] = {}
        if plat not in data[fid]:
            data[fid][plat] = {}
        data[fid][plat][year] = cites

    # Build report rows
    years = list(range(start_year, end_year + 1))
    rows = []

    for idx, f in enumerate(faculty, 1):
        fid = str(f["_id"])
        row = {
            "sr_no": idx,
            "faculty_id": fid,
            "faculty_name": f.get("name", "Unknown"),
            "designation": f.get("designation", ""),
            "department": f.get("department", ""),
        }

        for plat in platforms:
            plat_data = data.get(fid, {}).get(plat, {})
            plat_row = {}
            total = 0
            for year in years:
                val = plat_data.get(year)
                plat_row[year] = val  # None if missing (will be NA)
                if val is not None:
                    total += val
            plat_row["total"] = total
            row[plat] = plat_row

        rows.append(row)

    # Calculate totals
    totals = {}
    for plat in platforms:
        totals[plat] = {}
        for year in years:
            totals[plat][year] = sum(
                r[plat][year] for r in rows if r[plat][year] is not None
            )
        totals[plat]["total"] = sum(totals[plat][year] for year in years)

    # Calculate averages
    averages = {}
    num_faculty = len(faculty)
    for plat in platforms:
        averages[plat] = {}
        for year in years:
            if totals[plat][year] > 0:
                averages[plat][year] = round(totals[plat][year] / num_faculty, 2)
            else:
                averages[plat][year] = 0
        averages[plat]["total"] = round(totals[plat]["total"] / num_faculty, 2)

    return {
        "report_type": "YEAR_WISE",
        "department": department or "All Departments",
        "start_year": start_year,
        "end_year": end_year,
        "platforms": platforms,
        "years": years,
        "faculty_count": len(faculty),
        "rows": rows,
        "totals": totals,
        "averages": averages,
    }


async def get_month_wise_report(
    db: AsyncIOMotorDatabase,
    department: str | None,
    year: int,
    start_month: int = 1,
    end_month: int = 12,
    platforms: list[str] = ["WOS", "SCOPUS", "GOOGLE_SCHOLAR"],
) -> dict:
    """Generate month-wise citation report for a specific year.
    
    If department is None, includes all faculty across all departments.
    """
    query = {"department": department} if department else {}
    faculty = await db.authors.find(query).to_list(length=1000)
    if not faculty:
        return {"error": "No faculty found" + (f" in department {department}" if department else ""), "rows": []}

    # Aggregate by month
    pipeline = [
        {"$unwind": "$source_records"},
        {
            "$match": {
                "source_records.platform": {"$in": platforms},
                "publication_year": year,
            }
        },
        {
            "$group": {
                "_id": {
                    "faculty_id": {"$arrayElemAt": ["$faculty_ids", 0]},
                    "platform": "$source_records.platform",
                    "month": {"$month": {"$dateFromString": {"dateString": "$publication_date"}}},
                },
                "citations": {"$sum": "$source_records.citation_count"},
            }
        },
    ]

    results = await db.papers.aggregate(pipeline).to_list(length=100000)

    # Build lookup
    data: dict[str, dict[str, dict[int, int]]] = {}
    for r in results:
        fid = str(r["_id"]["faculty_id"])
        plat = r["_id"]["platform"]
        month = r["_id"]["month"]
        cites = r["citations"] or 0

        if fid not in data:
            data[fid] = {}
        if plat not in data[fid]:
            data[fid][plat] = {}
        data[fid][plat][month] = cites

    months = list(range(start_month, end_month + 1))
    rows = []

    for idx, f in enumerate(faculty, 1):
        fid = str(f["_id"])
        row = {
            "sr_no": idx,
            "faculty_id": fid,
            "faculty_name": f.get("name", "Unknown"),
        }

        for plat in platforms:
            plat_data = data.get(fid, {}).get(plat, {})
            plat_row = {}
            total = 0
            for month in months:
                val = plat_data.get(month)
                plat_row[month] = val
                if val is not None:
                    total += val
            plat_row["total"] = total
            row[plat] = plat_row

        rows.append(row)

    # Totals and averages
    totals = {}
    averages = {}
    num_faculty = len(faculty)

    for plat in platforms:
        totals[plat] = {}
        averages[plat] = {}
        for month in months:
            totals[plat][month] = sum(r[plat][month] for r in rows if r[plat][month] is not None)
            averages[plat][month] = round(totals[plat][month] / num_faculty, 2) if totals[plat][month] > 0 else 0
        totals[plat]["total"] = sum(totals[plat][month] for month in months)
        averages[plat]["total"] = round(totals[plat]["total"] / num_faculty, 2)

    return {
        "report_type": "MONTH_WISE",
        "department": department or "All Departments",
        "year": year,
        "start_month": start_month,
        "end_month": end_month,
        "platforms": platforms,
        "months": months,
        "faculty_count": len(faculty),
        "rows": rows,
        "totals": totals,
        "averages": averages,
    }


async def get_date_range_report(
    db: AsyncIOMotorDatabase,
    department: str | None,
    from_date: str,
    to_date: str,
    platforms: list[str] = ["WOS", "SCOPUS", "GOOGLE_SCHOLAR"],
) -> dict:
    """Generate report for custom date range.
    
    If department is None, includes all faculty across all departments.
    """
    query = {"department": department} if department else {}
    faculty = await db.authors.find(query).to_list(length=1000)
    if not faculty:
        return {"error": "No faculty found" + (f" in department {department}" if department else ""), "rows": []}

    from_dt = datetime.fromisoformat(from_date)
    to_dt = datetime.fromisoformat(to_date)

    # Aggregate papers within date range
    pipeline = [
        {"$unwind": "$source_records"},
        {
            "$match": {
                "source_records.platform": {"$in": platforms},
                "publication_date": {
                    "$gte": from_date,
                    "$lte": to_date,
                },
            }
        },
        {
            "$group": {
                "_id": {
                    "faculty_id": {"$arrayElemAt": ["$faculty_ids", 0]},
                    "platform": "$source_records.platform",
                },
                "citations": {"$sum": "$source_records.citation_count"},
                "papers": {"$sum": 1},
            }
        },
    ]

    results = await db.papers.aggregate(pipeline).to_list(length=100000)

    # Build lookup
    data: dict[str, dict[str, dict]] = {}
    for r in results:
        fid = str(r["_id"]["faculty_id"])
        plat = r["_id"]["platform"]
        if fid not in data:
            data[fid] = {}
        data[fid][plat] = {
            "citations": r["citations"] or 0,
            "papers": r["papers"],
        }

    rows = []
    for idx, f in enumerate(faculty, 1):
        fid = str(f["_id"])
        row = {
            "sr_no": idx,
            "faculty_id": fid,
            "faculty_name": f.get("name", "Unknown"),
        }

        for plat in platforms:
            plat_data = data.get(fid, {}).get(plat, {})
            row[plat] = {
                "citations": plat_data.get("citations"),
                "papers": plat_data.get("papers"),
            }

        rows.append(row)

    # Totals and averages
    totals = {}
    averages = {}
    num_faculty = len(faculty)

    for plat in platforms:
        totals[plat] = {
            "citations": sum(r[plat]["citations"] for r in rows if r[plat]["citations"] is not None),
            "papers": sum(r[plat]["papers"] for r in rows if r[plat]["papers"] is not None),
        }
        averages[plat] = {
            "citations": round(totals[plat]["citations"] / num_faculty, 2),
            "papers": round(totals[plat]["papers"] / num_faculty, 2),
        }

    return {
        "report_type": "DATE_RANGE",
        "department": department or "All Departments",
        "from_date": from_date,
        "to_date": to_date,
        "platforms": platforms,
        "faculty_count": len(faculty),
        "rows": rows,
        "totals": totals,
        "averages": averages,
    }
