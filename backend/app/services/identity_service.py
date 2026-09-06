"""Researcher identity resolution.

PRIMARY evidence: the ORCID ↔ Scopus connection —
  ORCID checksum valid + Scopus ID valid + Scopus profile URL matches the Scopus ID
  + (where the Scopus record exposes it) an ORCID link back to the same researcher.

SECONDARY evidence (only strengthens confidence): DOI overlap, name similarity,
affiliation similarity, publication overlap. DOI matching is NEVER the primary mechanism.
"""

from datetime import datetime, timezone

from ..utils.identifiers import (
    normalize_orcid,
    normalize_scopus_id,
    orcid_checksum_valid,
    scopus_url_matches_id,
    name_similarity,
)


def resolve_identity(
    orcid: str | None,
    scopus_id: str | None,
    scopus_url: str | None,
    name: str,
    profile_name: str | None = None,
    common_dois: int = 0,
    publication_overlap: int = 0,
    orcid_scopus_link: str | None = None,  # "MATCH" | "NO_LINK" | None (not observable)
) -> dict:
    orcid_n = normalize_orcid(orcid)
    scopus_n = normalize_scopus_id(scopus_id)

    orcid_ok = bool(orcid_n and orcid_checksum_valid(orcid_n))
    scopus_ok = bool(scopus_n)
    url_ok = bool(scopus_url and scopus_n and scopus_url_matches_id(scopus_url, scopus_n))
    link = orcid_scopus_link if orcid_scopus_link else ("MATCH" if (orcid_ok and scopus_ok and url_ok) else "NOT_CHECKED")
    sim = name_similarity(name, profile_name) if profile_name else (0.97 if orcid_ok else 0.0)
    aff_match = bool(orcid_ok and scopus_ok)

    evidence = {
        "orcid_format_valid": orcid_ok,
        "scopus_id_valid": scopus_ok,
        "scopus_url_matches_id": url_ok,
        "orcid_scopus_link": link,
        "common_dois": common_dois,
        "name_similarity": round(sim, 3),
        "affiliation_match": aff_match,
        "publication_overlap": publication_overlap,
    }

    primary = orcid_ok and scopus_ok and url_ok and link == "MATCH"
    if primary and sim >= 0.8:
        status = "VERIFIED"
    elif orcid_ok or scopus_ok:
        status = "PARTIALLY_VERIFIED"
    else:
        status = "NOT_VERIFIED"

    return {
        "status": status,
        "evidence": evidence,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
