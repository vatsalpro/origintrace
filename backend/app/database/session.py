from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings

# For SQLite, enable check_same_thread=False
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# In-Memory SQLite Engine exclusively for Incognito Mode (RAM-only, zero persistence to disk)
incognito_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
IncognitoSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=incognito_engine)

Base = declarative_base()

def init_incognito_tables():
    """Ensures all entity tables exist in the in-memory SQLite engine."""
    import app.models.entities
    Base.metadata.create_all(bind=incognito_engine)

def reset_incognito_db():
    """Drops and recreates all tables in the in-memory SQLite engine, purging all RAM state."""
    import app.models.entities
    Base.metadata.drop_all(bind=incognito_engine)
    Base.metadata.create_all(bind=incognito_engine)

try:
    init_incognito_tables()
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def upgrade_db_schema():
    """
    Ensures newly added columns are present in SQLite tables without dropping existing data.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    columns_to_ensure = {
        "investigations": [
            ("current_stage", "VARCHAR(64) DEFAULT 'created'"),
            ("stage_details", "JSON"),
            ("selected_platforms", "JSON"),
            ("is_incognito", "BOOLEAN DEFAULT 0"),
        ],
        "input_assets": [
            ("thumbnail_path", "VARCHAR(512)"),
            ("mime_type", "VARCHAR(128)"),
            ("camera_make", "VARCHAR(128)"),
            ("camera_model", "VARCHAR(128)"),
            ("software", "VARCHAR(128)"),
            ("capture_time", "VARCHAR(64)"),
            ("gps_info", "JSON"),
            ("icc_profile", "VARCHAR(128)"),
            ("ocr_status", "VARCHAR(64) DEFAULT 'pending'"),
            ("ocr_confidence", "FLOAT"),
            ("c2pa_status", "VARCHAR(64) DEFAULT 'unavailable'"),
            ("c2pa_data", "JSON"),
        ],
        "evidence_records": [
            ("candidate_image_url", "VARCHAR(1024)"),
            ("candidate_thumbnail_path", "VARCHAR(512)"),
            ("candidate_sha256", "VARCHAR(64)"),
            ("candidate_phash", "VARCHAR(64)"),
            ("candidate_dhash", "VARCHAR(64)"),
            ("candidate_width", "INTEGER"),
            ("candidate_height", "INTEGER"),
            ("visual_similarity", "FLOAT"),
            ("text_relevance", "FLOAT"),
            ("source_reliability_score", "FLOAT DEFAULT 0.5"),
            ("metadata_consistency_score", "FLOAT DEFAULT 0.5"),
            ("explanation", "TEXT"),
        ],
        "connector_logs": [
            ("queries_executed", "JSON"),
            ("items_inspected", "INTEGER DEFAULT 0"),
        ]
    }

    with engine.connect() as conn:
        for table, cols in columns_to_ensure.items():
            try:
                result = conn.execute(text(f"PRAGMA table_info({table})"))
                existing_cols = {row[1] for row in result.fetchall()}
                for col_name, col_def in cols:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
                conn.commit()
            except Exception:
                pass

try:
    upgrade_db_schema()
except Exception:
    pass
