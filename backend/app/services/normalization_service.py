"""Normalization layer — applied to every harvested record before storage."""

from ..utils.identifiers import (
    normalize_doi,
    normalize_issn,
    normalize_isbn,
    normalize_name,
    normalize_paper_type,
    normalize_year,
    normalize_date,
)


def normalize_paper(raw: dict) -> dict:
    """Raw connector dict → canonical paper fields (provenance preserved by caller)."""
    return {
        "title": (raw.get("title") or "").strip(),
        "doi": normalize_doi(raw.get("doi")),
        "year": normalize_year(raw.get("year")),
        "date": normalize_date(raw.get("date")),
        "type": normalize_paper_type(raw.get("type")),
        "source_name": (raw.get("source_name") or "").strip() or None,
        "issn": [x for x in [normalize_issn(i) for i in (raw.get("issn") or [])] if x],
        "isbn": [x for x in [normalize_isbn(i) for i in (raw.get("isbn") or [])] if x],
        "citations": raw.get("citations"),  # None → NA; 0 stays 0
        "authors": [normalize_name(a) or a for a in (raw.get("authors") or [])],
        "url": raw.get("url") or (raw.get("doi") and f"https://doi.org/{normalize_doi(raw['doi'])}"),
        "source_id": raw.get("source_id") or raw.get("eid") or raw.get("uid"),
    }
