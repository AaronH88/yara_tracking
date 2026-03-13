from pydantic import BaseModel
from datetime import date, datetime


class BabyCreate(BaseModel):
    name: str
    birthdate: date
    gender: str | None = None


class BabyRead(BaseModel):
    id: int
    name: str
    birthdate: date
    gender: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class BabyUpdate(BaseModel):
    name: str | None = None
    birthdate: date | None = None
    gender: str | None = None


class UserCreate(BaseModel):
    name: str


class UserRead(BaseModel):
    id: int
    name: str
    created_at: datetime | None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None


class FeedEventCreate(BaseModel):
    user_id: int
    type: str
    started_at: datetime
    ended_at: datetime | None = None
    amount_oz: float | None = None
    amount_ml: float | None = None
    notes: str | None = None


class FeedEventRead(BaseModel):
    id: int
    baby_id: int
    user_id: int
    type: str
    started_at: datetime
    ended_at: datetime | None
    amount_oz: float | None
    amount_ml: float | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class FeedEventUpdate(BaseModel):
    type: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    amount_oz: float | None = None
    amount_ml: float | None = None
    notes: str | None = None


class SleepEventCreate(BaseModel):
    user_id: int
    type: str
    started_at: datetime
    ended_at: datetime | None = None
    notes: str | None = None


class SleepEventRead(BaseModel):
    id: int
    baby_id: int
    user_id: int
    type: str
    started_at: datetime
    ended_at: datetime | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class SleepEventUpdate(BaseModel):
    type: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes: str | None = None


class DiaperEventCreate(BaseModel):
    user_id: int
    logged_at: datetime
    type: str
    notes: str | None = None


class DiaperEventRead(BaseModel):
    id: int
    baby_id: int
    user_id: int
    logged_at: datetime
    type: str
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class DiaperEventUpdate(BaseModel):
    logged_at: datetime | None = None
    type: str | None = None
    notes: str | None = None


class PumpEventCreate(BaseModel):
    user_id: int
    logged_at: datetime
    duration_minutes: int | None = None
    left_oz: float | None = None
    left_ml: float | None = None
    right_oz: float | None = None
    right_ml: float | None = None
    notes: str | None = None


class PumpEventRead(BaseModel):
    id: int
    user_id: int
    logged_at: datetime
    duration_minutes: int | None
    left_oz: float | None
    left_ml: float | None
    right_oz: float | None
    right_ml: float | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class PumpEventUpdate(BaseModel):
    logged_at: datetime | None = None
    duration_minutes: int | None = None
    left_oz: float | None = None
    left_ml: float | None = None
    right_oz: float | None = None
    right_ml: float | None = None
    notes: str | None = None


class MeasurementCreate(BaseModel):
    user_id: int
    measured_at: date
    weight_oz: float | None = None
    height_in: float | None = None
    head_cm: float | None = None
    notes: str | None = None


class MeasurementRead(BaseModel):
    id: int
    baby_id: int
    user_id: int
    measured_at: date
    weight_oz: float | None
    height_in: float | None
    head_cm: float | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class MeasurementUpdate(BaseModel):
    measured_at: date | None = None
    weight_oz: float | None = None
    height_in: float | None = None
    head_cm: float | None = None
    notes: str | None = None


class MilestoneCreate(BaseModel):
    user_id: int
    occurred_at: date
    title: str
    notes: str | None = None


class MilestoneRead(BaseModel):
    id: int
    baby_id: int
    user_id: int
    occurred_at: date
    title: str
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class MilestoneUpdate(BaseModel):
    occurred_at: date | None = None
    title: str | None = None
    notes: str | None = None


class SettingRead(BaseModel):
    key: str
    value: str | None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    key: str
    value: str | None = None
