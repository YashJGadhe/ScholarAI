# ScholarAI — Frontend

React 18 + Vite + Tailwind v4 + Recharts + React Router.

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The Vite config points at the repository root because this workspace serves the
live preview from there — the application source is `src/` at the repo root.
To make this folder fully standalone:

```bash
cp -r ../src ./src
# then in vite.config.ts: remove the `root` override (defaults to this folder)
```

## Point the UI at the Python backend

The sandbox UI ships with an in-browser API layer that mirrors the backend
contracts exactly (`src/lib/api.ts`). To run against the real FastAPI service:

1. Start the backend (`cd backend && uvicorn app.main:app --reload`).
2. Replace the calls in `src/lib/api.ts` with `fetch("http://localhost:8000…")`
   using the same endpoint paths — every route matches 1:1 (see root README,
   "REST API" table). Send the JWT as `Authorization: Bearer <token>`.

## Roles & domains

- Admin / Faculty register + sign in with `@raisoni.net`
- Students with `@ghrce.raisoni.net`
- Registration requires a checksum-valid ORCID and a 9–12 digit Scopus ID.

Route protection exists in the UI (guards + redirects) **and** in the backend —
never rely on the frontend alone.
