/* ScholarAI — seeded demo dataset.
   Clearly a demonstration corpus: connector responses are simulated in this
   sandbox (no external API keys). Unavailable sources return NA / NOT_AVAILABLE
   per the NA policy — nothing is presented as a live external fetch. */

import type { Author, DBShape, MetricSnapshot, Paper, Platform, PollingLog, SourceRecord, User } from "./core";
import { daysAgoIso, hIndexOf, i10Of, makeOrcid, mulberry32, paperId } from "./core";

const rng = mulberry32(20260214);
const ri = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
function pick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }

const JOURNALS: Record<string, string[]> = {
  CSE: ["IEEE Trans. on Knowledge & Data Engineering", "Pattern Recognition Letters", "Journal of Systems & Software", "Expert Systems with Applications", "Proc. ICMLA", "Computer Networks"],
  ECE: ["IEEE Sensors Journal", "Microprocessors & Microsystems", "IET Signal Processing", "Proc. IEEE INDICON", "Analog Integrated Circuits & Signal Processing"],
  BIOTECH: ["Applied Microbiology & Biotechnology", "Journal of Biomolecular Structure", "Bioprocess & Biosystems Engineering", "Molecular Biotechnology", "Preparative Biochemistry"],
  MECH: ["Journal of Manufacturing Processes", "Materials Today: Proceedings", "Mechanism & Machine Theory", "Proc. IMechE Part C", "Tribology International"],
  PHYSICS: ["Physica B: Condensed Matter", "Journal of Luminescence", "Optik", "Solid State Communications", "Pramana Journal of Physics"],
  MANAGEMENT: ["Journal of Business Research", "Int. Journal of Information Management", "Benchmarking: An Int. Journal", "Decision Analytics Journal"],
};

const TITLE_BANKS: Record<string, string[]> = {
  CSE: [
    "Attention-Guided Graph Networks for Source Code Summarization",
    "Federated Learning under Non-IID Clinical Data: A Robust Aggregation Study",
    "Lightweight Transformers for On-Device Tamil Speech Recognition",
    "Explainable Intrusion Detection in SDN Using Counterfactuals",
    "Energy-Aware Task Scheduling in Fog–Cloud Continuum",
    "Contrastive Pretraining for Low-Resource Neural Machine Translation",
    "Blockchain-Based Academic Credential Verification at Scale",
    "A Hybrid CNN–LSTM Model for Short-Term Traffic Flow Prediction",
    "Differentially Private Query Answering over Institutional Data Lakes",
    "Self-Supervised Representations for Satellite Image Classification",
  ],
  ECE: [
    "Wideband Microstrip Antenna Array for 5G Millimetre-Wave Handsets",
    "Low-Power ECG Front-End with Adaptive Baseline Wander Cancellation",
    "FPGA Acceleration of Sparse Matrix Kernels for Edge Inference",
    "MIMO Channel Estimation Using Deep Unfolding Networks",
    "CMOS Image Sensor Readout with Column-Parallel ADC Calibration",
    "Radar Cross-Section Reduction Using Frequency Selective Surfaces",
    "A 0.8-V Subthreshold SAR ADC for Wearable Biosensors",
    "mmWave Beam Management via Reinforcement Learning",
  ],
  BIOTECH: [
    "Exopolysaccharide Production by Halotolerant Bacillus sp.: Optimization and Rheology",
    "In-Silico Screening of Phytochemicals against Dengue NS2B-NS3 Protease",
    "Bioremediation of Textile Effluent using Immobilized Fungal Consortium",
    "CRISPR-Based Diagnostics for Rapid Detection of Leptospira",
    "Marine Sponge-Associated Actinomycetes as a Source of Novel Antibacterials",
    "Nanoformulated Curcumin: Bioavailability and Cytotoxicity Studies",
    "Microalgal Biodiesel: A Techno-Economic Assessment for Coastal India",
  ],
  MECH: [
    "Friction Stir Welding of Dissimilar Al–Cu Joints: Microstructure and Strength",
    "Topology Optimization of Additively Manufactured Lattice Heat Sinks",
    "Tribological Behaviour of Ti6Al4V under Minimum Quantity Lubrication",
    "Digital Twin Framework for Predictive Maintenance of CNC Machining Centres",
    "Vibration-Based Fault Diagnosis of Planetary Gearboxes Using Wavelet Scattering",
    "Experimental Investigation of PCM-Based Battery Thermal Management",
  ],
  PHYSICS: [
    "Photoluminescence Studies of Mn-Doped ZnS Quantum Dots",
    "Structural and Dielectric Properties of BaTiO₃–NiFe₂O₄ Multiferroics",
    "Raman Mapping of Strain in Monolayer MoS₂ on Flexible Substrates",
    "Thermoluminescence Kinetics of Gamma-Irradiated Borosilicate Glasses",
    "DFT Investigation of 2D Heterostructures for Photovoltaic Absorbers",
  ],
  MANAGEMENT: [
    "AI Adoption Readiness in Indian MSMEs: A Structural Equation Model",
    "Green Supply Chain Practices and Firm Performance: Moderating Role of Regulations",
    "Digital Payment Continuance Intention among Rural Consumers",
    "Servant Leadership and Employee Innovation Behaviour in Higher Education",
    "FinTech Literacy and Investment Decisions of Retail Investors",
  ],
};

const EXT_COAUTHORS = [
  "R. Subramanian", "P. Kaur", "M. Okonkwo", "L. Zhang", "S. Ghosh", "T. Yamamoto",
  "A. Petrova", "D. Iyer", "N. Reddy", "H. Farooqui", "J. Chen", "K. Bhattacharya",
  "V. Menon", "B. Osei", "C. Duarte", "E. Lindqvist",
];

const KEYWORDS: Record<string, string[]> = {
  CSE: ["deep learning", "federated learning", "NLP", "graph neural networks", "edge computing", "explainable AI", "security", "cloud scheduling"],
  ECE: ["antennas", "VLSI", "5G", "signal processing", "FPGA", "sensors", "mmWave"],
  BIOTECH: ["microbiology", "drug discovery", "bioremediation", "CRISPR", "nanobiotechnology", "biofuels"],
  MECH: ["additive manufacturing", "welding", "tribology", "digital twin", "condition monitoring", "thermal management"],
  PHYSICS: ["nanomaterials", "photoluminescence", "2D materials", "DFT", "dosimetry"],
  MANAGEMENT: ["technology adoption", "sustainability", "fintech", "leadership", "consumer behaviour"],
};

interface AuthorSeed {
  name: string; dept: string; designation: string; email: string; orcidBase: string;
  scopus: string; scholar: string; wos: string; rg: string | null;
  scale: number; wosQuotaFail?: boolean; partialIdentity?: boolean;
  pendingDelta?: { d_papers: number; d_citations: number; d_h: number };
}

const AUTHOR_SEEDS: AuthorSeed[] = [
  { name: "Dr. Anitha Raman", dept: "Computer Science & Engineering", designation: "Professor & Head", email: "anitha@scholarai.edu", orcidBase: "000000021825009", scopus: "57204819932", scholar: "xY8tRr0AAAAJ", wos: "AAB-4812-2020", rg: "Anitha-Raman", scale: 1.35, pendingDelta: { d_papers: 5, d_citations: 26, d_h: 1 } },
  { name: "Dr. Vikram Shetty", dept: "Electronics & Communication", designation: "Professor", email: "vikram@scholarai.edu", orcidBase: "000000015109370", scopus: "57190273341", scholar: "qJ2mPc8AAAAJ", wos: "C-7731-2015", rg: "Vikram-Shetty", scale: 1.1 },
  { name: "Dr. Meera Krishnan", dept: "Biotechnology", designation: "Associate Professor", email: "meera@scholarai.edu", orcidBase: "000000024567120", scopus: "57218834127", scholar: "bN4sQa2AAAAJ", wos: "HJZ-2214-2023", rg: null, scale: 0.95, pendingDelta: { d_papers: 2, d_citations: 9, d_h: 0 } },
  { name: "Dr. Arjun Nair", dept: "Mechanical Engineering", designation: "Associate Professor", email: "arjun@scholarai.edu", orcidBase: "000000032214881", scopus: "57186540219", scholar: "wT7kLe5AAAAJ", wos: "P-1198-2015", rg: "Arjun-Nair-3", scale: 0.9 },
  { name: "Dr. Farhan Ahmed", dept: "Computer Science & Engineering", designation: "Assistant Professor", email: "farhan@scholarai.edu", orcidBase: "000000019944662", scopus: "57225431860", scholar: "mK9vDw7AAAAJ", wos: "KQV-8843-2024", rg: null, scale: 0.75 },
  { name: "Dr. Lakshmi Priya", dept: "Physics", designation: "Assistant Professor", email: "lakshmi@scholarai.edu", orcidBase: "000000028773315", scopus: "57209876445", scholar: "zR5nGf1AAAAJ", wos: "GVW-5527-2022", rg: "Lakshmi-Priya", scale: 0.7 },
  { name: "Dr. Suresh Babu", dept: "School of Management", designation: "Professor", email: "suresh@scholarai.edu", orcidBase: "000000017655024", scopus: "56984321178", scholar: "hB3cXt9AAAAJ", wos: "D-9917-2011", rg: null, scale: 0.85, wosQuotaFail: true, partialIdentity: true },
];

const DEPT_KEY: Record<string, string> = {
  "Computer Science & Engineering": "CSE",
  "Electronics & Communication": "ECE",
  Biotechnology: "BIOTECH",
  "Mechanical Engineering": "MECH",
  Physics: "PHYSICS",
  "School of Management": "MANAGEMENT",
};

interface FacultyRef { _id: string; name: string; scale: number }

function makePaper(faculty: FacultyRef, idx: number, year: number, authorKey: string, crossId?: string, crossName?: string): Paper {
  const titles = TITLE_BANKS[authorKey];
  const title = titles[idx % titles.length];
  const typeRoll = rng();
  const type = typeRoll < 0.62 ? "Article" : typeRoll < 0.82 ? "Conference Paper" : typeRoll < 0.93 ? "Review" : "Book Chapter";
  const hasDoi = rng() < 0.87;
  const doi = hasDoi ? `10.${ri(1000, 9899)}/${authorKey.toLowerCase()}.${year}.${ri(1000, 98765)}` : null;
  const jour = pick(JOURNALS[authorKey]);
  const facIds = [faculty._id];
  const contribs = [faculty.name];
  if (crossId && crossName) { facIds.push(crossId); contribs.push(crossName); }
  const nExt = ri(0, 2);
  for (let i = 0; i < nExt; i++) {
    const c = pick(EXT_COAUTHORS);
    if (!contribs.includes(c)) contribs.push(c);
  }
  const base = ri(0, 26) * faculty.scale;
  function mkRec(platform: Platform, cites: number | null): SourceRecord {
    const sid = platform === "SCOPUS"
      ? "2-s2.0-" + ri(10000000000, 89999999999)
      : platform === "WOS"
        ? "WOS:" + String(ri(100000000, 499999999)) + String(ri(10, 99))
        : "GS" + ri(10000000, 15999999);
    return {
      platform,
      source_name: jour,
      source_id: String(sid),
      citation_count: cites,
      retrieved_at: daysAgoIso(ri(1, 40)),
      url: doi ? `https://doi.org/${doi}` : `https://example.org/records/${ri(100000, 999999)}`,
      validation_status: "VALID",
    };
  }
  const source_records: SourceRecord[] = [];
  const cScopus = Math.round(base * (0.55 + rng() * 0.5));
  const cWos = Math.round(cScopus * (0.1 + rng() * 0.16));
  const cScholar = Math.round(cScopus * (1.45 + rng() * 0.85)) + ri(0, 9);
  source_records.push(mkRec("SCOPUS", cScopus));
  if (rng() < 0.42) source_records.push(mkRec("WOS", cWos));
  if (rng() < 0.85) source_records.push(mkRec("GOOGLE_SCHOLAR", cScholar));
  const month = ri(1, 12);
  const day = ri(1, 28);
  const k1 = pick(KEYWORDS[authorKey]);
  const k2 = pick(KEYWORDS[authorKey]);
  return {
    _id: paperId(doi, "SCOPUS", source_records[0].source_id),
    title,
    publication_year: year,
    publication_date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    doi,
    paper_type: type,
    contributors: contribs,
    isbn: type === "Book Chapter" ? [`978-3-030-${ri(10000, 99999)}-${ri(0, 9)}`] : [],
    issn: type === "Article" ? [`${2000 + ri(100, 899)}-${ri(1000, 9999)}`] : [],
    paper_url: doi ? `https://doi.org/${doi}` : null,
    keywords: k1 === k2 ? [k1] : [k1, k2],
    faculty_ids: facIds,
    source_records,
    dedup: { status: "UNIQUE", merged_from: [] },
    created_at: daysAgoIso(ri(60, 400)),
    updated_at: daysAgoIso(ri(1, 59)),
  };
}

export function buildSeed(): DBShape {
  const users: User[] = [
    { _id: "u_admin", name: "Dr. Rajesh Venkatesan", email: "admin@scholarai.edu", password_hash: btoa("Admin@123"), role: "ADMIN", active: true, faculty_id: null, created_at: daysAgoIso(420), last_login_at: daysAgoIso(0) },
    { _id: "u_faculty", name: "Dr. Anitha Raman", email: "anitha@scholarai.edu", password_hash: btoa("Faculty@123"), role: "FACULTY", active: true, faculty_id: "a1", created_at: daysAgoIso(380), last_login_at: daysAgoIso(1) },
    { _id: "u_student", name: "Priya Sundaram", email: "student@scholarai.edu", password_hash: btoa("Student@123"), role: "STUDENT", active: true, faculty_id: null, created_at: daysAgoIso(120), last_login_at: daysAgoIso(2) },
    { _id: "u_fac2", name: "Dr. Vikram Shetty", email: "vikram@scholarai.edu", password_hash: btoa("Faculty@123"), role: "FACULTY", active: true, faculty_id: "a2", created_at: daysAgoIso(350), last_login_at: daysAgoIso(6) },
    { _id: "u_inactive", name: "Rahul Verma", email: "rahul@scholarai.edu", password_hash: btoa("Student@123"), role: "STUDENT", active: false, faculty_id: null, created_at: daysAgoIso(200), last_login_at: daysAgoIso(60) },
  ];

  const authors: Author[] = [];
  const papers: Paper[] = [];
  const crossPairs: Array<[number, number, number]> = [[0, 4, 3], [1, 3, 2], [2, 5, 2], [0, 1, 1]];

  AUTHOR_SEEDS.forEach(function (s, ai) {
    const id = `a${ai + 1}`;
    const key = DEPT_KEY[s.dept];
    const ref: FacultyRef = { _id: id, name: s.name, scale: s.scale };
    const myPapers: Paper[] = [];
    const count = Math.round(ri(9, 15) * s.scale);
    for (let i = 0; i < count; i++) {
      const step = Math.floor((i / count) * 8) + (rng() < 0.3 ? 1 : 0);
      const year = Math.min(2018 + Math.min(7, step), 2025);
      myPapers.push(makePaper(ref, i, year, key));
    }
    crossPairs.filter(function (p) { return p[0] === ai; }).forEach(function (pair) {
      const other = pair[1];
      const n = pair[2];
      const otherSeed = AUTHOR_SEEDS[other];
      for (let i = 0; i < n; i++) {
        const p = makePaper(ref, i + 2, ri(2020, 2025), key, `a${other + 1}`, otherSeed.name);
        myPapers.push(p);
      }
    });
    papers.push(...myPapers);

    function citeSeries(platform: Platform): number[] {
      const out: number[] = [];
      myPapers.forEach(function (p) {
        const rec = p.source_records.find(function (r) { return r.platform === platform; });
        if (rec) out.push(rec.citation_count ?? 0);
      });
      return out;
    }
    function metricsFor(platform: Platform) {
      const cites = citeSeries(platform);
      return {
        papers: cites.length,
        citations: cites.reduce(function (a, b) { return a + b; }, 0),
        h_index: hIndexOf(cites),
        i10_index: platform === "GOOGLE_SCHOLAR" ? i10Of(cites.map(function (c) { return Math.round(c * 1.15); })) : null,
      };
    }
    const scopus = metricsFor("SCOPUS");
    const wos = s.wosQuotaFail ? null : metricsFor("WOS");
    const scholar = metricsFor("GOOGLE_SCHOLAR");
    const retrieved = daysAgoIso(ri(2, 30));
    const orcid = makeOrcid(s.orcidBase);

    authors.push({
      _id: id,
      name: s.name,
      department: s.dept,
      designation: s.designation,
      email: s.email,
      identifiers: { orcid, scopus_id: s.scopus, google_scholar_id: s.scholar, wos_id: s.wos, researchgate_id: s.rg },
      profile_urls: {
        orcid: `https://orcid.org/${orcid}`,
        scopus: `https://www.scopus.com/authid/detail.uri?authorId=${s.scopus}`,
        google_scholar: `https://scholar.google.com/citations?user=${s.scholar}`,
        researchgate: s.rg ? `https://www.researchgate.net/profile/${s.rg}` : null,
        wos: `https://www.webofscience.com/wos/author/record/${s.wos}`,
      },
      platform_metrics: {
        ORCID: { papers: Math.max(3, scopus.papers - ri(4, 9)), citations: null, h_index: null, i10_index: null, last_updated: retrieved, provenance: { source_platform: "ORCID", retrieved_at: retrieved } },
        SCOPUS: { ...scopus, last_updated: retrieved, provenance: { source_platform: "SCOPUS", retrieved_at: retrieved } },
        WOS: wos
          ? { ...wos, last_updated: retrieved, provenance: { source_platform: "WOS", retrieved_at: retrieved } }
          : { papers: null, citations: null, h_index: null, i10_index: null, last_updated: null, provenance: { source_platform: "WOS", retrieved_at: retrieved, note: "API quota exceeded (HTTP 429)" } },
        GOOGLE_SCHOLAR: { ...scholar, last_updated: retrieved, provenance: { source_platform: "GOOGLE_SCHOLAR", retrieved_at: retrieved } },
      },
      research_areas: KEYWORDS[key].slice(0, 4),
      identity: {
        status: s.partialIdentity ? "PARTIALLY_VERIFIED" : "VERIFIED",
        evidence: {
          orcid_format_valid: true,
          scopus_id_valid: true,
          scopus_url_matches_id: true,
          orcid_scopus_link: s.partialIdentity ? "NOT_CHECKED" : "MATCH",
          common_dois: Math.round(scopus.papers * 0.62),
          name_similarity: s.partialIdentity ? 0.72 : 0.98,
          affiliation_match: !s.partialIdentity,
          publication_overlap: Math.round(scopus.papers * 0.55),
        },
        resolved_at: daysAgoIso(ri(10, 60)),
      },
      last_polled_at: daysAgoIso(ri(3, 24)),
      last_changed_at: daysAgoIso(ri(25, 90)),
      previous_summary: {
        SCOPUS: { papers: scopus.papers, citations: scopus.citations, h_index: scopus.h_index },
        GOOGLE_SCHOLAR: { papers: scholar.papers, citations: scholar.citations, h_index: scholar.h_index },
      },
      sim_pending_delta: s.pendingDelta ?? null,
      created_at: daysAgoIso(ri(120, 400)),
      updated_at: daysAgoIso(ri(1, 20)),
    });
  });

  const metrics_history: MetricSnapshot[] = [];
  authors.forEach(function (a) {
    const plats: Platform[] = ["SCOPUS", "GOOGLE_SCHOLAR"];
    plats.forEach(function (plat) {
      const cur = a.platform_metrics[plat];
      if (!cur || cur.papers === null) return;
      let p = Math.max(4, Math.round(cur.papers * 0.55));
      let c = Math.max(10, Math.round((cur.citations ?? 0) * 0.3));
      let h = Math.max(1, Math.round((cur.h_index ?? 1) * 0.6));
      for (let q = 8; q >= 1; q--) {
        metrics_history.push({ _id: `mh_${a._id}_${plat}_${q}`, author_id: a._id, platform: plat, date: daysAgoIso(q * 45), papers: p, citations: c, h_index: h, i10_index: null });
        p = Math.min(cur.papers, p + ri(1, 4));
        c = Math.min(cur.citations ?? c, c + ri(4, 18));
        if (q % 2 === 0) h = Math.min(cur.h_index ?? h, h + ri(0, 1));
      }
      metrics_history.push({ _id: `mh_${a._id}_${plat}_now`, author_id: a._id, platform: plat, date: new Date().toISOString(), papers: cur.papers, citations: cur.citations, h_index: cur.h_index, i10_index: cur.i10_index });
    });
  });

  const polling_logs: PollingLog[] = [
    { _id: "pl_1", author_id: "a1", author_name: "Dr. Anitha Raman", triggered_by: "admin@scholarai.edu", at: daysAgoIso(3), result: "UNCHANGED", change_detected: false, change_reason: ["Summary identical across Scopus & Google Scholar — full collection skipped"], changes: [], api_calls: 2, duration_ms: 940 },
    { _id: "pl_2", author_id: "a2", author_name: "Dr. Vikram Shetty", triggered_by: "admin@scholarai.edu", at: daysAgoIso(3), result: "CHANGED", change_detected: true, change_reason: ["Paper count 38 → 39 (Scopus)"], changes: [{ field: "papers", platform: "SCOPUS", from: 38, to: 39 }], api_calls: 41, duration_ms: 8412 },
    { _id: "pl_3", author_id: "a7", author_name: "Dr. Suresh Babu", triggered_by: "admin@scholarai.edu", at: daysAgoIso(6), result: "ERROR", change_detected: false, change_reason: ["Web of Science: API quota exceeded (HTTP 429)"], changes: [], api_calls: 3, duration_ms: 1510 },
  ];

  const api_usage: DBShape["api_usage"] = [
    { platform: "ORCID" as Platform, endpoint: "/v3.0/{orcid}/record", status_code: 200, success: true, estimated_usage: 1 },
    { platform: "SCOPUS" as Platform, endpoint: "/author/summary/{id}", status_code: 200, success: true, estimated_usage: 1 },
    { platform: "SCOPUS" as Platform, endpoint: "/author/{id}/documents", status_code: 200, success: true, estimated_usage: 25 },
    { platform: "WOS" as Platform, endpoint: "/wos-starter/v1/documents", status_code: 429, success: false, estimated_usage: 0 },
    { platform: "GOOGLE_SCHOLAR" as Platform, endpoint: "serpapi/scholar-author", status_code: 200, success: true, estimated_usage: 6 },
  ].map(function (r, i) { return { _id: `au_${i}`, at: daysAgoIso(ri(0, 4)), ...r }; });

  return {
    version: 3,
    users,
    authors,
    papers,
    metrics_history,
    polling_logs,
    api_usage,
    deleted_authors: [],
    settings: {
      keys: { orcid: "APP-DEMO-0X84QK", scopus: "7f59af901d2d86f78a1fd60c1bf9426a", wos: "wos-starter-demo-key", serpapi: "demo-serpapi-key-3391" },
      researchgate_mode: "OFF",
      summary_check_first: true,
      cache_ttl_hours: 24,
    },
  };
}
