"""Reports & export — Excel-compatible CSV (UTF-8 BOM), plain CSV, JSON.

Institutional column names are preserved EXACTLY (existing Excel structures stay
compatible). Author-level summary metrics are mapped into each row from the AUTHOR
document — paper documents keep only paper-level fields, so the DB model is never
corrupted. NA is exported as the literal string "NA", never as 0.
"""

import csv
import io
import json

from motor.motor_asyncio import AsyncIOMotorDatabase

INSTITUTIONAL_COLUMNS = [
    "Research Paper Name", "Research Paper Count", "Citation Count", "H-Index Count", "i10-Index Count",
    "Publication Year", "Publication Date", "DOI", "Research Paper Type", "Contributors Name",
    "Source Name", "ISBN", "ISSN", "URL of Research Paper", "Source Platform",
]

PLATFORM_DISPLAY = {"GOOGLE_SCHOLAR": "Google Scholar", "WOS": "Web of Science",
                    "SCOPUS": "Scopus", "ORCID": "ORCID", "RESEARCHGATE": "ResearchGate"}


def _na(v) -> str:
    return "NA" if v is None else str(v)


def _paper_rows(papers: list[dict], authors_by_id: dict) -> list[list]:
    rows = []
    for p in papers:
        owner = next((authors_by_id.get(f) for f in p.get("faculty_ids") or []), None) or {}
        metrics = owner.get("platform_metrics") or {}
        for r in p.get("source_records") or []:
            m = metrics.get(r.get("platform")) or {}
            rows.append([
                p.get("title"),
                _na(m.get("papers")), _na(m.get("citations")), _na(m.get("h_index")), _na(m.get("i10_index")),
                p.get("publication_year") or "NA", p.get("publication_date") or "NA",
                p.get("doi") or "NA", p.get("paper_type") or "NA",
                "; ".join(p.get("contributors") or []) or "NA",
                r.get("source_name") or "NA",
                "; ".join(p.get("isbn") or []) or "NA",
                "; ".join(p.get("issn") or []) or "NA",
                r.get("url") or p.get("paper_url") or "NA",
                PLATFORM_DISPLAY.get(r.get("platform"), r.get("platform")),
            ])
    return rows


def build_csv(columns: list[str], rows: list[list], excel: bool = False) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    w.writerow(columns)
    w.writerows(rows)
    return ("\ufeff" if excel else "") + buf.getvalue()


def build_json(title: str, columns: list[str], rows: list[list]) -> str:
    return json.dumps(
        {"report": title, "rows": [dict(zip(columns, r)) for r in rows]},
        indent=2, ensure_ascii=False, default=str,
    )


async def faculty_report(db: AsyncIOMotorDatabase, author_id: str) -> tuple[str, list, list]:
    from bson import ObjectId

    author = await db.authors.find_one({"_id": ObjectId(author_id)})
    papers = await db.papers.find({"faculty_ids": author_id}).to_list(length=10000)
    authors_by_id = {str(a["_id"]): a for a in await db.authors.find({}).to_list(length=2000)}
    title = f"Faculty Research Report — {(author or {}).get('name', 'Unknown')}"
    return title, INSTITUTIONAL_COLUMNS, _paper_rows(papers, authors_by_id)


async def citation_report(db: AsyncIOMotorDatabase) -> tuple[str, list, list]:
    authors = await db.authors.find({}).to_list(length=2000)
    columns = ["Researcher", "Department", "Source Platform",
               "Research Paper Count", "Citation Count", "H-Index Count", "i10-Index Count"]
    rows = []
    for a in authors:
        for plat in ["SCOPUS", "WOS", "GOOGLE_SCHOLAR", "RESEARCHGATE", "ORCID"]:
            m = (a.get("platform_metrics") or {}).get(plat) or {}
            rows.append([a.get("name"), a.get("department"), PLATFORM_DISPLAY.get(plat, plat),
                         _na(m.get("papers")), _na(m.get("citations")), _na(m.get("h_index")), _na(m.get("i10_index"))])
    return "Citation Report (by platform)", columns, rows
