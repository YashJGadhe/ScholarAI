"""Duplicate detection & record merging.

Hierarchy:
  1. DOI exact match                     → MERGE (confidence ~0.99)
  2. Source identifier exact match       → MERGE (confidence ~0.95)
  3. Normalized title + publication year → REVIEW (confidence ~0.80) → POSSIBLE_DUPLICATE
  4. Title + contributor similarity      → REVIEW (lower confidence)
Low-confidence matches are flagged, never auto-merged. Merged records keep
provenance of every contributing source record.
"""

import re

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..utils.identifiers import normalize_doi, name_similarity


def _norm_title(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", (t or "").lower())).strip()


def find_duplicate(db_papers: list[dict], candidate: dict) -> dict | None:
    """Returns {"existing": paper, "confidence": float, "method": str, "recommended": "MERGE"|"REVIEW"} or None."""
    cdoi = normalize_doi(candidate.get("doi"))
    if cdoi:
        for e in db_papers:
            if normalize_doi(e.get("doi")) == cdoi:
                return {"existing": e, "confidence": 0.99, "method": "DOI_EXACT", "recommended": "MERGE"}
    for e in db_papers:
        for cr in candidate.get("source_records") or []:
            if any(er.get("platform") == cr.get("platform") and er.get("source_id") == cr.get("source_id")
                   for er in e.get("source_records") or []):
                return {"existing": e, "confidence": 0.95, "method": "SOURCE_ID_EXACT", "recommended": "MERGE"}
    for e in db_papers:
        if _norm_title(e.get("title", "")) == _norm_title(candidate.get("title", "")) \
                and e.get("publication_year") == candidate.get("publication_year") \
                and candidate.get("publication_year"):
            return {"existing": e, "confidence": 0.80, "method": "TITLE_YEAR", "recommended": "REVIEW"}
    for e in db_papers:
        ts = 1.0 if _norm_title(e.get("title", "")) == _norm_title(candidate.get("title", "")) else \
            name_similarity(e.get("title", ""), candidate.get("title", ""))
        ca = set(candidate.get("contributors") or [])
        ea = set(e.get("contributors") or [])
        cs = len(ca & ea) / max(1, len(ca | ea))
        if ts >= 0.85 and cs >= 0.5:
            return {"existing": e, "confidence": round(0.6 + 0.3 * ts, 2), "method": "TITLE_CONTRIBUTOR_SIMILARITY", "recommended": "REVIEW"}
    return None


def merge_records(existing: dict, incoming: dict) -> dict:
    """Merge incoming into existing, preserving provenance (source_records are additive)."""
    have = {(r.get("platform"), r.get("source_id")) for r in existing.get("source_records") or []}
    extra = [r for r in incoming.get("source_records") or [] if (r.get("platform"), r.get("source_id")) not in have]
    existing["source_records"] = (existing.get("source_records") or []) + extra
    existing["contributors"] = sorted(set((existing.get("contributors") or []) + (incoming.get("contributors") or [])))
    existing["faculty_ids"] = sorted(set((existing.get("faculty_ids") or []) + (incoming.get("faculty_ids") or [])))
    existing["issn"] = sorted(set((existing.get("issn") or []) + (incoming.get("issn") or [])))
    existing["isbn"] = sorted(set((existing.get("isbn") or []) + (incoming.get("isbn") or [])))
    dedup = existing.get("dedup") or {"status": "UNIQUE", "merged_from": []}
    dedup["status"] = "MERGED"
    dedup["merged_from"] = sorted(set((dedup.get("merged_from") or []) + [incoming.get("_id", "?")]))
    existing["dedup"] = dedup
    return existing


async def upsert_paper(db: AsyncIOMotorDatabase, paper: dict) -> tuple[str, str]:
    """Insert or merge one normalized paper. Returns (paper_id, action: INSERTED|MERGED|FLAGGED)."""
    match = find_duplicate(await db.papers.find({}).to_list(length=5000), paper)
    if match and match["recommended"] == "MERGE":
        merged = merge_records(match["existing"], paper)
        await db.papers.replace_one({"_id": merged["_id"]}, merged)
        return merged["_id"], "MERGED"
    if match:
        paper["dedup"] = {"status": "POSSIBLE_DUPLICATE", "merged_from": [], "confidence": match["confidence"]}
    await db.papers.update_one({"_id": paper["_id"]}, {"$set": paper}, upsert=True)
    return paper["_id"], ("FLAGGED" if match else "INSERTED")
