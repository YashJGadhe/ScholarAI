"""Validators + normalizers for ORCID, Scopus, DOI, ISSN/ISBN, URLs, names.

DOI normalization treats https://doi.org/10.x/y, doi:10.x/y and 10.x/y as identical.
"""

import re
from datetime import datetime

_DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")
_SCOPUS_ID_RE = re.compile(r"^\d{9,12}$")
_ISSN_RE = re.compile(r"^\d{4}-\d{3}[\dXx]$")
_ISBN_RE = re.compile(r"^(97[89]-?)?[\d-]{9,13}$")


def normalize_orcid(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().replace("https://orcid.org/", "").replace("http://orcid.org/", "").strip("/")
    return v if re.fullmatch(r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]", v) else None


def orcid_checksum_valid(orcid: str | None) -> bool:
    """ISO 7064 MOD 11-2 check digit validation."""
    if not orcid or not re.fullmatch(r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]", orcid.strip()):
        return False
    digits = orcid.replace("-", "")
    total = 0
    for ch in digits[:-1]:
        total = (total + int(ch)) * 2
    remainder = total % 11
    result = (12 - remainder) % 11
    expected = "X" if result == 10 else str(result)
    return digits[-1].upper() == expected


def generate_orcid(base15: str) -> str:
    """Build a checksum-valid ORCID from 15 digits (used for demo tooling only)."""
    base15 = re.sub(r"\D", "", base15)[:15].ljust(15, "0")
    total = 0
    for ch in base15:
        total = (total + int(ch)) * 2
    result = (12 - (total % 11)) % 11
    check = "X" if result == 10 else str(result)
    full = base15 + check
    return f"{full[0:4]}-{full[4:8]}-{full[8:12]}-{full[12:16]}"


def normalize_scopus_id(value: str | None) -> str | None:
    if not value:
        return None
    v = re.sub(r"\D", "", value)
    return v if _SCOPUS_ID_RE.fullmatch(v) else None


def scopus_url_matches_id(url: str | None, scopus_id: str | None) -> bool:
    if not url or not scopus_id:
        return False
    return f"authorid={scopus_id}" in url.replace(" ", "").lower() or f"/authors/{scopus_id}" in url


def extract_scholar_id(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"[?&]user=([\w-]+)", url)
    return m.group(1) if m else None


def normalize_doi(value: str | None) -> str | None:
    """https://doi.org/10.x/y | doi:10.x/y | 10.x/y  →  10.x/y (canonical)."""
    if not value:
        return None
    v = value.strip()
    v = re.sub(r"^https?://(dx\.)?doi\.org/", "", v, flags=re.IGNORECASE)
    v = re.sub(r"^doi:", "", v, flags=re.IGNORECASE)
    v = v.strip().rstrip(".,;)")
    return v if _DOI_RE.fullmatch(v) else None


def normalize_issn(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().upper()
    if len(v) == 8 and v[:7].isdigit():
        v = f"{v[:4]}-{v[4:]}"
    return v if _ISSN_RE.fullmatch(v) else None


def normalize_isbn(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    return v if _ISBN_RE.fullmatch(v) else None


def normalize_name(value: str | None) -> str | None:
    if not value:
        return None
    return re.sub(r"\s+", " ", value.strip()).title()


def normalize_year(value) -> int | None:
    try:
        y = int(str(value)[:4])
        return y if 1900 <= y <= 2100 else None
    except (TypeError, ValueError):
        return None


def normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(value.strip()[:10], fmt).date().isoformat()
        except ValueError:
            continue
    return None


_PAPER_TYPE_MAP = {
    "ar": "Article", "article": "Article", "journal article": "Article",
    "cp": "Conference Paper", "conference paper": "Conference Paper", "proceedings-article": "Conference Paper",
    "re": "Review", "review": "Review",
    "bk": "Book Chapter", "book chapter": "Book Chapter", "ch": "Book Chapter",
    "no": "Note", "letter": "Letter", "sh": "Short Survey",
}


def normalize_paper_type(value: str | None) -> str:
    if not value:
        return "Article"
    return _PAPER_TYPE_MAP.get(value.strip().lower(), value.strip().title())


def name_similarity(a: str, b: str) -> float:
    """Token-overlap similarity in [0, 1] (lightweight stand-in for fuzzy matching)."""
    ta = set(re.sub(r"[^a-z ]", "", a.lower()).split())
    tb = set(re.sub(r"[^a-z ]", "", b.lower()).split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def paper_id(doi: str | None, platform: str, source_id: str) -> str:
    """DOI preferred; deterministic source-scoped fallback otherwise."""
    d = normalize_doi(doi)
    if d:
        return f"doi:{d.lower()}"
    return f"{platform.lower()}:{source_id}"
