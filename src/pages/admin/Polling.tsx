import { useEffect, useRef, useState } from "react";
import * as api from "../../lib/api";
import { pollAuthor } from "../../lib/connectors";
import type { PollResult } from "../../lib/connectors";
import type { Author, PollingLog } from "../../lib/core";
import { PLATFORM_LABEL, fmtDateTime, timeAgo } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { PageHeader, Skeleton, Spinner, useToast } from "../../components/ui";
import { IcCheck, IcRadar, IcRefresh } from "../../components/icons";

export default function PollingPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [logs, setLogs] = useState<PollingLog[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [runAll, setRunAll] = useState(false);
  const [stage, setStage] = useState("");
  const [lastResult, setLastResult] = useState<PollResult | null>(null);

  const load = async () => {
    setAuthors(await api.listAuthors(token));
    setLogs(await api.listPollingLogs(token));
  };
  useEffect(() => { load().catch((e) => toast("error", e.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const run = async (a: Author) => {
    setRunning(a._id);
    setLastResult(null);
    setStage("Queued…");
    try {
      const res = await pollAuthor(a._id, user?.email ?? "admin", (s) => alive.current && setStage(s));
      setLastResult(res);
      await load();
      if (res.log.result === "UNCHANGED") toast("info", `${a.name}: summary unchanged — stopped after ${res.log.api_calls} summary calls.`);
      else toast("success", `${a.name}: delta detected · ${res.log.api_calls} API calls for full collection.`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Poll failed.");
    } finally {
      setRunning(null);
      setStage("");
    }
  };

  const runAllPolls = async () => {
    if (!authors) return;
    setRunAll(true);
    for (const a of authors) {
      setRunning(a._id);
      setStage(`Checking ${a.name}…`);
      try {
        await pollAuthor(a._id, user?.email ?? "admin");
      } catch { /* keep going — one failure must not stop the pipeline */ }
      if (alive.current) setAuthors(await api.listAuthors(token));
    }
    setRunning(null);
    setRunAll(false);
    setStage("");
    setLogs(await api.listPollingLogs(token));
    toast("success", "Polling sweep complete — see the log below.");
  };

  return (
    <div>
      <PageHeader title="On-Demand Polling" sub="Summary Check-First: fetch profile summaries, compare with MongoDB, run full collection only on delta"
        actions={<button className="btn-primary" onClick={runAllPolls} disabled={runAll || !authors}><IcRefresh size={16} /> {runAll ? "Sweeping…" : "Poll all researchers"}</button>} />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {!authors ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />) : authors.map((a) => {
          const m = a.platform_metrics.SCOPUS;
          const isRunning = running === a._id;
          return (
            <div key={a._id} className={`card p-5 transition-shadow ${isRunning ? "shadow-[0_0_0_2px_#12998a55]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display font-semibold text-ink-900 text-[16px]">{a.name}</div>
                  <div className="text-[11.5px] text-ink-400">{a.department}</div>
                </div>
                {a.sim_pending_delta ? (
                  <span className="chip bg-gold-100 text-gold-700 border border-gold-300/70 h-5 text-[10px]" title="Simulated remote has drifted ahead of the stored snapshot — polling will detect a delta.">update pending</span>
                ) : (
                  <span className="chip bg-ink-50 border border-ink-100 text-ink-400 h-5 text-[10px]">in sync</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                {[["Papers", m?.papers ?? null], ["Citations", m?.citations ?? null], ["H-index", m?.h_index ?? null]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-ink-50/70 py-2">
                    <div className="num text-[15px] font-semibold text-ink-800">{v === null ? "NA" : (v as number).toLocaleString()}</div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400">{l} · Scopus</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 text-[11px] text-ink-400">
                <span>Polled {timeAgo(a.last_polled_at)}</span>
                <span>Changed {timeAgo(a.last_changed_at)}</span>
              </div>
              <button className={`w-full mt-3 ${isRunning ? "btn-dark" : "btn-ghost"}`} onClick={() => run(a)} disabled={!!running}>
                {isRunning ? <Spinner light /> : <IcRadar size={15} />}
                {isRunning ? stage || "Working…" : "Check for updates"}
              </button>
            </div>
          );
        })}
      </div>

      {lastResult && (
        <div className={`card p-5 mt-4 anim-fade-up border-l-4 ${lastResult.log.result === "UNCHANGED" ? "border-l-primary-500" : "border-l-gold-500"}`}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`chip ${lastResult.log.result === "UNCHANGED" ? "bg-primary-50 text-primary-700 border border-primary-200" : "bg-gold-100 text-gold-700 border border-gold-300"}`}>
              <IcCheck size={12} /> {lastResult.log.result === "UNCHANGED" ? "UNCHANGED — full collection skipped" : "DELTA DETECTED — full collection ran"}
            </span>
            <span className="text-[12px] text-ink-400 num">{lastResult.log.api_calls} API calls · {(lastResult.log.duration_ms / 1000).toFixed(1)}s</span>
          </div>
          <p className="text-[13px] text-ink-600">{lastResult.log.change_reason.join(" · ")}</p>
          {lastResult.log.changes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {lastResult.log.changes.map((c, i) => (
                <span key={i} className="chip bg-ink-50 border border-ink-100 text-ink-600 num">
                  {PLATFORM_LABEL[c.platform]} {c.field}: {c.from} → <strong className="text-ink-900">{c.to}</strong>
                </span>
              ))}
            </div>
          )}
          {lastResult.new_papers.length > 0 && (
            <p className="text-[12.5px] text-primary-700 font-semibold mt-2">+ {lastResult.new_papers.length} new publication record(s) ingested with provenance.</p>
          )}
        </div>
      )}

      <div className="card overflow-hidden mt-4">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-display font-semibold text-ink-900 text-[17px]">Polling log</h3>
          <span className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider">{logs.length} runs</span>
        </div>
        <table className="w-full">
          <thead><tr><th className="th">When</th><th className="th">Researcher</th><th className="th">Result</th><th className="th">Reason / changes</th><th className="th text-right">API calls</th><th className="th text-right">Duration</th></tr></thead>
          <tbody>
            {logs.slice(0, 12).map((l) => (
              <tr key={l._id} className="hover:bg-primary-50/30 transition-colors">
                <td className="td text-[12px] text-ink-500 whitespace-nowrap">{fmtDateTime(l.at)}</td>
                <td className="td font-semibold text-ink-800">{l.author_name}</td>
                <td className="td">
                  <span className={`chip h-5 text-[10px] ${l.result === "CHANGED" ? "bg-gold-100 text-gold-700" : l.result === "UNCHANGED" ? "bg-primary-50 text-primary-700 border border-primary-200" : "bg-danger-50 text-danger-700 border border-danger-100"}`}>
                    {l.result}
                  </span>
                </td>
                <td className="td text-[12.5px] text-ink-500 max-w-[380px] truncate">{l.change_reason.join("; ")}</td>
                <td className="td text-right num text-[12.5px] text-ink-600">{l.api_calls}</td>
                <td className="td text-right num text-[12.5px] text-ink-600">{(l.duration_ms / 1000).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
