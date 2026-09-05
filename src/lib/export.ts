/* ScholarAI — export_service: CSV (Excel-compatible w/ BOM), JSON downloads. */

import type { ReportData } from "./analytics";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(report: ReportData): string {
  const lines = [report.columns.map(csvEscape).join(",")];
  report.rows.forEach((r) => lines.push(r.map(csvEscape).join(",")));
  return lines.join("\r\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Excel-compatible CSV (UTF-8 BOM so Excel renders Unicode correctly). */
export function downloadExcel(report: ReportData): void {
  download(`${slug(report.title)}.csv`, "\uFEFF" + toCSV(report), "text/csv;charset=utf-8");
}

export function downloadCSV(report: ReportData): void {
  download(`${slug(report.title)}.csv`, toCSV(report), "text/csv;charset=utf-8");
}

export function downloadJSON(report: ReportData): void {
  const payload = report.rows.map((r) => Object.fromEntries(report.columns.map((c, i) => [c, r[i]])));
  download(`${slug(report.title)}.json`, JSON.stringify({ report: report.title, generated_at: new Date().toISOString(), rows: payload }, null, 2), "application/json");
}
