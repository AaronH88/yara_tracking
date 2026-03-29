from datetime import date, datetime, timezone

from pydantic import BaseModel, Field, ConfigDict, field_serializer


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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


class UserCreate(BaseModel):
    name: str


class UserUpdate(BaseModel):
    name: str | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


class FeedEventCreate(BaseModel):
    user_id: int
    type: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('started_at', 'ended_at', 'paused_at', 'created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        # Ensure timezone-aware and return as ISO string with Z suffix
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


class AutoClosedItem(BaseModel):
    type: str
    id: int
    started_at: str


class FeedEventCreateResponse(FeedEventResponse):
    auto_closed: list[AutoClosedItem] = []


class SleepEventCreate(BaseModel):
    user_id: int
    type: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('started_at', 'ended_at', 'created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('logged_at', 'created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


class BurpEventCreate(BaseModel):
    user_id: int | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('started_at', 'ended_at', 'created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('logged_at', 'created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


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

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


class WakeWindowResponse(BaseModel):
    is_sleeping: bool
    awake_since: datetime | None
    awake_minutes: int
    sleep_started_at: datetime | None

    @field_serializer('awake_since', 'sleep_started_at', when_used='json')
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')


class SettingResponse(BaseModel):
    key: str
    value: str | None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    key: str
    value: str | None = None


class InsightAlert(BaseModel):
    type: str
    message: str


class FeedInsights(BaseModel):
    count_since_midnight: int
    average_per_day_this_week: float


class SleepInsights(BaseModel):
    total_last_24h_minutes: int
    average_per_day_7day_minutes: int
    nap_count_today: int
    longest_night_stretch_minutes: int


class NappyInsights(BaseModel):
    wet_count_today: int
    average_wet_per_day_7day: float
    days_since_dirty: int


class InsightsResponse(BaseModel):
    has_enough_data: bool
    feeds: FeedInsights
    sleep: SleepInsights
    nappies: NappyInsights
    alerts: list[InsightAlert]
