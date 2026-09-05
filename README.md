# ScholarAI — Academic Research Intelligence Platform

ScholarAI is a centralized platform that **collects, validates, normalizes, cross-references,
deduplicates, stores, analyzes and visualizes** researcher and publication data from
**ORCID, Scopus, Web of Science, Google Scholar and ResearchGate** for an academic institution.

> **About this build.** This workspace ships as a static Vite bundle (no Python/Mongo runtime is
> available here), so the complete platform is delivered as a runnable React application whose
> service layer (`src/lib/`) mirrors the specified FastAPI + MongoDB contracts one-to-one:
> identical endpoint semantics, identical document shapes, identical RBAC enforcement, identical
> pipeline behaviour. Persistence uses `localStorage` in place of MongoDB, and external connector
> responses are **structured simulations** (clearly labelled) because no live API keys exist in the
> sandbox — unavailable sources return `NA` / `NOT_AVAILABLE`, never fabricated values. Every
> function in `src/lib` maps to the backend module listed beside it below.

---

## 1. Architecture

```
ADMIN ──▶ Add Faculty ──▶ Validate IDs/URLs ──▶ Fetch Data (preview only, NO save)
                                │                        │
                                ▼                        ▼
                        Identity Resolution       Source connectors
                        (ORCID ↔ Scopus primary)  ├─ ORCID (public API)
                                │                 ├─ Scopus (Elsevier)
                                ▼                 ├─ Web of Science (Starter API)
                        Admin confirms            ├─ Google Scholar (SerpApi provider)
                                │                 └─ ResearchGate (compliant modes only)
                                ▼                        │
                        MongoDB research DB ◀────────────┘
                        users · authors · papers · metrics_history
                        polling_logs · api_usage · deleted_authors
                                │
              ┌─────────────────┼─────────────────────┐
              ▼                 ▼                     ▼
     Bibliometric analytics  Collaboration network  AI/ML insights
              │                 │                     │
              └────────▶ Dashboards · Reports (Excel/CSV/JSON) ───────▶ END
```

### Frontend → backend module map

| Frontend module | Backend equivalent | Responsibility |
|---|---|---|
| `src/lib/core.ts` | `app/models/*`, `app/utils/*` | Types, ORCID checksum, DOI/ISSN/ISBN/name normalization, H/i10 computation |
| `src/lib/seed.ts` | `scripts/seed_admin.py` + fixtures | Seeded demo corpus (demo data only) |
| `src/lib/db.ts` | `app/database/mongodb.py` | Persistence engine (localStorage ↔ MongoDB) |
| `src/lib/api.ts` | `app/routes/*`, `app/core/security.py` | Auth (JWT-style tokens), RBAC on every call, users/faculty CRUD, guards |
| `src/lib/connectors.ts` | `app/services/*_service.py` | Five connectors, identity resolution, dedup hierarchy, Summary Check-First polling |
| `src/lib/analytics.ts` | `services/analytics_service.py` | Bibliometrics, network, AI insights, report builders |
| `src/lib/export.ts` | `services/export_service.py` | Excel-compatible CSV (UTF-8 BOM), CSV, JSON |

---

## 2. Roles & security (RBAC)

| Role | Access |
|---|---|
| **ADMIN** | Everything: users, faculty lifecycle (add/edit/delete/restore), fetch-data, polling, citations, analytics, reports, API config |
| **FACULTY** | Own profile, publications, metrics, analytics, collaborators |
| **STUDENT** | Read-only: researchers, publication explorer, analytics/network |

Security rules implemented **in the API layer** (frontend hiding is cosmetic only):

- Every mutating endpoint re-verifies token signature, expiry, account-active flag and role.
- Admin **cannot delete themself**, **cannot change their own role**.
- The **last remaining ADMIN** can be neither deleted, deactivated nor downgraded.
- Registration always creates a `STUDENT`; only admins can grant elevated roles.
- Direct URL access (`/admin/users`, `/admin/citations`, …) redirects unauthorized roles;
  the data APIs additionally refuse the request with `403`.

Demo accounts: `admin@scholarai.edu / Admin@123`, `anitha@scholarai.edu / Faculty@123`,
`student@scholarai.edu / Student@123`.

---

## 3. Data model (MongoDB document shapes)

- **authors** — identifiers (`orcid`, `scopus_id`, `google_scholar_id`, `wos_id`, `researchgate_id`),
  `profile_urls`, **`platform_metrics` kept strictly separate per source**, `identity` (status +
  primary/secondary evidence), `last_polled_at`, `last_changed_at`, `previous_summary`.
- **papers** — `_id` = normalized DOI (`doi:10.…`, lowercased) when present, else deterministic
  `platform:source_id` fallback. Carries the paper-level fields only; author summary metrics are
  **never duplicated onto paper documents**.
- **metrics_history** — `{author_id, platform, date, papers, citations, h_index, i10_index}` snapshots
  enabling `20 → 25 papers`, `150 → 176 citations`, `7 → 8 H-index` comparisons.
- **polling_logs** — result, `change_detected`, `change_reason`, per-field changes, `api_calls`, duration.
- **api_usage** — credit ledger: platform, endpoint, status code, success, estimated usage.
- **deleted_authors** — soft-deleted records with `deleted_at` / `deleted_by` (restorable).

### The 15 mandatory research fields

`Research Paper Name · Research Paper Count · Citation Count · H-Index Count · i10-Index Count ·
Publication Year · Publication Date · DOI · Research Paper Type · Contributors Name · Source Name ·
ISBN · ISSN · URL of Research Paper · Source Platform`

Fields 2–5 are **author/platform summary metrics**. They live on the author document; exports map
them onto each row (see `analytics.ts → paperRows`) without corrupting the paper model. Column names
are preserved verbatim for institutional Excel compatibility.

### NA policy

`NA` = never collected or connector failed (quota, missing key, compliant ResearchGate mode).
`0` = confirmed zero returned by the source. The UI never renders `null` as `0`.

---

## 4. Identity resolution

**Primary (required for VERIFIED):** ORCID checksum valid (ISO/IEC 7064 MOD 11-2) **and**
Scopus ID format valid **and** Scopus profile URL matches the Scopus ID **and** the
ORCID ↔ Scopus link confirms a MATCH.

**Secondary (confidence only):** common DOIs, name similarity, affiliation match, publication overlap.
DOI matching **never** acts as the primary mechanism. Statuses: `VERIFIED`,
`PARTIALLY_VERIFIED`, `NOT_VERIFIED` — evidence is displayed on every preview and profile page.

## 5. Duplicate detection hierarchy

1. DOI exact match (after normalization of `https://doi.org/…`, `doi:…`, bare `10.…`) → merge (0.99)
2. Source identifier exact match → merge (0.95)
3. Normalized title + year → `POSSIBLE_DUPLICATE`, flagged for review (0.80)
4. Title/contributor similarity → review
Merges append `source_records` and record `merged_from` provenance; low-confidence matches are
never auto-merged.

## 6. Summary Check-First & on-demand polling (mandatory)

`pollAuthor()` never downloads publications first:

1. Fetch **summary only** per platform (paper count, citations, H-index).
2. Compare against the stored `previous_summary` in the DB.
3. **UNCHANGED → STOP** (log shows the 2–3 summary calls; full collection skipped).
4. **DELTA DETECTED →** run full collection, ingest new papers, write a history snapshot,
   record `change_reason` like `Paper count 20 → 25 (Scopus)`.

Toggle in *System / APIs* (`summary_check_first`). Every run appends to `polling_logs` and the
`api_usage` credit ledger; one failing source never crashes the sweep. In the demo corpus,
*Dr. Anitha Raman* and *Dr. Meera Krishnan* carry pending remote drift, so their first poll
demonstrates a delta; subsequent polls demonstrate `UNCHANGED`.

## 7. Connector compliance notes

- **ORCID** — public read API; also powers identity resolution.
- **Scopus** — official Elsevier APIs; never relabelled data.
- **Web of Science** — Clarivate Starter API only (no page scraping); fields a plan doesn't expose
  return `NA`. A seeded `HTTP 429 quota exceeded` case demonstrates structured failure handling
  (see *Citation Management* banner for Dr. Suresh Babu).
- **Google Scholar** — authorized provider (SerpApi) only; OpenAlex fallbacks would be labelled
  OpenAlex, never "Google Scholar".
- **ResearchGate** — no public API exists, so the connector supports only `OFF`, `MANUAL_IMPORT`,
  `AUTHORIZED_ACCESS`, `EXTERNAL_AUTHORIZED_PROVIDER`. No CAPTCHA/anti-bot bypass, no scraping.
  `MANUAL_IMPORT` records admin-verified figures with `provenance = MANUAL`.

## 8. Analytics, network & AI layer

- Bibliometrics: publication/citation growth, H-index trajectories, source & department comparison,
  year-wise output, top researchers/papers.
- Collaboration: Author → Paper → Author edges, frequent collaborators, internal/external split
  (interactive radial network graph).
- AI/ML: trend detection, emerging-topic clusters, citation projection (linear model) and
  researcher-overlap estimates — every output labelled *AI-generated / Predicted / Estimated*
  with an explicit confidence. Predictions are never stated as facts.

## 9. Reports & export

Six report types (faculty, department, citation, year-wise, platform comparison, full publications)
exportable as **Excel-compatible CSV (UTF-8 BOM), CSV and JSON**, with a live row preview.
Institutional column headers are never renamed.

## 10. Run & test

```bash
npm install
npm run dev        # local development
npm run build      # production bundle (dist/)
```

Try this path end-to-end: sign in as **Admin** → *Add Faculty* → *Fill sample* →
*Validate & Fetch Data* (nothing is saved) → inspect identity evidence and duplicate scan →
*Add New Faculty* → *Polling* → run *Check for updates* on Dr. Anitha Raman (delta) and again
(UNCHANGED, collection skipped) → *Citations* (note the WoS NA row) → *Reports* → export Excel.

### Environment variables (production backend parity)

`MONGODB_URI · MONGODB_DATABASE · JWT_SECRET_KEY · ORCID_CLIENT_ID · ORCID_CLIENT_SECRET ·
SCOPUS_API_KEY · WOS_API_KEY · SERPAPI_API_KEY · RESEARCHGATE_MODE` — never hard-coded,
never exposed to the frontend; empty keys downgrade a connector to `NOT_CONFIGURED` gracefully.

### Troubleshooting

- *Connector shows EMPTY/NA* — set the key under *System / APIs*; WoS and Scholar respond immediately.
- *Poll always UNCHANGED* — expected after a delta is consumed; use *Reset demo dataset* to restore
  the pending-drift demonstration state.
- *Locked out* — the seed admin cannot be deleted or downgraded by design; reset the demo dataset
  from the login-level storage if needed.
