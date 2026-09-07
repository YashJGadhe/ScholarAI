"""
ORCID API Service - Fetch author profiles and publications from ORCID

STATUS: PLACEHOLDER IMPLEMENTATION
To make this work, you need to:
1. Register for ORCID API access at https://orcid.org/
2. Add ORCID_CLIENT_ID and ORCID_CLIENT_SECRET to backend/.env
3. Implement the actual API calls below

ORCID Public API is free and doesn't require authentication for public data.
Documentation: https://info.orcid.org/documentation/
"""

import httpx
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class OrcidService:
    """Service for interacting with ORCID API"""
    
    BASE_URL = "https://pub.orcid.org/v3.0"
    
    def __init__(self, client_id: str = None, client_secret: str = None):
        """
        Initialize ORCID service
        
        Args:
            client_id: ORCID Client ID (optional for public API)
            client_secret: ORCID Client Secret (optional for public API)
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.headers = {
            "Accept": "application/json"
        }
    
    async def get_author_profile(self, orcid_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch author profile from ORCID
        
        Args:
            orcid_id: ORCID ID (e.g., "0000-0002-1825-0097")
            
        Returns:
            Author profile data or None if not found
        """
        # TODO: Implement actual API call
        # Example implementation:
        """
        url = f"{self.BASE_URL}/{orcid_id}/record"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                
                # Extract author profile
                person = data.get("person", {})
                name = person.get("name", {})
                
                # Extract employment/affiliation
                employments = data.get("activities-summary", {}).get("employments", {}).get("employment-summary", [])
                current_affiliation = employments[0].get("organization", {}).get("name", "") if employments else ""
                
                return {
                    "name": f"{name.get('given-names', {}).get('value', '')} {name.get('family-name', {}).get('value', '')}",
                    "affiliation": current_affiliation,
                    "orcid_id": orcid_id,
                    "biography": person.get("biography", {}).get("content", "")
                }
            except httpx.HTTPError as e:
                logger.error(f"Error fetching ORCID author profile: {e}")
                return None
        """
        
        logger.warning("ORCID API not implemented - returning None")
        return None
    
    async def get_author_papers(self, orcid_id: str) -> List[Dict[str, Any]]:
        """
        Fetch papers for an author from ORCID
        
        Args:
            orcid_id: ORCID ID
            
        Returns:
            List of paper objects
        """
        # TODO: Implement actual API call
        # Example implementation:
        """
        url = f"{self.BASE_URL}/{orcid_id}/works"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                
                papers = []
                work_groups = data.get("group", [])
                
                for group in work_groups:
                    work_summary = group.get("work-summary", [{}])[0]
                    
                    # Extract title
                    title = work_summary.get("title", {}).get("title", {}).get("value", "")
                    
                    # Extract DOI
                    external_ids = work_summary.get("external-ids", {}).get("external-id", [])
                    doi = None
                    for ext_id in external_ids:
                        if ext_id.get("external-id-type") == "doi":
                            doi = ext_id.get("external-id-value")
                            break
                    
                    # Extract publication date
                    pub_date = work_summary.get("publication-date", {})
                    year = pub_date.get("year", {}).get("value")
                    month = pub_date.get("month", {}).get("value")
                    pub_date_str = f"{year}-{month.zfill(2)}" if year and month else year
                    
                    paper = {
                        "title": title,
                        "doi": doi,
                        "publication_date": pub_date_str,
                        "source": work_summary.get("journal-title", {}).get("value", ""),
                        "citation_count": 0,  # ORCID doesn't provide citation counts
                        "authors": "",  # Would need to fetch individual work details
                        "type": work_summary.get("type", "Journal Article"),
                        "orcid_id": orcid_id,
                        "platform": "ORCID",
                        "put_code": work_summary.get("put-code")
                    }
                    papers.append(paper)
                
                return papers
            except httpx.HTTPError as e:
                logger.error(f"Error fetching ORCID papers: {e}")
                return []
        """
        
        logger.warning("ORCID API not implemented - returning empty list")
        return []
    
    async def get_paper_details(self, orcid_id: str, put_code: str) -> Optional[Dict[str, Any]]:
        """
        Fetch detailed information about a specific paper from ORCID
        
        Args:
            orcid_id: ORCID ID
            put_code: ORCID work put-code
            
        Returns:
            Paper details or None if not found
        """
        # TODO: Implement actual API call
        # Example implementation:
        """
        url = f"{self.BASE_URL}/{orcid_id}/work/{put_code}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                
                # Extract paper details
                title = data.get("title", {}).get("title", {}).get("value", "")
                
                # Extract DOI
                external_ids = data.get("external-ids", {}).get("external-id", [])
                doi = None
                for ext_id in external_ids:
                    if ext_id.get("external-id-type") == "doi":
                        doi = ext_id.get("external-id-value")
                        break
                
                # Extract contributors
                contributors = data.get("contributors", {}).get("contributor", [])
                authors = ", ".join([
                    f"{c.get('credit-name', {}).get('value', '')}" 
                    for c in contributors
                ])
                
                return {
                    "title": title,
                    "doi": doi,
                    "abstract": data.get("short-description", ""),
                    "publication_date": data.get("publication-date", {}).get("year", {}).get("value"),
                    "source": data.get("journal-title", {}).get("value", ""),
                    "citation_count": 0,  # ORCID doesn't provide citation counts
                    "authors": authors,
                    "type": data.get("type", "Journal Article"),
                    "url": data.get("url", {}).get("value")
                }
            except httpx.HTTPError as e:
                logger.error(f"Error fetching ORCID paper details: {e}")
                return None
        """
        
        logger.warning("ORCID API not implemented - returning None")
        return None


def get_orcid_service() -> Optional[OrcidService]:
    """
    Get ORCID service instance
    
    Returns:
        OrcidService instance (works without API key for public data)
    """
    import os
    client_id = os.getenv("ORCID_CLIENT_ID")
    client_secret = os.getenv("ORCID_CLIENT_SECRET")
    
    # ORCID public API works without credentials, but we can use them if available
    return OrcidService(client_id, client_secret)
