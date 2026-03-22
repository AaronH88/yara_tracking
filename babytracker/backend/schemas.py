from datetime import date, datetime

from pydantic import BaseModel, Field


class BabyCreate(BaseModel):
    name: str
    birthdate: date
    gender: str | None = None


class BabyUpdate(BaseModel):
    name: str | None = None
    birthdate: date | None = None
    gender: str | None = None


class BabyResponse(BaseModel):
    id: int
    name: str
    birthdate: date
    gender: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str


class UserUpdate(BaseModel):
    name: str | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    created_at: datetime | None

    model_config = {"from_attributes": True}


class FeedEventCreate(BaseModel):
    user_id: int
    type: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: datetime | None = None
    amount_oz: float | None = None
    amount_ml: float | None = None
    paused_seconds: int | None = None
    is_paused: bool | None = None
    paused_at: datetime | None = None
    quality: str | None = None
    notes: str | None = None


class FeedEventUpdate(BaseModel):
    user_id: int | None = None
    type: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    amount_oz: float | None = None
    amount_ml: float | None = None
    paused_seconds: int | None = None
    is_paused: bool | None = None
    paused_at: datetime | None = None
    quality: str | None = None
    notes: str | None = None


class FeedEventResponse(BaseModel):
    id: int
    baby_id: int
    user_id: int
    type: str
    started_at: datetime
    ended_at: datetime | None
    amount_oz: float | None
    amount_ml: float | None
    paused_seconds: int | None
    is_paused: bool | None
    paused_at: datetime | None
    quality: str | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class AutoClosedItem(BaseModel):
    type: str
    id: int
    started_at: str


class FeedEventCreateResponse(FeedEventResponse):
    auto_closed: list[AutoClosedItem] = []


class SleepEventCreate(BaseModel):
    user_id: int
    type: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: datetime | None = None
    notes: str | None = None


class SleepEventUpdate(BaseModel):
    type: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes: str | None = None


class SleepEventResponse(BaseModel):
    id: int
    baby_id: int
    user_id: int
    type: str
    started_at: datetime
    ended_at: datetime | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class SleepEventCreateResponse(SleepEventResponse):
    auto_closed: list[AutoClosedItem] = []


class DiaperEventCreate(BaseModel):
    user_id: int
    logged_at: datetime
    type: str
    wet_amount: str | None = None
    dirty_colour: str | None = None
    notes: str | None = None


class DiaperEventUpdate(BaseModel):
    logged_at: datetime | None = None
    type: str | None = None
    wet_amount: str | None = None
    dirty_colour: str | None = None
    notes: str | None = None


class DiaperEventResponse(BaseModel):
    id: int
    baby_id: int
    user_id: int
    logged_at: datetime
    type: str
    wet_amount: str | None
    dirty_colour: str | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class BurpEventCreate(BaseModel):
    user_id: int | None = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: datetime | None = None
    notes: str | None = None


class BurpEventUpdate(BaseModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes: str | None = None


class BurpEventResponse(BaseModel):
    id: int
    baby_id: int
    user_id: int | None
    started_at: datetime
    ended_at: datetime | None
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class BurpEventCreateResponse(BurpEventResponse):
    auto_closed: list[AutoClosedItem] = []


class PumpEventCreate(BaseModel):
    user_id: int
    logged_at: datetime
    duration_minutes: int | None = None
    left_oz: float | None = None
    left_ml: float | None = None
    right_oz: float | None = None
    right_ml: float | None = None
    notes: str | None = None


class PumpEventUpdate(BaseModel):
    logged_at: datetime | None = None
    duration_minutes: int | None = None
    left_oz: float | None = None
    left_ml: float | None = None
    right_oz: float | None = None
    right_ml: float | None = None
    notes: str | None = None


class PumpEventResponse(BaseModel):
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


class MeasurementCreate(BaseModel):
    user_id: int
    measured_at: date
    weight_oz: float | None = None
    height_in: float | None = None
    head_cm: float | None = None
    notes: str | None = None


class MeasurementUpdate(BaseModel):
    measured_at: date | None = None
    weight_oz: float | None = None
    height_in: float | None = None
    head_cm: float | None = None
    notes: str | None = None


class MeasurementResponse(BaseModel):
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


class MilestoneCreate(BaseModel):
    user_id: int
    occurred_at: date
    title: str
    notes: str | None = None


class MilestoneUpdate(BaseModel):
    occurred_at: date | None = None
    title: str | None = None
    notes: str | None = None


class MilestoneResponse(BaseModel):
    id: int
    baby_id: int
    user_id: int
    occurred_at: date
    title: str
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class SettingResponse(BaseModel):
    key: str
    value: str | None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    key: str
    value: str | None = None
