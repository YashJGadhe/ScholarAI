"""Google Scholar connector — via the authorized SerpApi Google Scholar Author API.

Direct scraping of Google Scholar is intentionally NOT implemented.
OpenAlex may be used only as a fallback cross-reference and must always keep its
own source label — never relabeled as Google Scholar / Scopus / WoS.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..utils.identifiers import normalize_doi, normalize_year
from .http_util import connector_get

SERPAPI_URL = "https://serpapi.com/search"


async def fetch_summary(db: AsyncIOMotorDatabase, scholar_id: str) -> dict:
    if not get_settings().SERPAPI_API_KEY:
        return {"source": "GOOGLE_SCHOLAR", "status": "NOT_CONFIGURED", "message": "SERPAPI_API_KEY not set"}
    params = {"engine": "google_scholar_author", "author_id": scholar_id, "api_key": get_settings().SERPAPI_API_KEY}
    res = await connector_get(db, "GOOGLE_SCHOLAR", SERPAPI_URL, "serpapi/scholar-author", params=params)
    if not res["ok"]:
        return {"source": "GOOGLE_SCHOLAR", "status": res["status"], "message": res["message"]}
    author = res["json"].get("author") or {}
    return {
        "source": "GOOGLE_SCHOLAR", "status": "OK", "message": "",
        "data": {
            "name": author.get("name"),
            "affiliation": author.get("affiliation"),
            "papers": author.get("articles_count"),
            "citations": author.get("cited_by"),
            "h_index": author.get("h_index"),
            "i10_index": author.get("i10_index"),
        },
    }


async def fetch_articles(db: AsyncIOMotorDatabase, scholar_id: str, after_author: str | None = None) -> dict:
    if not get_settings().SERPAPI_API_KEY:
        return {"source": "GOOGLE_SCHOLAR", "status": "NOT_CONFIGURED", "message": "SERPAPI_API_KEY not set"}
    params = {"engine": "google_scholar_author", "author_id": scholar_id, "view_op": "list_works",
              "sortby": "pubdate", "api_key": get_settings().SERPAPI_API_KEY}
    if after_author:
        params["after_author"] = after_author
    res = await connector_get(db, "GOOGLE_SCHOLAR", SERPAPI_URL, "serpapi/scholar-author?view_op=list_works", params=params)
    if not res["ok"]:
        return {"source": "GOOGLE_SCHOLAR", "status": res["status"], "message": res["message"]}
    articles = []
    for a in res["json"].get("articles") or []:
        cid = a.get("citation_id")
        doi = normalize_doi(a.get("doi"))
        articles.append({
            "source_id": cid,
            "title": a.get("title"),
            "doi": doi,
            "year": normalize_year(a.get("year")),
            "date": None,
            "type": "Article",
            "source_name": a.get("publication"),
            "issn": [], "isbn": [],
            "citations": a.get("cited_by_count"),
            "authors": [x.strip() for x in (a.get("authors") or "").split(",") if x.strip()],
            "url": a.get("link") or (doi and f"https://doi.org/{doi}"),
        })
    next_token = ((res["json"].get("pagination") or {}).get("next"))
    return {"source": "GOOGLE_SCHOLAR", "status": "OK", "message": "",
            "data": {"papers": articles, "next": _token_from(next_token)}}


def _token_from(url: str | None) -> str | None:
    if not url:
        return None
    import re
    m = re.search(r"after_author=([^&]+)", url)
    return m.group(1) if m else None
