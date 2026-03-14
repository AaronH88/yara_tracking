from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    User, FeedEvent, SleepEvent, DiaperEvent, PumpEvent, Measurement, Milestone,
)
from schemas import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


async def seed_default_users(db: AsyncSession):
    """Create default admin user if no users exist"""
    result = await db.execute(select(User))
    existing_users = result.scalars().all()

    if len(existing_users) == 0:
        admin_user = User(name="Admin")
        db.add(admin_user)
        await db.commit()


@router.get("", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(User))
    return rows.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.name == user_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User with this name already exists")
    user = User(**user_in.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user_in: UserUpdate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in user_in.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    event_tables = [FeedEvent, SleepEvent, DiaperEvent, PumpEvent, Measurement, Milestone]
    for event_model in event_tables:
        has_events = await db.execute(
            select(event_model.id).where(event_model.user_id == user_id).limit(1)
        )
        if has_events.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail="User has logged events and cannot be deleted",
            )

    await db.delete(user)
    await db.commit()
