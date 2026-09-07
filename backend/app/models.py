"""MongoDB document builders for users, authors, papers, analytics snapshots.

Field sets mirror the web app contracts exactly (platform_metrics, identity,
source_records, provenance) so both tiers share one data model.
"""

from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def user_doc(name: str, email: str, password_hash: str, role: str, faculty_id: str | None = None) -> dict:
    return {
        "name": name,
        "email": email.lower(),
        "password_hash": password_hash,
        "role": role,  # ADMIN | FACULTY | STUDENT
        "active": True,
        "faculty_id": faculty_id,
        "created_at": _now(),
        "last_login_at": None,
    }


def platform_metrics_doc(platform: str, papers, citations, h_index, i10_index=None, note: str | None = None) -> dict:
    return {
        "papers": papers,
        "citations": citations,
        "h_index": h_index,
        "i10_index": i10_index,
        "last_updated": _now(),
        # provenance — never lost during normalization/merging
        "provenance": {"source_platform": platform, "retrieved_at": _now(), "note": note},
    }


def author_doc(
    name: str,
    department: str,
    designation: str,
    email: str,
    identifiers: dict,
    profile_urls: dict,
    identity: dict,
) -> dict:
    return {
        "name": name,
        "department": department,
        "designation": designation,
        "email": email,
        "identifiers": identifiers,        # orcid / scopus_id / google_scholar_id / wos_id / researchgate_id
        "profile_urls": profile_urls,      # orcid / scopus / google_scholar / researchgate / wos
        "platform_metrics": {},            # ORCID / SCOPUS / WOS / GOOGLE_SCHOLAR / RESEARCHGATE (kept separate!)
        "research_areas": [],
        "identity": identity,              # status + primary/secondary evidence
        "last_polled_at": None,
        "last_changed_at": None,
        "previous_summary": None,          # Summary Check-First baseline
        "created_at": _now(),
        "updated_at": _now(),
    }


def source_record_doc(platform: str, source_name: str, source_id: str, citation_count, url: str | None) -> dict:
    return {
        "platform": platform,
        "source_name": source_name,
        "source_id": source_id,
        "citation_count": citation_count,  # null = NA (unknown), 0 = confirmed zero
        "retrieved_at": _now(),
        "url": url,
        "validation_status": "UNVALIDATED",
    }


def paper_doc(
    title: str,
    publication_year: int | None,
    publication_date: str | None,
    doi: str | None,
    paper_type: str,
    contributors: list[str],
    isbn: list[str],
    issn: list[str],
    paper_url: str | None,
    faculty_ids: list[str],
    source_records: list[dict],
) -> dict:
    first = source_records[0] if source_records else {"platform": "UNKNOWN", "source_id": title}
    from .utils.identifiers import paper_id

    return {
        "_id": paper_id(doi, first["platform"], first["source_id"]),
        "title": title,
        "publication_year": publication_year,
        "publication_date": publication_date,
        "doi": doi,
        "paper_type": paper_type,
        "contributors": contributors,
        "isbn": isbn,
        "issn": issn,
        "paper_url": paper_url,
        "keywords": [],
        "faculty_ids": faculty_ids,
        "source_records": source_records,  # per-platform records — metrics never merged incorrectly
        "dedup": {"status": "UNIQUE", "merged_from": []},
        "created_at": _now(),
        "updated_at": _now(),
    }


def snapshot_doc(author_id: str, platform: str, papers, citations, h_index, i10_index=None) -> dict:
    return {
        "author_id": author_id,
        "platform": platform,
        "date": _now(),
        "papers": papers,
        "citations": citations,
        "h_index": h_index,
        "i10_index": i10_index,
    }


def polling_log_doc(author_id: str, author_name: str, triggered_by: str, result: str,
                    change_detected: bool, change_reason: list[str], changes: list[dict],
                    api_calls: int, duration_ms: int) -> dict:
    return {
        "author_id": author_id,
        "author_name": author_name,
        "triggered_by": triggered_by,
        "at": _now(),
        "result": result,  # UNCHANGED | CHANGED | ERROR
        "change_detected": change_detected,
        "change_reason": change_reason,
        "changes": changes,
        "api_calls": api_calls,
        "duration_ms": duration_ms,
    }


def api_usage_doc(platform: str, endpoint: str, success: bool, status_code: int, estimated_usage: int) -> dict:
    return {
        "platform": platform,
        "endpoint": endpoint,
        "at": _now(),
        "success": success,
        "status_code": status_code,
        "estimated_usage": estimated_usage,
    }


def notification_doc(
    recipient_user_id: str, author_id: str | None, event_type: str, platform: str | None,
    priority: str, title: str, message: str, paper_id: str | None = None,
    paper_title: str | None = None, metadata: dict | None = None,
) -> dict:
    return {
        "recipient_user_id": recipient_user_id,
        "author_id": author_id,
        "event_type": event_type,
        "platform": platform,
        "priority": priority,
        "title": title,
        "message": message,
        "paper_id": paper_id,
        "paper_title": paper_title,
        "metadata": metadata or {},
        "is_read": False,
        "created_at": _now(),
        "read_at": None,
    }
