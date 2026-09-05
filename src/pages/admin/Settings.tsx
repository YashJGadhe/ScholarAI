import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import type { Settings as TSettings } from "../../lib/core";
import type { ApiUsage, ResearchGateMode } from "../../lib/core";
import { fmtDateTime } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { Confirm, PageHeader, Skeleton, Spinner, useToast } from "../../components/ui";
import { IcAlert, IcCheck } from "../../components/icons";

const RG_MODES: { id: ResearchGateMode; label: string; desc: string }[] = [
  { id: "OFF", label: "OFF", desc: "No ResearchGate requests at all. Metrics show NOT_AVAILABLE." },
  { id: "MANUAL_IMPORT", label: "MANUAL_IMPORT", desc: "Admins record figures they personally verified. Provenance = MANUAL." },
  { id: "AUTHORIZED_ACCESS", label: "AUTHORIZED_ACCESS", desc: "Use only with an explicit institutional agreement with ResearchGate." },
  { id: "EXTERNAL_AUTHORIZED_PROVIDER", label: "EXTERNAL_AUTHORIZED_PROVIDER", desc: "Route through a licensed third-party data provider." },
];

export default function SettingsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<TSettings | null>(null);
  const [usage, setUsage] = useState<ApiUsage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    api.getSettings(token).then(setS).catch((e) => toast("error", e.message));
    api.listApiUsage(token).then(setUsage).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!s) return;
    setBusy(true);
    try {
      await api.updateSettings(token, s);
      toast("success", "System configuration saved. Connector behaviour updates immediately.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Save failed.");
    } finally { setBusy(false); }
  };

  const doReset = async () => {
    setResetBusy(true);
    try {
      await api.resetDemoData(token);
      toast("success", "Demo dataset restored to its seeded state.");
      setResetOpen(false);
      window.location.hash = "#/admin";
      setTimeout(() => window.location.reload(), 600);
    } finally { setResetBusy(false); }
  };

  if (!s) return <div className="space-y-4"><Skeleton className="h-8 w-52" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>;

  const setKey = (k: keyof TSettings["keys"], v: string) => setS({ ...s, keys: { ...s.keys, [k]: v } });

  return (
    <div>
      <PageHeader title="System & API Configuration" sub="Connector credentials and pipeline behaviour — keys never leave the backend in production" />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-4">External API keys</h3>
          <div className="space-y-3.5">
            {([
              ["orcid", "ORCID Client ID", "Public API — used for identity resolution"],
              ["scopus", "SCOPUS_API_KEY", "Elsevier Developer Portal"],
              ["wos", "WOS_API_KEY", "Clarivate WoS Starter API — empty = NOT_CONFIGURED"],
              ["serpapi", "SERPAPI_API_KEY", "Authorized Google Scholar provider"],
            ] as const).map(([k, label, hint]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <div className="flex items-center gap-2">
                  <input className="input num" type="password" value={s.keys[k]} onChange={(e) => setKey(k, e.target.value)} placeholder="not set" />
                  <span className={`chip shrink-0 ${s.keys[k] ? "bg-primary-50 text-primary-700 border border-primary-200" : "bg-warn-50 text-warn-700 border border-gold-300"}`}>
                    {s.keys[k] ? <IcCheck size={11} /> : <IcAlert size={11} />} {s.keys[k] ? "SET" : "EMPTY"}
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mt-1">{hint}</p>
              </div>
            ))}
          </div>

          <h3 className="font-display font-semibold text-ink-900 text-[16px] mt-6 mb-3">Pipeline behaviour</h3>
          <div className="space-y-3">
            <button onClick={() => setS({ ...s, summary_check_first: !s.summary_check_first })}
              className="w-full flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 cursor-pointer hover:border-primary-200 transition-colors">
              <div className="text-left">
                <div className="text-[13.5px] font-bold text-ink-800">Summary Check-First polling</div>
                <div className="text-[11.5px] text-ink-500">Compare summaries before any publication-level fetch (mandatory in production)</div>
              </div>
              <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${s.summary_check_first ? "bg-primary-600" : "bg-ink-200"}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${s.summary_check_first ? "translate-x-5" : ""}`} />
              </span>
            </button>
            <div>
              <label className="label">MongoDB summary cache TTL (hours)</label>
              <input className="input num" type="number" min={1} value={s.cache_ttl_hours} onChange={(e) => setS({ ...s, cache_ttl_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            </div>
            <div>
              <label className="label">ResearchGate connector mode</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {RG_MODES.map((m) => (
                  <button key={m.id} onClick={() => setS({ ...s, researchgate_mode: m.id })}
                    className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${s.researchgate_mode === m.id ? "border-primary-400 bg-primary-50/60" : "border-ink-100 hover:border-ink-200"}`}>
                    <div className="num text-[12px] font-bold text-ink-800">{m.label}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5 leading-snug">{m.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-400 mt-1.5">No scraping, CAPTCHA bypass or anti-bot evasion is ever implemented for ResearchGate.</p>
            </div>
          </div>
          <button className="btn-primary w-full mt-5" onClick={save} disabled={busy}>{busy ? <Spinner light /> : <IcCheck size={16} />} Save configuration</button>
        </div>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <h3 className="font-display font-semibold text-ink-900 text-[16px]">API usage & credit ledger</h3>
              <span className="chip bg-ink-50 border border-ink-100 text-ink-500">{usage?.length ?? 0} calls</span>
            </div>
            {!usage ? <div className="p-4"><Skeleton className="h-40" /></div> : (
              <table className="w-full">
                <thead><tr><th className="th">Platform</th><th className="th">Endpoint</th><th className="th">Status</th><th className="th text-right">Credits</th><th className="th text-right">When</th></tr></thead>
                <tbody>
                  {usage.slice(0, 10).map((u) => (
                    <tr key={u._id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="td num text-[12px] font-bold text-ink-700">{u.platform === "GOOGLE_SCHOLAR" ? "SCHOLAR" : u.platform}</td>
                      <td className="td num text-[11.5px] text-ink-500 max-w-[200px] truncate">{u.endpoint}</td>
                      <td className="td"><span className={`num chip h-5 text-[10px] ${u.success ? "bg-primary-50 text-primary-700" : "bg-danger-50 text-danger-700"}`}>{u.status_code}</span></td>
                      <td className="td text-right num text-[12px] text-ink-600">{u.estimated_usage}</td>
                      <td className="td text-right text-[11.5px] text-ink-400">{fmtDateTime(u.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card p-5 border-danger-100">
            <h3 className="font-display font-semibold text-danger-700 text-[16px]">Danger zone</h3>
            <p className="text-[12.5px] text-ink-500 mt-1 mb-3">Restore the original seeded demonstration dataset. All changes (added faculty, polls, imports) are discarded.</p>
            <button className="btn-danger" onClick={() => setResetOpen(true)}>Reset demo dataset</button>
          </div>
        </div>
      </div>

      <Confirm open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={doReset} busy={resetBusy} danger
        title="Reset demo dataset" body="This wipes every modification and reseeds ScholarAI with the original demonstration corpus. Continue?" />
    </div>
  );
}
