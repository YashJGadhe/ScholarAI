# ScholarAI Backend Services

This directory contains service stubs for integrating with academic APIs.

## Current Status

These services are **placeholder implementations**. To fetch real research papers, you need to:

1. Obtain API keys from each platform
2. Implement the actual API calls in each service file
3. Configure the API keys in your environment variables

## Required API Keys

### Scopus API (Elsevier)
- **Purpose**: Fetch papers, citations, h-index from Scopus
- **Get API Key**: https://dev.elsevier.com/
- **Documentation**: https://api.elsevier.com/documentation
- **Rate Limit**: 2,000 requests per week (free tier)
- **Implementation**: See `scopus_service.py`

### Google Scholar API (via SerpApi)
- **Purpose**: Fetch papers and citations from Google Scholar
- **Get API Key**: https://serpapi.com/
- **Pricing**: Free tier (100 searches/month), paid plans available
- **Implementation**: See `scholar_service.py`

### ORCID API
- **Purpose**: Fetch author profiles and publication lists
- **Get API Key**: https://orcid.org/ (free for public API)
- **Documentation**: https://info.orcid.org/documentation/
- **Implementation**: See `orcid_service.py`

### Web of Science API (Clarivate)
- **Purpose**: Fetch papers and citations from Web of Science
- **Get API Key**: Requires institutional subscription
- **Documentation**: https://developer.clarivate.com/apis/wos-starter
- **Implementation**: See `wos_service.py`

## Next Steps

1. **Get API Keys**: Register for each platform's API
2. **Configure Environment**: Add keys to `backend/.env`
3. **Implement Services**: Replace placeholder code with actual API calls
4. **Test Integration**: Use the "Fetch Data" button in Citation Management

## Important Notes

- **Do NOT hardcode API keys** in the source code
- **Respect rate limits** - implement proper error handling
- **Cache responses** where possible to reduce API calls
- **Handle errors gracefully** - APIs may be temporarily unavailable
- **Validate data** - ensure API responses match expected schema
