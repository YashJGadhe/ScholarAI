import { useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import { buildReport } from "../../lib/analytics";
import type { ReportData } from "../../lib/analytics";
import { downloadCSV, downloadExcel, downloadJSON } from "../../lib/export";
import type { Author } from "../../lib/core";
import { PageHeader, Skeleton, useToast } from "../../components/ui";
import { IcDownload, IcReport } from "../../components/icons";

const REPORT_TYPES = [
  { id: "faculty", label: "Faculty research report", desc: "All papers for one researcher with the 15 institutional columns" },
  { id: "department", label: "Department research report", desc: "Papers and author-summary metrics for a department" },
  { id: "citation", label: "Citation report", desc: "Papers / citations / H / i10 per researcher per platform" },
  { id: "yearly", label: "Year-wise report", desc: "Publication and citation totals per year" },
  { id: "platform", label: "Platform comparison", desc: "Coverage and totals across the five sources" },
  { id: "publications", label: "Publication report (all)", desc: "Full corpus export, one row per paper × source record" },
];

export default function ReportsPage() {
  const toast = useToast();
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [kind, setKind] = useState("faculty");
  const [param, setParam] = useState<string>("");
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    api.listAuthors(api.getToken()).then((a) => { setAuthors(a); if (a[0]) setParam(a[0]._id); }).catch((e) => toast("error", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authors) return;
    if (kind === "faculty") setParam(authors[0]?._id ?? "");
    else if (kind === "department") setParam(authors[0]?.department ?? "");
    else setParam("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, authors]);

  const needsParam = kind === "faculty" || kind === "department";
  const depts = useMemo(() => [...new Set((authors ?? []).map((a) => a.department))], [authors]);

  useEffect(() => {
    if (!authors) return;
    if (needsParam && !param) { setReport(null); return; }
    const t = setTimeout(() => setReport(buildReport(kind, needsParam ? param : null)), 250);
    return () => clearTimeout(t);
  }, [kind, param, authors, needsParam]);

  const fmts = report ? [
    { label: "Excel (CSV)", fn: () => downloadExcel(report) },
    { label: "CSV", fn: () => downloadCSV(report) },
    { label: "JSON", fn: () => downloadJSON(report) },
  ] : [];

  return (
    <div>
      <PageHeader title="Reports & Export" sub="Institutional column names are preserved exactly — existing Excel templates keep working" />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
        {REPORT_TYPES.map((r) => (
          <button key={r.id} onClick={() => setKind(r.id)}
            className={`card p-4 text-left transition-all cursor-pointer hover:-translate-y-0.5 ${kind === r.id ? "shadow-[0_0_0_2px_#0e8172] border-primary-200" : ""}`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${kind === r.id ? "bg-primary-700 text-white" : "bg-ink-50 text-ink-400"}`}><IcReport size={16} /></span>
              <span className="font-semibold text-[14px] text-ink-900">{r.label}</span>
            </div>
            <p className="text-[12px] text-ink-500 mt-2 leading-relaxed">{r.desc}</p>
          </button>
        ))}
      </div>

      <div className="card p-5 mt-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[240px]">
            <h3 className="font-display font-semibold text-ink-900 text-[17px]">{report?.title ?? "Configure report"}</h3>
            <p className="text-[12px] text-ink-400">{report ? `${report.rows.length} rows × ${report.columns.length} columns` : "Select parameters to build the report"}</p>
          </div>
          {needsParam && (
            <select className="input w-auto min-w-[260px] cursor-pointer" value={param} onChange={(e) => setParam(e.target.value)}>
              {kind === "faculty"
                ? (authors ?? []).map((a) => <option key={a._id} value={a._id}>{a.name} — {a.department}</option>)
                : depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {fmts.map((f) => (
            <button key={f.label} className="btn-ghost" onClick={() => { f.fn(); toast("success", `${report?.title} exported as ${f.label}.`); }}>
              <IcDownload size={15} /> {f.label}
            </button>
          ))}
        </div>

        {!authors ? <Skeleton className="h-64" /> : !report ? (
          <div className="py-10 text-center text-sm text-ink-400">Choose a report type{needsParam ? " and parameter" : ""} to preview rows.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-100">
            <table className="w-full min-w-[900px]">
              <thead><tr>{report.columns.map((c) => <th key={c} className="th whitespace-nowrap">{c}</th>)}</tr></thead>
              <tbody>
                {report.rows.slice(0, 8).map((row, i) => (
                  <tr key={i} className="hover:bg-primary-50/30 transition-colors">
                    {row.map((cell, j) => <td key={j} className="td text-[12.5px] text-ink-600 max-w-[260px] truncate">{String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length > 8 && <div className="px-4 py-2 text-[11.5px] text-ink-400 bg-ink-50/60 border-t border-ink-100">Preview shows 8 of {report.rows.length} rows — the export contains everything.</div>}
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-ink-400 mt-3">
        Author-level summary metrics (paper count, citations, H-index, i10-index) are mapped into export rows from the author record —
        paper documents in the database keep only paper-level fields, so the underlying model is never corrupted.
      </p>
    </div>
  );
}
