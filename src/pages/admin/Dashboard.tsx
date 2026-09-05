import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import { overview } from "../../lib/analytics";
import type { Author } from "../../lib/core";
import { fmtMetric, timeAgo } from "../../lib/core";
import { IdentityBadge, Metric, PageHeader, Skeleton, StatCard, useToast } from "../../components/ui";
import { YearTrendChart, DepartmentBarChart, PlatformRadar } from "../../components/charts";
import { IcPlus, IcRadar, IcDatabase, IcLink, IcAlert } from "../../components/icons";

export default function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [data, setData] = useState<ReturnType<typeof overview> | null>(null);
  const nav = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const a = await api.listAuthors(api.getToken());
        await api.listPapers(api.getToken());
        if (!live) return;
        setAuthors(a);
        setData(overview());
        setReady(true);
      } catch (e) {
        if (live) toast("error", e instanceof Error ? e.message : "Failed to load dashboard.");
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready || !data) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid lg:grid-cols-3 gap-4"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Research Command"
        sub={`Institutional snapshot · ${data.totals.researchers} researchers under active collection`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => nav("/admin/polling")}><IcRadar size={16} /> Run polling</button>
            <button className="btn-primary" onClick={() => nav("/admin/faculty/add")}><IcPlus size={16} /> Add faculty</button>
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        <StatCard label="Researchers" value={data.totals.researchers} tone="ink"
          sub={<><span className="w-1.5 h-1.5 rounded-full bg-primary-500" />{authors.filter((a) => a.identity.status === "VERIFIED").length} verified identities</>} />
        <StatCard label="Publications" value={data.totals.publications} tone="teal" delay={40}
          sub={<><IcDatabase size={13} />deduplicated canonical records</>} />
        <StatCard label="Citations (Scopus)" value={data.totals.citations} tone="amber" delay={80}
          sub="source-specific · not merged across platforms" />
        <StatCard label="Average H-index" value={Math.round(data.totals.avgH * 10)} suffix="/10" tone="blue" delay={120}
          sub="mean of Scopus H-index across faculty" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5 lg:col-span-2 anim-fade-up">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-semibold text-ink-900 text-[17px]">Year-wise research output</h3>
            <span className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider">Publications & citations</span>
          </div>
          <YearTrendChart data={data.yearSeries} />
        </div>
        <div className="card p-5 anim-fade-up" style={{ animationDelay: "80ms" }}>
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Platform comparison</h3>
          <PlatformRadar data={data.platformTotals.map((p) => ({ platform: p.platform, papers: p.papers, citations: p.citations }))} />
          <p className="text-[11.5px] text-ink-400 mt-2 leading-relaxed">Normalized per platform — source metrics are stored separately and never blended.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card lg:col-span-2 anim-fade-up overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="font-display font-semibold text-ink-900 text-[17px]">Top researchers</h3>
            <Link to="/admin/faculty" className="text-[12.5px] font-bold text-primary-700 hover:text-primary-800">View all →</Link>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Researcher</th><th className="th">Identity</th><th className="th text-right">Papers</th><th className="th text-right">Citations</th><th className="th text-right">H-index</th></tr></thead>
            <tbody>
              {data.topResearchers.map((a) => {
                const m = a.platform_metrics.SCOPUS;
                return (
                  <tr key={a._id} className="hover:bg-primary-50/40 transition-colors cursor-pointer" onClick={() => nav("/admin/faculty")}>
                    <td className="td">
                      <div className="font-semibold text-ink-900">{a.name}</div>
                      <div className="text-[11.5px] text-ink-400">{a.department}</div>
                    </td>
                    <td className="td"><IdentityBadge status={a.identity.status} size="sm" /></td>
                    <td className="td text-right"><Metric v={m?.papers ?? null} /></td>
                    <td className="td text-right"><Metric v={m?.citations ?? null} strong /></td>
                    <td className="td text-right"><Metric v={m?.h_index ?? null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "60ms" }}>
            <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Department output</h3>
            <DepartmentBarChart data={data.departments} />
          </div>
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "120ms" }}>
            <h3 className="font-display font-semibold text-ink-900 text-[15px] mb-3 flex items-center gap-2"><IcRadar size={16} /> Recent polling activity</h3>
            <div className="space-y-2.5">
              {data.recent.length === 0 && <p className="text-sm text-ink-400">No polling runs yet.</p>}
              {data.recent.map((log) => (
                <div key={log._id} className="flex items-start gap-2.5">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${log.result === "CHANGED" ? "bg-gold-500" : log.result === "UNCHANGED" ? "bg-primary-500" : "bg-danger-600"}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink-800 leading-snug">{log.author_name}</div>
                    <div className="text-[11.5px] text-ink-400 truncate">
                      {log.result === "UNCHANGED" ? "Summary unchanged — collection skipped" : log.change_reason[0] ?? log.result} · {timeAgo(log.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/admin/polling" className="inline-block mt-3 text-[12.5px] font-bold text-primary-700 hover:text-primary-800">Polling console →</Link>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-4 stagger">
        <div className="card p-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center"><IcLink size={17} /></span>
          <div><div className="num text-lg font-semibold text-ink-900">{authors.filter((a) => a.identity.evidence.orcid_scopus_link === "MATCH").length}</div><div className="text-[11.5px] text-ink-500 font-medium">ORCID ↔ Scopus primary matches</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-gold-100 text-gold-600 flex items-center justify-center"><IcAlert size={17} /></span>
          <div><div className="num text-lg font-semibold text-ink-900">{authors.filter((a) => a.platform_metrics.WOS?.papers === null).length}</div><div className="text-[11.5px] text-ink-500 font-medium">WoS sources reporting NA (quota / no key)</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#e7edfb] text-[#2f55b8] flex items-center justify-center"><IcDatabase size={17} /></span>
          <div><div className="num text-lg font-semibold text-ink-900">{fmtMetric(data.totals.publications)}</div><div className="text-[11.5px] text-ink-500 font-medium">Canonical papers after DOI deduplication</div></div>
        </div>
      </div>
    </div>
  );
}
