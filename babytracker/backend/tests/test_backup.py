"""Tests for Task 7.3 — Basic Backup Script.

Verifies that deploy/backup.sh exists, is well-formed, and satisfies
the acceptance criteria: creates a timestamped SQLite backup using
sqlite3 .backup, prunes old backups beyond a retention limit, and
documents cron usage.
"""

import os
import stat
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # workspace root
BACKUP_SCRIPT = REPO_ROOT / "deploy" / "backup.sh"


# ── File existence and permissions ───────────────────────────────────────────


class TestBackupScriptExists:
    """backup.sh must exist and be executable."""

    def test_backup_sh_exists(self):
        assert BACKUP_SCRIPT.is_file(), "deploy/backup.sh must exist"

    def test_backup_sh_is_executable(self):
        mode = os.stat(BACKUP_SCRIPT).st_mode
        assert mode & stat.S_IXUSR, "backup.sh must be executable (u+x)"


# ── Script structure ─────────────────────────────────────────────────────────


class TestBackupScriptStructure:
    """Verify backup.sh has required structural elements."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = BACKUP_SCRIPT.read_text()
        self.lines = self.text.splitlines()

    def test_has_bash_shebang(self):
        assert self.text.startswith("#!/"), "backup.sh must start with a shebang"
        first_line = self.lines[0]
        assert "bash" in first_line, "backup.sh should use bash"

    def test_uses_strict_mode(self):
        assert "set -e" in self.text or "set -euo pipefail" in self.text, \
            "backup.sh should use strict error handling"

    def test_is_not_empty(self):
        stripped = self.text.strip()
        # More than just a shebang
        assert len(stripped.splitlines()) > 3, \
            "backup.sh should contain meaningful content beyond the shebang"


# ── Backup directory ─────────────────────────────────────────────────────────


class TestBackupDirectory:
    """Verify the script creates/uses the correct backup directory."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = BACKUP_SCRIPT.read_text()

    def test_uses_backup_directory(self):
        assert "/var/lib/babytracker/backups" in self.text, \
            "backup.sh must use /var/lib/babytracker/backups as the backup directory"

    def test_creates_backup_directory(self):
        assert "mkdir -p" in self.text, \
            "backup.sh must create the backup directory with mkdir -p"


# ── SQLite backup method ────────────────────────────────────────────────────


class TestSqliteBackup:
    """Verify the script uses sqlite3 .backup for a consistent copy."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = BACKUP_SCRIPT.read_text()

    def test_uses_sqlite3_command(self):
        assert "sqlite3" in self.text, \
            "backup.sh must use the sqlite3 command"

    def test_uses_dot_backup(self):
        assert ".backup" in self.text, \
            "backup.sh must use sqlite3 .backup for a safe, consistent backup"

    def test_does_not_use_raw_cp(self):
        """Using cp on a live SQLite database can cause corruption."""
        for line in self.text.splitlines():
            stripped = line.strip()
            # Skip comments
            if stripped.startswith("#"):
                continue
            # Check active lines don't use cp to copy the database
            if stripped.startswith("cp ") and "sqlite" in stripped.lower():
                pytest.fail(
                    "backup.sh should not use cp to copy the SQLite database; "
                    "use sqlite3 .backup instead"
                )

    def test_source_database_path(self):
        assert "/var/lib/babytracker/db.sqlite" in self.text, \
            "backup.sh must reference the production database at /var/lib/babytracker/db.sqlite"


# ── Timestamped backup filename ──────────────────────────────────────────────


class TestTimestampedBackup:
    """Backup files must include a timestamp for uniqueness."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = BACKUP_SCRIPT.read_text()

    def test_backup_filename_has_timestamp(self):
        """The backup filename should include a date/time format string."""
        assert "date" in self.text, \
            "backup.sh must use the date command for timestamped filenames"

    def test_backup_filename_has_date_format(self):
        """The date format should include at least year, month, day."""
        assert "%Y" in self.text, "Timestamp should include year (%Y)"
        assert "%m" in self.text, "Timestamp should include month (%m)"
        assert "%d" in self.text, "Timestamp should include day (%d)"

    def test_backup_filename_has_time_format(self):
        """The date format should include time components for sub-daily backups."""
        assert "%H" in self.text, "Timestamp should include hour (%H)"
        assert "%M" in self.text, "Timestamp should include minute (%M)"
        assert "%S" in self.text, "Timestamp should include second (%S)"

    def test_backup_extension_is_sqlite(self):
        """Backup files should have .sqlite extension."""
        # Check that .backup writes to a file ending in .sqlite
        assert ".sqlite" in self.text, \
            "Backup files should have a .sqlite extension"


# ── Backup pruning / retention ───────────────────────────────────────────────


class TestBackupPruning:
    """Old backups beyond the retention limit must be removed."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = BACKUP_SCRIPT.read_text()

    def test_prunes_old_backups(self):
        """Script must have logic to remove old backups."""
        has_rm = "rm" in self.text
        has_tail = "tail" in self.text
        assert has_rm and has_tail, \
            "backup.sh must prune old backups using tail + rm (or similar)"

    def test_sorts_by_time(self):
        """Must sort backups by time to prune the oldest."""
        assert "ls -t" in self.text or "ls -1t" in self.text, \
            "backup.sh must sort backups by modification time (ls -t)"

    def test_retention_limit_is_defined(self):
        """Backup retention limit must be defined and reasonable."""
        import re
        # Check for a literal tail -n +N or a variable-based expression
        literal_match = re.search(r'tail\s+-n\s+\+(\d+)', self.text)
        variable_match = re.search(r'tail\s+-n\s+\+\$', self.text)
        assert literal_match or variable_match, \
            "backup.sh must use tail -n +N to select backups beyond the retention limit"

        # If a variable is used, look for the retention count assignment
        if variable_match:
            count_match = re.search(r'MAX_BACKUPS\s*=\s*(\d+)', self.text)
            assert count_match, \
                "If using a variable for retention, it must be assigned a numeric value"
            keep_count = int(count_match.group(1))
        else:
            keep_count = int(literal_match.group(1)) - 1

        assert keep_count >= 7, \
            f"Should keep at least 7 backups, but keeps {keep_count}"
        assert keep_count <= 365, \
            f"Keeping {keep_count} backups seems excessive"

    def test_uses_xargs_for_safe_rm(self):
        """Should use xargs -r to avoid running rm with no arguments."""
        assert "xargs" in self.text, \
            "backup.sh should use xargs to safely pass files to rm"
        assert "xargs -r" in self.text, \
            "backup.sh should use xargs -r to avoid running rm with no arguments"


# ── Cron documentation ───────────────────────────────────────────────────────


class TestCronDocumentation:
    """Script should document how to set up a cron job."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = BACKUP_SCRIPT.read_text()

    def test_mentions_cron(self):
        assert "cron" in self.text.lower(), \
            "backup.sh must document how to add it to cron"

    def test_shows_cron_schedule(self):
        """Should include an example cron schedule line."""
        # A cron entry looks like: 0 2 * * * /path/to/script
        import re
        cron_pattern = re.compile(r'#.*\d+\s+\d+\s+\*\s+\*\s+\*')
        assert cron_pattern.search(self.text), \
            "backup.sh should include an example cron schedule (e.g., '0 2 * * *')"

    def test_cron_example_references_script(self):
        """The cron example should reference the backup script itself."""
        for line in self.text.splitlines():
            if "cron" in line.lower() or ("* *" in line and "backup" in line):
                if "backup.sh" in line:
                    return
        pytest.fail("Cron example should reference backup.sh")
