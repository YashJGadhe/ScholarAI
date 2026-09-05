import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as api from "../../lib/api";
import { aiInsights, collaborationNetwork, facultyAnalytics, overview } from "../../lib/analytics";
import type { Author } from "../../lib/core";
import { PageHeader, Skeleton, useToast } from "../../components/ui";
import { DepartmentBarChart, PlatformRadar, TypeDonut, YearTrendChart } from "../../components/charts";
import NetworkGraph from "../../components/NetworkGraph";
import { IcNetwork, IcSpark } from "../../components/icons";

const LINE_COLORS = ["#0e8172", "#e9711c", "#3d6de0", "#e29a17", "#1299b8"];

export default function AdminAnalytics() {
  const toast = useToast();
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [papers, setPapers] = useState<{ paper_type: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listAuthors(api.getToken()), api.listPapers(api.getToken())])
      .then(([a, p]) => { setAuthors(a); setPapers(p); })
      .catch((e) => toast("error", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const net = useMemo(() => collaborationNetwork(), []);
  const insights = useMemo(() => aiInsights(), []);
  const ov = useMemo(() => overview(), []);

  const topAuthors = useMemo(
    () => (authors ? [...authors].sort((a, b) => (b.platform_metrics.SCOPUS?.citations ?? 0) - (a.platform_metrics.SCOPUS?.citations ?? 0)).slice(0, 4) : []),
    [authors],
  );

  const hTrend = useMemo(() => {
    const dates: string[] = [];
    const rows: Record<string, string | number | null>[] = [];
    topAuthors.forEach((a) => {
      const h = facultyAnalytics(a._id);
      if (!h) return;
      const snaps = h.history.filter((s) => s.platform === "SCOPUS");
      snaps.forEach((s) => {
        const label = new Date(s.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        if (!dates.includes(s.date)) { dates.push(s.date); rows.push({ label }); }
        const row = rows.find((r) => r.label === label);
        if (row) row[a.name.replace("Dr. ", "")] = s.h_index;
      });
    });
    return rows;
  }, [topAuthors]);

  if (!authors) {
    return <div className="space-y-4"><Skeleton className="h-8 w-56" /><div className="grid lg:grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div></div>;
  }

  const typeData = useMemo(() => {
    const m = new Map<string, number>();
    papers.forEach((p) => m.set(p.paper_type, (m.get(p.paper_type) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [papers]);

  return (
    <div>
      <PageHeader title="Bibliometric Analytics" sub="Growth, platform coverage, collaboration structure and AI-assisted signals" />

      <div className="grid lg:grid-cols-3 gap-4 stagger">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Publication & citation growth</h3>
          <YearTrendChart data={ov.yearSeries} />
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Source coverage (normalized)</h3>
          <PlatformRadar data={ov.platformTotals.map((p) => ({ platform: p.platform, papers: p.papers, citations: p.citations }))} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Department comparison</h3>
          <DepartmentBarChart data={ov.departments} />
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">H-index trajectory — top faculty</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hTrend} margin={{ top: 8, right: 8, left: -14 }}>
              <CartesianGrid stroke="#e6ebf1" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#7a90a9" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: "#7a90a9" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e3eaf1", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Public Sans" }} iconType="circle" iconSize={7} />
              {topAuthors.map((a, i) => (
                <Line key={a._id} type="monotone" dataKey={a.name.replace("Dr. ", "")} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Publication types</h3>
          <TypeDonut data={typeData} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-ink-900 text-[17px] flex items-center gap-2"><IcNetwork size={18} /> Co-authorship network</h3>
            <span className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider">Author → Paper → Author</span>
          </div>
          <NetworkGraph nodes={net.nodes} edges={net.edges} selected={selected} onSelect={setSelected} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-500 mt-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-600" /> Faculty (number = Scopus papers)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gold-400" /> External collaborator</span>
            <span>Edge thickness = shared papers · click a node to isolate</span>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3 flex items-center gap-2"><IcSpark size={18} /> AI / ML insights</h3>
          <div className="space-y-3">
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border border-ink-100 p-3 hover:border-primary-200 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-ink-800 leading-snug">{ins.title}</span>
                </div>
                <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{ins.detail}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="chip h-5 text-[10px] bg-[#f3ecfd] text-[#6b46c1] border border-[#e0d4f7]">{ins.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.round(ins.confidence * 100)}%` }} />
                  </div>
                  <span className="num text-[10.5px] text-ink-400">{Math.round(ins.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-ink-400 mt-3 leading-relaxed">Outputs are statistical estimates from the stored corpus — never facts. Predictions carry explicit confidence.</p>
        </div>
      </div>
    </div>
  );
}


