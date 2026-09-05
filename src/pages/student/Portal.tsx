import { useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import { aiInsights, byYearSeries, collaborationNetwork, maxCitations, overview } from "../../lib/analytics";
import type { Author, Paper } from "../../lib/core";
import { fmtMetric } from "../../lib/core";
import { IdentityBadge, Metric, Modal, PageHeader, Skeleton, StatCard, useToast } from "../../components/ui";
import { DepartmentBarChart, YearTrendChart } from "../../components/charts";
import NetworkGraph from "../../components/NetworkGraph";
import { PaperDetail } from "../faculty/Portal";
import { IcNetwork, IcSearch, IcSpark } from "../../components/icons";

function useCorpus() {
  const toast = useToast();
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  useEffect(() => {
    Promise.all([api.listAuthors(api.getToken()), api.listPapers(api.getToken())])
      .then(([a, p]) => { setAuthors(a); setPapers(p); })
      .catch((e) => toast("error", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { authors, papers };
}

export function StudentHome() {
  const { authors, papers } = useCorpus();
  const ov = useMemo(() => (authors ? overview() : null), [authors]);
  if (!authors || !ov) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-72" /></div>;
  return (
    <div>
      <PageHeader title="Research Overview" sub="Read-only view of the institution's verified research corpus" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        <StatCard label="Researchers" value={ov.totals.researchers} />
        <StatCard label="Publications" value={ov.totals.publications} tone="teal" delay={40} />
        <StatCard label="Citations (Scopus)" value={ov.totals.citations} tone="amber" delay={80} />
        <StatCard label="Avg H-index" value={Math.round(ov.totals.avgH * 10)} suffix="/10" tone="blue" delay={120} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5 lg:col-span-2"><h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Institutional research trend</h3><YearTrendChart data={ov.yearSeries} /></div>
        <div className="card overflow-hidden">
          <div className="px-5 pt-4 pb-2"><h3 className="font-display font-semibold text-ink-900 text-[17px]">Most cited papers</h3></div>
          <div className="px-3 pb-3">
            {ov.topPapers.slice(0, 5).map((p, i) => (
              <div key={p._id} className="flex gap-3 px-2 py-2 rounded-lg hover:bg-primary-50/40 transition-colors">
                <span className="font-display font-semibold text-[20px] text-ink-200 w-6 text-right">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink-800 leading-snug line-clamp-2">{p.title}</div>
                  <div className="text-[11px] text-ink-400 mt-0.5 num">{p.publication_year} · {maxCitations(p)} citations · {p.paper_type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card p-5 mt-4"><h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Department-wise output</h3><DepartmentBarChart data={ov.departments} /></div>
    </div>
  );
}

export function StudentResearchers() {
  const { authors, papers } = useCorpus();
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Author | null>(null);
  if (!authors) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div></div>;
  const filtered = authors.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.department.toLowerCase().includes(q.toLowerCase()));
  const detailPapers = detail ? papers.filter((p) => p.faculty_ids.includes(detail._id)).sort((a, b) => maxCitations(b) - maxCitations(a)) : [];
  return (
    <div>
      <PageHeader title="Researchers" sub={`${authors.length} faculty profiles with verified platform identities`} />
      <div className="relative max-w-md mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><IcSearch size={15} /></span>
        <input className="input pl-9" placeholder="Search researcher or department…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {filtered.map((a) => {
          const sc = a.platform_metrics.SCOPUS;
          const gs = a.platform_metrics.GOOGLE_SCHOLAR;
          return (
            <button key={a._id} onClick={() => setDetail(a)} className="card p-5 text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgb(16_30_49/0.25)]">
              <div className="flex items-start justify-between gap-2">
                <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center font-display font-semibold">
                  {a.name.replace(/^Dr\.?\s+/, "").split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
                </div>
                <IdentityBadge status={a.identity.status} size="sm" />
              </div>
              <div className="font-display font-semibold text-[16.5px] text-ink-900 mt-3">{a.name}</div>
              <div className="text-[12px] text-ink-400">{a.designation} · {a.department}</div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                {[["Scopus", fmtMetric(sc?.papers ?? null), fmtMetric(sc?.citations ?? null)], ["Scholar", fmtMetric(gs?.papers ?? null), fmtMetric(gs?.citations ?? null)], ["WoS", fmtMetric(a.platform_metrics.WOS?.papers ?? null), fmtMetric(a.platform_metrics.WOS?.citations ?? null)]].map(([l, p, c]) => (
                  <div key={l} className="rounded-lg bg-ink-50/70 py-2">
                    <div className="num text-[13px] font-semibold text-ink-800">{p} <span className="text-ink-300 font-normal">/</span> <span className="text-gold-600">{c}</span></div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-ink-400 mt-0.5">{l} p/c</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {a.research_areas.slice(0, 3).map((r) => <span key={r} className="chip bg-primary-50 border border-primary-200 text-primary-800 h-5 text-[10px]">{r}</span>)}
              </div>
            </button>
          );
        })}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} wide>
        {detail && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <IdentityBadge status={detail.identity.status} size="sm" />
              <span className="text-[13px] text-ink-500">{detail.designation} · {detail.department}</span>
              <span className="num text-[12px] text-ink-400 ml-auto">{detail.identifiers.orcid}</span>
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400 mb-2">Top publications</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {detailPapers.map((p) => (
                <div key={p._id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2">
                  <span className="num text-[11px] text-ink-400">{p.publication_year}</span>
                  <span className="text-[12.5px] font-medium text-ink-800 flex-1 truncate">{p.title}</span>
                  <span className="chip bg-gold-100 text-gold-700 num h-5 text-[10px]">{maxCitations(p)} cit.</span>
                </div>
              ))}
              {detailPapers.length === 0 && <p className="text-sm text-ink-400">No linked publications in the corpus.</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function StudentPublications() {
  const { papers } = useCorpus();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("ALL");
  const [sort, setSort] = useState("citations");
  const [detail, setDetail] = useState<Paper | null>(null);
  const [page, setPage] = useState(0);
  const years = useMemo(() => [...new Set(papers.map((p) => p.publication_year))].sort((a, b) => b - a), [papers]);
  const filtered = useMemo(() => {
    const f = papers.filter((p) => (year === "ALL" || p.publication_year === Number(year)) &&
      (p.title.toLowerCase().includes(q.toLowerCase()) || (p.doi ?? "").includes(q.toLowerCase()) || p.contributors.some((c) => c.toLowerCase().includes(q.toLowerCase()))));
    return f.sort((a, b) => sort === "citations" ? maxCitations(b) - maxCitations(a) : sort === "year" ? b.publication_year - a.publication_year : a.title.localeCompare(b.title));
  }, [papers, q, year, sort]);
  const PAGE = 12;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => setPage(0), [q, year, sort]);
  if (!papers.length) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-80" /></div>;
  return (
    <div>
      <PageHeader title="Publication Explorer" sub={`${papers.length} canonical records · click any row for full metadata and provenance`} />
      <div className="card p-3 flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><IcSearch size={15} /></span>
          <input className="input pl-9" placeholder="Search title, DOI, author…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto cursor-pointer" value={year} onChange={(e) => setYear(e.target.value)}>{["ALL", ...years].map((y) => <option key={y}>{y}</option>)}</select>
        <select className="input w-auto cursor-pointer" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="citations">Sort: most cited</option><option value="year">Sort: newest</option><option value="title">Sort: title A–Z</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Year</th><th className="th">Title</th><th className="th">Type</th><th className="th">Sources</th><th className="th text-right">Citations</th></tr></thead>
          <tbody>
            {view.map((p) => (
              <tr key={p._id} className="hover:bg-primary-50/40 cursor-pointer transition-colors" onClick={() => setDetail(p)}>
                <td className="td num text-[12.5px] text-ink-500">{p.publication_year}</td>
                <td className="td font-medium text-ink-800 text-[13px] max-w-[440px]"><span className="line-clamp-1">{p.title}</span><span className="text-[11px] text-ink-400">{p.contributors.slice(0, 3).join(", ")}{p.contributors.length > 3 ? " et al." : ""}</span></td>
                <td className="td text-[12.5px] text-ink-500">{p.paper_type}</td>
                <td className="td text-[11.5px] text-ink-400 num">{p.source_records.length} source{p.source_records.length > 1 ? "s" : ""}</td>
                <td className="td text-right num font-semibold text-ink-800">{maxCitations(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-ink-100 bg-ink-50/50">
          <span className="text-[11.5px] text-ink-400">{filtered.length} results</span>
          <div className="flex gap-1.5">
            <button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="num text-[12px] text-ink-500 px-2 py-1.5">{page + 1} / {pages}</span>
            <button className="btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      </div>
      <PaperDetail paper={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function StudentAnalytics() {
  const { papers } = useCorpus();
  const [selected, setSelected] = useState<string | null>(null);
  const net = useMemo(() => collaborationNetwork(), []);
  const insights = useMemo(() => aiInsights(), []);
  const series = useMemo(() => byYearSeries(papers), [papers]);
  if (!papers.length) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-80" /></div>;
  return (
    <div>
      <PageHeader title="Analytics & Collaboration" sub="Co-authorship structure and AI-assisted research signals" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-2 flex items-center gap-2"><IcNetwork size={18} /> Co-authorship network</h3>
          <NetworkGraph nodes={net.nodes} edges={net.edges} selected={selected} onSelect={setSelected} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-600" /> Faculty</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gold-400" /> External collaborator</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-ink-900 text-[16px] mb-3 flex items-center gap-2"><IcSpark size={17} /> AI insights</h3>
            <div className="space-y-2.5">
              {insights.slice(0, 4).map((i) => (
                <div key={i.id} className="rounded-lg border border-ink-100 p-3">
                  <div className="text-[12.5px] font-bold text-ink-800">{i.title}</div>
                  <p className="text-[11.5px] text-ink-500 mt-1 leading-relaxed">{i.detail}</p>
                  <span className="chip h-5 text-[10px] bg-[#f3ecfd] text-[#6b46c1] border border-[#e0d4f7] mt-2">{i.label} · {Math.round(i.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-display font-semibold text-ink-900 text-[16px] mb-3">Output by year</h3>
            <YearTrendChart data={series} />
          </div>
        </div>
      </div>
    </div>
  );
}
