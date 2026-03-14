"""Tests for Task 7.1 — LXC Deployment Script.

Verifies that deploy/ artifacts exist, are well-formed, and satisfy
the acceptance criteria: single setup script, service starts on boot,
SQLite path is outside the app directory.
"""

import os
import stat
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # workspace root
DEPLOY = REPO_ROOT / "deploy"


# ── File existence and permissions ───────────────────────────────────────────


class TestDeployFilesExist:
    """All required deployment files must exist."""

    def test_deploy_directory_exists(self):
        assert DEPLOY.is_dir(), "deploy/ directory must exist"

    def test_setup_sh_exists(self):
        assert (DEPLOY / "setup.sh").is_file(), "deploy/setup.sh must exist"

    def test_update_sh_exists(self):
        assert (DEPLOY / "update.sh").is_file(), "deploy/update.sh must exist"

    def test_service_file_exists(self):
        assert (DEPLOY / "babytracker.service").is_file(), \
            "deploy/babytracker.service must exist"


class TestScriptPermissions:
    """Shell scripts must be executable."""

    def test_setup_sh_is_executable(self):
        mode = os.stat(DEPLOY / "setup.sh").st_mode
        assert mode & stat.S_IXUSR, "setup.sh must be executable (u+x)"

    def test_update_sh_is_executable(self):
        mode = os.stat(DEPLOY / "update.sh").st_mode
        assert mode & stat.S_IXUSR, "update.sh must be executable (u+x)"


# ── setup.sh content ────────────────────────────────────────────────────────


class TestSetupScript:
    """Verify setup.sh has all required steps for a fresh LXC setup."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = (DEPLOY / "setup.sh").read_text()

    def test_has_bash_shebang(self):
        assert self.text.startswith("#!/"), "setup.sh must start with a shebang"
        first_line = self.text.splitlines()[0]
        assert "bash" in first_line, "setup.sh should use bash"

    def test_uses_strict_mode(self):
        assert "set -e" in self.text or "set -euo pipefail" in self.text, \
            "setup.sh should use strict error handling (set -e)"

    def test_installs_python(self):
        assert "python3" in self.text, \
            "setup.sh must install python3"

    def test_installs_nodejs(self):
        assert "nodejs" in self.text or "node" in self.text, \
            "setup.sh must install nodejs"

    def test_installs_sqlite(self):
        assert "sqlite3" in self.text or "sqlite" in self.text, \
            "setup.sh must install sqlite3"

    def test_creates_service_user(self):
        assert "useradd" in self.text, \
            "setup.sh must create a service user"

    def test_service_user_has_no_login_shell(self):
        assert "/bin/false" in self.text or "/sbin/nologin" in self.text, \
            "Service user should have no login shell"

    def test_creates_app_directory(self):
        assert "/opt/babytracker" in self.text, \
            "setup.sh must create /opt/babytracker"

    def test_creates_data_directory(self):
        assert "/var/lib/babytracker" in self.text, \
            "setup.sh must create /var/lib/babytracker for the database"

    def test_sets_data_dir_ownership(self):
        assert "chown" in self.text, \
            "setup.sh must chown the data directory to the service user"

    def test_creates_python_virtualenv(self):
        assert "venv" in self.text, \
            "setup.sh must create a Python virtual environment"

    def test_installs_pip_requirements(self):
        assert "requirements.txt" in self.text, \
            "setup.sh must install pip requirements"

    def test_builds_frontend(self):
        assert "npm" in self.text, \
            "setup.sh must build the frontend with npm"

    def test_installs_systemd_service(self):
        assert "systemctl" in self.text, \
            "setup.sh must install the systemd service"

    def test_enables_service_for_boot(self):
        assert "systemctl enable" in self.text, \
            "setup.sh must enable the service to start on boot"

    def test_starts_service(self):
        assert "systemctl start" in self.text, \
            "setup.sh must start the service"

    def test_copies_service_file_to_systemd(self):
        assert "/etc/systemd/system" in self.text, \
            "setup.sh must copy service file to /etc/systemd/system"

    def test_runs_daemon_reload(self):
        assert "daemon-reload" in self.text, \
            "setup.sh must run systemctl daemon-reload after copying the service file"


# ── update.sh content ───────────────────────────────────────────────────────


class TestUpdateScript:
    """Verify update.sh handles subsequent deploys correctly."""

    @pytest.fixture(autouse=True)
    def _read_script(self):
        self.text = (DEPLOY / "update.sh").read_text()

    def test_has_bash_shebang(self):
        assert self.text.startswith("#!/"), "update.sh must start with a shebang"
        first_line = self.text.splitlines()[0]
        assert "bash" in first_line, "update.sh should use bash"

    def test_uses_strict_mode(self):
        assert "set -e" in self.text or "set -euo pipefail" in self.text, \
            "update.sh should use strict error handling (set -e)"

    def test_rebuilds_frontend(self):
        assert "npm" in self.text, \
            "update.sh must rebuild the frontend"

    def test_restarts_service(self):
        assert "systemctl start" in self.text or "systemctl restart" in self.text, \
            "update.sh must restart the service"

    def test_updates_pip_requirements(self):
        assert "requirements.txt" in self.text, \
            "update.sh must update pip requirements"

    def test_copies_updated_code(self):
        assert "rsync" in self.text or "cp " in self.text, \
            "update.sh must copy updated code to /opt/babytracker"

    def test_does_not_create_user(self):
        assert "useradd" not in self.text, \
            "update.sh should not create the service user (setup.sh does that)"


# ── systemd service file ────────────────────────────────────────────────────


class TestSystemdServiceFile:
    """Verify babytracker.service is a well-formed systemd unit."""

    @pytest.fixture(autouse=True)
    def _read_service(self):
        self.text = (DEPLOY / "babytracker.service").read_text()
        self.lines = self.text.splitlines()

    def test_has_unit_section(self):
        assert "[Unit]" in self.text, "Service file must have a [Unit] section"

    def test_has_service_section(self):
        assert "[Service]" in self.text, "Service file must have a [Service] section"

    def test_has_install_section(self):
        assert "[Install]" in self.text, "Service file must have an [Install] section"

    def test_wanted_by_multi_user(self):
        assert "WantedBy=multi-user.target" in self.text, \
            "Service should be wanted by multi-user.target for boot start"

    def test_runs_as_service_user(self):
        assert "User=babytracker" in self.text, \
            "Service must run as the babytracker user"

    def test_exec_start_uses_uvicorn(self):
        assert "uvicorn" in self.text, \
            "Service must start the app using uvicorn"

    def test_exec_start_uses_venv(self):
        assert "/opt/babytracker/venv/" in self.text, \
            "Service must use the virtualenv's uvicorn"

    def test_working_directory_is_backend(self):
        assert "WorkingDirectory=/opt/babytracker/backend" in self.text, \
            "Working directory must be the backend folder"

    def test_database_url_points_to_data_dir(self):
        """Database must be in /var/lib/babytracker, NOT /opt/babytracker."""
        for line in self.lines:
            if "DATABASE_URL" in line:
                assert "/var/lib/babytracker" in line, \
                    "DATABASE_URL must point to /var/lib/babytracker"
                assert "/opt/babytracker" not in line.split("DATABASE_URL")[1], \
                    "Database must NOT be inside the app directory"
                return
        pytest.fail("Service file must define DATABASE_URL environment variable")

    def test_static_dir_is_configured(self):
        """STATIC_DIR should point to the built frontend assets."""
        found = False
        for line in self.lines:
            if "STATIC_DIR" in line:
                found = True
                assert "frontend/dist" in line, \
                    "STATIC_DIR should point to frontend/dist"
        assert found, "Service file should configure STATIC_DIR"

    def test_restart_on_failure(self):
        assert "Restart=" in self.text, \
            "Service should have a restart policy"

    def test_listens_on_port_8000(self):
        assert "8000" in self.text, \
            "Service should listen on port 8000"


# ── Acceptance criteria: database isolation ──────────────────────────────────


class TestDatabaseIsolation:
    """The SQLite database must not be in the app directory.

    This ensures redeployments (which may wipe /opt/babytracker)
    do not destroy user data.
    """

    def test_setup_data_dir_is_separate_from_app_dir(self):
        text = (DEPLOY / "setup.sh").read_text()
        # Both paths should be defined and different
        assert "/var/lib/babytracker" in text, \
            "Data directory must be /var/lib/babytracker"
        assert "/opt/babytracker" in text, \
            "App directory must be /opt/babytracker"

    def test_service_database_not_in_app_dir(self):
        text = (DEPLOY / "babytracker.service").read_text()
        for line in text.splitlines():
            if "DATABASE_URL" in line:
                # Make sure the DB path is under /var/lib, not /opt
                db_path_part = line.split("=", 2)[-1]
                assert "/var/lib/babytracker" in db_path_part
                assert "/opt/babytracker" not in db_path_part
                return
        pytest.fail("DATABASE_URL not found in service file")

    def test_update_script_does_not_touch_data_dir(self):
        """update.sh should not delete or overwrite /var/lib/babytracker."""
        text = (DEPLOY / "update.sh").read_text()
        # If rsync --delete is used, it should target app dirs, not data dirs
        for line in text.splitlines():
            if "rm " in line or "rm -rf" in line:
                assert "/var/lib/babytracker" not in line, \
                    "update.sh must never delete the data directory"
