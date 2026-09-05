import { useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import { facultyAnalytics, maxCitations } from "../../lib/analytics";
import type { Author, Paper, Platform } from "../../lib/core";
import { PLATFORMS, PLATFORM_LABEL, fmtDate, fmtMetric, timeAgo } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { IdentityBadge, Metric, Modal, PageHeader, PlatformChip, Skeleton, StatCard, useToast } from "../../components/ui";
import { HistoryLineChart, PlatformCompareBars, TypeDonut, YearTrendChart } from "../../components/charts";
import { IcCheck, IcExternal, IcLink, IcSearch, IcX } from "../../components/icons";

function useMyData() {
  const { token } = useAuth();
  const toast = useToast();
  const [author, setAuthor] = useState<Author | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const me = await api.getMyFaculty(token);
        const all = await api.listPapers(token);
        setAuthor(me);
        setPapers(all.filter((p: Paper) => p.faculty_ids.includes(me._id)));
      } catch (e) {
        toast("error", e instanceof Error ? e.message : "Failed to load profile.");
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { author, papers, loading };
}

function Loading() {
  return <div className="space-y-4"><Skeleton className="h-9 w-72" /><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-72" /></div>;
}

function PlatformMetricCard({ author, plat, delay }: { author: Author; plat: Platform; delay: number }) {
  const m = author.platform_metrics[plat];
  const unavailable = !m || m.papers === null;
  return (
    <div className="card p-5 anim-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <PlatformChip platform={plat} />
        {m?.provenance.note && <span className="chip h-5 text-[10px] bg-warn-50 text-warn-700 border border-gold-300" title={m.provenance.note}>issue</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
        {([["Papers", m?.papers ?? null], ["Citations", m?.citations ?? null], ["H-index", m?.h_index ?? null], ["i10-index", plat === "GOOGLE_SCHOLAR" ? m?.i10_index ?? null : null]] as const).map(([l, v]) => (
          <div key={l}>
            <div className="num text-[22px] leading-none font-semibold text-ink-900"><Metric v={v} /></div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400 mt-1">{l}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-ink-400 mt-3">
        {unavailable ? (m?.provenance.note ?? "Not collected for this source.") : `Updated ${timeAgo(m?.last_updated)}`}
      </div>
    </div>
  );
}

export function FacultyHome() {
  const { author, papers, loading } = useMyData();
  if (loading || !author) return <Loading />;
  const an = facultyAnalytics(author._id)!;
  return (
    <div>
      <div className="card p-5 mb-4 flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-ink-900 text-white flex items-center justify-center font-display font-semibold text-xl">
          {author.name.replace(/^Dr\.?\s+/, "").split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-[22px] font-semibold text-ink-900">{author.name}</h1>
            <IdentityBadge status={author.identity.status} size="sm" />
          </div>
          <p className="text-[13px] text-ink-500">{author.designation} · {author.department}</p>
        </div>
        <div className="text-right text-[12px] text-ink-400">
          <div>Last polled {timeAgo(author.last_polled_at)}</div>
          <div>Data changed {timeAgo(author.last_changed_at)}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        <StatCard label="Publications (Scopus)" value={author.platform_metrics.SCOPUS?.papers ?? 0} tone="teal" />
        <StatCard label="Citations (Scopus)" value={author.platform_metrics.SCOPUS?.citations ?? 0} tone="amber" delay={40} />
        <StatCard label="H-index (Scopus)" value={author.platform_metrics.SCOPUS?.h_index ?? 0} tone="ink" delay={80} />
        <StatCard label="i10-index (Scholar)" value={author.platform_metrics.GOOGLE_SCHOLAR?.i10_index ?? 0} tone="blue" delay={120} />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4 stagger">
        {PLATFORMS.filter((p) => p !== "RESEARCHGATE").map((p, i) => <PlatformMetricCard key={p} author={author} plat={p} delay={i * 50} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">My year-wise output</h3>
          <YearTrendChart data={an.yearSeries} />
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Top collaborators</h3>
          <div className="space-y-2">
            {an.collaborators.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold-100 text-gold-700 flex items-center justify-center text-[11px] font-bold">{c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink-800 truncate">{c.name}</div></div>
                <span className="num chip bg-ink-50 border border-ink-100 text-ink-600">{c.count} papers</span>
              </div>
            ))}
            {an.collaborators.length === 0 && <p className="text-sm text-ink-400">No co-authored records yet.</p>}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden mt-4">
        <div className="px-5 pt-4 pb-2"><h3 className="font-display font-semibold text-ink-900 text-[17px]">Recent publications</h3></div>
        <table className="w-full">
          <thead><tr><th className="th">Year</th><th className="th">Title</th><th className="th">Type</th><th className="th">Sources</th><th className="th text-right">Citations (max)</th></tr></thead>
          <tbody>
            {[...papers].sort((a, b) => b.publication_year - a.publication_year).slice(0, 6).map((p) => (
              <tr key={p._id} className="hover:bg-primary-50/30 transition-colors">
                <td className="td num text-[12.5px] text-ink-500">{p.publication_year}</td>
                <td className="td font-medium text-ink-800 text-[13px] max-w-[420px] truncate">{p.title}</td>
                <td className="td text-[12.5px] text-ink-500">{p.paper_type}</td>
                <td className="td"><div className="flex gap-1">{p.source_records.map((r) => <span key={r.platform} className="w-2 h-2 rounded-[3px]" style={{ background: { ORCID: "#7ba23f", SCOPUS: "#e9711c", WOS: "#1299b8", GOOGLE_SCHOLAR: "#3d6de0", RESEARCHGATE: "#00a89b" }[r.platform] }} title={PLATFORM_LABEL[r.platform]} />)}</div></td>
                <td className="td text-right num font-semibold text-ink-800">{maxCitations(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FacultyProfile() {
  const { author, loading } = useMyData();
  if (loading || !author) return <Loading />;
  const ev = author.identity.evidence;
  const ids: { label: string; value: string | null; url: string | null }[] = [
    { label: "ORCID", value: author.identifiers.orcid, url: author.profile_urls.orcid },
    { label: "Scopus Author ID", value: author.identifiers.scopus_id, url: author.profile_urls.scopus },
    { label: "Google Scholar", value: author.identifiers.google_scholar_id, url: author.profile_urls.google_scholar },
    { label: "Web of Science", value: author.identifiers.wos_id, url: author.profile_urls.wos },
    { label: "ResearchGate", value: author.identifiers.researchgate_id, url: author.profile_urls.researchgate },
  ];
  return (
    <div>
      <PageHeader title="Profile & Identity" sub={`${author.name} · ${author.designation}, ${author.department}`} />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900 text-[17px]">Identity resolution</h3>
            <IdentityBadge status={author.identity.status} />
          </div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2">Primary — ORCID ↔ Scopus</div>
          {[
            ["ORCID checksum valid (ISO 7064)", ev.orcid_format_valid],
            ["Scopus ID format valid", ev.scopus_id_valid],
            ["Scopus URL matches Scopus ID", ev.scopus_url_matches_id],
            ["ORCID ↔ Scopus connection", ev.orcid_scopus_link === "MATCH"],
          ].map(([l, ok]) => (
            <div key={l as string} className="flex items-center gap-2 text-[13px] font-medium text-ink-700 py-1.5 border-b border-ink-50">
              <span className={ok ? "text-primary-600" : "text-danger-600"}>{ok ? <IcCheck size={14} /> : <IcX size={14} />}</span>{l as string}
            </div>
          ))}
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 mt-4 mb-2">Secondary (confidence boosters)</div>
          <div className="grid grid-cols-2 gap-2.5">
            {[["Common DOIs", String(ev.common_dois)], ["Name similarity", `${Math.round(ev.name_similarity * 100)}%`], ["Affiliation match", ev.affiliation_match ? "Yes" : "No"], ["Publication overlap", String(ev.publication_overlap)]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-ink-50/70 px-3 py-2.5">
                <div className="num text-[16px] font-semibold text-ink-800">{v}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{l}</div>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-ink-400 mt-3">Resolved {fmtDate(author.identity.resolved_at)}. DOI matching supports — but never replaces — the primary ORCID ↔ Scopus link.</p>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Platform identifiers</h3>
            <div className="space-y-2">
              {ids.map((it) => (
                <div key={it.label} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3.5 py-2.5">
                  <span className="text-ink-400"><IcLink size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{it.label}</div>
                    <div className="num text-[13px] text-ink-800 truncate">{it.value ?? "NA — not provided"}</div>
                  </div>
                  {it.url && it.value && (
                    <a href={it.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><IcExternal size={13} /> Open</a>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-display font-semibold text-ink-900 text-[16px] mb-3">Research areas</h3>
            <div className="flex flex-wrap gap-2">
              {author.research_areas.map((r) => <span key={r} className="chip bg-primary-50 border border-primary-200 text-primary-800 h-7 px-3 text-[12px]">{r}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FacultyPublications() {
  const { author, papers, loading } = useMyData();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [detail, setDetail] = useState<Paper | null>(null);
  const years = useMemo(() => [...new Set(papers.map((p) => p.publication_year))].sort((a, b) => b - a), [papers]);
  const types = useMemo(() => [...new Set(papers.map((p) => p.paper_type))], [papers]);
  if (loading || !author) return <Loading />;
  const filtered = papers.filter((p) =>
    (year === "ALL" || p.publication_year === Number(year)) &&
    (type === "ALL" || p.paper_type === type) &&
    (p.title.toLowerCase().includes(q.toLowerCase()) || (p.doi ?? "").toLowerCase().includes(q.toLowerCase()) || p.contributors.some((c) => c.toLowerCase().includes(q.toLowerCase()))));
  return (
    <div>
      <PageHeader title="My Publications" sub={`${papers.length} canonical records after cross-platform deduplication`} />
      <div className="card p-3 flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><IcSearch size={15} /></span>
          <input className="input pl-9" placeholder="Search title, DOI, co-author…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto cursor-pointer" value={year} onChange={(e) => setYear(e.target.value)}>{["ALL", ...years].map((y) => <option key={y}>{y}</option>)}</select>
        <select className="input w-auto cursor-pointer" value={type} onChange={(e) => setType(e.target.value)}>{["ALL", ...types].map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Year</th><th className="th">Title</th><th className="th">Type</th><th className="th">DOI</th><th className="th text-right">Scopus cit.</th><th className="th text-right">Scholar cit.</th></tr></thead>
          <tbody>
            {filtered.slice(0, 40).map((p) => {
              const sc = p.source_records.find((r) => r.platform === "SCOPUS")?.citation_count ?? null;
              const gs = p.source_records.find((r) => r.platform === "GOOGLE_SCHOLAR")?.citation_count ?? null;
              return (
                <tr key={p._id} className="hover:bg-primary-50/40 cursor-pointer transition-colors" onClick={() => setDetail(p)}>
                  <td className="td num text-[12.5px] text-ink-500">{p.publication_year}</td>
                  <td className="td font-medium text-ink-800 text-[13px] max-w-[380px]">
                    <span className="line-clamp-2">{p.title}</span>
                    {p.dedup.status === "MERGED" && <span className="chip h-4 text-[9px] bg-primary-50 text-primary-700 mt-1">merged record</span>}
                  </td>
                  <td className="td text-[12.5px] text-ink-500">{p.paper_type}</td>
                  <td className="td num text-[11.5px] text-ink-400 max-w-[160px] truncate">{p.doi ?? "NA"}</td>
                  <td className="td text-right"><Metric v={sc} /></td>
                  <td className="td text-right"><Metric v={gs} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-10 text-center text-sm text-ink-400">No publications match these filters.</div>}
      </div>
      <PaperDetail paper={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function PaperDetail({ paper, onClose }: { paper: Paper | null; onClose: () => void }) {
  if (!paper) return null;
  const rows: [string, string][] = [
    ["Research Paper Name", paper.title],
    ["Publication Year", String(paper.publication_year)],
    ["Publication Date", paper.publication_date ?? "NA"],
    ["DOI", paper.doi ?? "NA"],
    ["Research Paper Type", paper.paper_type],
    ["Contributors Name", paper.contributors.join("; ")],
    ["ISBN", paper.isbn.join("; ") || "NA"],
    ["ISSN", paper.issn.join("; ") || "NA"],
    ["URL of Research Paper", paper.paper_url ?? "NA"],
    ["Keywords", paper.keywords.join(", ") || "NA"],
  ];
  return (
    <Modal open onClose={onClose} title="Publication record" wide>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map(([l, v]) => (
          <div key={l}>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{l}</div>
            <div className={`text-[13px] text-ink-800 break-words ${l === "DOI" || l === "URL of Research Paper" ? "num" : ""}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400 mb-2">Source records & provenance</div>
        <div className="space-y-2">
          {paper.source_records.map((r) => (
            <div key={r.platform + r.source_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-100 px-3.5 py-2.5">
              <PlatformChip platform={r.platform} />
              <span className="text-[12.5px] text-ink-600 flex-1 min-w-[160px] truncate">{r.source_name}</span>
              <span className="num text-[11.5px] text-ink-400">{r.source_id}</span>
              <span className="chip bg-ink-50 border border-ink-100 text-ink-600 num">citations: <Metric v={r.citation_count} /></span>
              <span className="text-[11px] text-ink-400">fetched {fmtDate(r.retrieved_at)}</span>
            </div>
          ))}
        </div>
      </div>
      {paper.dedup.status !== "UNIQUE" && (
        <p className="text-[12px] text-gold-700 bg-warn-50 border border-gold-300/60 rounded-lg px-3 py-2 mt-3">
          Dedup status: {paper.dedup.status}{paper.dedup.merged_from.length > 0 && ` — merged from ${paper.dedup.merged_from.join(", ")}`}
        </p>
      )}
    </Modal>
  );
}

export function FacultyAnalytics() {
  const { author, loading } = useMyData();
  if (loading || !author) return <Loading />;
  const an = facultyAnalytics(author._id)!;
  const hist = an.history;
  const labels = [...new Set(hist.map((h) => h.date))].sort();
  const histData = labels.map((d) => ({
    label: new Date(d).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    scopus: hist.find((h) => h.date === d && h.platform === "SCOPUS")?.citations ?? null,
    scholar: hist.find((h) => h.date === d && h.platform === "GOOGLE_SCHOLAR")?.citations ?? null,
  }));
  const compare = PLATFORMS.filter((p) => p !== "ORCID").map((p) => ({
    platform: p,
    papers: author.platform_metrics[p]?.papers ?? 0,
    citations: author.platform_metrics[p]?.citations ?? 0,
  }));
  return (
    <div>
      <PageHeader title="My Analytics" sub="Historical snapshots enable before → after comparisons on every poll" />
      <div className="grid lg:grid-cols-2 gap-4 stagger">
        <div className="card p-5"><h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Year-wise publications & citations</h3><YearTrendChart data={an.yearSeries} /></div>
        <div className="card p-5"><h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Citation growth — stored snapshots</h3><HistoryLineChart data={histData} /></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5"><h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Publication types</h3><TypeDonut data={an.types} /></div>
        <div className="card p-5"><h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Source comparison (my record)</h3><PlatformCompareBars data={compare} /></div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Frequent collaborators</h3>
          <div className="space-y-1.5">
            {an.collaborators.map((c) => (
              <div key={c.name} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-[13px] font-medium text-ink-700 truncate">{c.name}</div>
                <div className="w-24 h-2 rounded-full bg-ink-100 overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${(c.count / (an.collaborators[0]?.count || 1)) * 100}%` }} /></div>
                <span className="num text-[12px] text-ink-500 w-6 text-right">{c.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-ink-50/70 p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Source metrics stay separate</div>
            <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">Scopus reports {fmtMetric(author.platform_metrics.SCOPUS?.papers ?? null)} papers / {fmtMetric(author.platform_metrics.SCOPUS?.citations ?? null)} citations; Google Scholar reports {fmtMetric(author.platform_metrics.GOOGLE_SCHOLAR?.papers ?? null)} / {fmtMetric(author.platform_metrics.GOOGLE_SCHOLAR?.citations ?? null)}. They are never averaged or merged.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
