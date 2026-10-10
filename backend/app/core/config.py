import os
from pathlib import Path
from typing import List
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
SAMPLE_DIR = DATA_DIR / "sample"

class Settings(BaseModel):
    APP_NAME: str = "OriginTrace AI"
    APP_VERSION: str = "1.0.0"
    TAGLINE: str = "Trace the content. Reconstruct the timeline. Verify the evidence."
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

    # Storage & DB
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'origintrace.db'}")
    UPLOADS_PATH: Path = UPLOADS_DIR
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB

    # Allowed extensions
    ALLOWED_IMAGE_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"]
    ALLOWED_VIDEO_EXTENSIONS: List[str] = [".mp4", ".webm", ".mov", ".mkv", ".avi"]

    # External APIs (all optional, free-first design)
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    REDDIT_CLIENT_ID: str = os.getenv("REDDIT_CLIENT_ID", "")
    REDDIT_CLIENT_SECRET: str = os.getenv("REDDIT_CLIENT_SECRET", "")
    BLUESKY_HANDLE: str = os.getenv("BLUESKY_HANDLE", "")
    BLUESKY_APP_PASSWORD: str = os.getenv("BLUESKY_APP_PASSWORD", "")
    MASTODON_DEFAULT_INSTANCE: str = os.getenv("MASTODON_INSTANCE", "mastodon.social")
    SEARCH_API_KEY: str = os.getenv("SEARCH_API_KEY", "")

    # Tool paths
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "tesseract")
    FFMPEG_CMD: str = os.getenv("FFMPEG_CMD", "ffmpeg")

    # Timeouts
    HTTP_TIMEOUT_SECONDS: float = 12.0
    MAX_CONCURRENT_SEARCHES: int = 5

    def ensure_directories(self):
        self.UPLOADS_PATH.mkdir(parents=True, exist_ok=True)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_directories()
