from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Setting

router = APIRouter(prefix="/settings", tags=["settings"])

SETTING_DEFAULTS = {
    "units": "imperial",
    "time_format": "24h",
}


async def seed_settings(db: AsyncSession):
    for key, default_value in SETTING_DEFAULTS.items():
        existing = await db.get(Setting, key)
        if not existing:
            db.add(Setting(key=key, value=default_value))
    await db.commit()


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Setting))
    all_settings = rows.scalars().all()
    return {setting.key: setting.value for setting in all_settings}


@router.patch("")
async def update_settings(
    updates: dict[str, str],
    db: AsyncSession = Depends(get_db),
):
    for key, value in updates.items():
        existing = await db.get(Setting, key)
        if existing:
            existing.value = value
        else:
            db.add(Setting(key=key, value=value))
    await db.commit()
    rows = await db.execute(select(Setting))
    all_settings = rows.scalars().all()
    return {setting.key: setting.value for setting in all_settings}
