from typing import Dict, List, Optional
from app.connectors.base import BaseConnector
from app.connectors.wayback import WaybackConnector
from app.connectors.bluesky import BlueskyConnector
from app.connectors.mastodon import MastodonConnector
from app.connectors.youtube import YouTubeConnector
from app.connectors.reddit import RedditConnector
from app.connectors.web_search import WebSearchConnector

CONNECTORS: Dict[str, BaseConnector] = {
    "wayback": WaybackConnector(),
    "bluesky": BlueskyConnector(),
    "mastodon": MastodonConnector(),
    "youtube": YouTubeConnector(),
    "reddit": RedditConnector(),
    "web_search": WebSearchConnector(),
}

def get_connector(name: str) -> Optional[BaseConnector]:
    return CONNECTORS.get(name)

def get_all_connectors() -> List[BaseConnector]:
    return list(CONNECTORS.values())
