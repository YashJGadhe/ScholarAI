"""Scopus connector — Elsevier Author Retrieval + Scopus Search APIs.

Summary endpoint (check-first): paper count, cited-by count, h-index.
Document endpoint (full collection only on delta): per-paper metadata with provenance.
Data is labeled Scopus only when it actually comes from Scopus.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..utils.identifiers import normalize_doi, normalize_issn, normalize_isbn, normalize_paper_type, normalize_year
from .http_util import connector_get, log_usage

AUTHOR_URL = "https://api.elsevier.com/content/author/author_id/{aid}"
SEARCH_URL = "https://api.elsevier.com/content/search/scopus"


def _headers() -> dict:
    return {"X-ELS-APIKey": get_settings().SCOPUS_API_KEY, "Accept": "application/json"}


async def fetch_summary(db: AsyncIOMotorDatabase, scopus_id: str) -> dict:
    if not get_settings().SCOPUS_API_KEY:
        return {"source": "SCOPUS", "status": "NOT_CONFIGURED", "message": "SCOPUS_API_KEY not set"}
    res = await connector_get(db, "SCOPUS", AUTHOR_URL.format(aid=scopus_id), "/author/summary/{id}", headers=_headers())
    if not res["ok"]:
        return {"source": "SCOPUS", "status": res["status"], "message": res["message"]}
    entry = ((res["json"].get("author-retrieval-response") or [{}])[0] or {}).get("author-profile") or {}
    prefs = entry.get("preferred-name") or {}
    counts = {
        "name": f"{prefs.get('given-name', '')} {prefs.get('surname', '')}".strip() or None,
        "papers": _int(entry.get("document-count")),
        "citations": _int(entry.get("citedby-count")),
        "h_index": _int(entry.get("h-index")),
    }
    affiliation = (((entry.get("affiliation-current") or {}).get("affiliation") or [{}])[0] or {}).get("ip-doc") or {}
    counts["affiliation"] = affiliation.get("afdispname")
    return {"source": "SCOPUS", "status": "OK", "message": "", "data": counts}


async def fetch_documents(db: AsyncIOMotorDatabase, scopus_id: str, start: int = 0, count: int = 25) -> dict:
    """One page of Scopus documents for au-id(scopus_id). Caller pages as needed."""
    if not get_settings().SCOPUS_API_KEY:
        return {"source": "SCOPUS", "status": "NOT_CONFIGURED", "message": "SCOPUS_API_KEY not set"}
    params = {"query": f"AU-ID({scopus_id})", "start": start, "count": count,
              "field": "eid,dc:title,dc:creator,prism:doi,prism:issn,prism:isbn,prism:publicationName,prism:coverDate,dc:type,citedby-count,link"}
    res = await connector_get(db, "SCOPUS", SEARCH_URL, "/search/scopus", headers=_headers(), params=params)
    if not res["ok"]:
        return {"source": "SCOPUS", "status": res["status"], "message": res["message"]}

    body = res["json"].get("search-results") or {}
    total = _int(body.get("opensearch:totalResults")) or 0
    papers = []
    for e in body.get("entry") or []:
        doi = normalize_doi(e.get("prism:doi"))
        papers.append({
            "eid": e.get("eid"),
            "title": e.get("dc:title"),
            "doi": doi,
            "year": normalize_year((e.get("prism:coverDate") or "")[:4] or None),
            "date": (e.get("prism:coverDate") or None),
            "type": normalize_paper_type(e.get("prism:aggregationType") or e.get("dc:type")),
            "source_name": e.get("prism:publicationName"),
            "issn": [x for x in [normalize_issn(e.get("prism:issn"))] if x],
            "isbn": [x for x in [normalize_isbn(e.get("prism:isbn"))] if x],
            "citations": _int(e.get("citedby-count")),
            "authors": [a.strip() for a in (e.get("dc:creator") or "").split(",") if a.strip()],
            "url": doi and f"https://doi.org/{doi}" or None,
        })
    await log_usage(db, "SCOPUS", "/search/scopus", True, 200, len(papers))
    return {"source": "SCOPUS", "status": "OK", "message": "", "data": {"total": total, "papers": papers}}


def _int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None
