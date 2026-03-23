#!/usr/bin/env python3
"""
Migration script for Baby Tracker v1 -> v2

This script safely migrates the production database schema to v2.
Run this AFTER backing up your database and testing on a copy.

Usage:
    python migrate_v2.py /path/to/db.sqlite
"""

import sys
import sqlite3
from pathlib import Path


def check_column_exists(cursor, table, column):
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def check_table_exists(cursor, table):
    """Check if a table exists"""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cursor.fetchone() is not None


def migrate_database(db_path):
    """Apply all v2 migrations"""
    print(f"Migrating database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")

        print("\n=== Checking schema ===")

        # Add new columns to feed_events
        if not check_column_exists(cursor, "feed_events", "paused_seconds"):
            print("Adding feed_events.paused_seconds...")
            cursor.execute(
                "ALTER TABLE feed_events ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0"
            )
        else:
            print("✓ feed_events.paused_seconds exists")

        if not check_column_exists(cursor, "feed_events", "is_paused"):
            print("Adding feed_events.is_paused...")
            cursor.execute(
                "ALTER TABLE feed_events ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT 0"
            )
        else:
            print("✓ feed_events.is_paused exists")

        if not check_column_exists(cursor, "feed_events", "paused_at"):
            print("Adding feed_events.paused_at...")
            cursor.execute(
                "ALTER TABLE feed_events ADD COLUMN paused_at DATETIME"
            )
        else:
            print("✓ feed_events.paused_at exists")

        if not check_column_exists(cursor, "feed_events", "quality"):
            print("Adding feed_events.quality...")
            cursor.execute(
                "ALTER TABLE feed_events ADD COLUMN quality TEXT"
            )
        else:
            print("✓ feed_events.quality exists")

        # Add new columns to diaper_events
        if not check_column_exists(cursor, "diaper_events", "wet_amount"):
            print("Adding diaper_events.wet_amount...")
            cursor.execute(
                "ALTER TABLE diaper_events ADD COLUMN wet_amount TEXT"
            )
        else:
            print("✓ diaper_events.wet_amount exists")

        if not check_column_exists(cursor, "diaper_events", "dirty_colour"):
            print("Adding diaper_events.dirty_colour...")
            cursor.execute(
                "ALTER TABLE diaper_events ADD COLUMN dirty_colour TEXT"
            )
        else:
            print("✓ diaper_events.dirty_colour exists")

        # Create new tables (burp_events, measurements, milestones, settings)
        # These will be created by create_all() but we can verify them
        if not check_table_exists(cursor, "burp_events"):
            print("Creating burp_events table...")
            cursor.execute("""
                CREATE TABLE burp_events (
                    id INTEGER PRIMARY KEY,
                    baby_id INTEGER NOT NULL,
                    user_id INTEGER,
                    started_at DATETIME NOT NULL,
                    ended_at DATETIME,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (baby_id) REFERENCES babies(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
        else:
            print("✓ burp_events table exists")

        if not check_table_exists(cursor, "measurements"):
            print("Creating measurements table...")
            cursor.execute("""
                CREATE TABLE measurements (
                    id INTEGER PRIMARY KEY,
                    baby_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    measured_at DATE NOT NULL,
                    weight_oz REAL,
                    height_in REAL,
                    head_cm REAL,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (baby_id) REFERENCES babies(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
        else:
            print("✓ measurements table exists")

        if not check_table_exists(cursor, "milestones"):
            print("Creating milestones table...")
            cursor.execute("""
                CREATE TABLE milestones (
                    id INTEGER PRIMARY KEY,
                    baby_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    occurred_at DATE NOT NULL,
                    title TEXT NOT NULL,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (baby_id) REFERENCES babies(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
        else:
            print("✓ milestones table exists")

        if not check_table_exists(cursor, "settings"):
            print("Creating settings table...")
            cursor.execute("""
                CREATE TABLE settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
        else:
            print("✓ settings table exists")

        # Commit all changes
        conn.commit()
        print("\n✅ Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python migrate_v2.py /path/to/db.sqlite")
        sys.exit(1)

    db_path = Path(sys.argv[1])

    if not db_path.exists():
        print(f"Error: Database file not found: {db_path}")
        sys.exit(1)

    # Confirm before proceeding
    print("⚠️  WARNING: This will modify your database.")
    print("   Make sure you have a backup before proceeding!")
    response = input("\nContinue? (yes/no): ")

    if response.lower() != "yes":
        print("Migration cancelled.")
        sys.exit(0)

    migrate_database(db_path)
