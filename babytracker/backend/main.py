from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from database import engine, Base
from routers import (
    babies,
    users,
    feeds,
    sleeps,
    diapers,
    pumps,
    measurements,
    milestones,
    calendar,
    settings,
)

app = FastAPI(title="Baby Tracker")

app.include_router(babies.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(feeds.router, prefix="/api/v1")
app.include_router(sleeps.router, prefix="/api/v1")
app.include_router(diapers.router, prefix="/api/v1")
app.include_router(pumps.router, prefix="/api/v1")
app.include_router(measurements.router, prefix="/api/v1")
app.include_router(milestones.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")

frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")


@app.on_event("startup")
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
