/* Citation Management — rendered in the institute's master-sheet format:
   Sr. No. | Faculty | WoS (P/C/H) | Scopus (P/C/H) | Scholar (P/C/H/i10) | profile links,
   with Total + Average footer rows. Source metrics come straight from the stored
   author-level summaries — never recomputed or blended. NA ≠ 0. */

import { useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import { downloadExcel, downloadJSON } from "../../lib/export";
import type { Author } from "../../lib/core";
import { fmtDate } from "../../lib/core";
import { PageHeader, Skeleton, StatCard, useToast } from "../../components/ui";
import { IcDownload, IcExternal, IcInfo } from "../../components/icons";

/** NA-aware metric cell: null → NA badge, number → exact value (0 stays 0). */
function Cell({ v, strong = false }: { v: number | null; strong?: boolean }) {
  if (v === null || v === undefined) {
    return <span className="chip h-5 px-1.5 text-[10px] bg-ink-50 border border-ink-100 text-ink-400" title="Not available / not collected — this is NA, not zero">NA</span>;
  }
  return <span className={`num ${strong ? "font-semibold text-ink-900" : "text-ink-700"}`}>{v.toLocaleString()}</span>;
}

function LinkCell({ url, color, label }: { url: string | null; color: string; label: string }) {
  if (!url) return <span className="text-ink-300 text-[12px]">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" title={url}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-transform hover:scale-110 hover:shadow-md"
      style={{ background: `${color}18`, color }}
      onClick={(e) => e.stopPropagation()}>
      <IcExternal size={13} /><span className="sr-only">{label}</span>
    </a>
  );
}

const WOS = "#1299b8", SCOPUS = "#e9711c", SCHOLAR = "#3d6de0", RG = "#00a89b";

const sum = (vals: (number | null)[]) => vals.reduce<number>((a, v) => a + (v ?? 0), 0);
const avg = (vals: (number | null)[]) => (vals.length ? sum(vals) / vals.length : 0);

export default function CitationsPage() {
  const toast = useToast();
  const [authors, setAuthors] = useState<Author[] | null>(null);

  useEffect(() => {
    api.listAuthors(api.getToken()).then(setAuthors).catch((e) => toast("error", e instanceof Error ? e.message : "Load failed."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    if (!authors) return null;
    const m = (a: Author, p: "WOS" | "SCOPUS" | "GOOGLE_SCHOLAR") => a.platform_metrics[p];
    const t = {
      wos: { p: sum(authors.map((a) => m(a, "WOS")?.papers ?? null)), c: sum(authors.map((a) => m(a, "WOS")?.citations ?? null)), h: sum(authors.map((a) => m(a, "WOS")?.h_index ?? null)) },
      scopus: { p: sum(authors.map((a) => m(a, "SCOPUS")?.papers ?? null)), c: sum(authors.map((a) => m(a, "SCOPUS")?.citations ?? null)), h: sum(authors.map((a) => m(a, "SCOPUS")?.h_index ?? null)) },
      scholar: { p: sum(authors.map((a) => m(a, "GOOGLE_SCHOLAR")?.papers ?? null)), c: sum(authors.map((a) => m(a, "GOOGLE_SCHOLAR")?.citations ?? null)), h: sum(authors.map((a) => m(a, "GOOGLE_SCHOLAR")?.h_index ?? null)), i: sum(authors.map((a) => m(a, "GOOGLE_SCHOLAR")?.i10_index ?? null)) },
      cover: {
        wos: authors.filter((a) => m(a, "WOS")).length,
        scopus: authors.filter((a) => m(a, "SCOPUS")).length,
        scholar: authors.filter((a) => m(a, "GOOGLE_SCHOLAR")).length,
        rg: authors.filter((a) => a.profile_urls.researchgate).length,
      },
    };
    return t;
  }, [authors]);

  const exportSheet = () => {
    if (!authors) return;
    const columns = [
      "Sr. No.", "Faculty Name",
      "Paper in Web of Science", "Citations in WoS", "h-Index (WOS)",
      "Paper in Scopus", "Citations in Scopus", "h-Index (Scopus)",
      "Paper in Google Scholar", "Citations in Google Scholar", "h-Index", "i-Index",
      "Publons Link", "Scopus Link", "Google Scholar Link", "ResearchGate ID",
    ];
    const cell = (v: number | null | undefined) => (v === null || v === undefined ? "NA" : v);
    const link = (v: string | null) => v ?? "NIL";
    const rows: (string | number)[][] = authors.map((a, i) => [
      i + 1, a.name,
      cell(a.platform_metrics.WOS?.papers), cell(a.platform_metrics.WOS?.citations), cell(a.platform_metrics.WOS?.h_index),
      cell(a.platform_metrics.SCOPUS?.papers), cell(a.platform_metrics.SCOPUS?.citations), cell(a.platform_metrics.SCOPUS?.h_index),
      cell(a.platform_metrics.GOOGLE_SCHOLAR?.papers), cell(a.platform_metrics.GOOGLE_SCHOLAR?.citations), cell(a.platform_metrics.GOOGLE_SCHOLAR?.h_index), cell(a.platform_metrics.GOOGLE_SCHOLAR?.i10_index),
      link(a.profile_urls.wos), link(a.profile_urls.scopus), link(a.profile_urls.google_scholar), link(a.profile_urls.researchgate),
    ]);
    if (totals) {
      rows.push([
        "", "Total",
        totals.wos.p, totals.wos.c, totals.wos.h,
        totals.scopus.p, totals.scopus.c, totals.scopus.h,
        totals.scholar.p, totals.scholar.c, totals.scholar.h, totals.scholar.i,
        "-", "-", "-", "-",
      ]);
      rows.push([
        "", "Average",
        +avg(authors.map((a) => a.platform_metrics.WOS?.papers ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.WOS?.citations ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.WOS?.h_index ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.SCOPUS?.papers ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.SCOPUS?.citations ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.SCOPUS?.h_index ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.papers ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.citations ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.h_index ?? null)).toFixed(2),
        +avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.i10_index ?? null)).toFixed(2),
        "-", "-", "-", "-",
      ]);
    }
    downloadExcel({ title: "Citation Management — Faculty Master Sheet", columns, rows });
    toast("success", "Excel (CSV) exported with institutional column names + Total/Average rows.");
  };

  const n = authors?.length ?? 0;

  return (
    <div>
      <PageHeader title="Citation Management" sub="Institutional master-sheet format · source metrics kept separate per platform"
        actions={
          <>
            <button className="btn-ghost" onClick={() => {
              if (!authors) return;
              const cols = ["Sr. No.", "Faculty Name", "Paper in Web of Science", "Citations in WoS", "h-Index (WOS)", "Paper in Scopus", "Citations in Scopus", "h-Index (Scopus)", "Paper in Google Scholar", "Citations in Google Scholar", "h-Index", "i-Index", "Publons Link", "Scopus Link", "Google Scholar Link", "ResearchGate ID"];
              const rows = authors.map((a, i) => [i + 1, a.name, a.platform_metrics.WOS?.papers ?? "NA", a.platform_metrics.WOS?.citations ?? "NA", a.platform_metrics.WOS?.h_index ?? "NA", a.platform_metrics.SCOPUS?.papers ?? "NA", a.platform_metrics.SCOPUS?.citations ?? "NA", a.platform_metrics.SCOPUS?.h_index ?? "NA", a.platform_metrics.GOOGLE_SCHOLAR?.papers ?? "NA", a.platform_metrics.GOOGLE_SCHOLAR?.citations ?? "NA", a.platform_metrics.GOOGLE_SCHOLAR?.h_index ?? "NA", a.platform_metrics.GOOGLE_SCHOLAR?.i10_index ?? "NA", a.profile_urls.wos ?? "NIL", a.profile_urls.scopus ?? "NIL", a.profile_urls.google_scholar ?? "NIL", a.profile_urls.researchgate ?? "NIL"] as (string | number)[]);
              downloadJSON({ title: "Citation Management — Faculty Master Sheet", columns: cols, rows });
              toast("success", "JSON snapshot exported.");
            }}>
              <IcDownload size={15} /> JSON
            </button>
            <button className="btn-primary" onClick={exportSheet} disabled={!authors}><IcDownload size={15} /> Export Excel</button>
          </>
        } />

      {!authors || !totals ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <StatCard label="Web of Science" value={totals.wos.c} tone="blue"
            sub={`${totals.wos.p} papers · Σ h-index ${totals.wos.h} · ${totals.cover.wos}/${n} profiles`} />
          <StatCard label="Scopus" value={totals.scopus.c} tone="amber" delay={40}
            sub={`${totals.scopus.p} papers · Σ h-index ${totals.scopus.h} · ${totals.cover.scopus}/${n} profiles`} />
          <StatCard label="Google Scholar" value={totals.scholar.c} tone="teal" delay={80}
            sub={`${totals.scholar.p} papers · Σ h-index ${totals.scholar.h} · i10 Σ ${totals.scholar.i}`} />
          <StatCard label="ResearchGate" value={totals.cover.rg} suffix={`/${n}`} tone="ink" delay={120}
            sub="profiles linked · metrics NA (no authorized access)" />
        </div>
      )}

      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead>
              <tr>
                <th className="th" rowSpan={2}>Sr. No.</th>
                <th className="th" rowSpan={2}>Faculty Name</th>
                <th className="th text-center" colSpan={3} style={{ borderTop: `3px solid ${WOS}`, background: "#1299b80f", color: WOS }}>Web of Science</th>
                <th className="th text-center" colSpan={3} style={{ borderTop: `3px solid ${SCOPUS}`, background: "#e9711c0f", color: SCOPUS }}>Scopus</th>
                <th className="th text-center" colSpan={4} style={{ borderTop: `3px solid ${SCHOLAR}`, background: "#3d6de00f", color: SCHOLAR }}>Google Scholar</th>
                <th className="th text-center" colSpan={4} style={{ borderTop: "3px solid #29405c", background: "#29405c0a" }}>Profiles</th>
              </tr>
              <tr>
                {["Papers", "Citations", "h-Index", "Papers", "Citations", "h-Index", "Papers", "Citations", "h-Index", "i10-Index"].map((h, i) => (
                  <th key={i} className="th text-right">{h}</th>
                ))}
                <th className="th text-center">Publons</th>
                <th className="th text-center">Scopus</th>
                <th className="th text-center">Scholar</th>
                <th className="th text-center">RG</th>
              </tr>
            </thead>
            <tbody>
              {!authors ? (
                <tr><td colSpan={16} className="td"><Skeleton className="h-40" /></td></tr>
              ) : (
                authors.map((a, i) => {
                  const w = a.platform_metrics.WOS, s = a.platform_metrics.SCOPUS, g = a.platform_metrics.GOOGLE_SCHOLAR;
                  return (
                    <tr key={a._id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="td num text-ink-400 text-[12px]">{i + 1}</td>
                      <td className="td">
                        <div className="font-semibold text-ink-900 whitespace-nowrap">{a.name}</div>
                        <div className="text-[11px] text-ink-400">{a.designation}</div>
                      </td>
                      <td className="td text-right"><Cell v={w?.papers ?? null} /></td>
                      <td className="td text-right"><Cell v={w?.citations ?? null} strong /></td>
                      <td className="td text-right"><Cell v={w?.h_index ?? null} /></td>
                      <td className="td text-right"><Cell v={s?.papers ?? null} /></td>
                      <td className="td text-right"><Cell v={s?.citations ?? null} strong /></td>
                      <td className="td text-right"><Cell v={s?.h_index ?? null} /></td>
                      <td className="td text-right"><Cell v={g?.papers ?? null} /></td>
                      <td className="td text-right"><Cell v={g?.citations ?? null} strong /></td>
                      <td className="td text-right"><Cell v={g?.h_index ?? null} /></td>
                      <td className="td text-right"><Cell v={g?.i10_index ?? null} /></td>
                      <td className="td text-center"><LinkCell url={a.profile_urls.wos} color={WOS} label="Publons / WoS" /></td>
                      <td className="td text-center"><LinkCell url={a.profile_urls.scopus} color={SCOPUS} label="Scopus" /></td>
                      <td className="td text-center"><LinkCell url={a.profile_urls.google_scholar} color={SCHOLAR} label="Google Scholar" /></td>
                      <td className="td text-center"><LinkCell url={a.profile_urls.researchgate} color={RG} label="ResearchGate" /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {authors && totals && (
              <tfoot>
                <tr className="bg-ink-900 text-white">
                  <td className="td font-bold" colSpan={2}>Total ({authors.length} faculty)</td>
                  {[totals.wos.p, totals.wos.c, totals.wos.h, totals.scopus.p, totals.scopus.c, totals.scopus.h, totals.scholar.p, totals.scholar.c, totals.scholar.h, totals.scholar.i].map((v, i) => (
                    <td key={i} className="td text-right num font-bold border-white/10">{v.toLocaleString()}</td>
                  ))}
                  <td colSpan={4} className="td border-white/10" />
                </tr>
                <tr className="bg-ink-50">
                  <td className="td font-bold text-ink-600" colSpan={2}>Average</td>
                  {[
                    avg(authors.map((a) => a.platform_metrics.WOS?.papers ?? null)), avg(authors.map((a) => a.platform_metrics.WOS?.citations ?? null)), avg(authors.map((a) => a.platform_metrics.WOS?.h_index ?? null)),
                    avg(authors.map((a) => a.platform_metrics.SCOPUS?.papers ?? null)), avg(authors.map((a) => a.platform_metrics.SCOPUS?.citations ?? null)), avg(authors.map((a) => a.platform_metrics.SCOPUS?.h_index ?? null)),
                    avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.papers ?? null)), avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.citations ?? null)), avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.h_index ?? null)), avg(authors.map((a) => a.platform_metrics.GOOGLE_SCHOLAR?.i10_index ?? null)),
                  ].map((v, i) => (
                    <td key={i} className="td text-right num font-semibold text-ink-700">{v.toFixed(2)}</td>
                  ))}
                  <td colSpan={4} className="td" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2.5 mt-3 text-[11.5px] text-ink-500">
        <span className="text-ink-400 mt-0.5"><IcInfo size={14} /></span>
        <p className="max-w-3xl leading-relaxed">
          Values are read verbatim from each researcher's stored platform summary (provenance: institutional master-sheet import) — nothing here is
          recomputed or blended across sources. <span className="chip h-5 px-1.5 text-[10px] bg-ink-50 border border-ink-100 text-ink-400 align-middle">NA</span> means
          the profile/data is unavailable (NIL on the sheet); <strong>0</strong> is a confirmed zero. i10-Index is Google Scholar-only by definition.
          Data as of {authors?.[0] ? fmtDate(authors[0].platform_metrics.SCOPUS?.last_updated ?? authors[0].updated_at) : "—"}.
        </p>
      </div>
    </div>
  );
}
