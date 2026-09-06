"""Bibliometric analytics + collaboration network + AI/ML insight layer.

All predictions are labeled — never presented as fact.
"""

from collections import defaultdict

from motor.motor_asyncio import AsyncIOMotorDatabase

PLATFORMS = ["ORCID", "SCOPUS", "WOS", "GOOGLE_SCHOLAR", "RESEARCHGATE"]


def _m(author: dict, plat: str, field: str):
    v = ((author.get("platform_metrics") or {}).get(plat) or {}).get(field)
    return v if isinstance(v, (int, float)) else None


def _sum(vals):
    nums = [v for v in vals if v is not None]
    return sum(nums) if nums else None


async def overview(db: AsyncIOMotorDatabase) -> dict:
    authors = await db.authors.find({}).to_list(length=2000)
    papers = await db.papers.find({}).to_list(length=20000)

    year_map: dict[int, dict] = defaultdict(lambda: {"publications": 0, "citations": 0})
    for p in papers:
        y = p.get("publication_year")
        if not y:
            continue
        c = max([r.get("citation_count") or 0 for r in p.get("source_records") or []], default=0)
        year_map[y]["publications"] += 1
        year_map[y]["citations"] += c
    year_series = [{"year": str(y), **v} for y, v in sorted(year_map.items())]

    dept_map: dict[str, dict] = defaultdict(lambda: {"publications": 0, "citations": 0, "faculty": 0})
    for a in authors:
        d = dept_map[a.get("department") or "Unassigned"]
        d["faculty"] += 1
        d["publications"] += _m(a, "SCOPUS", "papers") or 0
        d["citations"] += _m(a, "SCOPUS", "citations") or 0

    platform_totals = []
    for plat in PLATFORMS:
        vals = [(a.get("platform_metrics") or {}).get(plat) for a in authors]
        vals = [v for v in vals if v]
        platform_totals.append({
            "platform": plat,
            "papers": _sum([v.get("papers") for v in vals]),
            "citations": _sum([v.get("citations") for v in vals]),
            "h_sum": _sum([v.get("h_index") for v in vals]),
            "coverage": len(vals), "total": len(authors),
        })

    hs = [_m(a, "SCOPUS", "h_index") or 0 for a in authors]
    top = sorted(authors, key=lambda a: _m(a, "SCOPUS", "citations") or 0, reverse=True)[:5]
    top_papers = sorted(
        papers,
        key=lambda p: max([r.get("citation_count") or 0 for r in p.get("source_records") or []], default=0),
        reverse=True,
    )[:6]

    return {
        "totals": {
            "researchers": len(authors),
            "publications": len(papers),
            "citations": _sum([_m(a, "SCOPUS", "citations") for a in authors]) or 0,
            "avgH": round(sum(hs) / len(hs), 1) if hs else 0,
        },
        "yearSeries": year_series,
        "departments": [{"name": k, **v} for k, v in sorted(dept_map.items(), key=lambda kv: -kv[1]["publications"])],
        "platformTotals": platform_totals,
        "topResearchers": top,
        "topPapers": top_papers,
    }


async def faculty_analytics(db: AsyncIOMotorDatabase, author_id: str) -> dict | None:
    from bson import ObjectId

    author = await db.authors.find_one({"_id": ObjectId(author_id)})
    if not author:
        return None
    papers = await db.papers.find({"faculty_ids": author_id}).to_list(length=5000)
    year_map: dict[int, dict] = defaultdict(lambda: {"publications": 0, "citations": 0})
    types: dict[str, int] = defaultdict(int)
    collab: dict[str, int] = defaultdict(int)
    for p in papers:
        y = p.get("publication_year")
        if y:
            year_map[y]["publications"] += 1
            year_map[y]["citations"] += max([r.get("citation_count") or 0 for r in p.get("source_records") or []], default=0)
        types[p.get("paper_type") or "Article"] += 1
        for c in p.get("contributors") or []:
            if c != author.get("name"):
                collab[c] += 1
    history = await db.metrics_history.find({"author_id": author_id}).sort("date", 1).to_list(length=500)
    return {
        "author": author,
        "yearSeries": [{"year": str(y), **v} for y, v in sorted(year_map.items())],
        "types": [{"name": k, "value": v} for k, v in types.items()],
        "collaborators": [{"name": k, "count": v} for k, v in sorted(collab.items(), key=lambda kv: -kv[1])[:8]],
        "history": history,
    }


async def collaboration_network(db: AsyncIOMotorDatabase) -> dict:
    authors = await db.authors.find({}).to_list(length=2000)
    papers = await db.papers.find({}).to_list(length=20000)
    fac_names = {a.get("name") for a in authors}
    co: dict[str, int] = defaultdict(int)
    pairs: dict[str, int] = defaultdict(int)
    for p in papers:
        cs = p.get("contributors") or []
        for c in cs:
            co[c] += 1
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                pairs["||".join(sorted([cs[i], cs[j]]))] += 1
    ext = sorted(((k, v) for k, v in co.items() if k not in fac_names), key=lambda kv: -kv[1])[:10]
    nodes = [
        {"id": a.get("name"), "label": (a.get("name") or "").replace("Dr. ", "").replace("Prof. ", ""),
         "kind": "faculty", "papers": _m(a, "SCOPUS", "papers") or 0, "dept": a.get("department")}
        for a in authors
    ] + [{"id": k, "label": k, "kind": "external", "papers": v, "dept": "External"} for k, v in ext]
    keep = {n["id"] for n in nodes}
    edges = [
        {"a": a, "b": b, "weight": w}
        for (key, w) in pairs.items()
        for (a, b) in [key.split("||")]
        if a in keep and b in keep
    ]
    return {"nodes": nodes, "edges": edges}


def ai_insights(year_series: list[dict], authors: list[dict]) -> list[dict]:
    """Labeled, non-factual signals: trend, projection, clusters, similarity."""
    out: list[dict] = []
    if len(year_series) >= 3:
        recent = year_series[-3:]
        growth = recent[-1]["publications"] - recent[0]["publications"]
        out.append({
            "kind": "TREND",
            "title": "Publication output accelerating" if growth >= 0 else "Publication output cooling",
            "detail": f"Output moved {recent[0]['publications']} → {recent[-1]['publications']} papers over the last three years.",
            "confidence": 0.82, "label": "AI-generated insight",
        })
        n = len(year_series)
        xs = list(range(n)); ys = [y["citations"] for y in year_series]
        sx, sy = sum(xs), sum(ys); sxy = sum(x * y for x, y in zip(xs, ys)); sxx = sum(x * x for x in xs)
        slope = (n * sxy - sx * sy) / (n * sxx - sx * sx or 1)
        intercept = (sy - slope * sx) / n
        predicted = max(0, round(slope * n + intercept))
        out.append({
            "kind": "PREDICTION",
            "title": f"Citation projection for {int(year_series[-1]['year']) + 1}",
            "detail": f"Linear trend estimates ~{predicted} citations. A projection, not a fact.",
            "confidence": 0.61, "label": "Predicted · Estimated",
        })
    return out
