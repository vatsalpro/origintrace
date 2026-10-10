from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.database.session import engine, Base
from app.api.investigations import router as investigations_router
from app.api.connectors import router as connectors_router
from app.api.benchmark import router as benchmark_router
import app.models.entities  # Ensure models are loaded into Base metadata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("origintrace")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("OriginTrace AI backend ready.")
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Trace the content. Reconstruct the timeline. Verify the evidence.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global safe exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "An internal server error occurred.", "detail": str(exc) if settings.DEBUG else "Please check investigation logs."}
    )

# Include API Routers
app.include_router(investigations_router)
app.include_router(connectors_router)
app.include_router(benchmark_router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tagline": settings.TAGLINE
    }

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "tagline": settings.TAGLINE,
        "docs": "/docs",
        "api_health": "/api/health"
    }
