from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Measurement
from schemas import MeasurementCreate, MeasurementUpdate, MeasurementResponse

router = APIRouter(tags=["measurements"])


@router.get("/babies/{baby_id}/measurements", response_model=list[MeasurementResponse])
async def list_measurements(
    baby_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Measurement)
        .where(Measurement.baby_id == baby_id)
        .order_by(Measurement.measured_at.desc())
        .limit(limit)
    )
    rows = await db.execute(query)
    return rows.scalars().all()


@router.post("/babies/{baby_id}/measurements", response_model=MeasurementResponse, status_code=201)
async def create_measurement(
    baby_id: int,
    measurement_in: MeasurementCreate,
    db: AsyncSession = Depends(get_db),
):
    measurement = Measurement(baby_id=baby_id, **measurement_in.model_dump())
    db.add(measurement)
    await db.commit()
    await db.refresh(measurement)
    return measurement


@router.patch("/babies/{baby_id}/measurements/{measurement_id}", response_model=MeasurementResponse)
async def update_measurement(
    baby_id: int,
    measurement_id: int,
    measurement_in: MeasurementUpdate,
    db: AsyncSession = Depends(get_db),
):
    measurement = await db.get(Measurement, measurement_id)
    if not measurement or measurement.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Measurement not found")
    for field, value in measurement_in.model_dump(exclude_unset=True).items():
        setattr(measurement, field, value)
    await db.commit()
    await db.refresh(measurement)
    return measurement


@router.delete("/babies/{baby_id}/measurements/{measurement_id}", status_code=204)
async def delete_measurement(
    baby_id: int,
    measurement_id: int,
    db: AsyncSession = Depends(get_db),
):
    measurement = await db.get(Measurement, measurement_id)
    if not measurement or measurement.baby_id != baby_id:
        raise HTTPException(status_code=404, detail="Measurement not found")
    await db.delete(measurement)
    await db.commit()
