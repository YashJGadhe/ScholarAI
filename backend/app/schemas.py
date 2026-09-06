"""Pydantic request/response schemas (auth, users, faculty, papers, citations, analytics)."""

from pydantic import BaseModel, EmailStr, Field


# ---------- auth ----------

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = Field(default="STUDENT", pattern="^(ADMIN|FACULTY|STUDENT)$")
    orcid: str = Field(description="Mandatory — checksum-validated server side")
    scopus_id: str = Field(description="Mandatory — 9–12 digits")


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ---------- users (admin) ----------

class UserUpdateIn(BaseModel):
    role: str | None = Field(default=None, pattern="^(ADMIN|FACULTY|STUDENT)$")
    active: bool | None = None
    faculty_id: str | None = None


class UserInviteIn(BaseModel):
    name: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = Field(pattern="^(ADMIN|FACULTY|STUDENT)$")
    faculty_id: str | None = None


# ---------- faculty ----------

class FacultyIdentifiersIn(BaseModel):
    orcid: str
    scopus_id: str
    scopus_url: str
    scholar_url: str | None = None
    wos_url: str | None = None
    researchgate_url: str | None = None


class FacultyCreateIn(FacultyIdentifiersIn):
    name: str = Field(min_length=3)
    department: str = "Unassigned"
    designation: str = "Faculty"
    email: str = ""
    research_areas: list[str] = []


class FacultyUpdateIn(BaseModel):
    name: str | None = None
    department: str | None = None
    designation: str | None = None
    email: str | None = None
    research_areas: list[str] | None = None


class FetchDataOut(BaseModel):
    """Preview only — nothing is persisted by this endpoint."""
    validation: dict
    platforms: dict
    identity: dict
    papers_preview: list[dict]
    duplicates: list[dict]
    fetched_at: str


# ---------- settings ----------

class SettingsIn(BaseModel):
    orcid_client_id: str | None = None
    scopus_api_key: str | None = None
    wos_api_key: str | None = None
    serpapi_api_key: str | None = None
    researchgate_mode: str | None = Field(default=None, pattern="^(OFF|MANUAL_IMPORT|AUTHORIZED_ACCESS|EXTERNAL_AUTHORIZED_PROVIDER)$")
