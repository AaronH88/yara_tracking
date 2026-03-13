from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from pathlib import Path

DATABASE_DIR = Path("/var/lib/babytracker")
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_DIR / 'db.sqlite'}"

# Fall back to local db for development
if not DATABASE_DIR.exists():
    DATABASE_URL = "sqlite+aiosqlite:///./db.sqlite"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session
