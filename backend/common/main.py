"""
FastAPI Main Application - CyberQuote
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common.config import get_settings
from common.db.database import engine
from common.db.models import Base

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    # Create tables (for development)
    if settings.app.environment == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Shutdown
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.app.name,
    description=settings.app.description,
    version=settings.app.version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# ROUTES
# =============================================================================

@app.get("/")
async def root():
    return {
        "name": settings.app.name,
        "version": settings.app.version,
        "status": "healthy",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Import and include routers
from api.v1 import auth, analytics, alerts, outlets, ml, notifications, ingestion

app.include_router(auth.router, prefix=f"{settings.app.api_prefix}/auth", tags=["auth"])
app.include_router(outlets.router, prefix=f"{settings.app.api_prefix}/outlets", tags=["outlets"])
app.include_router(analytics.router, prefix=f"{settings.app.api_prefix}/analytics", tags=["analytics"])
app.include_router(alerts.router, prefix=f"{settings.app.api_prefix}/alerts", tags=["alerts"])
app.include_router(ml.router, prefix=f"{settings.app.api_prefix}/ml", tags=["ml"])
app.include_router(notifications.router, prefix=f"{settings.app.api_prefix}/notifications", tags=["notifications"])
app.include_router(ingestion.router, prefix=f"{settings.app.api_prefix}/ingestion", tags=["ingestion"])
