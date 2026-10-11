from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime

class ConnectorResult:
    def __init__(
        self,
        connector_name: str,
        status: str,  # completed_with_matches, completed_no_matches, partially_completed, access_denied, rate_limited, not_configured, error
        records: Optional[List[Dict[str, Any]]] = None,
        duration_ms: int = 0,
        coverage_notes: str = "",
        error_message: Optional[str] = None,
        credits_consumed: int = 0,
        is_cached: bool = False
    ):
        self.connector_name = connector_name
        self.status = status
        self.records = records or []
        self.duration_ms = duration_ms
        self.coverage_notes = coverage_notes
        self.error_message = error_message
        self.credits_consumed = credits_consumed
        self.is_cached = is_cached

    def to_dict(self) -> Dict[str, Any]:
        return {
            "connector_name": self.connector_name,
            "status": self.status,
            "results_count": len(self.records),
            "records": self.records,
            "duration_ms": self.duration_ms,
            "coverage_notes": self.coverage_notes,
            "error_message": self.error_message,
            "credits_consumed": self.credits_consumed,
            "is_cached": self.is_cached
        }


class BaseConnector(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        pass

    @property
    @abstractmethod
    def category(self) -> str:
        """e.g. social, archive, video, web"""
        pass

    @property
    @abstractmethod
    def supported_operations(self) -> List[str]:
        """e.g. ['search_text', 'fetch_public_post', 'health_check']"""
        pass

    @property
    @abstractmethod
    def requires_api_key(self) -> bool:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        pass

    async def search_text(self, query: str, options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        return ConnectorResult(
            connector_name=self.name,
            status="unsupported_operation",
            coverage_notes=f"{self.display_name} does not support free text search."
        )

    async def search_image(self, fingerprint: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        return ConnectorResult(
            connector_name=self.name,
            status="unsupported_operation",
            coverage_notes=f"{self.display_name} does not support image hash search."
        )

    async def fetch_public_post(self, url: str) -> Optional[Dict[str, Any]]:
        return None
