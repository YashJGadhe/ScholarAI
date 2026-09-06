"""Web of Science connector — Clarivate WoS Starter API (official; no scraping).

Fields not exposed by the subscribed plan are returned as None → rendered NA.
Values are never fabricated.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..utils.identifiers import normalize_doi, normalize_issn, normalize_year
from .http_util import connector_get, log_usage

STARTER_URL = "https://wos-api.clarivate.com/wos-starter/v1/documents"


def _headers() -> dict:
    return {"X-ApiKey": get_settings().WOS_API_KEY, "Accept": "application/json"}


async def fetch_documents(db: AsyncIOMotorDatabase, wos_id: str, page: int = 1, limit: int = 50) -> dict:
    if not get_settings().WOS_API_KEY:
        return {"source": "WOS", "status": "NOT_CONFIGURED", "message": "WOS_API_KEY not set — plan required"}
    params = {"databaseId": "WOS", "usrQuery": f"RID={wos_id}", "page": page, "limit": limit}
    res = await connector_get(db, "WOS", STARTER_URL, "/wos-starter/v1/documents", headers=_headers(), params=params)
    if not res["ok"]:
        return {"source": "WOS", "status": res["status"], "message": res["message"]}

    body = res["json"]
    papers = []
    for d in body.get("Documents") or []:
        doi = normalize_doi(d.get("Doi"))
        papers.append({
            "uid": d.get("UID"),
            "title": (d.get("titles") or [{}])[0].get("title") if d.get("titles") else None,
            "doi": doi,
            "year": normalize_year(d.get("PublishedYear") or (d.get("PublicationDate") or "")[:4] or None),
            "date": d.get("PublicationDate"),
            "type": d.get("DocumentType"),
            "source_name": d.get("JournalName"),
            "issn": [x for x in [normalize_issn(d.get("ISSN"))] if x],
            "isbn": [],
            "citations": d.get("TimesCited"),  # None when plan hides it → NA
            "authors": d.get("Authors") or [],
            "url": doi and f"https://doi.org/{doi}" or None,
        })
    await log_usage(db, "WOS", "/wos-starter/v1/documents", True, 200, len(papers))
    return {
        "source": "WOS", "status": "OK", "message": "",
        "data": {"total": body.get("total"), "papers": papers},
    }
