# ScholarAI - Implementation Summary

## What Was Implemented

This implementation addresses three key requirements:

### 1. ✅ Demo Disclaimer Added
- Created `src/components/DemoDisclaimer.tsx` component
- Added disclaimer to both Admin and Faculty Research Papers pages
- Clear warning that research papers are demo data and will only appear after API integration

### 2. ✅ Fake Papers Removed
- Modified `src/lib/seed.ts` to stop generating fake research papers
- The `buildPapers()` function now returns an empty array
- Only citation metrics from the institutional master sheet are preserved
- No more misleading fake paper titles, DOIs, or publication details

### 3. ✅ Backend API Service Stubs Created
Created placeholder implementations for four academic APIs:

#### Scopus API Service (`backend/app/services/scopus_service.py`)
- Methods: `get_author_profile()`, `get_author_papers()`, `get_paper_details()`
- API Key: Get from https://dev.elsevier.com/
- Rate Limit: 2,000 requests/week (free tier)

#### Google Scholar API Service (`backend/app/services/scholar_service.py`)
- Methods: `get_author_profile()`, `get_author_papers()`, `search_papers()`
- API Key: Get from https://serpapi.com/
- Pricing: Free tier (100 searches/month)

#### ORCID API Service (`backend/app/services/orcid_service.py`)
- Methods: `get_author_profile()`, `get_author_papers()`, `get_paper_details()`
- API Key: Free public API from https://orcid.org/
- No authentication required for public data

#### Web of Science API Service (`backend/app/services/wos_service.py`)
- Methods: `get_author_profile()`, `get_author_papers()`, `get_paper_details()`
- API Key: Requires institutional subscription from Clarivate
- Documentation: https://developer.clarivate.com/apis/wos-starter

### 4. ✅ Documentation Created
- `backend/app/services/README.md` - Complete guide for API integration
- Each service file contains detailed TODO comments with example implementations
- Clear instructions on how to obtain API keys and implement the services

---

## Current State

### What Works Now
- ✅ Citation Management page shows real metrics from your institutional data
- ✅ Faculty profiles display correct citation counts (papers, citations, h-index)
- ✅ Research Papers pages show disclaimer explaining demo mode
- ✅ No fake papers are generated or displayed
- ✅ Backend service stubs are ready for API integration

### What Doesn't Work Yet
- ❌ Research papers are not fetched (empty results)
- ❌ "Fetch Data" button in Citation Management won't retrieve papers
- ❌ Paper-level details (title, DOI, abstract, etc.) are not available

---

## Next Steps to Get Real Research Papers

### Step 1: Get API Keys

**Priority Order (based on ease and cost):**

1. **ORCID** (FREE, easiest)
   - Go to https://orcid.org/
   - Create account → Developer Tools → Register application
   - Get Client ID and Client Secret
   - Public API is free and doesn't require authentication

2. **Scopus** (FREE, good data quality)
   - Go to https://dev.elsevier.com/
   - Sign up → Create API Key
   - Select "Scopus Search API" and "Author Retrieval API"
   - Free tier: 2,000 requests/week

3. **Google Scholar via SerpApi** (PAID, but comprehensive)
   - Go to https://serpapi.com/
   - Sign up → Get API key
   - Free tier: 100 searches/month
   - Paid: $50/month for 5,000 searches

4. **Web of Science** (PAID, institutional only)
   - Requires institutional subscription
   - Contact your library/IT department
   - Most expensive option

### Step 2: Configure Environment Variables

Edit `backend/.env`:

```env
# ORCID (FREE)
ORCID_CLIENT_ID=your-client-id
ORCID_CLIENT_SECRET=your-client-secret

# Scopus (FREE)
SCOPUS_API_KEY=your-scopus-api-key

# Google Scholar via SerpApi (PAID)
SERPAPI_API_KEY=your-serpapi-key

# Web of Science (INSTITUTIONAL)
WOS_API_KEY=your-wos-api-key
```

### Step 3: Implement API Calls

Each service file has detailed TODO comments with example implementations. You need to:

1. Uncomment the example code in each service method
2. Test the API calls with your credentials
3. Handle errors and edge cases
4. Add proper logging

**Example: Implementing Scopus Service**

```python
# In backend/app/services/scopus_service.py

async def get_author_papers(self, scopus_id: str, count: int = 100) -> List[Dict[str, Any]]:
    url = f"{self.BASE_URL}/search/scopus"
    params = {
        "query": f"AU-ID({scopus_id})",
        "count": count,
        "sort": "-coverDate"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            papers = []
            entries = data.get("search-results", {}).get("entry", [])
            
            for entry in entries:
                paper = {
                    "title": entry.get("dc:title", ""),
                    "doi": entry.get("prism:doi"),
                    "publication_date": entry.get("prism:coverDate"),
                    "source": entry.get("prism:publicationName"),
                    "citation_count": int(entry.get("citedby-count", 0)),
                    "authors": entry.get("dc:creator", ""),
                    "type": entry.get("prism:aggregationType", "Journal"),
                    "scopus_id": entry.get("dc:identifier"),
                    "platform": "SCOPUS"
                }
                papers.append(paper)
            
            return papers
        except httpx.HTTPError as e:
            logger.error(f"Error fetching Scopus papers: {e}")
            return []
```

### Step 4: Update Citation Management Fetch Logic

The "Fetch Data" button in Citation Management needs to:

1. Call the appropriate service based on faculty identifiers
2. Fetch papers from each platform
3. Store papers in the database
4. Update citation metrics

**Location:** `backend/app/routes/citations.py` - Update the `fetch_all_faculty_citations()` endpoint

### Step 5: Test Integration

1. Start the backend: `uvicorn app.main:app --reload`
2. Open Swagger docs: http://localhost:8000/docs
3. Test each service endpoint
4. Use the "Fetch Data" button in Citation Management
5. Verify papers appear in Research Papers pages

---

## File Structure

```
backend/
├── app/
│   └── services/
│       ├── README.md                    # API integration guide
│       ├── scopus_service.py           # Scopus API stub
│       ├── scholar_service.py          # Google Scholar API stub
│       ├── orcid_service.py            # ORCID API stub
│       ├── wos_service.py              # Web of Science API stub
│       └── __init__.py                 # Service exports

src/
├── components/
│   └── DemoDisclaimer.tsx              # Disclaimer component
├── pages/
│   ├── admin/
│   │   └── ResearchPapers.tsx          # Admin view with disclaimer
│   └── faculty/
│       └── ResearchPapers.tsx          # Faculty view with disclaimer
└── lib/
    └── seed.ts                         # Modified to not generate fake papers
```

---

## Important Notes

### Data Integrity
- ✅ No fake papers are generated
- ✅ Citation metrics are real (from institutional master sheet)
- ✅ Clear disclaimer shown to users
- ⚠️ Papers will only appear after API integration

### API Rate Limits
- **ORCID**: No limit (public API)
- **Scopus**: 2,000 requests/week
- **SerpApi**: 100 searches/month (free), upgrade for more
- **Web of Science**: Varies by subscription

### Cost Considerations
- **ORCID**: FREE
- **Scopus**: FREE (with registration)
- **SerpApi**: FREE tier (100/month) or $50/month
- **Web of Science**: PAID (institutional subscription required)

### Recommended Approach
1. Start with ORCID (free, easy)
2. Add Scopus (free, good data)
3. Add SerpApi for Google Scholar (start with free tier)
4. Web of Science only if your institution has subscription

---

## Testing Checklist

- [ ] Get ORCID API credentials
- [ ] Get Scopus API key
- [ ] Get SerpApi key (optional)
- [ ] Update backend/.env with API keys
- [ ] Implement API calls in service files
- [ ] Test each service individually
- [ ] Update Citation Management fetch logic
- [ ] Test "Fetch Data" button
- [ ] Verify papers appear in Research Papers pages
- [ ] Verify disclaimer is shown
- [ ] Verify no fake papers are displayed

---

## Support

If you need help with API integration:

1. **ORCID**: https://info.orcid.org/documentation/
2. **Scopus**: https://api.elsevier.com/documentation
3. **SerpApi**: https://serpapi.com/documentation
4. **Web of Science**: https://developer.clarivate.com/apis/wos-starter

---

## Summary

✅ **Completed:**
- Demo disclaimer added
- Fake papers removed
- Backend service stubs created
- Documentation provided

⏳ **Next:**
- Get API keys
- Implement API calls
- Test integration
- Fetch real papers

The system is now transparent about demo mode and ready for real API integration.
