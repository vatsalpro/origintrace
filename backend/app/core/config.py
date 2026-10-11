import os
from pathlib import Path
from typing import List
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
THUMBNAILS_DIR = DATA_DIR / "thumbnails"
CANDIDATES_DIR = DATA_DIR / "candidates"
CACHE_DIR = DATA_DIR / "cache"
SAMPLE_DIR = DATA_DIR / "sample"
INCOGNITO_UPLOADS_DIR = DATA_DIR / "temp_incognito"

def _load_env_file():
    for p in [BASE_DIR / ".env", Path.cwd() / ".env"]:
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k and k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass
            break

_load_env_file()

def _resolve_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "")
    if not raw:
        return f"sqlite:///{DATA_DIR / 'origintrace.db'}"
    if raw.startswith("sqlite:///./data/"):
        filename = raw.replace("sqlite:///./data/", "")
        return f"sqlite:///{DATA_DIR / filename}"
    if raw.startswith("sqlite:///./"):
        rel_path = raw.replace("sqlite:///./", "")
        return f"sqlite:///{BASE_DIR / rel_path}"
    return raw

class Settings(BaseModel):
    APP_NAME: str = "OriginTrace AI"
    APP_VERSION: str = "1.0.0"
    TAGLINE: str = "Trace the content. Reconstruct the timeline. Verify the evidence."
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

    # Storage & DB
    DATABASE_URL: str = _resolve_database_url()
    UPLOADS_PATH: Path = UPLOADS_DIR
    THUMBNAILS_PATH: Path = THUMBNAILS_DIR
    CANDIDATES_PATH: Path = CANDIDATES_DIR
    CACHE_PATH: Path = CACHE_DIR
    INCOGNITO_UPLOADS_PATH: Path = INCOGNITO_UPLOADS_DIR
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    MAX_DOWNLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB for candidate images
    SERPAPI_CACHE_TTL_SECONDS: int = 7 * 86400  # 7 days

    # Allowed extensions
    ALLOWED_IMAGE_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"]
    ALLOWED_VIDEO_EXTENSIONS: List[str] = [".mp4", ".webm", ".mov", ".mkv", ".avi"]

    # External APIs (free-first design with optional credentials)
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", os.getenv("REVERSE_IMAGE_API_KEY", ""))
    REVERSE_IMAGE_PROVIDER: str = os.getenv("REVERSE_IMAGE_PROVIDER", "serpapi")
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    BLUESKY_HANDLE: str = os.getenv("BLUESKY_HANDLE", "")
    BLUESKY_APP_PASSWORD: str = os.getenv("BLUESKY_APP_PASSWORD", "")
    MASTODON_DEFAULT_INSTANCE: str = os.getenv("MASTODON_INSTANCE", "mastodon.social")
    SEARCH_API_KEY: str = os.getenv("SEARCH_API_KEY", "")

    # Tool paths
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "tesseract")
    FFMPEG_CMD: str = os.getenv("FFMPEG_CMD", "ffmpeg")

    # Timeouts
    HTTP_TIMEOUT_SECONDS: float = 12.0
    DOWNLOAD_TIMEOUT_SECONDS: float = 6.0
    MAX_CONCURRENT_SEARCHES: int = 5

    def ensure_directories(self):
        self.UPLOADS_PATH.mkdir(parents=True, exist_ok=True)
        self.THUMBNAILS_PATH.mkdir(parents=True, exist_ok=True)
        self.CANDIDATES_PATH.mkdir(parents=True, exist_ok=True)
        self.CACHE_PATH.mkdir(parents=True, exist_ok=True)
        self.INCOGNITO_UPLOADS_PATH.mkdir(parents=True, exist_ok=True)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_directories()
