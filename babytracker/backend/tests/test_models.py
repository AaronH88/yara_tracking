import pytest
import pytest_asyncio
from sqlalchemy import inspect, Integer, Text, Float, Date, DateTime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from datetime import date, datetime, timezone

from database import Base
from models import (
    Baby, User, FeedEvent, SleepEvent, DiaperEvent,
    PumpEvent, Measurement, Milestone, Setting, create_tables,
)


# ---------------------------------------------------------------------------
# Fixtures — isolated in-memory database per test
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def test_engine():
    eng = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session(test_engine):
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as sess:
        yield sess


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALL_MODELS = [Baby, User, FeedEvent, SleepEvent, DiaperEvent,
              PumpEvent, Measurement, Milestone, Setting]

EXPECTED_TABLES = [
    "babies", "users", "feed_events", "sleep_events", "diaper_events",
    "pump_events", "measurements", "milestones", "settings",
]


def _col(model, name):
    """Return the Column object for *name* on *model*."""
    return model.__table__.columns[name]


# ---------------------------------------------------------------------------
# Test: all expected model classes exist and are Base subclasses
# ---------------------------------------------------------------------------

class TestModelClassesExist:

    @pytest.mark.parametrize("model", ALL_MODELS, ids=lambda m: m.__name__)
    def test_model_is_base_subclass(self, model):
        assert issubclass(model, Base)

    @pytest.mark.parametrize("model,table", zip(ALL_MODELS, EXPECTED_TABLES),
                             ids=EXPECTED_TABLES)
    def test_tablename(self, model, table):
        assert model.__tablename__ == table


# ---------------------------------------------------------------------------
# Test: create_tables() creates all expected tables
# ---------------------------------------------------------------------------

class TestCreateTables:

    @pytest.mark.asyncio
    async def test_create_tables_creates_all_tables(self):
        eng = create_async_engine("sqlite+aiosqlite://", echo=False)
        # Monkey-patch so create_tables uses our test engine
        import models as models_mod
        import database as db_mod
        original_engine = db_mod.engine
        db_mod.engine = eng
        try:
            await create_tables()
            async with eng.connect() as conn:
                table_names = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_table_names()
                )
            for expected in EXPECTED_TABLES:
                assert expected in table_names, f"Table '{expected}' not created"
        finally:
            db_mod.engine = original_engine
            await eng.dispose()

    @pytest.mark.asyncio
    async def test_create_tables_is_idempotent(self):
        eng = create_async_engine("sqlite+aiosqlite://", echo=False)
        import database as db_mod
        original_engine = db_mod.engine
        db_mod.engine = eng
        try:
            await create_tables()
            await create_tables()  # second call should not raise
            async with eng.connect() as conn:
                table_names = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_table_names()
                )
            assert "babies" in table_names
        finally:
            db_mod.engine = original_engine
            await eng.dispose()


# ---------------------------------------------------------------------------
# Test: DateTime columns use timezone=True
# ---------------------------------------------------------------------------

class TestDateTimeTimezoneAware:

    _TZ_DATETIME_COLS = [
        (Baby, "created_at"),
        (User, "created_at"),
        (FeedEvent, "started_at"),
        (FeedEvent, "ended_at"),
        (FeedEvent, "created_at"),
        (SleepEvent, "started_at"),
        (SleepEvent, "ended_at"),
        (SleepEvent, "created_at"),
        (DiaperEvent, "logged_at"),
        (DiaperEvent, "created_at"),
        (PumpEvent, "logged_at"),
        (PumpEvent, "created_at"),
        (Measurement, "created_at"),
        (Milestone, "created_at"),
    ]

    @pytest.mark.parametrize("model,col_name",
                             _TZ_DATETIME_COLS,
                             ids=[f"{m.__name__}.{c}" for m, c in _TZ_DATETIME_COLS])
    def test_datetime_column_has_timezone(self, model, col_name):
        col = _col(model, col_name)
        assert isinstance(col.type, DateTime), f"{model.__name__}.{col_name} should be DateTime"
        assert col.type.timezone is True, (
            f"{model.__name__}.{col_name} must use DateTime(timezone=True)"
        )


# ---------------------------------------------------------------------------
# Test: created_at columns have server_default
# ---------------------------------------------------------------------------

class TestCreatedAtServerDefault:

    _CREATED_AT_MODELS = [Baby, User, FeedEvent, SleepEvent, DiaperEvent,
                          PumpEvent, Measurement, Milestone]

    @pytest.mark.parametrize("model", _CREATED_AT_MODELS,
                             ids=lambda m: m.__name__)
    def test_created_at_has_server_default(self, model):
        col = _col(model, "created_at")
        assert col.server_default is not None, (
            f"{model.__name__}.created_at must have a server_default"
        )

    @pytest.mark.parametrize("model", _CREATED_AT_MODELS,
                             ids=lambda m: m.__name__)
    def test_created_at_is_nullable_by_default(self, model):
        col = _col(model, "created_at")
        # created_at should be auto-filled, so nullable=True (the default) is fine
        # but it must NOT be required input
        assert col.nullable is not False or col.server_default is not None


# ---------------------------------------------------------------------------
# Test: Setting model has no created_at
# ---------------------------------------------------------------------------

class TestSettingModel:

    def test_setting_has_key_as_primary_key(self):
        col = _col(Setting, "key")
        assert col.primary_key is True

    def test_setting_has_value_column(self):
        assert "value" in Setting.__table__.columns

    def test_setting_has_no_created_at(self):
        assert "created_at" not in Setting.__table__.columns

    def test_setting_key_is_text(self):
        assert isinstance(_col(Setting, "key").type, Text)

    def test_setting_value_is_text(self):
        assert isinstance(_col(Setting, "value").type, Text)


# ---------------------------------------------------------------------------
# Test: Foreign key constraints
# ---------------------------------------------------------------------------

class TestForeignKeys:

    _FK_SPECS = [
        (FeedEvent, "baby_id", "babies.id"),
        (FeedEvent, "user_id", "users.id"),
        (SleepEvent, "baby_id", "babies.id"),
        (SleepEvent, "user_id", "users.id"),
        (DiaperEvent, "baby_id", "babies.id"),
        (DiaperEvent, "user_id", "users.id"),
        (PumpEvent, "user_id", "users.id"),
        (Measurement, "baby_id", "babies.id"),
        (Measurement, "user_id", "users.id"),
        (Milestone, "baby_id", "babies.id"),
        (Milestone, "user_id", "users.id"),
    ]

    @pytest.mark.parametrize("model,col_name,target",
                             _FK_SPECS,
                             ids=[f"{m.__name__}.{c}->{t}" for m, c, t in _FK_SPECS])
    def test_foreign_key_target(self, model, col_name, target):
        col = _col(model, col_name)
        fk_targets = [fk.target_fullname for fk in col.foreign_keys]
        assert target in fk_targets, (
            f"{model.__name__}.{col_name} should reference {target}, got {fk_targets}"
        )


# ---------------------------------------------------------------------------
# Test: nullable constraints on required columns
# ---------------------------------------------------------------------------

class TestNullableConstraints:

    _REQUIRED_COLS = [
        (Baby, "name"),
        (Baby, "birthdate"),
        (User, "name"),
        (FeedEvent, "baby_id"),
        (FeedEvent, "user_id"),
        (FeedEvent, "type"),
        (FeedEvent, "started_at"),
        (SleepEvent, "baby_id"),
        (SleepEvent, "user_id"),
        (SleepEvent, "type"),
        (SleepEvent, "started_at"),
        (DiaperEvent, "baby_id"),
        (DiaperEvent, "user_id"),
        (DiaperEvent, "logged_at"),
        (DiaperEvent, "type"),
        (PumpEvent, "user_id"),
        (PumpEvent, "logged_at"),
        (Measurement, "baby_id"),
        (Measurement, "user_id"),
        (Measurement, "measured_at"),
        (Milestone, "baby_id"),
        (Milestone, "user_id"),
        (Milestone, "occurred_at"),
        (Milestone, "title"),
    ]

    @pytest.mark.parametrize("model,col_name",
                             _REQUIRED_COLS,
                             ids=[f"{m.__name__}.{c}" for m, c in _REQUIRED_COLS])
    def test_required_column_is_not_nullable(self, model, col_name):
        col = _col(model, col_name)
        assert col.nullable is False, (
            f"{model.__name__}.{col_name} must be nullable=False"
        )

    _OPTIONAL_COLS = [
        (Baby, "gender"),
        (FeedEvent, "ended_at"),
        (FeedEvent, "amount_oz"),
        (FeedEvent, "amount_ml"),
        (FeedEvent, "notes"),
        (SleepEvent, "ended_at"),
        (SleepEvent, "notes"),
        (DiaperEvent, "notes"),
        (PumpEvent, "duration_minutes"),
        (PumpEvent, "notes"),
        (Measurement, "weight_oz"),
        (Measurement, "height_in"),
        (Measurement, "head_cm"),
        (Measurement, "notes"),
        (Milestone, "notes"),
    ]

    @pytest.mark.parametrize("model,col_name",
                             _OPTIONAL_COLS,
                             ids=[f"{m.__name__}.{c}" for m, c in _OPTIONAL_COLS])
    def test_optional_column_is_nullable(self, model, col_name):
        col = _col(model, col_name)
        assert col.nullable is True, (
            f"{model.__name__}.{col_name} should be nullable"
        )


# ---------------------------------------------------------------------------
# Test: column types
# ---------------------------------------------------------------------------

class TestColumnTypes:

    _TYPE_SPECS = [
        (Baby, "id", Integer),
        (Baby, "name", Text),
        (Baby, "birthdate", Date),
        (Baby, "gender", Text),
        (User, "id", Integer),
        (User, "name", Text),
        (FeedEvent, "id", Integer),
        (FeedEvent, "type", Text),
        (FeedEvent, "amount_oz", Float),
        (FeedEvent, "amount_ml", Float),
        (FeedEvent, "notes", Text),
        (SleepEvent, "id", Integer),
        (SleepEvent, "type", Text),
        (SleepEvent, "notes", Text),
        (DiaperEvent, "id", Integer),
        (DiaperEvent, "type", Text),
        (DiaperEvent, "notes", Text),
        (PumpEvent, "id", Integer),
        (PumpEvent, "duration_minutes", Integer),
        (PumpEvent, "left_oz", Float),
        (PumpEvent, "left_ml", Float),
        (PumpEvent, "right_oz", Float),
        (PumpEvent, "right_ml", Float),
        (PumpEvent, "notes", Text),
        (Measurement, "id", Integer),
        (Measurement, "measured_at", Date),
        (Measurement, "weight_oz", Float),
        (Measurement, "height_in", Float),
        (Measurement, "head_cm", Float),
        (Measurement, "notes", Text),
        (Milestone, "id", Integer),
        (Milestone, "occurred_at", Date),
        (Milestone, "title", Text),
        (Milestone, "notes", Text),
    ]

    @pytest.mark.parametrize("model,col_name,expected_type",
                             _TYPE_SPECS,
                             ids=[f"{m.__name__}.{c}" for m, c, _ in _TYPE_SPECS])
    def test_column_type(self, model, col_name, expected_type):
        col = _col(model, col_name)
        assert isinstance(col.type, expected_type), (
            f"{model.__name__}.{col_name} should be {expected_type.__name__}, "
            f"got {type(col.type).__name__}"
        )


# ---------------------------------------------------------------------------
# Test: primary keys
# ---------------------------------------------------------------------------

class TestPrimaryKeys:

    @pytest.mark.parametrize("model", [Baby, User, FeedEvent, SleepEvent,
                                        DiaperEvent, PumpEvent, Measurement, Milestone],
                             ids=lambda m: m.__name__)
    def test_id_is_primary_key(self, model):
        col = _col(model, "id")
        assert col.primary_key is True

    def test_setting_key_is_primary_key(self):
        col = _col(Setting, "key")
        assert col.primary_key is True


# ---------------------------------------------------------------------------
# Test: User.name is unique
# ---------------------------------------------------------------------------

class TestUniqueConstraints:

    def test_user_name_is_unique(self):
        col = _col(User, "name")
        assert col.unique is True

    @pytest.mark.asyncio
    async def test_inserting_duplicate_user_name_raises(self, session):
        from sqlalchemy.exc import IntegrityError
        session.add(User(name="Alice"))
        await session.commit()
        session.add(User(name="Alice"))
        with pytest.raises(IntegrityError):
            await session.commit()


# ---------------------------------------------------------------------------
# Test: PumpEvent has no baby_id (pumping is user-only)
# ---------------------------------------------------------------------------

class TestPumpEventNoBabyId:

    def test_pump_event_has_no_baby_id(self):
        assert "baby_id" not in PumpEvent.__table__.columns


# ---------------------------------------------------------------------------
# Test: CRUD round-trip through the database
# ---------------------------------------------------------------------------

class TestDatabaseRoundTrip:

    @pytest.mark.asyncio
    async def test_insert_and_query_baby(self, session):
        baby = Baby(name="TestBaby", birthdate=date(2024, 1, 15), gender="F")
        session.add(baby)
        await session.commit()

        from sqlalchemy import select
        result = await session.execute(select(Baby).where(Baby.name == "TestBaby"))
        fetched = result.scalar_one()
        assert fetched.name == "TestBaby"
        assert fetched.birthdate == date(2024, 1, 15)
        assert fetched.gender == "F"
        assert fetched.id is not None

    @pytest.mark.asyncio
    async def test_insert_feed_event_with_foreign_keys(self, session):
        baby = Baby(name="FeedBaby", birthdate=date(2024, 6, 1))
        user = User(name="FeedUser")
        session.add_all([baby, user])
        await session.commit()

        now = datetime.now(timezone.utc)
        feed = FeedEvent(
            baby_id=baby.id, user_id=user.id,
            type="bottle", started_at=now,
            amount_oz=4.0,
        )
        session.add(feed)
        await session.commit()

        from sqlalchemy import select
        result = await session.execute(select(FeedEvent))
        fetched = result.scalar_one()
        assert fetched.baby_id == baby.id
        assert fetched.user_id == user.id
        assert fetched.type == "bottle"
        assert fetched.amount_oz == 4.0

    @pytest.mark.asyncio
    async def test_insert_setting_round_trip(self, session):
        setting = Setting(key="theme", value="dark")
        session.add(setting)
        await session.commit()

        from sqlalchemy import select
        result = await session.execute(select(Setting).where(Setting.key == "theme"))
        fetched = result.scalar_one()
        assert fetched.value == "dark"

    @pytest.mark.asyncio
    async def test_created_at_auto_populated(self, session):
        baby = Baby(name="AutoTS", birthdate=date(2024, 3, 1))
        session.add(baby)
        await session.commit()

        from sqlalchemy import select
        result = await session.execute(select(Baby).where(Baby.name == "AutoTS"))
        fetched = result.scalar_one()
        assert fetched.created_at is not None
