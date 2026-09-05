/* ScholarAI — analytics_service + reports (bibliometrics, collaboration
   network, AI/ML insight layer, report builders). */

import type { Author, Paper, Platform } from "./core";
import { fmtMetric } from "./core";
import { getDB } from "./db";

export const maxCitations = (p: Paper): number =>
  p.source_records.reduce((m, r) => Math.max(m, r.citation_count ?? 0), 0);

export const primaryRecord = (p: Paper) =>
  p.source_records.find((r) => r.platform === "SCOPUS") ?? p.source_records[0];

export function byYearSeries(papers: Paper[]) {
  const map = new Map<number, { publications: number; citations: number }>();
  papers.forEach((p) => {
    const e = map.get(p.publication_year) ?? { publications: 0, citations: 0 };
    e.publications++;
    e.citations += maxCitations(p);
    map.set(p.publication_year, e);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year: String(year), ...v }));
}

export function overview() {
  const db = getDB();
  const { authors, papers } = db;
  const scopus = (a: Author) => a.platform_metrics.SCOPUS;
  const totalCitations = authors.reduce((s, a) => s + (scopus(a)?.citations ?? 0), 0);
  const hs = authors.map((a) => scopus(a)?.h_index ?? 0);
  const avgH = hs.length ? Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 10) / 10 : 0;
  const yearSeries = byYearSeries(papers);

  const deptMap = new Map<string, { publications: number; citations: number; faculty: number }>();
  authors.forEach((a) => {
    const e = deptMap.get(a.department) ?? { publications: 0, citations: 0, faculty: 0 };
    e.faculty++;
    e.publications += scopus(a)?.papers ?? 0;
    e.citations += scopus(a)?.citations ?? 0;
    deptMap.set(a.department, e);
  });

  const platformTotals = (["ORCID", "SCOPUS", "WOS", "GOOGLE_SCHOLAR", "RESEARCHGATE"] as Platform[]).map((plat) => {
    const vals = authors.map((a) => a.platform_metrics[plat]).filter(Boolean);
    const sum = (k: "papers" | "citations" | "h_index") => {
      const nums = vals.map((v) => v![k]).filter((v): v is number => v !== null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
    };
    return { platform: plat, papers: sum("papers"), citations: sum("citations"), h_sum: sum("h_index"), coverage: vals.length, total: authors.length };
  });

  const topResearchers = [...authors]
    .sort((a, b) => (scopus(b)?.citations ?? 0) - (scopus(a)?.citations ?? 0))
    .slice(0, 5);

  const topPapers = [...papers].sort((a, b) => maxCitations(b) - maxCitations(a)).slice(0, 6);

  const recent = db.polling_logs.slice(0, 6);
  return {
    totals: { researchers: authors.length, publications: papers.length, citations: totalCitations, avgH },
    yearSeries,
    departments: [...deptMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.publications - a.publications),
    platformTotals,
    topResearchers,
    topPapers,
    recent,
  };
}

export function facultyAnalytics(authorId: string) {
  const db = getDB();
  const author = db.authors.find((a) => a._id === authorId);
  if (!author) return null;
  const papers = db.papers.filter((p) => p.faculty_ids.includes(authorId));
  const yearSeries = byYearSeries(papers);
  const types = new Map<string, number>();
  papers.forEach((p) => types.set(p.paper_type, (types.get(p.paper_type) ?? 0) + 1));
  const history = db.metrics_history.filter((m) => m.author_id === authorId).sort((a, b) => a.date.localeCompare(b.date));
  const collaborators = new Map<string, number>();
  papers.forEach((p) => p.contributors.forEach((c) => {
    if (c !== author.name) collaborators.set(c, (collaborators.get(c) ?? 0) + 1);
  }));
  return {
    author,
    papers,
    yearSeries,
    types: [...types.entries()].map(([name, value]) => ({ name, value })),
    history,
    collaborators: [...collaborators.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
  };
}

/* ---------------- collaboration network ---------------- */

export interface NetNode { id: string; label: string; kind: "faculty" | "external"; papers: number; dept: string }
export interface NetEdge { a: string; b: string; weight: number }

export function collaborationNetwork() {
  const db = getDB();
  const coCount = new Map<string, number>();
  const pairCount = new Map<string, number>();
  db.papers.forEach((p) => {
    const cs = p.contributors;
    cs.forEach((c) => coCount.set(c, (coCount.get(c) ?? 0) + 1));
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const key = [cs[i], cs[j]].sort().join("||");
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  });
  const facByName = new Map(db.authors.map((a) => [a.name, a]));
  const topExternal = [...coCount.entries()]
    .filter(([name]) => !facByName.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const nodes: NetNode[] = [
    ...db.authors.map((a) => ({ id: a.name, label: a.name.replace(/^Dr\.?\s+/, ""), kind: "faculty" as const, papers: a.platform_metrics.SCOPUS?.papers ?? 0, dept: a.department })),
    ...topExternal.map(([name, c]) => ({ id: name, label: name, kind: "external" as const, papers: c, dept: "External" })),
  ];
  const keep = new Set(nodes.map((n) => n.id));
  const edges: NetEdge[] = [...pairCount.entries()]
    .map(([key, weight]) => {
      const [a, b] = key.split("||");
      return { a, b, weight };
    })
    .filter((e) => keep.has(e.a) && keep.has(e.b) && e.weight >= 1)
    .sort((x, y) => y.weight - x.weight);
  return { nodes, edges };
}

/* ---------------- AI/ML insight layer ---------------- */

function linregForecast(series: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = series.length;
  if (n < 2) return { slope: 0, intercept: series[0]?.y ?? 0 };
  const sx = series.reduce((s, p) => s + p.x, 0);
  const sy = series.reduce((s, p) => s + p.y, 0);
  const sxy = series.reduce((s, p) => s + p.x * p.y, 0);
  const sxx = series.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

export interface AiInsight {
  id: string;
  kind: "TREND" | "PREDICTION" | "CLUSTER" | "SIMILARITY";
  title: string;
  detail: string;
  confidence: number;
  label: string;
}

export function aiInsights(): AiInsight[] {
  const db = getDB();
  const out: AiInsight[] = [];
  const years = byYearSeries(db.papers);
  if (years.length >= 3) {
    const recent = years.slice(-3);
    const growth = recent[recent.length - 1].publications - recent[0].publications;
    out.push({
      id: "t1", kind: "TREND",
      title: growth >= 0 ? "Publication output is accelerating" : "Publication output is cooling",
      detail: `Institutional output moved from ${recent[0].publications} to ${recent[recent.length - 1].publications} papers across the last three recorded years (${growth >= 0 ? "+" : ""}${growth}).`,
      confidence: 0.82, label: "AI-generated insight",
    });
    const { slope, intercept } = linregForecast(years.map((y, i) => ({ x: i, y: y.citations })));
    const nextYear = Number(years[years.length - 1].year) + 1;
    const predicted = Math.max(0, Math.round(slope * years.length + intercept));
    out.push({
      id: "t2", kind: "PREDICTION",
      title: `Citation volume projection for ${nextYear}`,
      detail: `Linear trend model estimates ~${predicted} citations in ${nextYear}. This is a projection, not a fact — actual values depend on future indexing and platform coverage.`,
      confidence: 0.61, label: "Predicted · Estimated",
    });
  }
  const kw = new Map<string, { recent: number; earlier: number }>();
  db.papers.forEach((p) => p.keywords.forEach((k) => {
    const e = kw.get(k) ?? { recent: 0, earlier: 0 };
    if (p.publication_year >= 2024) e.recent++; else e.earlier++;
    kw.set(k, e);
  }));
  const emerging = [...kw.entries()].filter(([, v]) => v.recent >= 2).sort((a, b) => b[1].recent - a[1].recent).slice(0, 3);
  if (emerging.length) {
    out.push({
      id: "t3", kind: "CLUSTER",
      title: "Emerging topic clusters detected",
      detail: `Keyword clustering flags ${emerging.map(([k]) => `“${k}”`).join(", ")} as disproportionately frequent in papers since 2024 — candidate focus areas for new seed grants.`,
      confidence: 0.74, label: "AI-generated insight",
    });
  }
  const areas = db.authors.map((a) => ({ a, set: new Set(a.research_areas) }));
  for (let i = 0; i < areas.length && out.length < 6; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      const inter = [...areas[i].set].filter((x) => areas[j].set.has(x)).length;
      const union = new Set([...areas[i].set, ...areas[j].set]).size;
      const sim = union ? inter / union : 0;
      if (sim >= 0.4) {
        out.push({
          id: `s${i}${j}`, kind: "SIMILARITY",
          title: `Research overlap: ${areas[i].a.name} ↔ ${areas[j].a.name}`,
          detail: `Jaccard similarity of ${Math.round(sim * 100)}% across declared research areas — estimated strong candidates for a cross-department collaboration.`,
          confidence: Math.round(sim * 100) / 100, label: "Estimated",
        });
      }
    }
  }
  return out.slice(0, 6);
}

/* ---------------- reports (institutional column compatibility) ---------------- */

export const INSTITUTIONAL_COLUMNS = [
  "Research Paper Name", "Research Paper Count", "Citation Count", "H-Index Count", "i10-Index Count",
  "Publication Year", "Publication Date", "DOI", "Research Paper Type", "Contributors Name",
  "Source Name", "ISBN", "ISSN", "URL of Research Paper", "Source Platform",
] as const;

export interface ReportData { title: string; columns: string[]; rows: (string | number)[][] }

/** Maps AUTHOR SUMMARY metrics into each export row without corrupting paper documents. */
function paperRows(papers: Paper[], authors: Author[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  papers.forEach((p) => {
    const owner = authors.find((a) => p.faculty_ids.includes(a._id));
    p.source_records.forEach((r) => {
      const m = owner?.platform_metrics[r.platform];
      rows.push([
        p.title,
        m?.papers !== undefined ? fmtMetric(m?.papers ?? null) : "NA",
        m?.citations !== undefined ? fmtMetric(m?.citations ?? null) : "NA",
        m?.h_index !== undefined ? fmtMetric(m?.h_index ?? null) : "NA",
        m?.i10_index !== undefined ? fmtMetric(m?.i10_index ?? null) : "NA",
        p.publication_year,
        p.publication_date ?? "NA",
        p.doi ?? "NA",
        p.paper_type,
        p.contributors.join("; "),
        r.source_name,
        p.isbn.join("; ") || "NA",
        p.issn.join("; ") || "NA",
        r.url ?? p.paper_url ?? "NA",
        r.platform === "GOOGLE_SCHOLAR" ? "Google Scholar" : r.platform === "WOS" ? "Web of Science" : r.platform === "SCOPUS" ? "Scopus" : r.platform,
      ]);
    });
  });
  return rows;
}

export function buildReport(kind: string, paramId: string | null): ReportData {
  const db = getDB();
  const cols = [...INSTITUTIONAL_COLUMNS];
  switch (kind) {
    case "faculty": {
      const a = db.authors.find((x) => x._id === paramId);
      const papers = db.papers.filter((p) => p.faculty_ids.includes(paramId ?? ""));
      return { title: `Faculty Research Report — ${a?.name ?? "Unknown"}`, columns: cols, rows: paperRows(papers, db.authors) };
    }
    case "department": {
      const fac = db.authors.filter((a) => a.department === paramId);
      const ids = new Set(fac.map((a) => a._id));
      const papers = db.papers.filter((p) => p.faculty_ids.some((f) => ids.has(f)));
      return { title: `Department Research Report — ${paramId ?? "All"}`, columns: cols, rows: paperRows(papers, db.authors) };
    }
    case "citation": {
      const rows = db.authors.map((a) => (["SCOPUS", "WOS", "GOOGLE_SCHOLAR", "RESEARCHGATE", "ORCID"] as Platform[]).map((plat) => {
        const m = a.platform_metrics[plat];
        return [a.name, a.department, plat === "GOOGLE_SCHOLAR" ? "Google Scholar" : plat === "WOS" ? "Web of Science" : plat === "SCOPUS" ? "Scopus" : plat === "ORCID" ? "ORCID" : "ResearchGate", fmtMetric(m?.papers ?? null), fmtMetric(m?.citations ?? null), fmtMetric(m?.h_index ?? null), fmtMetric(m?.i10_index ?? null)];
      })).flat();
      return { title: "Citation Report (by platform)", columns: ["Researcher", "Department", "Source Platform", "Research Paper Count", "Citation Count", "H-Index Count", "i10-Index Count"], rows: rows as (string | number)[][] };
    }
    case "yearly": {
      const series = byYearSeries(db.papers);
      return { title: "Year-wise Research Report", columns: ["Publication Year", "Research Paper Count", "Citation Count (max across sources)"], rows: series.map((s) => [s.year, s.publications, s.citations]) };
    }
    case "platform": {
      const o = overview();
      return { title: "Platform Comparison Report", columns: ["Source Platform", "Researchers Covered", "Research Paper Count", "Citation Count", "Combined H-index"], rows: o.platformTotals.map((p) => [p.platform === "GOOGLE_SCHOLAR" ? "Google Scholar" : p.platform === "WOS" ? "Web of Science" : p.platform === "SCOPUS" ? "Scopus" : p.platform === "ORCID" ? "ORCID" : "ResearchGate", `${p.coverage}/${p.total}`, fmtMetric(p.papers), fmtMetric(p.citations), fmtMetric(p.h_sum)]) };
    }
    default: {
      return { title: "Publication Report (all)", columns: cols, rows: paperRows(db.papers, db.authors) };
    }
  }
}
