from sqlalchemy import Column, Integer, Text, Real, Date, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone


class Base(DeclarativeBase):
    pass


class Baby(Base):
    __tablename__ = "babies"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    birthdate = Column(Date, nullable=False)
    gender = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FeedEvent(Base):
    __tablename__ = "feed_events"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Text, nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    amount_oz = Column(Real)
    amount_ml = Column(Real)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SleepEvent(Base):
    __tablename__ = "sleep_events"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Text, nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DiaperEvent(Base):
    __tablename__ = "diaper_events"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    logged_at = Column(DateTime, nullable=False)
    type = Column(Text, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PumpEvent(Base):
    __tablename__ = "pump_events"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    logged_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer)
    left_oz = Column(Real)
    left_ml = Column(Real)
    right_oz = Column(Real)
    right_ml = Column(Real)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    measured_at = Column(Date, nullable=False)
    weight_oz = Column(Real)
    height_in = Column(Real)
    head_cm = Column(Real)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    occurred_at = Column(Date, nullable=False)
    title = Column(Text, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Setting(Base):
    __tablename__ = "settings"

    key = Column(Text, primary_key=True)
    value = Column(Text)
