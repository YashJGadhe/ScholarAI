import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import type { FetchPreview, PlatformPreview } from "../../lib/connectors";
import { PLATFORMS, PLATFORM_LABEL } from "../../lib/core";
import { makeOrcid, orcidChecksumValid, scopusUrlMatchesId, isValidScopusId, isValidUrl } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { IdentityBadge, Metric, PageHeader, Spinner, useToast } from "../../components/ui";
import { IcAlert, IcCheck, IcDatabase, IcRadar, IcX } from "../../components/icons";

const STAGES = ["Validating identifiers", "ORCID public record", "Scopus author retrieval", "Web of Science Starter API", "Google Scholar via SerpApi", "ResearchGate compliant probe", "Identity resolution", "Duplicate scan against corpus"];

function FieldHint({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return null;
  return (
    <div className={`flex items-center gap-1.5 mt-1 text-[11.5px] font-semibold ${ok ? "text-primary-700" : "text-danger-600"}`}>
      {ok ? <IcCheck size={12} /> : <IcX size={12} />} {label}
    </div>
  );
}

function PlatformCard({ platform, p }: { platform: string; p: PlatformPreview }) {
  const ok = p.status === "SIMULATED" || p.status === "OK";
  return (
    <div className={`rounded-lg border p-3 ${ok ? "border-primary-200 bg-primary-50/40" : p.status === "NOT_AVAILABLE" ? "border-ink-100 bg-ink-50/50" : "border-danger-100 bg-danger-50/40"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-ink-800">{PLATFORM_LABEL[platform as keyof typeof PLATFORM_LABEL]}</span>
        <span className={`chip h-5 text-[10px] ${ok ? "bg-primary-100 text-primary-800" : p.status === "NOT_AVAILABLE" ? "bg-ink-100 text-ink-500" : p.status === "RATE_LIMITED" ? "bg-warn-50 text-warn-700 border border-gold-300" : "bg-danger-100 text-danger-700"}`}>
          {ok ? "DATA OK" : p.status.replace(/_/g, " ")}
        </span>
      </div>
      {p.metrics ? (
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            ["Papers", p.metrics.papers], ["Citations", p.metrics.citations],
            ["H-index", p.metrics.h_index], ["i10", p.metrics.i10_index],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="num text-[15px] font-semibold text-ink-900"><Metric v={v as number | null} /></div>
              <div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400">{l}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11.5px] text-ink-500 leading-snug">{p.message ?? "No data returned."}</p>
      )}
    </div>
  );
}

export default function AddFaculty() {
  const { token } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", orcid: "", scopus_id: "", scopus_url: "", scholar_url: "", rg_url: "", wos_url: "" });
  const [phase, setPhase] = useState<"idle" | "fetching" | "preview">("idle");
  const [stageIdx, setStageIdx] = useState(0);
  const [preview, setPreview] = useState<FetchPreview | null>(null);
  const [saving, setSaving] = useState(false);

  const orcidOk = f.orcid ? orcidChecksumValid(f.orcid) : null;
  const scopusOk = f.scopus_id ? isValidScopusId(f.scopus_id) : null;
  const urlOk = f.scopus_url && f.scopus_id ? scopusUrlMatchesId(f.scopus_url, f.scopus_id) : null;

  const fillSample = () => {
    const base = String(Math.floor(100000000000000 + Math.random() * 899999999999999));
    const orcid = makeOrcid(base.slice(0, 15));
    const sid = String(Math.floor(57000000000 + Math.random() * 2999999999));
    const user = Math.random().toString(36).slice(2, 10) + "AAAAJ";
    setF({
      name: "Dr. Kavitha Menon",
      orcid,
      scopus_id: sid,
      scopus_url: `https://www.scopus.com/authid/detail.uri?authorId=${sid}`,
      scholar_url: `https://scholar.google.com/citations?user=${user}`,
      rg_url: "",
      wos_url: "https://www.webofscience.com/wos/author/record/KMN-2210-2024",
    });
    setPhase("idle");
    setPreview(null);
    toast("info", "Sample researcher filled — identifiers are checksum-valid. Nothing is saved until you confirm.");
  };

  const fetch = async () => {
    setPhase("fetching");
    setStageIdx(0);
    setPreview(null);
    const iv = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 420);
    try {
      const res = await api.previewFaculty(token, {
        name: f.name, orcid: f.orcid, scopus_id: f.scopus_id, scopus_url: f.scopus_url,
        scholar_url: f.scholar_url || undefined, rg_url: f.rg_url || undefined, wos_url: f.wos_url || undefined,
      });
      setPreview(res);
      setPhase("preview");
      const hardFail = Object.entries(res.validation).some(([k, v]) => v && ["name", "orcid", "scopus_id", "scopus_url"].includes(k));
      if (!hardFail) toast("success", "Preview ready — nothing has been saved yet.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Fetch failed.");
      setPhase("idle");
    } finally {
      clearInterval(iv);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const author = await api.confirmNewFaculty(token, preview);
      toast("success", `${author.name} added to the research database.`);
      nav("/admin/faculty");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(false); }
  };

  const validationFailed = preview && ["name", "orcid", "scopus_id", "scopus_url"].some((k) => preview.validation[k]);

  return (
    <div>
      <PageHeader title="Add Faculty" sub="Validate & fetch a preview first — the record is written to MongoDB only on final confirmation" />
      <div className="grid lg:grid-cols-[400px_1fr] gap-4 items-start">
        {/* form */}
        <div className="card p-5 lg:sticky lg:top-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900">Researcher identifiers</h3>
            <button className="btn-ghost btn-sm" onClick={fillSample}>Fill sample</button>
          </div>
          <div className="space-y-3.5">
            <div>
              <label className="label">Researcher name *</label>
              <input className={`input ${preview?.validation.name ? "input-invalid" : ""}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dr. …" />
              {preview?.validation.name && <p className="text-[11.5px] text-danger-600 font-semibold mt-1">{preview.validation.name}</p>}
            </div>
            <div>
              <label className="label">ORCID ID *</label>
              <input className={`input num ${preview?.validation.orcid ? "input-invalid" : ""}`} value={f.orcid} onChange={(e) => setF({ ...f, orcid: e.target.value })} placeholder="0000-0002-1825-0097" />
              <FieldHint ok={orcidOk} label={orcidOk ? "Checksum valid (ISO 7064 MOD 11-2)" : "Checksum failed"} />
              {preview?.validation.orcid && <p className="text-[11.5px] text-danger-600 font-semibold mt-1">{preview.validation.orcid}</p>}
            </div>
            <div>
              <label className="label">Scopus Author ID *</label>
              <input className={`input num ${preview?.validation.scopus_id ? "input-invalid" : ""}`} value={f.scopus_id} onChange={(e) => setF({ ...f, scopus_id: e.target.value })} placeholder="9–12 digits" />
              <FieldHint ok={scopusOk} label="Format valid" />
              {preview?.validation.scopus_id && <p className="text-[11.5px] text-danger-600 font-semibold mt-1">{preview.validation.scopus_id}</p>}
            </div>
            <div>
              <label className="label">Scopus profile URL *</label>
              <input className={`input ${preview?.validation.scopus_url ? "input-invalid" : ""}`} value={f.scopus_url} onChange={(e) => setF({ ...f, scopus_url: e.target.value })} placeholder="https://www.scopus.com/authid/detail.uri?authorId=…" />
              <FieldHint ok={urlOk} label={urlOk ? "URL matches Scopus ID" : "URL does not match the Scopus ID"} />
              {preview?.validation.scopus_url && <p className="text-[11.5px] text-danger-600 font-semibold mt-1">{preview.validation.scopus_url}</p>}
            </div>
            <div className="pt-1 border-t border-ink-100">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-400 mb-2.5">Optional profiles</div>
              <div className="space-y-2.5">
                <input className="input" value={f.scholar_url} onChange={(e) => setF({ ...f, scholar_url: e.target.value })} placeholder="Google Scholar profile URL" />
                <input className="input" value={f.wos_url} onChange={(e) => setF({ ...f, wos_url: e.target.value })} placeholder="Web of Science / Publons profile URL" />
                <input className="input" value={f.rg_url} onChange={(e) => setF({ ...f, rg_url: e.target.value })} placeholder="ResearchGate profile URL" />
              </div>
            </div>
            <button className="btn-dark w-full" onClick={fetch} disabled={phase === "fetching" || !f.name || !f.orcid || !f.scopus_id || !f.scopus_url}>
              {phase === "fetching" ? <Spinner light /> : <IcRadar size={16} />}
              {phase === "fetching" ? "Fetching…" : "Validate & Fetch Data"}
            </button>
            <p className="text-[11px] text-ink-400 leading-relaxed text-center">Fetch runs read-only connector calls and previews the result. It never writes to the database.</p>
          </div>
        </div>

        {/* preview pane */}
        <div className="space-y-4">
          {phase === "idle" && (
            <div className="card p-10 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-ink-50 text-ink-400 flex items-center justify-center mb-3"><IcDatabase size={22} /></div>
              <div className="font-display font-semibold text-lg text-ink-800">No preview yet</div>
              <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">Enter the researcher's identifiers and run <strong>Validate & Fetch Data</strong>. You'll see identity resolution, per-platform metrics and a duplicate scan before anything is saved.</p>
            </div>
          )}

          {phase === "fetching" && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Spinner /><span className="font-display font-semibold text-ink-900">Contacting connectors…</span>
              </div>
              <div className="space-y-2">
                {STAGES.map((s, i) => (
                  <div key={s} className={`flex items-center gap-2.5 text-[13px] font-medium transition-opacity ${i > stageIdx ? "opacity-30" : ""}`}>
                    {i < stageIdx ? <span className="text-primary-600"><IcCheck size={14} /></span> : i === stageIdx ? <Spinner /> : <span className="w-3.5 h-3.5 rounded-full border border-ink-200 inline-block" />}
                    <span className={i <= stageIdx ? "text-ink-700" : "text-ink-400"}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "preview" && preview && (
            <>
              {validationFailed && (
                <div className="card border-danger-100 bg-danger-50/60 p-4 flex items-start gap-3">
                  <span className="text-danger-600 mt-0.5"><IcAlert size={18} /></span>
                  <div>
                    <div className="font-semibold text-danger-700 text-sm">Validation failed — preview unavailable</div>
                    <p className="text-[12.5px] text-danger-700/80 mt-0.5">Fix the highlighted identifier fields and fetch again. No connectors were called for invalid primary identifiers.</p>
                  </div>
                </div>
              )}

              {!validationFailed && (
                <>
                  <div className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h3 className="font-display font-semibold text-ink-900 text-[17px]">Identity resolution</h3>
                      <IdentityBadge status={preview.identity.status} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-ink-100 p-3.5">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2">Primary evidence — ORCID ↔ Scopus</div>
                        {[
                          ["ORCID checksum valid", preview.identity.evidence.orcid_format_valid],
                          ["Scopus ID format valid", preview.identity.evidence.scopus_id_valid],
                          ["Scopus URL matches ID", preview.identity.evidence.scopus_url_matches_id],
                          ["ORCID ↔ Scopus link", preview.identity.evidence.orcid_scopus_link === "MATCH"],
                        ].map(([l, ok]) => (
                          <div key={l as string} className="flex items-center gap-2 text-[13px] font-medium text-ink-700 py-1">
                            <span className={ok ? "text-primary-600" : "text-danger-600"}>{ok ? <IcCheck size={14} /> : <IcX size={14} />}</span>{l as string}
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-ink-100 p-3.5">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2">Secondary evidence (supporting)</div>
                        {[
                          ["Common DOIs", String(preview.identity.evidence.common_dois)],
                          ["Name similarity", `${Math.round(preview.identity.evidence.name_similarity * 100)}%`],
                          ["Affiliation match", preview.identity.evidence.affiliation_match ? "Yes" : "No"],
                          ["Publication overlap", String(preview.identity.evidence.publication_overlap)],
                        ].map(([l, v]) => (
                          <div key={l as string} className="flex items-center justify-between text-[13px] font-medium text-ink-700 py-1">
                            <span>{l}</span><span className="num text-ink-500">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11.5px] text-ink-400 mt-3">DOI overlap only strengthens confidence — the primary identity mechanism is the ORCID ↔ Scopus connection.</p>
                  </div>

                  <div className="card p-5">
                    <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">Source metrics — kept separate per platform</h3>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {PLATFORMS.map((p) => <PlatformCard key={p} platform={p} p={preview.platforms[p]} />)}
                    </div>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display font-semibold text-ink-900 text-[17px]">Harvest sample & duplicate scan</h3>
                      <span className="chip bg-ink-50 border border-ink-100 text-ink-500">{preview.papers.length} records previewed</span>
                    </div>
                    {preview.papers.length === 0 ? (
                      <p className="text-sm text-ink-400">No publication records returned by the connectors.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {preview.papers.slice(0, 5).map((p) => {
                          const dup = preview.duplicates.find((d) => d.candidate_id === p._id);
                          return (
                            <div key={p._id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2">
                              <span className="num text-[11px] text-ink-400 shrink-0">{p.publication_year}</span>
                              <span className="text-[13px] font-medium text-ink-800 truncate flex-1">{p.title}</span>
                              <span className="num text-[11px] text-ink-400 hidden sm:block shrink-0 max-w-[180px] truncate">{p.doi ?? "no DOI"}</span>
                              {dup ? (
                                <span className={`chip h-5 text-[10px] shrink-0 ${dup.recommended === "MERGE" ? "bg-gold-100 text-gold-700" : "bg-warn-50 text-warn-700 border border-gold-300"}`}>
                                  {dup.method.replace(/_/g, " ")} · will {dup.recommended === "MERGE" ? "merge" : "flag"}
                                </span>
                              ) : (
                                <span className="chip h-5 text-[10px] bg-primary-50 text-primary-700 shrink-0">new record</span>
                              )}
                            </div>
                          );
                        })}
                        {preview.papers.length > 5 && <p className="text-[11.5px] text-ink-400 pl-1">…and {preview.papers.length - 5} more on confirmation.</p>}
                      </div>
                    )}
                  </div>

                  <div className="card p-5 flex flex-wrap items-center justify-between gap-3 bg-ink-900 border-ink-800">
                    <div>
                      <div className="font-display font-semibold text-white text-[16px]">Commit to research database?</div>
                      <p className="text-[12px] text-ink-300 mt-0.5">Writes authors + papers + first metric snapshots. Merges high-confidence DOI duplicates; flags low-confidence ones.</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost border-ink-600 text-ink-200 hover:bg-white/10 hover:border-ink-500" onClick={() => { setPreview(null); setPhase("idle"); }}>Discard</button>
                      <button className="btn-primary" onClick={confirm} disabled={saving}>{saving ? <Spinner light /> : <IcCheck size={16} />} Add New Faculty</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
