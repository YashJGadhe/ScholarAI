# ScholarAI — Academic Research Intelligence Platform

Centralized collection, validation, normalization, deduplication, identity
resolution, analytics and reporting for institutional research output —
aggregated from **ORCID, Scopus, Web of Science, Google Scholar and ResearchGate**,
stored in **MongoDB**, served by a **FastAPI** backend and a **React** frontend.

```
ScholarAI/
├── backend/            ← Python 3.11 + FastAPI + Motor (runs on :8000)
│   ├── app/
│   │   ├── main.py            app entrypoint (uvicorn app.main:app)
│   │   ├── core/              config · security (bcrypt + JWT) · RBAC dependencies
│   │   ├── database/          mongodb.py (Motor) · indexes.py
│   │   ├── models.py          user / author / paper / snapshot document builders
│   │   ├── schemas.py         Pydantic request/response schemas
│   │   ├── routes/            auth · faculty · publications(+citations) · analytics(+reports) · admin · notifications
│   │   ├── services/          orcid · scopus · wos · google_scholar · researchgate
│   │   │                      identity · normalization · deduplication · polling · analytics · export
│   │   │                      notification_service · change_detector · scheduler (automatic alerts)
│   │   └── utils/identifiers.py  ORCID checksum · DOI/ISSN/ISBN normalizers
│   ├── scripts/               seed_admin.py · create_indexes.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/           ← React runner (package.json, vite.config.ts)
├── src/                ← frontend application source (React + Tailwind + Recharts)
├── docker-compose.yml
└── README.md
```

> The live web preview of this workspace builds from the repo root, so the
> frontend source is `src/` here; `frontend/` provides the standalone runner.
> See `frontend/README.md`.

---

## 1 · Run the project

### Backend (FastAPI + MongoDB)

```bash
# 1. Start MongoDB (or: docker compose up -d mongo)

# 2. Configure secrets — never hard-code keys
cd backend
cp .env.example .env
#    edit .env → SCOPUS_API_KEY, WOS_API_KEY, SERPAPI_API_KEY,
#    ORCID_CLIENT_ID/SECRET, JWT_SECRET_KEY

# 3. Virtual environment + dependencies  (Python 3.11+)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 4. Indexes + default admin (both also run automatically on first start)
python -m scripts.create_indexes
python -m scripts.seed_admin     # → admin@raisoni.net / Admin@123  (change it!)

# 5. Start the API
uvicorn app.main:app --reload    # http://localhost:8000  · docs: /docs
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

### Docker (MongoDB + backend together)

```bash
docker compose up -d
```

---

## 2 · Accounts, roles & domains

| Workspace | Email domain        | Example                       |
|-----------|---------------------|-------------------------------|
| Admin     | `@raisoni.net`      | `admin@raisoni.net`           |
| Faculty   | `@raisoni.net`      | `shruti.thakur@raisoni.net`   |
| Student   | `@ghrce.raisoni.net`| `yash.gadhe.cse@ghrce.raisoni.net` |

**Registration requires a checksum-valid ORCID and a 9–12 digit Scopus ID** —
validated at the API layer, not just the form. Faculty self-registration creates
a researcher record whose metrics stay **NA** until an admin verifies it.

RBAC (enforced on every sensitive endpoint, independent of the UI):

- **ADMIN** — manage users & faculty, add/edit/delete/restore faculty,
  trigger fetch-data & polling, citation management, reports, API settings.
- **FACULTY** — own profile, publications, citations, analytics.
- **STUDENT** — read-only access to researchers/publications/analytics.

Admin safety rules (backend-enforced): an admin cannot delete or downgrade
themselves, and the **last remaining ADMIN can never be deleted or downgraded**.

---

## 3 · Data collection flow

```
START → Authentication & RBAC
      → Research Data Collection
          ├─ ORCID            (public API; checksum-validated)
          ├─ Scopus           (Elsevier Author Retrieval + Search; API key)
          ├─ Web of Science   (Clarivate Starter API; API key; never scraped)
          ├─ Google Scholar   (SerpApi authorized provider; never scraped)
          └─ ResearchGate     (compliant modes: OFF · MANUAL_IMPORT ·
                               AUTHORIZED_ACCESS · EXTERNAL_AUTHORIZED_PROVIDER)
      → Validation & Cleaning → Normalization
      → Duplicate Detection & Merging (provenance preserved)
      → Identity Resolution → MongoDB
      → Analytics · AI/ML · Collaboration network
      → Dashboards → Reports & Export → END
```

### Fetch Data never saves

`POST /faculty/fetch-data` **only validates and previews**: identifier checks,
per-platform summaries, identity status with evidence, duplicate scan. The final
write happens on `POST /faculty` after the admin confirms.

### Identity resolution — ORCID ↔ Scopus first

PRIMARY: ORCID checksum valid + Scopus ID valid + Scopus URL matches the ID +
ORCID↔Scopus link. SECONDARY (confidence boosters only): common DOIs, name /
affiliation similarity, publication overlap. **DOI matching is never the primary
mechanism.** Statuses: `VERIFIED · PARTIALLY_VERIFIED · NOT_VERIFIED`.

### Summary Check-First (mandatory)

Every poll fetches **summaries only** and compares with `previous_summary` in
MongoDB. Identical → `UNCHANGED`, pipeline stops, ~2–3 API calls. Different →
`DELTA DETECTED` → full publication collection runs, papers are normalized,
deduplicated (DOI → source-id → title/year → similarity), merged with full
provenance, and a `metrics_history` snapshot is appended so you can report
`Papers 20 → 25 · Citations 150 → 176 · H-index 7 → 8`.

### NA policy

`NA` (null) means *not collected / unavailable*; `0` means *confirmed zero*.
Unavailable sources (missing key, HTTP 429 quota, NIL profiles like
`Prof. Sonali Bhardwaj`'s Scopus) are stored as null and rendered as NA —
values are never fabricated.

---

## 4 · Report Module (Year-Wise / Month-Wise / Date-Range)

The Report module generates institutional-format citation reports for **WOS, Scopus, and
Google Scholar only** (ResearchGate and ORCID are excluded from citation sections).

### Report types

| Type | Description |
|------|-------------|
| **Year-Wise** | Citations per faculty per year across a year range (2010 → 2026 by default) |
| **Month-Wise** | Citations per faculty per month within a year |
| **Custom Date Range** | Citations for an arbitrary from/to date range |

### Structure

```
| Sr. No. | Faculty Name | Citations in Web of Science | ... | Citations in Scopus | ... | Citations in Google Scholar | ... |
          |              | 2010 | 2011 | ... | 2026 | Total | 2010 | ... | 2026 | Total | 2010 | ... | 2026 | Total |
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1         | Dr. Mangala  |   2  |   3  | ... |  39  |  39   |   5  | ... | 285  | 285   |  10  | ... | 541  | 541   |
...
17        | Dr. Sonia    |  NA  |  NA  | ... |   0  |   0   |  NA  | ... |   0  |   0   |   2  | ... |  15  |  15   |
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Total     |              | ... | ... | ... | ... |  ...  | ... | ... | ... |  ...  | ... | ... | ... |  ...  |
Average   |              | ... | ... | ... | ... |  ...  | ... | ... | ... |  ...  | ... | ... | ... |  ...  |
```

### NA policy in reports

- `NA` = historical data unavailable for that year/platform
- `0` = confirmed zero (verified by the source)
- Never fabricate missing historical values

### API endpoints

```
GET /reports/year-wise?department=CSE&start_year=2020&end_year=2026
GET /reports/year-wise/download?department=CSE&start_year=2020&end_year=2026&fmt=excel
GET /reports/month-wise?department=CSE&year=2026&start_month=1&end_month=8
GET /reports/date-range?department=CSE&from_date=2026-01-01&to_date=2026-08-31
GET /reports/departments
```

### Downloads

- **Excel (.xlsx)** — openpyxl with merged platform headers, colored headers, freeze panes
- **CSV** — UTF-8 BOM for Excel compatibility
- **PDF** — reportlab with landscape A4 layout

### Historical data

Reports are generated from stored `metrics_history` snapshots and paper publication dates.
The automatic polling system feeds historical data into these reports — no separate
hard-coded dataset.

---

## 5 · Automatic Alert & Notification Module

ScholarAI includes a **fully automatic** notification system that monitors research
platforms in the background and alerts users when meaningful changes are detected —
no manual "Fetch Data" or "Check Updates" clicks required.

### How it works

```
Background Scheduler (configurable interval)
    ↓
Poll all researchers (Summary Check-First)
    ↓
Compare current vs previous_summary
    ↓
Change detected?
    ├─ NO → stop, no notification
    └─ YES → fetch full data, detect events
              ↓
        Create notifications
              ↓
        Store in MongoDB
              ↓
        Deliver to users (faculty sees own, admin sees system-wide)
```

### Event types detected

- **NEW_PUBLICATION** — new paper indexed in any platform
- **SCOPUS_INDEXED** — paper newly available in Scopus
- **WOS_INDEXED** — paper newly available in Web of Science
- **GOOGLE_SCHOLAR_INDEXED** — paper newly available in Google Scholar
- **ORCID_PUBLICATION** — new work in ORCID profile
- **CITATION_INCREASE** — citation count increased
- **H_INDEX_CHANGE** — H-index changed
- **I10_INDEX_CHANGE** — i10-index changed (Google Scholar)
- **PROFILE_UPDATE** — profile metadata changed
- **DATA_COLLECTION_ERROR** — polling failed for a researcher
- **API_ERROR** — platform API returned an error
- **API_RATE_LIMIT** — platform quota exceeded
- **IDENTITY_WARNING** — identity verification issue
- **SYSTEM_ALERT** — critical system event

### Notification priorities

- **LOW** — citation updates, i10-index changes
- **MEDIUM** — new publications, H-index changes, rate limits
- **HIGH** — data collection errors, API errors, identity warnings
- **CRITICAL** — system alerts

### Duplicate prevention

Each notification has a deterministic `event_key` (author_id + platform + event_type + paper_id)
so the same event never generates duplicate alerts, even across multiple polling cycles.

### User targeting

- **Faculty** receives notifications about their own research profile only
- **Admin** receives system-wide alerts (API errors, rate limits, faculty publication updates)
- Users cannot access another user's notifications (enforced server-side)

### Configuration

In `backend/.env`:

```bash
# Background polling scheduler
POLLING_ENABLED=true
POLLING_INTERVAL_MINUTES=60
```

The scheduler runs automatically on app startup and polls all researchers at the
configured interval. It respects Summary Check-First to minimize API calls.

### Notification preferences

Faculty can customize which notification categories they receive at
`/faculty/notifications`. Disabling a category stops delivery but does **not**
stop data collection — the two systems are independent.

### API endpoints

```
GET  /notifications              list notifications (role-filtered)
GET  /notifications/unread-count unread count
PUT  /notifications/{id}/read    mark as read
PUT  /notifications/read-all     mark all as read
GET  /notifications/preferences  get preferences
PUT  /notifications/preferences  update preferences
```

### Real-time updates

The frontend polls `/notifications/unread-count` every 30 seconds and displays
a notification bell with an unread badge in the shell header. Clicking the bell
opens the notification center with full details, priority indicators, and
mark-as-read actions.

For production deployments, replace the polling with WebSocket or Server-Sent
Events (SSE) — the backend architecture is ready for that upgrade.

---

## 4 · REST API (all auth'd unless noted)

```
POST   /auth/register            POST  /auth/login            GET  /auth/me
GET    /faculty                  POST  /faculty               GET  /faculty/{id}
PUT    /faculty/{id}             DELETE /faculty/{id}         POST /faculty/{id}/restore
POST   /faculty/fetch-data       POST  /faculty/{id}/poll     GET  /faculty/me
GET    /publications             GET   /publications/{id}
GET    /citations                GET   /citations/{faculty_id}
GET    /analytics/overview       GET   /analytics/faculty/{id}
GET    /analytics/department/{d} GET   /analytics/network
GET    /reports/faculty/{id}     GET   /reports/citations     (?fmt=csv|excel|json)
GET    /admin/users              POST  /admin/users           PUT  /admin/users/{id}
DELETE /admin/users/{id}         GET   /admin/settings        PUT  /admin/settings
GET    /admin/polling-logs       GET   /admin/api-usage
GET    /health
```

---

## 5 · MongoDB schema & indexes

Collections: `users · authors · papers · metrics_history · polling_logs ·
api_usage · deleted_authors`.

- `papers._id` = normalized DOI (`doi:10.x/y`); deterministic
  `platform:source_id` fallback when no DOI exists.
- `source_records[]` keeps per-platform citation counts separately —
  Scopus 46/285/10 and WoS 14/39/4 are **never blended**.
- Unique: `users.email`, `papers.doi` (sparse). Indexed: author identifiers,
  `papers.title`, `papers.publication_year`, `source_records.platform`,
  history/log lookups.

## 6 · Reports & Excel compatibility

Exports use the institute's exact column names — *Research Paper Name, Research
Paper Count, Citation Count, H-Index Count, i10-Index Count, Publication Year,
Publication Date, DOI, Research Paper Type, Contributors Name, Source Name,
ISBN, ISSN, URL of Research Paper, Source Platform* — plus Total/Average rows.
Author-level summary metrics are mapped into rows from the author document, so
paper documents stay pure. Excel export is UTF-8-BOM CSV.

## 7 · AI/ML layer

Trend detection, citation projection (linear model), topic clustering,
researcher similarity — every output is labeled
`AI-generated insight · Predicted · Estimated · Confidence: n%` and is never
presented as fact.

## 8 · External APIs & limits

| Source        | Auth                     | Notes                                            |
|---------------|--------------------------|--------------------------------------------------|
| ORCID         | public (key optional)    | read-only public records                         |
| Scopus        | `X-ELS-APIKey`           | institutional plan; 429 → NA                     |
| WoS           | `X-ApiKey` (Starter API) | hidden fields → NA; no scraping                  |
| Google Scholar| SerpApi key              | authorized provider; direct scraping not used    |
| ResearchGate  | modes only               | no CAPTCHA/anti-bot bypass; NOT_AVAILABLE if off |

Every connector handles timeout / 401 / 403 / 404 / 429 / 5xx / bad JSON with a
structured error and an `api_usage` log entry — one failing source never
crashes the pipeline.

## 9 · Troubleshooting

- **401 on login** → account inactive or wrong credentials; reseed with
  `python -m scripts.seed_admin`.
- **All sources NOT_CONFIGURED** → keys missing in `backend/.env`; restart uvicorn.
- **WoS returns NA** → quota (429) or plan limitation — expected, by design.
- **CORS errors** → add your origin to `CORS_ORIGINS`.
- **Mongo connection refused** → start `mongod` or `docker compose up -d mongo`.
