from sqlalchemy import Boolean, Column, Integer, Text, Float, Date, DateTime, ForeignKey, func

from database import Base


class Baby(Base):
    __tablename__ = "babies"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    birthdate = Column(Date, nullable=False)
    gender = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FeedEvent(Base):
    __tablename__ = "feed_events"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True))
    amount_oz = Column(Float)
    amount_ml = Column(Float)
    paused_seconds = Column(Integer, nullable=False, default=0, server_default="0")
    is_paused = Column(Boolean, nullable=False, default=False, server_default="0")
    paused_at = Column(DateTime(timezone=True))
    quality = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SleepEvent(Base):
    __tablename__ = "sleep_events"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DiaperEvent(Base):
    __tablename__ = "diaper_events"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    logged_at = Column(DateTime(timezone=True), nullable=False)
    type = Column(Text, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PumpEvent(Base):
    __tablename__ = "pump_events"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    logged_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer)
    left_oz = Column(Float)
    left_ml = Column(Float)
    right_oz = Column(Float)
    right_ml = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    measured_at = Column(Date, nullable=False)
    weight_oz = Column(Float)
    height_in = Column(Float)
    head_cm = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    occurred_at = Column(Date, nullable=False)
    title = Column(Text, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Setting(Base):
    __tablename__ = "settings"

    key = Column(Text, primary_key=True)
    value = Column(Text)


async def create_tables():
    from database import engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
