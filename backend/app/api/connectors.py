from typing import List, Dict, Any
from fastapi import APIRouter
from app.connectors import get_all_connectors
from app.schemas.schemas import ConnectorStatus

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

CONNECTOR_DOCS = {
    "reverse_image": {
        "description": "Reverse-image search provider querying Google Lens / web visual indexes.",
        "limitations": "Requires SERPAPI_API_KEY. Without API key, local perceptual hashing is used for candidates discovered via other sources."
    },
    "wayback": {
        "description": "Internet Archive Wayback Machine CDX historical snapshot discovery.",
        "limitations": "Captures represent archival snapshots, not verified original publication dates. Private/unarchived URLs cannot be discovered."
    },
    "bluesky": {
        "description": "Public authenticated AT Protocol post search and decentralized thread resolution.",
        "limitations": "Full-text indexing covers public posts only. Deleted or blocklisted posts cannot be retrieved."
    },
    "mastodon": {
        "description": "Federated ActivityPub public status query across open participating instances.",
        "limitations": "Searches are scoped to the queried instance and its federated federated relays. Not a global centralized index."
    },
    "youtube": {
        "description": "Google YouTube Data API v3 video title, description, and thumbnail discovery.",
        "limitations": "Requires free developer quota API key. Does not access unlisted, private, or age-gated videos."
    },
    "openverse": {
        "description": "Publicly licensed image catalog discovery via Openverse API.",
        "limitations": "Queries by OCR text and keywords, not reverse-image search. Candidate images are compared locally using perceptual hashes."
    },
    "web_search": {
        "description": "Public webpage metadata, OpenGraph, JSON-LD, and publication date extraction with SSRF security filter.",
        "limitations": "Subject to robots.txt and paywalls. Blocked internal/private network addresses are strictly rejected."
    }
}

@router.get("", response_model=List[ConnectorStatus])
def list_connectors():
    results = []
    for c in get_all_connectors():
        docs = CONNECTOR_DOCS.get(c.name, {"description": "", "limitations": ""})
        results.append(ConnectorStatus(
            name=c.name,
            display_name=c.display_name,
            category=c.category,
            is_available=c.is_configured(),
            is_configured=c.is_configured(),
            requires_api_key=c.requires_api_key,
            supported_operations=c.supported_operations,
            description=docs["description"],
            limitations=docs["limitations"]
        ))
    return results

@router.get("/status")
async def check_all_connectors_status() -> Dict[str, Any]:
    statuses = {}
    for c in get_all_connectors():
        st = await c.health_check()
        statuses[c.name] = {
            "name": c.name,
            "display_name": c.display_name,
            "configured": c.is_configured(),
            "requires_key": c.requires_api_key,
            "health": st
        }
    return statuses
