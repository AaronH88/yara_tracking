import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from database import engine, get_db
from migrations import migrate_feed_event_v2, migrate_diaper_event_v2
from models import create_tables

CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
from routers.settings import seed_settings
from routers.users import seed_default_users
from routers import (
    babies,
    burps,
    calendar,
    diapers,
    feeds,
    measurements,
    milestones,
    pumps,
    settings,
    sleeps,
    users,
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await migrate_feed_event_v2(engine)
    await migrate_diaper_event_v2(engine)
    await create_tables()
    async for db in get_db():
        await seed_settings(db)
        await seed_default_users(db)
    yield


app = FastAPI(title="Baby Tracker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(babies.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(feeds.router, prefix="/api/v1")
app.include_router(sleeps.router, prefix="/api/v1")
app.include_router(burps.router, prefix="/api/v1")
app.include_router(diapers.router, prefix="/api/v1")
app.include_router(pumps.router, prefix="/api/v1")
app.include_router(measurements.router, prefix="/api/v1")
app.include_router(milestones.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    index_html = FRONTEND_DIST / "index.html"
    if index_html.exists():
        return FileResponse(str(index_html))
    return JSONResponse(status_code=404, content={"detail": "Frontend not built yet"})
