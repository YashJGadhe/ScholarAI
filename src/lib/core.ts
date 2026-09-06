/* ScholarAI — core domain types, validators, normalizers, formatters.
   Mirrors the backend `app/utils` + `app/models` contracts. */

export type Role = "ADMIN" | "FACULTY" | "STUDENT";
export type Platform = "ORCID" | "SCOPUS" | "WOS" | "GOOGLE_SCHOLAR" | "RESEARCHGATE";
export type IdentityStatus = "VERIFIED" | "PARTIALLY_VERIFIED" | "NOT_VERIFIED";
export type ResearchGateMode = "OFF" | "MANUAL_IMPORT" | "AUTHORIZED_ACCESS" | "EXTERNAL_AUTHORIZED_PROVIDER";

export const PLATFORMS: Platform[] = ["ORCID", "SCOPUS", "WOS", "GOOGLE_SCHOLAR", "RESEARCHGATE"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  ORCID: "ORCID",
  SCOPUS: "Scopus",
  WOS: "Web of Science",
  GOOGLE_SCHOLAR: "Google Scholar",
  RESEARCHGATE: "ResearchGate",
};

export const PLATFORM_COLOR: Record<Platform, string> = {
  ORCID: "#7ba23f",
  SCOPUS: "#e9711c",
  WOS: "#1299b8",
  GOOGLE_SCHOLAR: "#3d6de0",
  RESEARCHGATE: "#00a89b",
};

/** Platform summary metrics. `null` means NA (not collected / unavailable) — never render as 0. */
export interface PlatformMetrics {
  papers: number | null;
  citations: number | null;
  h_index: number | null;
  i10_index: number | null;
  last_updated: string | null;
  provenance: { source_platform: Platform | "MANUAL"; retrieved_at: string; note?: string };
}

export interface SourceRecord {
  platform: Platform;
  source_name: string;
  source_id: string;
  citation_count: number | null;
  retrieved_at: string;
  url?: string;
  validation_status: "VALID" | "UNVALIDATED";
}

export interface Paper {
  _id: string;
  title: string;
  publication_year: number;
  publication_date: string | null;
  doi: string | null;
  paper_type: string;
  contributors: string[];
  isbn: string[];
  issn: string[];
  paper_url: string | null;
  keywords: string[];
  faculty_ids: string[];
  source_records: SourceRecord[];
  dedup: { status: "UNIQUE" | "MERGED" | "POSSIBLE_DUPLICATE"; merged_from: string[]; confidence?: number };
  created_at: string;
  updated_at: string;
}

export interface IdentityEvidence {
  orcid_format_valid: boolean;
  scopus_id_valid: boolean;
  scopus_url_matches_id: boolean;
  orcid_scopus_link: "MATCH" | "NO_LINK" | "NOT_CHECKED";
  common_dois: number;
  name_similarity: number;
  affiliation_match: boolean;
  publication_overlap: number;
  note?: string;
}

export interface Author {
  _id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  identifiers: {
    orcid: string | null;
    scopus_id: string | null;
    google_scholar_id: string | null;
    wos_id: string | null;
    researchgate_id: string | null;
  };
  profile_urls: {
    orcid: string | null;
    scopus: string | null;
    google_scholar: string | null;
    researchgate: string | null;
    wos: string | null;
  };
  platform_metrics: Partial<Record<Platform, PlatformMetrics>>;
  research_areas: string[];
  identity: { status: IdentityStatus; evidence: IdentityEvidence; resolved_at: string };
  last_polled_at: string | null;
  last_changed_at: string | null;
  previous_summary: Record<string, { papers: number | null; citations: number | null; h_index: number | null }> | null;
  sim_pending_delta?: { d_papers: number; d_citations: number; d_h: number } | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: boolean;
  faculty_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface MetricSnapshot {
  _id: string;
  author_id: string;
  platform: Platform;
  date: string;
  papers: number | null;
  citations: number | null;
  h_index: number | null;
  i10_index: number | null;
}

export interface PollChange { field: string; platform: Platform; from: number | null; to: number | null }

export interface PollingLog {
  _id: string;
  author_id: string;
  author_name: string;
  triggered_by: string;
  at: string;
  result: "UNCHANGED" | "CHANGED" | "ERROR";
  change_detected: boolean;
  change_reason: string[];
  changes: PollChange[];
  api_calls: number;
  duration_ms: number;
}

export interface ApiUsage {
  _id: string;
  platform: Platform;
  endpoint: string;
  at: string;
  success: boolean;
  status_code: number;
  estimated_usage: number;
}

export interface DeletedAuthor extends Author {
  deleted_at: string;
  deleted_by: string;
}

export interface Settings {
  keys: { orcid: string; scopus: string; wos: string; serpapi: string };
  researchgate_mode: ResearchGateMode;
  summary_check_first: boolean;
  cache_ttl_hours: number;
}

export interface DBShape {
  version: number;
  users: User[];
  authors: Author[];
  papers: Paper[];
  metrics_history: MetricSnapshot[];
  polling_logs: PollingLog[];
  api_usage: ApiUsage[];
  deleted_authors: DeletedAuthor[];
  settings: Settings;
}

/* ---------------- deterministic PRNG (seeded test data) ---------------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- identifiers & normalization (app/utils) ---------------- */

/** ORCID checksum — ISO/IEC 7064:2003 MOD 11-2. */
export function orcidChecksumValid(orcid: string): boolean {
  const m = /^(\d{4})-(\d{4})-(\d{4})-(\d{3}[\dX])$/.exec(orcid.trim());
  if (!m) return false;
  const digits = m.slice(1, 4).join("") + m[4].slice(0, 3);
  const check = m[4][3];
  let total = 0;
  for (const ch of digits) total = (total + Number(ch)) * 2;
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expected = result === 10 ? "X" : String(result);
  return check === expected;
}

/** Build a guaranteed-valid ORCID from a 15-digit base. */
export function makeOrcid(base15: string): string {
  let total = 0;
  for (const ch of base15) total = (total + Number(ch)) * 2;
  const result = (12 - (total % 11)) % 11;
  const check = result === 10 ? "X" : String(result);
  const full = base15 + check;
  return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}-${full.slice(12)}`;
}

/** DOI normalization: https://doi.org/…, doi:…, and bare 10.… resolve to the same key. */
export function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim();
  d = d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  d = d.replace(/\/$/, "").trim();
  if (!/^10\.\d{4,9}\/\S+$/i.test(d)) return null;
  return "doi:" + d.toLowerCase();
}

export function normalizeIssn(raw: string): string | null {
  const m = /^(\d{4})-?(\d{3}[\dXx])$/.exec(raw.trim());
  return m ? `${m[1]}-${m[2].toUpperCase()}` : null;
}

export function normalizeIsbn(raw: string): string | null {
  const d = raw.replace(/[-\s]/g, "");
  return /^(\d{9}[\dXx]|\d{13})$/.test(d) ? d.toUpperCase() : null;
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s.]/gu, "").trim();
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a).split(" ").filter(Boolean);
  const nb = normalizeName(b).split(" ").filter(Boolean);
  if (!na.length || !nb.length) return 0;
  const setB = new Set(nb);
  const inter = na.filter((t) => setB.has(t)).length;
  return Math.round((inter / Math.max(na.length, nb.length)) * 100) / 100;
}

export function isValidScopusId(id: string): boolean {
  return /^\d{9,12}$/.test(id.trim());
}

export function scopusUrlMatchesId(url: string, id: string): boolean {
  try {
    const u = new URL(url.trim());
    if (!/scopus\.com$/.test(u.hostname.replace(/^www\./, ""))) return false;
    return u.searchParams.get("authorId") === id.trim() || u.pathname.includes(`/${id.trim()}`);
  } catch {
    return false;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function extractScholarId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.searchParams.get("user");
  } catch {
    return null;
  }
}

/** Deterministic paper _id: normalized DOI, else source+source-id fallback. */
export function paperId(doi: string | null, platform: Platform, sourceId: string): string {
  const nd = normalizeDoi(doi);
  return nd ?? `${platform.toLowerCase()}:${sourceId}`;
}

export function hIndexOf(citations: number[]): number {
  const sorted = [...citations].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) if (sorted[i] >= i + 1) h = i + 1;
  return h;
}

export function i10Of(citations: number[]): number {
  return citations.filter((c) => c >= 10).length;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const nowIso = () => new Date().toISOString();
export const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

/* ---------------- formatting ---------------- */

/** NA policy: null/undefined → "NA" (unknown). 0 is a confirmed zero and renders as 0. */
export function fmtMetric(v: number | null | undefined): string {
  return v === null || v === undefined ? "NA" : v.toLocaleString("en-US");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "NA";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "NA";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "NA";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function initials(name: string): string {
  return name.replace(/^Dr\.?\s+/, "").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
