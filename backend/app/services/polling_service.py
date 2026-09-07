"""On-Demand Polling with mandatory SUMMARY CHECK-FIRST.

Flow per researcher:
  1. Fetch ONLY profile-level summaries (paper/citation counts, h-index).
  2. Compare with the author's previous_summary stored in MongoDB.
  3. Identical → UNCHANGED: stop. No publication-level calls are made.
  4. Different → DELTA: run full collection, normalize, dedupe/merge, update
     platform_metrics, append a metrics_history snapshot, store new previous_summary.
Polling is logged with api_calls + duration for credit management.
"""

import time
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models import paper_doc, platform_metrics_doc, polling_log_doc, snapshot_doc, source_record_doc
from ..utils.identifiers import paper_id
from . import google_scholar_service, orcid_service, scopus_service, wos_service
from .change_detector import detect_and_notify, notify_platform_error, notify_rate_limit
from .deduplication_service import upsert_paper
from .normalization_service import normalize_paper


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def poll_author(db: AsyncIOMotorDatabase, author_id: str, triggered_by: str) -> dict:
    t0 = time.perf_counter()
    author = await db.authors.find_one({"_id": ObjectId(author_id)})
    if not author:
        raise LookupError("Author not found")

    ids = author.get("identifiers") or {}
    prev = author.get("previous_summary") or {}
    remote: dict[str, dict] = {}
    api_calls = 0

    # ---- 1) summary-only phase ------------------------------------------
    if ids.get("scopus_id"):
        r = await scopus_service.fetch_summary(db, ids["scopus_id"])
        api_calls += 1
        if r["status"] == "OK":
            d = r["data"]
            remote["SCOPUS"] = {"papers": d.get("papers"), "citations": d.get("citations"), "h_index": d.get("h_index")}
    if ids.get("google_scholar_id"):
        r = await google_scholar_service.fetch_summary(db, ids["google_scholar_id"])
        api_calls += 1
        if r["status"] == "OK":
            d = r["data"]
            remote["GOOGLE_SCHOLAR"] = {"papers": d.get("papers"), "citations": d.get("citations"),
                                        "h_index": d.get("h_index"), "i10_index": d.get("i10_index")}
    if ids.get("wos_id"):
        r = await wos_service.fetch_documents(db, ids["wos_id"], page=1, limit=1)
        api_calls += 1
        if r["status"] == "OK":
            remote["WOS"] = None  # counts computed during full collection when delta found

    # ---- 2) compare with MongoDB snapshot --------------------------------
    changes: list[dict] = []
    reasons: list[str] = []
    label = {"SCOPUS": "Scopus", "GOOGLE_SCHOLAR": "Google Scholar", "WOS": "Web of Science"}
    for plat, rem in remote.items():
        if rem is None:
            continue
        p = prev.get(plat) or {}
        for field in ("papers", "citations", "h_index"):
            rv, pv = rem.get(field), p.get(field)
            if rv is not None and pv is not None and rv != pv:
                changes.append({"field": field, "platform": plat, "from": pv, "to": rv})
                reasons.append(f"{field.replace('_', ' ').title()} {pv} → {rv} ({label[plat]})")
    changed = len(changes) > 0

    # ---- 3) UNCHANGED → stop, no publication-level fetch -----------------
    if not changed:
        await db.authors.update_one({"_id": author["_id"]}, {"$set": {"last_polled_at": _now()}})
        log = polling_log_doc(str(author["_id"]), author.get("name", ""), triggered_by, "UNCHANGED",
                              False, ["Remote summary identical to stored snapshot — publication-level fetch skipped"],
                              [], api_calls, int((time.perf_counter() - t0) * 1000))
        await db.polling_logs.insert_one(log)
        return {"result": "UNCHANGED", "change_detected": False, "api_calls": api_calls,
                "duration_ms": log["duration_ms"], "changes": []}

    # ---- 4) DELTA → full collection pipeline ------------------------------
    new_platform_metrics: dict[str, dict] = {}
    inserted = merged = flagged = 0

    if ids.get("scopus_id") and "SCOPUS" in remote:
        total = remote["SCOPUS"].get("papers") or 0
        cites = h = None
        start = 0
        while start < max(total, 1):
            page = await scopus_service.fetch_documents(db, ids["scopus_id"], start=start, count=25)
            api_calls += 1
            if page["status"] != "OK":
                break
            docs = page["data"]["papers"]
            if not docs:
                break
            cites_list: list[int] = []
            for raw in docs:
                p = normalize_paper(raw)
                rec = source_record_doc("SCOPUS", p["source_name"] or "", p["source_id"] or "", p["citations"], p["url"])
                doc = paper_doc(p["title"], p["year"], p["date"], p["doi"], p["type"], p["authors"] or [author.get("name", "")],
                                p["isbn"], p["issn"], p["url"], [str(author["_id"])], [rec])
                _, action = await upsert_paper(db, doc)
                inserted += action == "INSERTED"; merged += action == "MERGED"; flagged += action == "FLAGGED"
                if isinstance(p["citations"], int):
                    cites_list.append(p["citations"])
            cites = sum(cites_list) if cites is None else cites
            start += len(docs)
            if len(docs) < 25:
                break
        s = await scopus_service.fetch_summary(db, ids["scopus_id"]); api_calls += 1
        if s["status"] == "OK":
            d = s["data"]
            h = d.get("h_index"); cites = d.get("citations")
            remote["SCOPUS"] = {"papers": d.get("papers"), "citations": cites, "h_index": h}
        new_platform_metrics["SCOPUS"] = platform_metrics_doc("SCOPUS", remote["SCOPUS"]["papers"], cites, h)

    if ids.get("google_scholar_id") and "GOOGLE_SCHOLAR" in remote:
        after = None
        cites_list2: list[int] = []
        for _ in range(20):  # safety cap on pages
            page = await google_scholar_service.fetch_articles(db, ids["google_scholar_id"], after)
            api_calls += 1
            if page["status"] != "OK":
                break
            docs = page["data"]["papers"]
            for raw in docs:
                p = normalize_paper(raw)
                rec = source_record_doc("GOOGLE_SCHOLAR", p["source_name"] or "", p["source_id"] or "", p["citations"], p["url"])
                doc = paper_doc(p["title"], p["year"], p["date"], p["doi"], p["type"], p["authors"] or [author.get("name", "")],
                                [], p["issn"], p["url"], [str(author["_id"])], [rec])
                _, action = await upsert_paper(db, doc)
                inserted += action == "INSERTED"; merged += action == "MERGED"; flagged += action == "FLAGGED"
                if isinstance(p["citations"], int):
                    cites_list2.append(p["citations"])
            after = page["data"].get("next")
            if not after or not docs:
                break
        g = remote["GOOGLE_SCHOLAR"]
        new_platform_metrics["GOOGLE_SCHOLAR"] = platform_metrics_doc(
            "GOOGLE_SCHOLAR", g.get("papers"), g.get("citations"), g.get("h_index"), g.get("i10_index"))

    # ORCID profile refresh (works count feeds the ORCID summary card)
    if ids.get("orcid"):
        o = await orcid_service.fetch_profile(db, ids["orcid"]); api_calls += 1
        if o["status"] == "OK":
            new_platform_metrics["ORCID"] = platform_metrics_doc("ORCID", o["data"]["works_count"], None, None)

    update = {
        "platform_metrics": new_platform_metrics,
        "last_polled_at": _now(),
        "last_changed_at": _now(),
        "updated_at": _now(),
        "previous_summary": {k: {kk: vv for kk, vv in v.items() if kk != "i10_index"} for k, v in remote.items() if v},
    }
    await db.authors.update_one({"_id": author["_id"]}, {"$set": update})

    # historical snapshots (enables 20 → 25 style delta reporting)
    snaps = [snapshot_doc(str(author["_id"]), k, v.get("papers"), v.get("citations"), v.get("h_index"), v.get("i10_index"))
             for k, v in new_platform_metrics.items()]
    if snaps:
        await db.metrics_history.insert_many(snaps)

    log = polling_log_doc(str(author["_id"]), author.get("name", ""), triggered_by, "CHANGED", True,
                          reasons or ["Delta detected during full collection"], changes,
                          api_calls, int((time.perf_counter() - t0) * 1000))
    await db.polling_logs.insert_one(log)

    # ---- 5) Automatic notifications for detected changes -----------------
    # Collect newly inserted papers per platform for notification
    new_papers_by_platform: dict[str, list[dict]] = {}
    for plat in ["SCOPUS", "GOOGLE_SCHOLAR", "WOS", "ORCID"]:
        if plat in new_platform_metrics:
            # Query papers inserted during this poll (created_at within last minute)
            from datetime import datetime, timedelta, timezone
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            papers = await db.papers.find({
                "faculty_ids": str(author["_id"]),
                "source_records.platform": plat,
                "created_at": {"$gte": cutoff}
            }).to_list(length=100)
            new_papers_by_platform[plat] = papers

    # Trigger notifications for each platform with changes
    for plat, papers in new_papers_by_platform.items():
        await detect_and_notify(
            db, str(author["_id"]), author.get("name", ""), plat,
            prev, remote, papers if papers else None,
        )

    return {"result": "CHANGED", "change_detected": True, "changes": changes,
            "papers": {"inserted": inserted, "merged": merged, "flagged": flagged},
            "api_calls": api_calls, "duration_ms": log["duration_ms"]}
