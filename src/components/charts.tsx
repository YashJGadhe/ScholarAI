/* ScholarAI — themed Recharts wrappers for the light academic UI. */

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "../lib/core";
import type { Platform } from "../lib/core";

const AXIS = { fontSize: 11, fill: "#7a90a9", fontFamily: "Public Sans" };
const GRID = "#e6ebf1";

const tooltipStyle = {
  borderRadius: 10, border: "1px solid #e3eaf1", boxShadow: "0 8px 24px -10px rgb(16 30 49 / 0.25)",
  fontSize: 12, fontFamily: "Public Sans", background: "#fff",
};

export function YearTrendChart({ data }: { data: { year: string; publications: number; citations: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gPub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12998a" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#12998a" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gCit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e29a17" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#e29a17" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Public Sans" }} iconType="circle" iconSize={8} />
        <Area type="monotone" dataKey="publications" name="Publications" stroke="#0e8172" strokeWidth={2.2} fill="url(#gPub)" />
        <Area type="monotone" dataKey="citations" name="Citations" stroke="#e29a17" strokeWidth={2.2} fill="url(#gCit)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DepartmentBarChart({ data }: { data: { name: string; publications: number; citations: number }[] }) {
  const short = (s: string) => s.replace("School of ", "").replace(" & Engineering", "").replace("Engineering", "Engg.").replace("Electronics & Communication", "ECE").replace("Computer Science", "CSE");
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data.map((d) => ({ ...d, short: short(d.name) }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barSize={18}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="short" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-14} height={44} textAnchor="end" />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Public Sans" }} iconType="circle" iconSize={8} />
        <Bar dataKey="publications" name="Publications" fill="#0e8172" radius={[4, 4, 0, 0]} />
        <Bar dataKey="citations" name="Citations" fill="#f2b33d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlatformRadar({ data }: { data: { platform: Platform; papers: number | null; citations: number | null }[] }) {
  const norm = (vals: (number | null)[]) => {
    const max = Math.max(1, ...vals.map((v) => v ?? 0));
    return vals.map((v) => Math.round(((v ?? 0) / max) * 100));
  };
  const papers = norm(data.map((d) => d.papers));
  const cites = norm(data.map((d) => d.citations));
  const chartData = data.map((d, i) => ({
    label: d.platform === "GOOGLE_SCHOLAR" ? "Scholar" : d.platform === "WOS" ? "WoS" : d.platform === "SCOPUS" ? "Scopus" : d.platform === "ORCID" ? "ORCID" : "RG",
    papers: papers[i], citations: cites[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={chartData} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="label" tick={{ ...AXIS, fontSize: 11 }} />
        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Radar name="Papers (norm.)" dataKey="papers" stroke="#0e8172" fill="#12998a" fillOpacity={0.3} strokeWidth={2} />
        <Radar name="Citations (norm.)" dataKey="citations" stroke="#3d6de0" fill="#3d6de0" fillOpacity={0.18} strokeWidth={2} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Public Sans" }} iconType="circle" iconSize={8} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function HistoryLineChart({ data }: { data: { label: string; scopus: number | null; scholar: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Public Sans" }} iconType="circle" iconSize={8} />
        <Line type="monotone" dataKey="scopus" name="Scopus citations" stroke="#e9711c" strokeWidth={2.2} dot={{ r: 2.5 }} />
        <Line type="monotone" dataKey="scholar" name="Scholar citations" stroke="#3d6de0" strokeWidth={2.2} dot={{ r: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TypeDonut({ data }: { data: { name: string; value: number }[] }) {
  const COLORS = ["#0e8172", "#f2b33d", "#3d6de0", "#e9711c", "#7ba23f", "#1299b8"];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} strokeWidth={2} stroke="#fff">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Public Sans" }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PlatformCompareBars({ data }: { data: { platform: Platform; papers: number; citations: number }[] }) {
  const rows = data.map((d) => ({
    label: PLATFORM_LABEL[d.platform],
    papers: d.papers,
    citations: d.citations,
    fill: PLATFORM_COLOR[d.platform],
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barSize={26}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="papers" name="Papers" radius={[4, 4, 0, 0]}>
          {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
