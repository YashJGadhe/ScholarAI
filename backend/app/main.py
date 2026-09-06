"""ScholarAI — FastAPI application entry point.

Run:  uvicorn app.main:app --reload   (from the backend/ directory)
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .database.indexes import create_indexes
from .database.mongodb import close_db, connect_db
from .routes import admin, analytics, auth, faculty, publications


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = connect_db()
    await create_indexes(db)
    # Ensure at least one ADMIN exists (default admin; change password in production!)
    if await db.users.count_documents({"role": "ADMIN"}) == 0:
        from .core.security import hash_password

        await db.users.insert_one({
            "name": "Admin", "email": "admin@raisoni.net",
            "password_hash": hash_password("Admin@123"),
            "role": "ADMIN", "active": True, "faculty_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(), "last_login_at": None,
        })
        print("[ScholarAI] Seeded default admin: admin@raisoni.net / Admin@123 — CHANGE THIS.")
    yield
    close_db()


app = FastAPI(
    title="ScholarAI API",
    description="Academic research data aggregation & analytics — ORCID, Scopus, Web of Science, "
                "Google Scholar (SerpApi), ResearchGate (compliant modes only).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(faculty.router)
app.include_router(publications.router)
app.include_router(analytics.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scholarai", "database": get_settings().MONGODB_DATABASE}
