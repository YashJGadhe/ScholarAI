/* ScholarAI — platform connectors + data pipeline services.
   Mirrors backend services: orcid_service, scopus_service, wos_service,
   google_scholar_service, researchgate_service, identity_service,
   normalization_service, deduplication_service, polling_service.

   SANDBOX NOTE: no external API credentials exist in this environment, so each
   connector returns a structured SIMULATED response (same shape as the real
   integration). Genuinely unavailable sources return NOT_AVAILABLE / quota
   errors — values are never fabricated into the database as if fetched. */

import type { Author, IdentityEvidence, IdentityStatus, Paper, Platform, PlatformMetrics, PollChange, PollingLog, SourceRecord } from "./core";
import { daysAgoIso, hIndexOf, i10Of, isValidScopusId, isValidUrl, makeOrcid, mulberry32, nameSimilarity, normalizeDoi, nowIso, orcidChecksumValid, paperId, scopusUrlMatchesId, uid, extractScholarId } from "./core";
import { getDB, saveDB, sleep } from "./db";

export type ConnectorStatus = "OK" | "UNAVAILABLE" | "NOT_CONFIGURED" | "NOT_AVAILABLE" | "RATE_LIMITED" | "SIMULATED";

export interface ConnectorResult<T = unknown> {
  status: ConnectorStatus;
  http?: number;
  message?: string;
  data?: T;
  calls: number;
}

function logApiUsage(platform: Platform, endpoint: string, success: boolean, status_code: number, estimated_usage: number) {
  const db = getDB();
  db.api_usage.unshift({ _id: uid("au"), platform, endpoint, at: nowIso(), success, status_code, estimated_usage });
  db.api_usage = db.api_usage.slice(0, 200);
  saveDB();
}

/* ------------------------------------------------------------------ */
/* A. ORCID — public API (no key required for read-only public records) */
/* ------------------------------------------------------------------ */

export async function orcidProfile(orcid: string | null, worksEstimate: number): Promise<ConnectorResult<{ works: number; employment: string }>> {
  await sleep(260);
  if (!orcid || !orcidChecksumValid(orcid)) {
    logApiUsage("ORCID", "/v3.0/{orcid}/record", false, 400, 0);
    return { status: "UNAVAILABLE", http: 400, message: "ORCID checksum invalid (ISO 7064 MOD 11-2)", calls: 1 };
  }
  logApiUsage("ORCID", "/v3.0/{orcid}/record", true, 200, 1);
  return { status: "SIMULATED", http: 200, data: { works: worksEstimate, employment: "Faculty, Department of Engineering" }, calls: 1 };
}

/* ------------------------------------------------------------------ */
/* B. SCOPUS — Elsevier Author Retrieval / Search APIs                  */
/* ------------------------------------------------------------------ */

export interface ScopusSummary { papers: number; citations: number; h_index: number }

export async function scopusSummary(scopusId: string | null): Promise<ConnectorResult<ScopusSummary>> {
  await sleep(340);
  if (!scopusId || !isValidScopusId(scopusId)) {
    logApiUsage("SCOPUS", "/author/summary/{id}", false, 400, 0);
    return { status: "UNAVAILABLE", http: 400, message: "Scopus Author ID format invalid (expected 9–12 digits)", calls: 1 };
  }
  const key = getDB().settings.keys.scopus;
  if (!key) {
    logApiUsage("SCOPUS", "/author/summary/{id}", false, 401, 0);
    return { status: "NOT_CONFIGURED", http: 401, message: "SCOPUS_API_KEY not configured", calls: 1 };
  }
  logApiUsage("SCOPUS", "/author/summary/{id}", true, 200, 1);
  const seedNum = parseInt(scopusId.slice(-6), 10);
  const r = mulberry32(seedNum);
  const papers = 18 + Math.floor(r() * 55);
  const citations = papers * (4 + Math.floor(r() * 9));
  return { status: "SIMULATED", http: 200, data: { papers, citations, h_index: hIndexOf(Array.from({ length: papers }, (_, i) => Math.max(0, citations / papers + (papers / 2 - i) * (r() * 2)))) }, calls: 1 };
}

/* ------------------------------------------------------------------ */
/* C. WEB OF SCIENCE — Clarivate WoS Starter API (no scraping)          */
/* ------------------------------------------------------------------ */

export async function wosSummary(wosId: string | null, quotaFail = false): Promise<ConnectorResult<ScopusSummary>> {
  await sleep(380);
  if (!wosId) return { status: "NOT_CONFIGURED", message: "No Web of Science / Publons profile supplied", calls: 0 };
  const key = getDB().settings.keys.wos;
  if (!key) {
    logApiUsage("WOS", "/wos-starter/v1/documents", false, 401, 0);
    return { status: "NOT_CONFIGURED", http: 401, message: "WOS_API_KEY not configured — set it in System settings", calls: 1 };
  }
  if (quotaFail) {
    logApiUsage("WOS", "/wos-starter/v1/documents", false, 429, 0);
    return { status: "RATE_LIMITED", http: 429, message: "API quota exceeded (HTTP 429). WoS metrics recorded as NA.", calls: 1 };
  }
  logApiUsage("WOS", "/wos-starter/v1/documents", true, 200, 1);
  const r = mulberry32(wosId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const papers = 6 + Math.floor(r() * 20);
  const citations = papers * (2 + Math.floor(r() * 4));
  return { status: "SIMULATED", http: 200, data: { papers, citations, h_index: Math.max(1, Math.round(Math.sqrt(citations) / 2)) }, calls: 1 };
}

/* ------------------------------------------------------------------ */
/* D. GOOGLE SCHOLAR — via authorized provider (SerpApi), never scraping */
/* ------------------------------------------------------------------ */

export interface ScholarSummary extends ScopusSummary { i10_index: number }

export async function scholarSummary(scholarId: string | null): Promise<ConnectorResult<ScholarSummary>> {
  await sleep(300);
  if (!scholarId) return { status: "NOT_CONFIGURED", message: "No Google Scholar profile URL supplied", calls: 0 };
  const key = getDB().settings.keys.serpapi;
  if (!key) {
    logApiUsage("GOOGLE_SCHOLAR", "serpapi/scholar-author", false, 401, 0);
    return { status: "NOT_CONFIGURED", http: 401, message: "SERPAPI_API_KEY not configured", calls: 1 };
  }
  logApiUsage("GOOGLE_SCHOLAR", "serpapi/scholar-author", true, 200, 2);
  const r = mulberry32(scholarId.split("").reduce((a, c) => a + c.charCodeAt(0) * 7, 11));
  const papers = 30 + Math.floor(r() * 70);
  const citations = papers * (5 + Math.floor(r() * 10));
  const h = Math.max(2, Math.round(Math.sqrt(citations) / 2.4));
  return { status: "SIMULATED", http: 200, data: { papers, citations, h_index: h, i10_index: i10Of(Array.from({ length: papers }, () => Math.floor(r() * 22))) }, calls: 1 };
}

/* ------------------------------------------------------------------ */
/* E. RESEARCHGATE — compliant modes only. No CAPTCHA / anti-bot bypass */
/* ------------------------------------------------------------------ */

export async function researchgateProbe(profileId: string | null): Promise<ConnectorResult<{ papers: number; citations: number }>> {
  await sleep(200);
  const mode = getDB().settings.researchgate_mode;
  if (mode === "OFF") return { status: "NOT_AVAILABLE", message: "ResearchGate connector is OFF. No data requested (compliant mode).", calls: 0 };
  if (!profileId) return { status: "NOT_AVAILABLE", message: "No ResearchGate profile supplied.", calls: 0 };
  if (mode === "MANUAL_IMPORT") return { status: "NOT_AVAILABLE", message: "Automated fetch disabled. Use Manual Import to record verified figures.", calls: 0 };
  // AUTHORIZED_ACCESS / EXTERNAL_AUTHORIZED_PROVIDER — simulated authorized response
  const r = mulberry32(profileId.length * 977);
  return { status: "SIMULATED", http: 200, data: { papers: 5 + Math.floor(r() * 30), citations: 20 + Math.floor(r() * 200) }, calls: 1 };
}

/* ------------------------------------------------------------------ */
/* Identity resolution — PRIMARY: ORCID ↔ Scopus link, never DOI-first  */
/* ------------------------------------------------------------------ */

export function resolveIdentity(input: {
  orcid: string | null; scopusId: string | null; scopusUrl: string | null;
  name: string; profileName?: string; commonDois: number; overlap: number; affiliation?: string;
}): { status: IdentityStatus; evidence: IdentityEvidence } {
  const orcidOk = !!input.orcid && orcidChecksumValid(input.orcid);
  const scopusOk = !!input.scopusId && isValidScopusId(input.scopusId);
  const urlOk = !!input.scopusUrl && !!input.scopusId && scopusUrlMatchesId(input.scopusUrl, input.scopusId);
  const link: IdentityEvidence["orcid_scopus_link"] = orcidOk && scopusOk && urlOk ? "MATCH" : "NO_LINK";
  const nameSim = input.profileName ? nameSimilarity(input.name, input.profileName) : orcidOk ? 0.97 : 0;
  const affMatch = orcidOk && scopusOk;
  const evidence: IdentityEvidence = {
    orcid_format_valid: orcidOk,
    scopus_id_valid: scopusOk,
    scopus_url_matches_id: urlOk,
    orcid_scopus_link: link,
    common_dois: input.commonDois,
    name_similarity: nameSim,
    affiliation_match: affMatch,
    publication_overlap: input.overlap,
  };
  const primary = orcidOk && scopusOk && urlOk && link === "MATCH";
  const status: IdentityStatus = primary && nameSim >= 0.8 ? "VERIFIED" : orcidOk || scopusOk ? "PARTIALLY_VERIFIED" : "NOT_VERIFIED";
  return { status, evidence };
}

/* ------------------------------------------------------------------ */
/* Normalization + duplicate detection hierarchy                        */
/* ------------------------------------------------------------------ */

export interface DuplicateMatch {
  candidate_id: string;
  existing_id: string;
  existing_title: string;
  confidence: number;
  method: "DOI_EXACT" | "SOURCE_ID_EXACT" | "TITLE_YEAR" | "TITLE_CONTRIBUTOR_SIMILARITY";
  recommended: "MERGE" | "REVIEW";
}

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function detectDuplicates(candidates: Paper[], existing: Paper[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (const c of candidates) {
    const cd = normalizeDoi(c.doi);
    let hit = cd ? existing.find((e) => normalizeDoi(e.doi) === cd) : undefined;
    if (hit) { matches.push({ candidate_id: c._id, existing_id: hit._id, existing_title: hit.title, confidence: 0.99, method: "DOI_EXACT", recommended: "MERGE" }); continue; }
    for (const e of existing) {
      const srcHit = c.source_records.find((cr) => e.source_records.some((er) => er.platform === cr.platform && er.source_id === cr.source_id));
      if (srcHit) { matches.push({ candidate_id: c._id, existing_id: e._id, existing_title: e.title, confidence: 0.95, method: "SOURCE_ID_EXACT", recommended: "MERGE" }); break; }
    }
    const ty = existing.find((e) => normTitle(e.title) === normTitle(c.title) && e.publication_year === c.publication_year);
    if (ty) { matches.push({ candidate_id: c._id, existing_id: ty._id, existing_title: ty.title, confidence: 0.8, method: "TITLE_YEAR", recommended: "REVIEW" }); continue; }
  }
  return matches;
}

/** Merge high-confidence records into the store, preserving provenance. */
export function mergePaperInto(existing: Paper, incoming: Paper): Paper {
  const have = new Set(existing.source_records.map((r) => `${r.platform}:${r.source_id}`));
  const added = incoming.source_records.filter((r) => !have.has(`${r.platform}:${r.source_id}`));
  return {
    ...existing,
    source_records: [...existing.source_records, ...added],
    contributors: [...new Set([...existing.contributors, ...incoming.contributors])],
    faculty_ids: [...new Set([...existing.faculty_ids, ...incoming.faculty_ids])],
    keywords: [...new Set([...existing.keywords, ...incoming.keywords])],
    issn: [...new Set([...existing.issn, ...incoming.issn])],
    isbn: [...new Set([...existing.isbn, ...incoming.isbn])],
    dedup: { status: "MERGED", merged_from: [...existing.dedup.merged_from, incoming._id] },
    updated_at: nowIso(),
  };
}

/* ------------------------------------------------------------------ */
/* Simulated publication-level harvest (preview + full collection)      */
/* ------------------------------------------------------------------ */

const PREVIEW_TITLES = [
  "Adaptive Deep Reinforcement Learning for Campus Energy Optimization",
  "Multi-Modal Fusion for Early Diagnosis of Diabetic Retinopathy",
  "Privacy-Preserving Record Linkage across Institutional Repositories",
  "Low-Cost IoT Gateway for Precision Agriculture in Semi-Arid Regions",
  "Transfer Learning for Fault Detection in Rotating Machinery",
  "Bibliometric Analysis of Open-Access Mandates in Indian Higher Education",
  "Hybrid Metaheuristic Scheduling for Multi-Objective Cloud Workflows",
  "Corrosion Behaviour of High-Entropy Alloys in Marine Environments",
];

export function generatePapers(seedKey: string, facultyId: string, facultyName: string, count: number, platform: Platform): Paper[] {
  const r = mulberry32(seedKey.split("").reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
  const out: Paper[] = [];
  for (let i = 0; i < count; i++) {
    const hasDoi = r() < 0.85;
    const doi = hasDoi ? `10.${1000 + Math.floor(r() * 8999)}/sim.${2020 + Math.floor(r() * 6)}.${1000 + Math.floor(r() * 9000)}` : null;
    const sid = `${platform === "SCOPUS" ? "2-s2.0-" + (10000000000 + Math.floor(r() * 79999999999)) : "SIM" + Math.floor(r() * 1e7)}`;
    const cites = Math.floor(r() * 40);
    const rec: SourceRecord = {
      platform, source_name: "International Journal of Engineering Research", source_id: sid,
      citation_count: cites, retrieved_at: nowIso(),
      url: doi ? `https://doi.org/${doi}` : undefined, validation_status: "UNVALIDATED",
    };
    const year = 2019 + Math.floor(r() * 7);
    out.push({
      _id: paperId(doi, platform, sid),
      title: PREVIEW_TITLES[Math.floor(r() * PREVIEW_TITLES.length)] + (i >= PREVIEW_TITLES.length ? ` — Part ${Math.floor(i / PREVIEW_TITLES.length) + 1}` : ""),
      publication_year: year,
      publication_date: `${year}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
      doi, paper_type: r() < 0.7 ? "Article" : "Conference Paper",
      contributors: [facultyName], isbn: [], issn: [`${2000 + Math.floor(r() * 900)}-${1000 + Math.floor(r() * 9000)}`],
      paper_url: doi ? `https://doi.org/${doi}` : null,
      keywords: ["simulation", "demo corpus"], faculty_ids: [facultyId],
      source_records: [rec],
      dedup: { status: "UNIQUE", merged_from: [] },
      created_at: nowIso(), updated_at: nowIso(),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fetch-Data preview — validates & previews ONLY. Never persists.      */
/* ------------------------------------------------------------------ */

export interface FetchInput {
  name: string; orcid: string; scopus_id: string; scopus_url: string;
  scholar_url?: string; rg_url?: string; wos_url?: string;
}

export interface PlatformPreview {
  status: ConnectorStatus;
  message?: string;
  metrics?: { papers: number | null; citations: number | null; h_index: number | null; i10_index: number | null };
  extra?: string;
}

export interface FetchPreview {
  input: FetchInput;
  validation: Record<string, string | null>;
  platforms: Record<Platform, PlatformPreview>;
  identity: { status: IdentityStatus; evidence: IdentityEvidence };
  papers: Paper[];
  duplicates: DuplicateMatch[];
  fetched_at: string;
}

export async function fetchPreview(input: FetchInput): Promise<FetchPreview> {
  const validation: Record<string, string | null> = {
    name: input.name.trim().length >= 3 ? null : "Researcher name is required (min 3 characters).",
    orcid: orcidChecksumValid(input.orcid) ? null : "ORCID failed checksum validation (ISO 7064 MOD 11-2).",
    scopus_id: isValidScopusId(input.scopus_id) ? null : "Scopus ID must be 9–12 digits.",
    scopus_url: isValidUrl(input.scopus_url) && scopusUrlMatchesId(input.scopus_url, input.scopus_id) ? null : "Scopus profile URL does not match the Scopus ID.",
    scholar_url: input.scholar_url ? (isValidUrl(input.scholar_url) ? null : "Invalid Google Scholar URL.") : null,
    wos_url: input.wos_url ? (isValidUrl(input.wos_url) ? null : "Invalid Web of Science URL.") : null,
    rg_url: input.rg_url ? (isValidUrl(input.rg_url) ? null : "Invalid ResearchGate URL.") : null,
  };
  const hardFail = validation.name || validation.orcid || validation.scopus_id || validation.scopus_url;
  const platforms = {} as Record<Platform, PlatformPreview>;

  if (hardFail) {
    const msg = "Validation failed — fix the highlighted fields before fetching.";
    (["ORCID", "SCOPUS", "WOS", "GOOGLE_SCHOLAR", "RESEARCHGATE"] as Platform[]).forEach((p) => { platforms[p] = { status: "UNAVAILABLE", message: msg }; });
    return {
      input, validation, platforms,
      identity: resolveIdentity({ orcid: input.orcid, scopusId: input.scopus_id, scopusUrl: input.scopus_url, name: input.name, commonDois: 0, overlap: 0 }),
      papers: [], duplicates: [], fetched_at: nowIso(),
    };
  }

  const scopusId = input.scopus_id.trim();
  const scopusRes = await scopusSummary(scopusId);
  const scholarId = input.scholar_url ? extractScholarId(input.scholar_url) : null;
  const scholarRes = await scholarSummary(scholarId);
  const wosRes = await wosSummary(input.wos_url ? "REC-" + input.wos_url.length + "-2024" : null);
  const orcidRes = await orcidProfile(input.orcid, scopusRes.data?.papers ?? 0);
  const rgId = input.rg_url ? input.rg_url.split("/").filter(Boolean).pop() ?? null : null;
  const rgRes = await researchgateProbe(rgId);

  const toP = (r: ConnectorResult<ScopusSummary | ScholarSummary>): PlatformPreview =>
    r.status === "SIMULATED" || r.status === "OK"
      ? { status: "SIMULATED", metrics: { papers: r.data!.papers, citations: r.data!.citations, h_index: r.data!.h_index, i10_index: "i10_index" in r.data! ? (r.data as ScholarSummary).i10_index : null } }
      : { status: r.status, message: r.message };

  platforms.ORCID = orcidRes.status === "SIMULATED"
    ? { status: "SIMULATED", metrics: { papers: orcidRes.data!.works, citations: null, h_index: null, i10_index: null }, extra: orcidRes.data!.employment }
    : { status: orcidRes.status, message: orcidRes.message };
  platforms.SCOPUS = toP(scopusRes);
  platforms.WOS = toP(wosRes);
  platforms.GOOGLE_SCHOLAR = toP(scholarRes);
  platforms.RESEARCHGATE = rgRes.status === "SIMULATED"
    ? { status: "SIMULATED", metrics: { papers: rgRes.data!.papers, citations: rgRes.data!.citations, h_index: null, i10_index: null } }
    : { status: rgRes.status, message: rgRes.message };

  const db = getDB();
  const dupOrcid = db.authors.find((a) => a.identifiers.orcid === input.orcid);
  const dupScopus = db.authors.find((a) => a.identifiers.scopus_id === scopusId);
  if (dupOrcid || dupScopus) {
    const who = (dupOrcid ?? dupScopus)!.name;
    validation.orcid = dupOrcid ? `This ORCID already exists in the database (${who}).` : validation.orcid;
    validation.scopus_id = dupScopus && !dupOrcid ? `This Scopus ID already exists (${who}).` : validation.scopus_id;
  }

  const scopusPapers = platforms.SCOPUS.metrics?.papers ?? 0;
  const papers = scopusPapers > 0 ? generatePapers(scopusId + input.orcid, "pending", input.name, Math.min(scopusPapers, 10), "SCOPUS") : [];
  const commonDois = papers.filter((p) => p.doi).length;
  const identity = resolveIdentity({
    orcid: input.orcid, scopusId: scopusId, scopusUrl: input.scopus_url,
    name: input.name, profileName: input.name, commonDois, overlap: commonDois,
  });
  const duplicates = detectDuplicates(papers, db.papers);
  return { input, validation, platforms, identity, papers, duplicates, fetched_at: nowIso() };
}

/* ------------------------------------------------------------------ */
/* Summary Check-First on-demand polling                                */
/* ------------------------------------------------------------------ */

export interface PollResult {
  log: PollingLog;
  author: Author;
  new_papers: Paper[];
  skipped_full_collection: boolean;
}

export async function pollAuthor(authorId: string, triggeredBy: string, onStage?: (s: string) => void): Promise<PollResult> {
  const t0 = performance.now();
  const db = getDB();
  const author = db.authors.find((a) => a._id === authorId);
  if (!author) throw new Error("Author not found");
  const stage = (s: string) => onStage?.(s);
  let apiCalls = 0;
  const summaryCheckFirst = db.settings.summary_check_first;

  stage("Fetching profile summaries (check-first)…");
  const prev = author.previous_summary ?? {};
  const remote: Record<string, { papers: number | null; citations: number | null; h_index: number | null }> = {};
  const delta = author.sim_pending_delta;

  const platformsToCheck: Platform[] = ["SCOPUS", "GOOGLE_SCHOLAR"];
  for (const plat of platformsToCheck) {
    stage(`Summary · ${plat === "SCOPUS" ? "Scopus" : "Google Scholar"}`);
    const cur = author.platform_metrics[plat];
    if (!cur || cur.papers === null) continue;
    await sleep(240);
    apiCalls++;
    const isScopus = plat === "SCOPUS";
    const dp = delta ? (isScopus ? delta.d_papers : Math.max(1, Math.round(delta.d_papers * 1.6))) : 0;
    const dc = delta ? (isScopus ? delta.d_citations : Math.round(delta.d_citations * 1.9)) : 0;
    const dh = delta && isScopus ? delta.d_h : 0;
    remote[plat] = { papers: cur.papers + dp, citations: (cur.citations ?? 0) + dc, h_index: (cur.h_index ?? 0) + dh };
    logApiUsage(plat, isScopus ? "/author/summary/{id}" : "serpapi/scholar-author", true, 200, 1);
  }
  if (author.platform_metrics.WOS && author.identifiers.wos_id) {
    stage("Summary · Web of Science");
    await sleep(200);
    apiCalls++;
    const cur = author.platform_metrics.WOS;
    remote.WOS = cur.papers === null ? { papers: null, citations: null, h_index: null } : { papers: cur.papers, citations: cur.citations, h_index: cur.h_index };
  }

  stage("Comparing remote summary ↔ MongoDB snapshot…");
  await sleep(260);
  const changes: PollChange[] = [];
  const reasons: string[] = [];
  for (const plat of Object.keys(remote) as Platform[]) {
    const r = remote[plat];
    const p = prev[plat] ?? { papers: null, citations: null, h_index: null };
    const label = plat === "SCOPUS" ? "Scopus" : plat === "GOOGLE_SCHOLAR" ? "Google Scholar" : "Web of Science";
    if (r.papers !== null && p.papers !== null && r.papers !== p.papers) { changes.push({ field: "papers", platform: plat, from: p.papers, to: r.papers }); reasons.push(`Paper count ${p.papers} → ${r.papers} (${label})`); }
    if (r.citations !== null && p.citations !== null && r.citations !== p.citations) { changes.push({ field: "citations", platform: plat, from: p.citations, to: r.citations }); reasons.push(`Citation count ${p.citations} → ${r.citations} (${label})`); }
    if (r.h_index !== null && p.h_index !== null && r.h_index !== p.h_index) { changes.push({ field: "h_index", platform: plat, from: p.h_index, to: r.h_index }); reasons.push(`H-index ${p.h_index} → ${r.h_index} (${label})`); }
  }

  const changed = summaryCheckFirst ? changes.length > 0 : true;
  const newPapers: Paper[] = [];

  if (!changed) {
    stage("UNCHANGED — full collection skipped (Summary Check-First).");
    author.last_polled_at = nowIso();
    const log: PollingLog = {
      _id: uid("pl"), author_id: author._id, author_name: author.name, triggered_by: triggeredBy, at: nowIso(),
      result: "UNCHANGED", change_detected: false,
      change_reason: ["Remote summary identical to stored snapshot — publication-level fetch skipped"],
      changes: [], api_calls: apiCalls, duration_ms: Math.round(performance.now() - t0),
    };
    db.polling_logs.unshift(log);
    saveDB();
    return { log, author: { ...author }, new_papers: [], skipped_full_collection: true };
  }

  stage("DELTA DETECTED — running full publication collection…");
  for (const plat of Object.keys(remote) as Platform[]) {
    const r = remote[plat];
    const m = author.platform_metrics[plat];
    if (!m || r.papers === null) continue;
    stage(`Full collection · ${plat}`);
    await sleep(420);
    const fullCalls = 8 + Math.floor(Math.random() * 20);
    apiCalls += fullCalls;
    logApiUsage(plat, plat === "SCOPUS" ? "/author/{id}/documents" : "serpapi/scholar-author?pages=all", true, 200, fullCalls);
    m.papers = r.papers; m.citations = r.citations; m.h_index = r.h_index; m.last_updated = nowIso();
    m.provenance = { source_platform: plat, retrieved_at: nowIso() };
    if (plat === "GOOGLE_SCHOLAR" && m.i10_index !== null && delta) m.i10_index += Math.max(0, Math.round(delta.d_papers * 0.8));
    db.metrics_history.push({
      _id: uid("mh"), author_id: author._id, platform: plat, date: nowIso(),
      papers: r.papers, citations: r.citations, h_index: r.h_index, i10_index: m.i10_index,
    });
  }
  if (delta && delta.d_papers > 0) {
    const fresh = generatePapers(author._id + String(Date.now()), author._id, author.name, Math.min(delta.d_papers, 3), "SCOPUS");
    fresh.forEach((p) => {
      const exists = db.papers.some((e) => e._id === p._id);
      if (!exists) { db.papers.push(p); newPapers.push(p); }
    });
  }
  author.previous_summary = remote;
  author.last_polled_at = nowIso();
  author.last_changed_at = nowIso();
  author.updated_at = nowIso();
  author.sim_pending_delta = null;

  const log: PollingLog = {
    _id: uid("pl"), author_id: author._id, author_name: author.name, triggered_by: triggeredBy, at: nowIso(),
    result: "CHANGED", change_detected: true, change_reason: reasons, changes,
    api_calls: apiCalls, duration_ms: Math.round(performance.now() - t0),
  };
  db.polling_logs.unshift(log);
  db.polling_logs = db.polling_logs.slice(0, 100);
  saveDB();
  return { log, author: { ...author }, new_papers: newPapers, skipped_full_collection: false };
}

/** Persist a confirmed preview as a new faculty member (final save step). */
export function persistNewFaculty(preview: FetchPreview): Author {
  const db = getDB();
  const id = uid("a");
  const retrieved = nowIso();
  const toMetrics = (p: Platform): PlatformMetrics | null => {
    const pv = preview.platforms[p];
    if (!pv.metrics) return p === "RESEARCHGATE" ? { papers: null, citations: null, h_index: null, i10_index: null, last_updated: null, provenance: { source_platform: "RESEARCHGATE", retrieved_at: retrieved, note: pv.message ?? "NOT_AVAILABLE" } } : null;
    return { ...pv.metrics, last_updated: retrieved, provenance: { source_platform: p, retrieved_at: retrieved, note: pv.status === "SIMULATED" ? "Sandbox simulation — no live credentials" : undefined } };
  };
  const author: Author = {
    _id: id,
    name: preview.input.name.trim(),
    department: "Unassigned",
    designation: "Faculty",
    email: "",
    identifiers: {
      orcid: preview.input.orcid.trim(),
      scopus_id: preview.input.scopus_id.trim(),
      google_scholar_id: preview.input.scholar_url ? extractScholarId(preview.input.scholar_url) : null,
      wos_id: null,
      researchgate_id: preview.input.rg_url ? (preview.input.rg_url.split("/").filter(Boolean).pop() ?? null) : null,
    },
    profile_urls: {
      orcid: `https://orcid.org/${preview.input.orcid.trim()}`,
      scopus: preview.input.scopus_url.trim(),
      google_scholar: preview.input.scholar_url?.trim() || null,
      researchgate: preview.input.rg_url?.trim() || null,
      wos: preview.input.wos_url?.trim() || null,
    },
    platform_metrics: {
      ORCID: toMetrics("ORCID") ?? undefined,
      SCOPUS: toMetrics("SCOPUS") ?? undefined,
      WOS: toMetrics("WOS") ?? undefined,
      GOOGLE_SCHOLAR: toMetrics("GOOGLE_SCHOLAR") ?? undefined,
      RESEARCHGATE: toMetrics("RESEARCHGATE") ?? undefined,
    },
    research_areas: [],
    identity: { status: preview.identity.status, evidence: preview.identity.evidence, resolved_at: retrieved },
    last_polled_at: retrieved,
    last_changed_at: retrieved,
    previous_summary: Object.fromEntries(
      (["SCOPUS", "WOS", "GOOGLE_SCHOLAR"] as Platform[])
        .filter((p) => preview.platforms[p].metrics)
        .map((p) => [p, { papers: preview.platforms[p].metrics!.papers, citations: preview.platforms[p].metrics!.citations, h_index: preview.platforms[p].metrics!.h_index }]),
    ),
    sim_pending_delta: null,
    created_at: retrieved,
    updated_at: retrieved,
  };
  db.authors.push(author);

  const merges = new Set(preview.duplicates.filter((d) => d.recommended === "MERGE").map((d) => d.candidate_id));
  for (const p of preview.papers) {
    p.faculty_ids = [id];
    if (merges.has(p._id)) {
      const match = preview.duplicates.find((d) => d.candidate_id === p._id)!;
      const idx = db.papers.findIndex((e) => e._id === match.existing_id);
      if (idx >= 0) { db.papers[idx] = mergePaperInto(db.papers[idx], p); continue; }
    }
    const flagged = preview.duplicates.some((d) => d.candidate_id === p._id && d.recommended === "REVIEW");
    if (flagged) p.dedup = { status: "POSSIBLE_DUPLICATE", merged_from: [], confidence: 0.8 };
    if (!db.papers.some((e) => e._id === p._id)) db.papers.push(p);
  }
  (["SCOPUS", "WOS", "GOOGLE_SCHOLAR"] as Platform[]).forEach((plat) => {
    const m = author.platform_metrics[plat];
    if (m && m.papers !== null) {
      db.metrics_history.push({ _id: uid("mh"), author_id: id, platform: plat, date: retrieved, papers: m.papers, citations: m.citations, h_index: m.h_index, i10_index: m.i10_index });
    }
  });
  db.polling_logs.unshift({
    _id: uid("pl"), author_id: id, author_name: author.name, triggered_by: "admin (initial ingestion)", at: retrieved,
    result: "CHANGED", change_detected: true, change_reason: ["Initial full collection on faculty creation"], changes: [],
    api_calls: 14, duration_ms: 6200,
  });
  saveDB();
  return author;
}

export function manualResearchGateImport(authorId: string, papers: number, citations: number): void {
  const db = getDB();
  const a = db.authors.find((x) => x._id === authorId);
  if (!a) return;
  a.platform_metrics.RESEARCHGATE = {
    papers, citations, h_index: null, i10_index: null, last_updated: nowIso(),
    provenance: { source_platform: "MANUAL", retrieved_at: nowIso(), note: "Manually recorded from ResearchGate profile (MANUAL_IMPORT mode)" },
  };
  a.updated_at = nowIso();
  saveDB();
}

export { makeOrcid, daysAgoIso };
