from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Baby
from schemas import BabyCreate, BabyUpdate, BabyResponse

router = APIRouter(prefix="/babies", tags=["babies"])


@router.get("", response_model=list[BabyResponse])
async def list_babies(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Baby))
    return rows.scalars().all()


@router.post("", response_model=BabyResponse, status_code=201)
async def create_baby(baby_in: BabyCreate, db: AsyncSession = Depends(get_db)):
    baby = Baby(**baby_in.model_dump())
    db.add(baby)
    await db.commit()
    await db.refresh(baby)
    return baby


@router.get("/{baby_id}", response_model=BabyResponse)
async def get_baby(baby_id: int, db: AsyncSession = Depends(get_db)):
    baby = await db.get(Baby, baby_id)
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    return baby


@router.patch("/{baby_id}", response_model=BabyResponse)
async def update_baby(baby_id: int, baby_in: BabyUpdate, db: AsyncSession = Depends(get_db)):
    baby = await db.get(Baby, baby_id)
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    for field, value in baby_in.model_dump(exclude_unset=True).items():
        setattr(baby, field, value)
    await db.commit()
    await db.refresh(baby)
    return baby
