import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import { manualResearchGateImport } from "../../lib/connectors";
import { buildReport } from "../../lib/analytics";
import { downloadExcel } from "../../lib/export";
import type { Author, Platform } from "../../lib/core";
import { PLATFORM_LABEL, fmtDateTime } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { Modal, PageHeader, PlatformChip, Skeleton, Spinner, Metric, useToast } from "../../components/ui";
import { IcAlert, IcDownload, IcInfo, IcPlus } from "../../components/icons";

const TABS: Platform[] = ["SCOPUS", "GOOGLE_SCHOLAR", "WOS", "ORCID", "RESEARCHGATE"];

export default function CitationsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [plat, setPlat] = useState<Platform>("SCOPUS");
  const [rgModal, setRgModal] = useState<Author | null>(null);
  const [rgValues, setRgValues] = useState({ papers: "", citations: "" });
  const [rgBusy, setRgBusy] = useState(false);
  const [rgMode, setRgMode] = useState<string>("OFF");

  const load = () => api.listAuthors(token).then(setAuthors).catch((e) => toast("error", e.message));
  useEffect(() => {
    load();
    api.getSettings(token).then((s) => setRgMode(s.researchgate_mode)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    downloadExcel(buildReport("citation", null));
    toast("success", "Citation report exported (Excel-compatible CSV).");
  };

  const saveRg = async () => {
    if (!rgModal) return;
    const papers = parseInt(rgValues.papers, 10);
    const citations = parseInt(rgValues.citations, 10);
    if (isNaN(papers) || isNaN(citations) || papers < 0 || citations < 0) {
      toast("error", "Enter non-negative whole numbers.");
      return;
    }
    setRgBusy(true);
    manualResearchGateImport(rgModal._id, papers, citations);
    await new Promise((r) => setTimeout(r, 500));
    setRgBusy(false);
    setRgModal(null);
    toast("success", `ResearchGate figures recorded for ${rgModal.name} (provenance: MANUAL).`);
    load();
  };

  const quotaRows = (authors ?? []).filter((a) => a.platform_metrics.WOS?.provenance.note?.includes("quota"));

  return (
    <div>
      <PageHeader title="Citation Management" sub="Source-specific metrics per platform — NA means not collected, 0 means confirmed zero"
        actions={<button className="btn-ghost" onClick={exportCsv}><IcDownload size={16} /> Export report</button>} />

      {plat === "WOS" && quotaRows.length > 0 && (
        <div className="card border-gold-300 bg-warn-50/60 p-4 mb-4 flex items-start gap-3">
          <span className="text-warn-600 mt-0.5"><IcAlert size={17} /></span>
          <div className="text-[13px] text-warn-700">
            <strong>Structured API failure on record:</strong> {quotaRows.map((a) => a.name).join(", ")} returned <span className="num">HTTP 429 — API quota exceeded</span> from the WoS Starter API.
            Metrics are shown as <strong>NA</strong> (never fabricated) until the next successful poll.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setPlat(t)}
            className={`h-9 px-3.5 rounded-lg text-[12.5px] font-bold cursor-pointer border transition-colors ${plat === t ? "bg-ink-900 text-white border-ink-900" : "bg-surface text-ink-500 border-ink-200 hover:border-ink-300"}`}>
            {PLATFORM_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {!authors ? (
          <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <table className="w-full">
            <thead><tr>
              <th className="th">Researcher</th>
              <th className="th text-right">Papers</th><th className="th text-right">Citations</th>
              <th className="th text-right">H-index</th><th className="th text-right">i10-index</th>
              <th className="th">Retrieved</th><th className="th text-right">Provenance</th>
            </tr></thead>
            <tbody>
              {authors.map((a) => {
                const m = a.platform_metrics[plat];
                return (
                  <tr key={a._id} className="hover:bg-primary-50/30 transition-colors">
                    <td className="td">
                      <div className="font-semibold text-ink-900">{a.name}</div>
                      <div className="text-[11.5px] text-ink-400">{a.department}</div>
                    </td>
                    <td className="td text-right"><Metric v={m?.papers ?? null} strong /></td>
                    <td className="td text-right"><Metric v={m?.citations ?? null} strong /></td>
                    <td className="td text-right"><Metric v={m?.h_index ?? null} /></td>
                    <td className="td text-right"><Metric v={plat === "GOOGLE_SCHOLAR" ? m?.i10_index ?? null : null} /></td>
                    <td className="td text-[12px] text-ink-500">{m?.last_updated ? fmtDateTime(m.last_updated) : "NA"}</td>
                    <td className="td text-right">
                      {plat === "RESEARCHGATE" && rgMode === "MANUAL_IMPORT" && a.identifiers.researchgate_id && !m?.papers && (
                        <button className="btn-ghost btn-sm" onClick={() => { setRgModal(a); setRgValues({ papers: "", citations: "" }); }}>
                          <IcPlus size={13} /> Manual import
                        </button>
                      )}
                      <span className="chip bg-ink-50 border border-ink-100 text-ink-500 h-5 text-[10px]" title={m?.provenance.note ?? ""}>
                        {m?.provenance.source_platform ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-4 mt-4 flex items-start gap-3">
        <span className="text-ink-400 mt-0.5"><IcInfo size={16} /></span>
        <div className="text-[12.5px] text-ink-500 leading-relaxed">
          <strong className="text-ink-700">Reading this table:</strong> <span className="num font-semibold text-ink-700">0</span> is a confirmed zero returned by the source.
          <span className="num font-semibold text-ink-400 italic"> NA</span> means the value was never collected or the connector failed (quota, missing key, or a compliant
          ResearchGate mode). Platform chips in the top bar show live connector status. i10-index is only reported by Google Scholar.
        </div>
      </div>

      <Modal open={!!rgModal} onClose={() => setRgModal(null)} title={`Manual ResearchGate import — ${rgModal?.name}`}>
        <p className="text-[13px] text-ink-500 mb-4 leading-relaxed">
          ResearchGate has no open public API, so ScholarAI never scrapes it. In <strong>MANUAL_IMPORT</strong> mode you may record figures you personally verified on the researcher's profile.
          Provenance is stored as <span className="num">MANUAL</span>.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Papers (verified)</label><input className="input num" type="number" min={0} value={rgValues.papers} onChange={(e) => setRgValues({ ...rgValues, papers: e.target.value })} /></div>
          <div><label className="label">Citations (verified)</label><input className="input num" type="number" min={0} value={rgValues.citations} onChange={(e) => setRgValues({ ...rgValues, citations: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={() => setRgModal(null)}>Cancel</button>
          <button className="btn-primary" onClick={saveRg} disabled={rgBusy}>{rgBusy ? <Spinner light /> : null} Record figures</button>
        </div>
      </Modal>
    </div>
  );
}
