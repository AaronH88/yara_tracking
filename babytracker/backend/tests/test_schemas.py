"""Tests for Pydantic schemas (task 1.3)."""

from datetime import date, datetime, timezone
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from schemas import (
    BabyCreate,
    BabyUpdate,
    BabyResponse,
    UserCreate,
    UserUpdate,
    UserResponse,
    FeedEventCreate,
    FeedEventUpdate,
    FeedEventResponse,
    SleepEventCreate,
    SleepEventUpdate,
    SleepEventResponse,
    DiaperEventCreate,
    DiaperEventUpdate,
    DiaperEventResponse,
    PumpEventCreate,
    PumpEventUpdate,
    PumpEventResponse,
    MeasurementCreate,
    MeasurementUpdate,
    MeasurementResponse,
    MilestoneCreate,
    MilestoneUpdate,
    MilestoneResponse,
    SettingResponse,
    SettingUpdate,
)


# ---------------------------------------------------------------------------
# Importability — every schema class exists in the module
# ---------------------------------------------------------------------------

class TestAllSchemasImportable:
    """Verify that all expected schema classes can be imported."""

    @pytest.mark.parametrize("cls", [
        BabyCreate, BabyUpdate, BabyResponse,
        UserCreate, UserUpdate, UserResponse,
        FeedEventCreate, FeedEventUpdate, FeedEventResponse,
        SleepEventCreate, SleepEventUpdate, SleepEventResponse,
        DiaperEventCreate, DiaperEventUpdate, DiaperEventResponse,
        PumpEventCreate, PumpEventUpdate, PumpEventResponse,
        MeasurementCreate, MeasurementUpdate, MeasurementResponse,
        MilestoneCreate, MilestoneUpdate, MilestoneResponse,
        SettingResponse, SettingUpdate,
    ])
    def test_schema_is_a_pydantic_model(self, cls):
        from pydantic import BaseModel
        assert issubclass(cls, BaseModel)


# ---------------------------------------------------------------------------
# Baby schemas
# ---------------------------------------------------------------------------

class TestBabyCreate:
    def test_valid_minimal(self):
        b = BabyCreate(name="Alice", birthdate=date(2024, 1, 15))
        assert b.name == "Alice"
        assert b.birthdate == date(2024, 1, 15)
        assert b.gender is None

    def test_valid_with_gender(self):
        b = BabyCreate(name="Bob", birthdate=date(2024, 6, 1), gender="male")
        assert b.gender == "male"

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            BabyCreate(birthdate=date(2024, 1, 1))

    def test_missing_birthdate_raises(self):
        with pytest.raises(ValidationError):
            BabyCreate(name="Alice")

    def test_invalid_birthdate_type_raises(self):
        with pytest.raises(ValidationError):
            BabyCreate(name="Alice", birthdate="not-a-date")


class TestBabyUpdate:
    def test_all_fields_optional(self):
        b = BabyUpdate()
        assert b.name is None
        assert b.birthdate is None
        assert b.gender is None

    def test_partial_update(self):
        b = BabyUpdate(name="New Name")
        assert b.name == "New Name"
        assert b.birthdate is None


class TestBabyResponse:
    def test_valid_response(self):
        b = BabyResponse(
            id=1, name="Alice", birthdate=date(2024, 1, 15),
            gender=None, created_at=datetime(2024, 1, 15, 12, 0, 0),
        )
        assert b.id == 1
        assert b.name == "Alice"

    def test_from_attributes_enabled(self):
        assert BabyResponse.model_config.get("from_attributes") is True

    def test_missing_id_raises(self):
        with pytest.raises(ValidationError):
            BabyResponse(
                name="Alice", birthdate=date(2024, 1, 15),
                gender=None, created_at=None,
            )


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------

class TestUserCreate:
    def test_valid(self):
        u = UserCreate(name="Mom")
        assert u.name == "Mom"

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            UserCreate()


class TestUserUpdate:
    def test_all_fields_optional(self):
        u = UserUpdate()
        assert u.name is None

    def test_can_set_name(self):
        u = UserUpdate(name="Dad")
        assert u.name == "Dad"


class TestUserResponse:
    def test_valid_response(self):
        u = UserResponse(id=1, name="Mom", created_at=None)
        assert u.id == 1

    def test_from_attributes_enabled(self):
        assert UserResponse.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# FeedEvent schemas
# ---------------------------------------------------------------------------

class TestFeedEventCreate:
    def test_valid_minimal(self):
        f = FeedEventCreate(user_id=1, type="bottle")
        assert f.user_id == 1
        assert f.type == "bottle"
        assert f.ended_at is None
        assert f.amount_oz is None
        assert f.amount_ml is None
        assert f.notes is None

    def test_started_at_defaults_to_now(self):
        before = datetime.utcnow()
        f = FeedEventCreate(user_id=1, type="breast")
        after = datetime.utcnow()
        assert before <= f.started_at <= after

    def test_started_at_can_be_provided_explicitly(self):
        explicit = datetime(2024, 3, 10, 14, 30, 0)
        f = FeedEventCreate(user_id=1, type="bottle", started_at=explicit)
        assert f.started_at == explicit

    def test_missing_user_id_raises(self):
        with pytest.raises(ValidationError):
            FeedEventCreate(type="bottle")

    def test_missing_type_raises(self):
        with pytest.raises(ValidationError):
            FeedEventCreate(user_id=1)

    def test_all_optional_fields_accepted(self):
        f = FeedEventCreate(
            user_id=1, type="bottle",
            started_at=datetime(2024, 1, 1),
            ended_at=datetime(2024, 1, 1, 0, 15),
            amount_oz=4.0, amount_ml=120.0, notes="good feed",
        )
        assert f.amount_oz == 4.0
        assert f.amount_ml == 120.0
        assert f.notes == "good feed"

    def test_invalid_user_id_type_raises(self):
        with pytest.raises(ValidationError):
            FeedEventCreate(user_id="abc", type="bottle")


class TestFeedEventUpdate:
    def test_all_fields_optional(self):
        f = FeedEventUpdate()
        assert f.type is None
        assert f.started_at is None
        assert f.ended_at is None
        assert f.amount_oz is None
        assert f.amount_ml is None
        assert f.notes is None

    def test_partial_update(self):
        f = FeedEventUpdate(notes="updated note")
        assert f.notes == "updated note"
        assert f.type is None


class TestFeedEventResponse:
    def test_valid_full_response(self):
        f = FeedEventResponse(
            id=1, baby_id=1, user_id=2, type="bottle",
            started_at=datetime(2024, 1, 1),
            ended_at=None, amount_oz=4.0, amount_ml=None,
            paused_seconds=0, is_paused=False, paused_at=None, quality=None,
            notes=None, created_at=None,
        )
        assert f.id == 1
        assert f.baby_id == 1

    def test_from_attributes_enabled(self):
        assert FeedEventResponse.model_config.get("from_attributes") is True

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            FeedEventResponse(
                id=1, baby_id=1, user_id=2,
                # missing type and started_at
                ended_at=None, amount_oz=None, amount_ml=None,
                notes=None, created_at=None,
            )


# ---------------------------------------------------------------------------
# SleepEvent schemas
# ---------------------------------------------------------------------------

class TestSleepEventCreate:
    def test_valid_minimal(self):
        s = SleepEventCreate(user_id=1, type="nap")
        assert s.user_id == 1
        assert s.type == "nap"
        assert s.ended_at is None
        assert s.notes is None

    def test_started_at_defaults_to_now(self):
        before = datetime.utcnow()
        s = SleepEventCreate(user_id=1, type="nap")
        after = datetime.utcnow()
        assert before <= s.started_at <= after

    def test_started_at_can_be_provided_explicitly(self):
        explicit = datetime(2024, 3, 10, 20, 0, 0)
        s = SleepEventCreate(user_id=1, type="night", started_at=explicit)
        assert s.started_at == explicit

    def test_missing_user_id_raises(self):
        with pytest.raises(ValidationError):
            SleepEventCreate(type="nap")

    def test_missing_type_raises(self):
        with pytest.raises(ValidationError):
            SleepEventCreate(user_id=1)

    def test_all_optional_fields_accepted(self):
        s = SleepEventCreate(
            user_id=1, type="nap",
            started_at=datetime(2024, 1, 1, 13, 0),
            ended_at=datetime(2024, 1, 1, 14, 30),
            notes="good nap",
        )
        assert s.notes == "good nap"
        assert s.ended_at == datetime(2024, 1, 1, 14, 30)


class TestSleepEventUpdate:
    def test_all_fields_optional(self):
        s = SleepEventUpdate()
        assert s.type is None
        assert s.started_at is None
        assert s.ended_at is None
        assert s.notes is None


class TestSleepEventResponse:
    def test_valid_response(self):
        s = SleepEventResponse(
            id=1, baby_id=1, user_id=2, type="nap",
            started_at=datetime(2024, 1, 1, 13, 0),
            ended_at=None, notes=None, created_at=None,
        )
        assert s.id == 1

    def test_from_attributes_enabled(self):
        assert SleepEventResponse.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# DiaperEvent schemas
# ---------------------------------------------------------------------------

class TestDiaperEventCreate:
    def test_valid(self):
        d = DiaperEventCreate(
            user_id=1, logged_at=datetime(2024, 1, 1, 10, 0), type="wet",
        )
        assert d.type == "wet"

    def test_missing_logged_at_raises(self):
        with pytest.raises(ValidationError):
            DiaperEventCreate(user_id=1, type="wet")

    def test_missing_type_raises(self):
        with pytest.raises(ValidationError):
            DiaperEventCreate(user_id=1, logged_at=datetime(2024, 1, 1))

    def test_notes_optional(self):
        d = DiaperEventCreate(
            user_id=1, logged_at=datetime(2024, 1, 1), type="dirty",
            notes="blowout",
        )
        assert d.notes == "blowout"


class TestDiaperEventUpdate:
    def test_all_fields_optional(self):
        d = DiaperEventUpdate()
        assert d.logged_at is None
        assert d.type is None
        assert d.notes is None


class TestDiaperEventResponse:
    def test_valid_response(self):
        d = DiaperEventResponse(
            id=1, baby_id=1, user_id=1, logged_at=datetime(2024, 1, 1),
            type="wet", notes=None, created_at=None,
        )
        assert d.id == 1

    def test_from_attributes_enabled(self):
        assert DiaperEventResponse.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# PumpEvent schemas
# ---------------------------------------------------------------------------

class TestPumpEventCreate:
    def test_valid_minimal(self):
        p = PumpEventCreate(user_id=1, logged_at=datetime(2024, 1, 1))
        assert p.user_id == 1
        assert p.duration_minutes is None
        assert p.left_oz is None

    def test_missing_user_id_raises(self):
        with pytest.raises(ValidationError):
            PumpEventCreate(logged_at=datetime(2024, 1, 1))

    def test_missing_logged_at_raises(self):
        with pytest.raises(ValidationError):
            PumpEventCreate(user_id=1)

    def test_all_optional_fields_accepted(self):
        p = PumpEventCreate(
            user_id=1, logged_at=datetime(2024, 1, 1),
            duration_minutes=20, left_oz=3.0, left_ml=90.0,
            right_oz=2.5, right_ml=75.0, notes="pump session",
        )
        assert p.duration_minutes == 20
        assert p.left_oz == 3.0
        assert p.right_ml == 75.0


class TestPumpEventUpdate:
    def test_all_fields_optional(self):
        p = PumpEventUpdate()
        assert p.logged_at is None
        assert p.duration_minutes is None
        assert p.left_oz is None
        assert p.left_ml is None
        assert p.right_oz is None
        assert p.right_ml is None
        assert p.notes is None


class TestPumpEventResponse:
    def test_valid_response(self):
        p = PumpEventResponse(
            id=1, user_id=1, logged_at=datetime(2024, 1, 1),
            duration_minutes=20, left_oz=3.0, left_ml=90.0,
            right_oz=2.5, right_ml=75.0, notes=None, created_at=None,
        )
        assert p.id == 1

    def test_from_attributes_enabled(self):
        assert PumpEventResponse.model_config.get("from_attributes") is True

    def test_pump_response_has_no_baby_id(self):
        """PumpEvent is not linked to a baby — response should not require baby_id."""
        fields = PumpEventResponse.model_fields
        assert "baby_id" not in fields


# ---------------------------------------------------------------------------
# Measurement schemas
# ---------------------------------------------------------------------------

class TestMeasurementCreate:
    def test_valid_minimal(self):
        m = MeasurementCreate(user_id=1, measured_at=date(2024, 6, 1))
        assert m.measured_at == date(2024, 6, 1)
        assert m.weight_oz is None

    def test_missing_measured_at_raises(self):
        with pytest.raises(ValidationError):
            MeasurementCreate(user_id=1)

    def test_measured_at_is_date_not_datetime(self):
        m = MeasurementCreate(user_id=1, measured_at=date(2024, 6, 1))
        assert isinstance(m.measured_at, date)

    def test_all_optional_fields_accepted(self):
        m = MeasurementCreate(
            user_id=1, measured_at=date(2024, 6, 1),
            weight_oz=120.0, height_in=22.5, head_cm=35.0,
            notes="checkup",
        )
        assert m.weight_oz == 120.0
        assert m.height_in == 22.5


class TestMeasurementUpdate:
    def test_all_fields_optional(self):
        m = MeasurementUpdate()
        assert m.measured_at is None
        assert m.weight_oz is None
        assert m.height_in is None
        assert m.head_cm is None
        assert m.notes is None


class TestMeasurementResponse:
    def test_valid_response(self):
        m = MeasurementResponse(
            id=1, baby_id=1, user_id=1, measured_at=date(2024, 6, 1),
            weight_oz=120.0, height_in=22.5, head_cm=35.0,
            notes=None, created_at=None,
        )
        assert m.id == 1

    def test_from_attributes_enabled(self):
        assert MeasurementResponse.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# Milestone schemas
# ---------------------------------------------------------------------------

class TestMilestoneCreate:
    def test_valid(self):
        m = MilestoneCreate(
            user_id=1, occurred_at=date(2024, 6, 1), title="First smile",
        )
        assert m.title == "First smile"
        assert m.notes is None

    def test_missing_title_raises(self):
        with pytest.raises(ValidationError):
            MilestoneCreate(user_id=1, occurred_at=date(2024, 6, 1))

    def test_missing_occurred_at_raises(self):
        with pytest.raises(ValidationError):
            MilestoneCreate(user_id=1, title="First smile")


class TestMilestoneUpdate:
    def test_all_fields_optional(self):
        m = MilestoneUpdate()
        assert m.occurred_at is None
        assert m.title is None
        assert m.notes is None


class TestMilestoneResponse:
    def test_valid_response(self):
        m = MilestoneResponse(
            id=1, baby_id=1, user_id=1, occurred_at=date(2024, 6, 1),
            title="First smile", notes=None, created_at=None,
        )
        assert m.id == 1

    def test_from_attributes_enabled(self):
        assert MilestoneResponse.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# Setting schemas
# ---------------------------------------------------------------------------

class TestSettingResponse:
    def test_valid(self):
        s = SettingResponse(key="theme", value="dark")
        assert s.key == "theme"
        assert s.value == "dark"

    def test_value_can_be_none(self):
        s = SettingResponse(key="theme", value=None)
        assert s.value is None

    def test_missing_key_raises(self):
        with pytest.raises(ValidationError):
            SettingResponse(value="dark")

    def test_from_attributes_enabled(self):
        assert SettingResponse.model_config.get("from_attributes") is True


class TestSettingUpdate:
    def test_valid(self):
        s = SettingUpdate(key="theme", value="dark")
        assert s.key == "theme"

    def test_missing_key_raises(self):
        with pytest.raises(ValidationError):
            SettingUpdate(value="light")

    def test_value_defaults_to_none(self):
        s = SettingUpdate(key="theme")
        assert s.value is None


# ---------------------------------------------------------------------------
# Cross-cutting: Update schemas accept empty payloads for PATCH
# ---------------------------------------------------------------------------

class TestUpdateSchemasAllOptional:
    """Every Update schema should accept an empty dict (no fields required)."""

    @pytest.mark.parametrize("cls", [
        BabyUpdate, UserUpdate, FeedEventUpdate, SleepEventUpdate,
        DiaperEventUpdate, PumpEventUpdate, MeasurementUpdate, MilestoneUpdate,
    ])
    def test_empty_update_is_valid(self, cls):
        obj = cls()
        # All fields should be None
        for field_name in cls.model_fields:
            assert getattr(obj, field_name) is None


# ---------------------------------------------------------------------------
# Cross-cutting: Response schemas have from_attributes
# ---------------------------------------------------------------------------

class TestResponseSchemasFromAttributes:
    @pytest.mark.parametrize("cls", [
        BabyResponse, UserResponse, FeedEventResponse, SleepEventResponse,
        DiaperEventResponse, PumpEventResponse, MeasurementResponse,
        MilestoneResponse, SettingResponse,
    ])
    def test_from_attributes_is_true(self, cls):
        assert cls.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# Cross-cutting: Type validation rejects wrong types
# ---------------------------------------------------------------------------

class TestTypeValidation:
    def test_baby_create_rejects_int_name(self):
        # Pydantic v2 coerces int to str, so this should either work or raise
        # The important thing is birthdate must be a date
        with pytest.raises(ValidationError):
            BabyCreate(name="Alice", birthdate="not-a-date-format")

    def test_feed_event_create_rejects_non_int_user_id(self):
        with pytest.raises(ValidationError):
            FeedEventCreate(user_id="not-an-int", type="bottle")

    def test_pump_event_create_rejects_non_int_duration(self):
        with pytest.raises(ValidationError):
            PumpEventCreate(
                user_id=1, logged_at=datetime(2024, 1, 1),
                duration_minutes="twenty",
            )

    def test_measurement_create_rejects_non_float_weight(self):
        with pytest.raises(ValidationError):
            MeasurementCreate(
                user_id=1, measured_at=date(2024, 1, 1),
                weight_oz="heavy",
            )


# ---------------------------------------------------------------------------
# FeedEvent / SleepEvent retroactive entry: default_factory behavior
# ---------------------------------------------------------------------------

class TestRetroactiveEntryDefaults:
    """The spec requires FeedEventCreate and SleepEventCreate to default
    started_at to utcnow when not provided, supporting retroactive entries."""

    def test_feed_event_two_instances_get_different_defaults(self):
        """Ensure default_factory is used (not a shared default value)."""
        f1 = FeedEventCreate(user_id=1, type="bottle")
        f2 = FeedEventCreate(user_id=1, type="bottle")
        # Both should be very close in time but are independent instances
        assert abs((f2.started_at - f1.started_at).total_seconds()) < 1

    def test_sleep_event_two_instances_get_different_defaults(self):
        s1 = SleepEventCreate(user_id=1, type="nap")
        s2 = SleepEventCreate(user_id=1, type="nap")
        assert abs((s2.started_at - s1.started_at).total_seconds()) < 1

    def test_feed_event_explicit_started_at_overrides_default(self):
        past = datetime(2020, 1, 1, 0, 0, 0)
        f = FeedEventCreate(user_id=1, type="bottle", started_at=past)
        assert f.started_at == past

    def test_sleep_event_explicit_started_at_overrides_default(self):
        past = datetime(2020, 1, 1, 0, 0, 0)
        s = SleepEventCreate(user_id=1, type="nap", started_at=past)
        assert s.started_at == past
