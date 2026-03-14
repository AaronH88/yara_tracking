import os
import sys
from pathlib import Path

# Use a local SQLite database for tests instead of the production default
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_babytracker.db")

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
