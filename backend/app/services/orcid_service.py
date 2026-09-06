"""ORCID connector — public API (read-only; no key required for public records).

Collects: name, biography, employments, education, works + DOIs.
Also used by identity resolution (ORCID ↔ Scopus link evidence).
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..utils.identifiers import normalize_doi, normalize_orcid, orcid_checksum_valid
from .http_util import connector_get

BASE = "https://pub.orcid.org/v3.0"
HDRS = {"Accept": "application/json"}


async def fetch_profile(db: AsyncIOMotorDatabase, orcid: str) -> dict:
    orcid = normalize_orcid(orcid)
    if not orcid or not orcid_checksum_valid(orcid):
        return {"source": "ORCID", "status": "UNAVAILABLE", "message": "ORCID checksum invalid (ISO 7064 MOD 11-2)"}

    res = await connector_get(db, "ORCID", f"{BASE}/{orcid}/record", "/v3.0/{orcid}/record", headers=HDRS)
    if not res["ok"]:
        return {"source": "ORCID", "status": res["status"], "message": res["message"]}

    rec = res["json"]
    person = rec.get("person", {}) or {}
    name_node = (person.get("name") or {})
    given = (name_node.get("given-names") or {}).get("value", "")
    family = (name_node.get("family-name") or {}).get("value", "")
    biography = ((person.get("biography") or {}).get("content"))

    activities = rec.get("activities-summary", {}) or {}
    employments = [
        (s.get("employment-summary") or {}).get("organization", {}).get("name")
        for grp in ((activities.get("employments") or {}).get("affiliation-group") or [])
        for s in (grp.get("summaries") or [])
    ]
    educations = [
        (s.get("education-summary") or {}).get("organization", {}).get("name")
        for grp in ((activities.get("educations") or {}).get("affiliation-group") or [])
        for s in (grp.get("summaries") or [])
    ]
    works = []
    for grp in ((activities.get("works") or {}).get("group") or []):
        for s in grp.get("work-summary") or []:
            if s:
                works.append(s)
    dois = [
        d for d in (
            normalize_doi((eid.get("external-id-value")))
            for w in works
            for eid in ((w.get("external-ids") or {}).get("external-id") or [])
            if (eid.get("external-id-type") or "").lower() == "doi"
        ) if d
    ]

    return {
        "source": "ORCID",
        "status": "OK",
        "message": "",
        "data": {
            "orcid": orcid,
            "name": f"{given} {family}".strip() or None,
            "biography": biography,
            "employments": [e for e in employments if e],
            "educations": [e for e in educations if e],
            "works_count": len(works),
            "dois": dois,
        },
    }
