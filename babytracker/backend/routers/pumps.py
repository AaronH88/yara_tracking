from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PumpEvent
from schemas import PumpEventCreate, PumpEventUpdate, PumpEventResponse

router = APIRouter(prefix="/pumps", tags=["pumps"])


@router.get("", response_model=list[PumpEventResponse])
async def list_pumps(
    user_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PumpEvent)
        .order_by(PumpEvent.logged_at.desc())
        .limit(limit)
    )
    if user_id is not None:
        query = query.where(PumpEvent.user_id == user_id)
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("", response_model=PumpEventResponse, status_code=201)
async def create_pump(
    pump_in: PumpEventCreate,
    db: AsyncSession = Depends(get_db),
):
    pump = PumpEvent(**pump_in.model_dump())
    db.add(pump)
    await db.commit()
    await db.refresh(pump)
    return pump


@router.patch("/{pump_id}", response_model=PumpEventResponse)
async def update_pump(
    pump_id: int,
    pump_in: PumpEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    pump = await db.get(PumpEvent, pump_id)
    if not pump:
        raise HTTPException(status_code=404, detail="Pump event not found")
    for field, value in pump_in.model_dump(exclude_unset=True).items():
        setattr(pump, field, value)
    await db.commit()
    await db.refresh(pump)
    return pump


@router.delete("/{pump_id}", status_code=204)
async def delete_pump(
    pump_id: int,
    db: AsyncSession = Depends(get_db),
):
    pump = await db.get(PumpEvent, pump_id)
    if not pump:
        raise HTTPException(status_code=404, detail="Pump event not found")
    await db.delete(pump)
    await db.commit()
