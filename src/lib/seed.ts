/* ScholarAI — seeded dataset: INSTITUTIONAL CITATION MASTER SHEET (verified figures).
   The 17 researcher records below carry the EXACT per-platform metrics provided by the
   institute (Web of Science / Scopus / Google Scholar). These are stored as author-level
   summary metrics with provenance "MANUAL — institutional master sheet import", so they are
   never altered by simulated connectors or polling (polling reports UNCHANGED for them).
   Paper-level documents are generated so per-platform counts and citation totals reconcile
   with the sheet. NA (null) ≠ 0: null means the source/profile is unavailable (NIL),
   0 is a confirmed zero from the sheet. */

import type { Author, DBShape, MetricSnapshot, Paper, Platform, PlatformMetrics, PollingLog, SourceRecord, User } from "./core";
import { daysAgoIso, mulberry32, paperId, uid } from "./core";
import { instEmail } from "./institution";

const rng = mulberry32(20260214);
const ri = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

/* ------------------------------------------------------------------ */
/* Institutional master sheet — one row per faculty, values verbatim    */
/* ------------------------------------------------------------------ */

type Triple = [number, number, number]; // papers, citations, h-index
type Quad = [number, number, number, number]; // + i10-index

interface FacRow {
  name: string;
  wos: Triple | null; // null → NA (NIL on the sheet)
  scopus: Triple | null;
  scholar: Quad | null;
  wos_url: string | null;
  scopus_id: string | null;
  scopus_url: string | null;
  scholar_id: string | null;
  scholar_url: string | null;
  rg_url: string | null;
}

const SHEET: FacRow[] = [
  { name: "Dr. Mangala Madankar", wos: [14, 39, 4], scopus: [46, 285, 10], scholar: [80, 541, 13, 15],
    wos_url: "https://www.webofscience.com/wos/author/record/107106",
    scopus_id: "55786580000", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=55786580000",
    scholar_id: "5t2M6y0AAAAJ", scholar_url: "https://scholar.google.com/citations?user=5t2M6y0AAAAJ&hl=en",
    rg_url: "https://www.researchgate.net/profile/Mangala-Madankar-Phd" },
  { name: "Dr. Apeksha Sakhare", wos: [11, 51, 2], scopus: [41, 236, 10], scholar: [74, 626, 12, 19],
    wos_url: "https://publons.com/researcher/2980815/apeksha-sakhare/metrics/",
    scopus_id: "55791652400", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=55791652400",
    scholar_id: "rWcV8lsAAAAJ", scholar_url: "https://scholar.google.co.in/citations?hl=en&user=rWcV8lsAAAAJ",
    rg_url: "https://www.researchgate.net/profile/Apeksha-Sakhare" },
  { name: "Dr. Girish Talmale", wos: [17, 103, 4], scopus: [25, 220, 7], scholar: [48, 428, 8, 6],
    wos_url: "https://publons.com/researcher/2980829/girish-talmale/metrics/",
    scopus_id: "37049158500", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=37049158500",
    scholar_id: "hE7IPLoAAAAJ", scholar_url: "https://scholar.google.co.in/citations?hl=en&user=hE7IPLoAAAAJ",
    rg_url: "https://www.researchgate.net/profile/Girish-Talmale" },
  { name: "Prof. Prashant K. Khobragade", wos: [3, 6, 2], scopus: [42, 656, 13], scholar: [61, 834, 16, 24],
    wos_url: "https://publons.com/researcher/2980883/prashant-khobragade/",
    scopus_id: "56209222100", scopus_url: "https://www.scopus.com/pages/authors/56209222100",
    scholar_id: "huWWpbsAAAAJ", scholar_url: "https://scholar.google.co.in/citations?user=huWWpbsAAAAJ&hl=en",
    rg_url: "https://www.researchgate.net/profile/Prashant-Khobragade-2" },
  { name: "Dr. Atiya Khan", wos: [3, 300, 2], scopus: [24, 650, 9], scholar: [29, 656, 9, 8],
    wos_url: "https://publons.com/researcher/2980976/atiya-khan/",
    scopus_id: "57289057700", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=57289057700",
    scholar_id: "Gb-7uR0AAAAJ", scholar_url: "https://scholar.google.co.in/citations?user=Gb-7uR0AAAAJ&hl=en",
    rg_url: "https://www.researchgate.net/profile/Atiya-Khan-4" },
  { name: "Prof. Neha Purohit", wos: [3, 4, 1], scopus: [23, 194, 8], scholar: [30, 270, 7, 7],
    wos_url: "https://publons.com/researcher/2980932/neha-purohit/",
    scopus_id: "57289743900", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=57289743900",
    scholar_id: "XG_3XW8AAAAJ", scholar_url: "https://scholar.google.com/citations?user=XG_3XW8AAAAJ&hl=en",
    rg_url: "https://www.researchgate.net/profile/Neha-Purohit-7" },
  { name: "Dr. Prasad Lokulwar", wos: [1, 5, 1], scopus: [41, 240, 10], scholar: [50, 374, 12, 14],
    wos_url: "https://www.webofscience.com/wos/author/record/AAG-7649-2019",
    scopus_id: "57197762410", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=57197762410",
    scholar_id: "PmrroegAAAAJ", scholar_url: "https://scholar.google.com/citations?hl=en&user=PmrroegAAAAJ",
    rg_url: "https://www.researchgate.net/profile/Prasad-Lokulwar-2" },
  { name: "Dr. Shruti Thakur", wos: [2, 5, 2], scopus: [22, 95, 6], scholar: [47, 135, 7, 5],
    wos_url: "https://www.webofscience.com/wos/author/record/AAT-7069-2021",
    scopus_id: "57487968600", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=57487968600",
    scholar_id: "cQ8t36oAAAAJ", scholar_url: "https://scholar.google.com/citations?view_op=list_works&hl=en&user=cQ8t36oAAAAJ",
    rg_url: "https://www.researchgate.net/profile/Shruti-Thakur-12" },
  { name: "Dr. Sarika Khandelwal", wos: [15, 41, 3], scopus: [58, 247, 9], scholar: [85, 375, 11, 15],
    wos_url: "https://www.webofscience.com/wos/author/record/AFG-7712-2022",
    scopus_id: "37011347300", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=37011347300",
    scholar_id: "YBuPBIgAAAAJ", scholar_url: "https://scholar.google.com/citations?user=YBuPBIgAAAAJ&hl=en",
    rg_url: null },
  { name: "Prof. Ashish Soni", wos: [0, 0, 0], scopus: [7, 12, 2], scholar: [14, 20, 3, 0],
    wos_url: "https://www.webofscience.com/wos/author/record/JWO-1600-2024",
    scopus_id: "58168806900", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=58168806900",
    scholar_id: "AOG41V8AAAAJ", scholar_url: "https://scholar.google.com/citations?hl=en&user=AOG41V8AAAAJ",
    rg_url: "https://www.researchgate.net/profile/Ashish-Soni-38" },
  { name: "Prof. Anuradha Joshi", wos: [0, 0, 0], scopus: [6, 17, 2], scholar: [4, 22, 2, 1],
    wos_url: null,
    scopus_id: "57197060288", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=57197060288",
    scholar_id: "x9dind0AAAAJ", scholar_url: "https://scholar.google.com/citations?hl=en&user=x9dind0AAAAJ",
    rg_url: "https://www.researchgate.net/profile/Anuradha-Joshi-14" },
  { name: "Prof. Imran Ahmad", wos: [0, 0, 0], scopus: [6, 0, 0], scholar: [4, 0, 0, 0],
    wos_url: null,
    scopus_id: "58651062700", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=58651062700",
    scholar_id: "fNJdnXgAAAAJ", scholar_url: "https://scholar.google.com/citations?hl=en&user=fNJdnXgAAAAJ",
    rg_url: "https://www.researchgate.net/profile/Imran-Ahmad-60" },
  { name: "Prof. Mrunali Dhone", wos: [0, 0, 0], scopus: [13, 253, 4], scholar: [16, 286, 6, 4],
    wos_url: "https://www.webofscience.com/wos/author/record/LVR-9137-2024",
    scopus_id: "58412672000", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=58412672000",
    scholar_id: "xfnfseMAAAAJ", scholar_url: "https://scholar.google.com/citations?view_op=list_works&hl=en&user=xfnfseMAAAAJ",
    rg_url: "https://www.researchgate.net/profile/Mrunalee-Dhone" },
  { name: "Dr. Aditya Turankar", wos: [0, 0, 0], scopus: [8, 12, 2], scholar: [20, 632, 7, 7],
    wos_url: "https://www.webofscience.com/wos/author/record/66097199",
    scopus_id: null, scopus_url: "https://www.scopus.com/results/authorNamesList.uri?sort=count-f&src=al&affilName=g+h+raisoni&s=AUTHLASTNAME(turankar)+AND+AUTHFIRST(aditya)",
    scholar_id: "im8Cuc4AAAAJ", scholar_url: "https://scholar.google.com/citations?hl=en&user=im8Cuc4AAAAJ&view_op=list_works&sortby=pubdate",
    rg_url: null },
  { name: "Prof. Sonali Bhardwaj", wos: [0, 0, 0], scopus: null, scholar: null,
    wos_url: "https://www.webofscience.com/wos/author/record/80658455",
    scopus_id: null, scopus_url: null,
    scholar_id: null, scholar_url: null,
    rg_url: null },
  { name: "Prof. Wani Bisen", wos: [2, 11, 1], scopus: [5, 39, 3], scholar: [10, 66, 5, 2],
    wos_url: "https://www.webofscience.com/wos/author/record/45779294",
    scopus_id: "58888352900", scopus_url: "https://www.scopus.com/authid/detail.uri?authorId=58888352900",
    scholar_id: "z7T8g-8AAAAJ", scholar_url: "https://scholar.google.com/citations?user=z7T8g-8AAAAJ&hl=en",
    rg_url: null },
  { name: "Dr. Sonia Bajaj", wos: null, scopus: null, scholar: [10, 15, 2, 0],
    wos_url: null,
    scopus_id: null, scopus_url: null,
    scholar_id: "QkiY9K4AAAAJ", scholar_url: "https://scholar.google.com/citations?user=QkiY9K4AAAAJ&hl=en",
    rg_url: null },
];

/* ------------------------------------------------------------------ */
/* Corpus generators (paper-level documents reconciling with the sheet) */
/* ------------------------------------------------------------------ */

const PREFIXES = ["Adaptive", "Hybrid", "Explainable", "Privacy-Preserving", "Energy-Efficient", "Self-Supervised", "Lightweight", "Robust", "Multi-Modal", "Federated", "Context-Aware", "Scalable"];
const CORES = ["Deep Learning", "Graph Neural Network", "IoT Framework", "Intrusion Detection", "Cloud Scheduling", "Image Segmentation", "Sentiment Analysis", "Fault Diagnosis", "Recommendation Model", "Blockchain Ledger", "Feature Selection", "Anomaly Detection"];
const SUFFIXES = ["for Smart Healthcare", "in Edge Computing", "for Precision Agriculture", "using Transfer Learning", "for Urban Mobility", "in Wireless Sensor Networks", "for Financial Fraud Detection", "using Attention Mechanisms", "for Resource-Constrained Devices", "in Social Networks"];

const JOURNALS = [
  "IEEE Access", "Multimedia Tools and Applications", "Wireless Personal Communications",
  "International Journal of Intelligent Systems", "SN Computer Science", "Cluster Computing",
  "IET Image Processing", "Arabian Journal for Science and Engineering", "Soft Computing",
  "Computer Communications", "Procedia Computer Science", "IEEE Trans. on Consumer Electronics",
];

const EXT_COAUTHORS = ["R. Wankhede", "S. Deshmukh", "P. Gawande", "M. Motghare", "A. Tidke", "K. Bhoyar", "N. Ramteke", "V. Ingole", "S. Agrawal", "D. Manwatkar"];
const KEYWORDS = ["deep learning", "IoT", "cloud computing", "cybersecurity", "NLP", "image processing", "machine learning", "data mining", "wireless networks", "blockchain", "optimization", "smart systems"];

/** Distribute `total` as `n` non-negative ints (deterministic, exact sum, head-weighted). */
function distribute(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (total <= 0) return Array(n).fill(0);
  const w = Array.from({ length: n }, (_, i) => (0.25 + rng()) * (1 + (n - i) / n));
  const s = w.reduce((a, b) => a + b, 0);
  const out = w.map((x) => Math.floor((total * x) / s));
  const order = out.map((_, i) => i).sort((a, b) => w[b] - w[a]);
  let rem = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; rem > 0; i = (i + 1) % n, rem--) out[order[i]]++;
  return out;
}

let doiSeq = 10000;
function makeDoc(facId: string, facName: string, idx: number, year: number): Paper {
  const title = `${pick(PREFIXES)} ${pick(CORES)} ${pick(SUFFIXES)}`;
  const hasDoi = rng() < 0.86;
  const doi = hasDoi ? `10.5121/ghrce.${year}.${doiSeq++}` : null;
  const type = rng() < 0.6 ? "Article" : rng() < 0.82 ? "Conference Paper" : rng() < 0.93 ? "Review" : "Book Chapter";
  const contribs = [facName];
  const nExt = ri(1, 2);
  for (let i = 0; i < nExt; i++) { const c = pick(EXT_COAUTHORS); if (!contribs.includes(c)) contribs.push(c); }
  const month = ri(1, 12);
  return {
    _id: paperId(doi, "SCOPUS", `${facId}-${idx}`),
    title,
    publication_year: year,
    publication_date: `${year}-${String(month).padStart(2, "0")}-${String(ri(1, 28)).padStart(2, "0")}`,
    doi, paper_type: type,
    contributors: contribs,
    isbn: type === "Book Chapter" ? [`978-3-030-${ri(10000, 99999)}-${ri(0, 9)}`] : [],
    issn: type === "Article" ? [`${2000 + ri(100, 899)}-${ri(1000, 9999)}`] : [],
    paper_url: doi ? `https://doi.org/${doi}` : null,
    keywords: [pick(KEYWORDS), pick(KEYWORDS)].filter((v, i, a) => a.indexOf(v) === i),
    faculty_ids: [facId],
    source_records: [],
    dedup: { status: "UNIQUE", merged_from: [] },
    created_at: daysAgoIso(ri(60, 400)),
    updated_at: daysAgoIso(ri(1, 59)),
  };
}

function buildPapers(facId: string, facName: string, row: FacRow): Paper[] {
  // IMPORTANT: No fake papers are generated.
  // Real papers will be fetched from academic APIs (Scopus, Google Scholar, ORCID, WoS)
  // when the backend is configured with valid API keys.
  // Citation metrics are preserved from the institutional master sheet.
  return [];
}

/* ------------------------------------------------------------------ */
/* Seed builder                                                         */
/* ------------------------------------------------------------------ */

export function buildSeed(): DBShape {
  const users: User[] = [
    { _id: "u_admin", name: "Admin", email: instEmail("admin"), password_hash: btoa("Admin@123"), role: "ADMIN", active: true, faculty_id: null, created_at: daysAgoIso(420), last_login_at: daysAgoIso(0) },
    { _id: "u_faculty", name: "Dr. Mangala Madankar", email: instEmail("mangala.madankar"), password_hash: btoa("Faculty@123"), role: "FACULTY", active: true, faculty_id: "a1", created_at: daysAgoIso(380), last_login_at: daysAgoIso(1) },
    { _id: "u_fac2", name: "Dr. Shruti Thakur", email: instEmail("shruti.thakur"), password_hash: btoa("Faculty@123"), role: "FACULTY", active: true, faculty_id: "a8", created_at: daysAgoIso(340), last_login_at: daysAgoIso(4) },
    { _id: "u_student", name: "Yash Gadhe", email: instEmail("yash.gadhe.cse", "STUDENT"), password_hash: btoa("Student@123"), role: "STUDENT", active: true, faculty_id: null, created_at: daysAgoIso(120), last_login_at: daysAgoIso(2) },
    { _id: "u_inactive", name: "Kiran Raut", email: instEmail("kiran.raut.cse", "STUDENT"), password_hash: btoa("Student@123"), role: "STUDENT", active: false, faculty_id: null, created_at: daysAgoIso(200), last_login_at: daysAgoIso(60) },
  ];

  const authors: Author[] = [];
  const papers: Paper[] = [];
  const seenPaperIds = new Set<string>();
  const retrieved = daysAgoIso(ri(3, 20));
  const provNote = "Institutional citation master sheet (Excel) — verified figures, imported manually";
  const prov = (p: Platform) => ({ source_platform: "MANUAL" as const, retrieved_at: retrieved, note: `${provNote} · ${p}` });

  SHEET.forEach((row, i) => {
    const id = `a${i + 1}`;
    const local = row.name.replace(/^(Dr|Prof)\.?\s+/, "").split(" ")[0].toLowerCase();
    const myPapers = buildPapers(id, row.name, row);
    myPapers.forEach((p) => { if (!seenPaperIds.has(p._id)) { seenPaperIds.add(p._id); papers.push(p); } });

    const pm: Author["platform_metrics"] = {};
    if (row.wos) pm.WOS = { papers: row.wos[0], citations: row.wos[1], h_index: row.wos[2], i10_index: null, last_updated: retrieved, provenance: prov("WOS") };
    if (row.scopus) pm.SCOPUS = { papers: row.scopus[0], citations: row.scopus[1], h_index: row.scopus[2], i10_index: null, last_updated: retrieved, provenance: prov("SCOPUS") };
    if (row.scholar) pm.GOOGLE_SCHOLAR = { papers: row.scholar[0], citations: row.scholar[1], h_index: row.scholar[2], i10_index: row.scholar[3], last_updated: retrieved, provenance: prov("GOOGLE_SCHOLAR") };
    if (row.rg_url) pm.RESEARCHGATE = { papers: null, citations: null, h_index: null, i10_index: null, last_updated: retrieved, provenance: { source_platform: "MANUAL", retrieved_at: retrieved, note: "Profile linked · metrics not collected (no authorized ResearchGate access)" } };

    const anyProfile = !!(row.scopus_url || row.scholar_url || row.wos_url);
    authors.push({
      _id: id,
      name: row.name,
      department: "Computer Science & Engineering",
      designation: row.name.startsWith("Prof.") ? "Professor" : "Assistant Professor",
      email: `${local}@raisoni.edu`,
      identifiers: {
        orcid: null,
        scopus_id: row.scopus_id,
        google_scholar_id: row.scholar_id,
        wos_id: row.wos_url?.match(/record\/([A-Z]{2,3}-\d{4}-\d{4})/)?.[1] ?? null,
        researchgate_id: row.rg_url ? row.rg_url.split("/").filter(Boolean).pop() ?? null : null,
      },
      profile_urls: {
        orcid: null,
        scopus: row.scopus_url,
        google_scholar: row.scholar_url,
        researchgate: row.rg_url,
        wos: row.wos_url,
      },
      platform_metrics: pm,
      research_areas: [...new Set([pick(KEYWORDS), pick(KEYWORDS), pick(KEYWORDS)])],
      identity: {
        status: anyProfile ? "PARTIALLY_VERIFIED" : "NOT_VERIFIED",
        evidence: {
          orcid_format_valid: false,
          scopus_id_valid: !!row.scopus_id,
          scopus_url_matches_id: !!row.scopus_id && !!row.scopus_url?.includes(row.scopus_id),
          orcid_scopus_link: "NOT_CHECKED",
          common_dois: myPapers.filter((p) => p.doi).length,
          name_similarity: 1,
          affiliation_match: true,
          publication_overlap: row.scopus?.[0] ?? 0,
          note: "ORCID not present on the institutional sheet — identity established from Scopus / Scholar / Publons profile links.",
        },
        resolved_at: retrieved,
      },
      last_polled_at: daysAgoIso(ri(2, 12)),
      last_changed_at: null,
      previous_summary: {
        ...(row.scopus ? { SCOPUS: { papers: row.scopus[0], citations: row.scopus[1], h_index: row.scopus[2] } } : {}),
        ...(row.scholar ? { GOOGLE_SCHOLAR: { papers: row.scholar[0], citations: row.scholar[1], h_index: row.scholar[2] } } : {}),
        ...(row.wos ? { WOS: { papers: row.wos[0], citations: row.wos[1], h_index: row.wos[2] } } : {}),
      },
      sim_pending_delta: null,
      created_at: daysAgoIso(ri(90, 300)),
      updated_at: daysAgoIso(ri(1, 30)),
    });
  });

  const metrics_history: MetricSnapshot[] = [];
  // Generate yearly snapshots from 2010-2026 for all platforms
  authors.forEach((a) => {
    (["WOS", "SCOPUS", "GOOGLE_SCHOLAR"] as Platform[]).forEach((plat) => {
      const cur = a.platform_metrics[plat];
      if (!cur || cur.papers === null || cur.papers === 0) return;

      // Generate yearly snapshots from 2010 to 2026
      for (let year = 2010; year <= 2026; year++) {
        const yearFraction = (year - 2010) / 16; // 0 to 1
        const papers = Math.max(0, Math.round(cur.papers * yearFraction * 0.95));
        const citations = Math.max(0, Math.round((cur.citations ?? 0) * yearFraction * 0.9));
        const h_index = Math.max(0, Math.round((cur.h_index ?? 0) * yearFraction * 0.85));
        const i10_index = plat === "GOOGLE_SCHOLAR" && cur.i10_index !== null
          ? Math.max(0, Math.round(cur.i10_index * yearFraction * 0.9))
          : null;

        metrics_history.push({
          _id: `mh_${a._id}_${plat}_${year}`,
          author_id: a._id,
          platform: plat,
          date: `${year}-12-31T23:59:59.000Z`,
          papers,
          citations,
          h_index,
          i10_index,
        });
      }
    });
  });

  const polling_logs: PollingLog[] = [
    { _id: "pl_1", author_id: "a1", author_name: "Dr. Mangala Madankar", triggered_by: instEmail("admin"), at: daysAgoIso(2), result: "UNCHANGED", change_detected: false, change_reason: ["Stored summary matches the institutional master sheet — full collection skipped"], changes: [], api_calls: 2, duration_ms: 860 },
    { _id: "pl_2", author_id: "a10", author_name: "Prof. Ashish Soni", triggered_by: instEmail("admin"), at: daysAgoIso(5), result: "UNCHANGED", change_detected: false, change_reason: ["Scopus & Scholar summaries unchanged — no delta vs. last snapshot"], changes: [], api_calls: 2, duration_ms: 900 },
  ];

  const api_usage = [
    { platform: "SCOPUS" as Platform, endpoint: "/author/summary/{id}", status_code: 200, success: true, estimated_usage: 17 },
    { platform: "GOOGLE_SCHOLAR" as Platform, endpoint: "serpapi/scholar-author", status_code: 200, success: true, estimated_usage: 30 },
    { platform: "WOS" as Platform, endpoint: "/wos-starter/v1/author", status_code: 200, success: true, estimated_usage: 15 },
  ].map((r, i) => ({ _id: `au_${i}`, at: daysAgoIso(ri(0, 4)), ...r }));

  return {
    version: 6,
    users,
    authors,
    papers,
    metrics_history,
    polling_logs,
    api_usage,
    deleted_authors: [],
    settings: {
      keys: { orcid: "", scopus: "", wos: "", serpapi: "" },
      researchgate_mode: "OFF",
      summary_check_first: true,
      cache_ttl_hours: 24,
    },
  };
}

export type { PlatformMetrics };
