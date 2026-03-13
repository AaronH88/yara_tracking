"""Tests for Task 0.1 — Initialise Project Structure.

Verifies that the directory layout, configuration files, and dependency
declarations match the spec.
"""

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent  # babytracker/
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"


# ── Directory structure ────────────────────────────────────────────────────────

class TestBackendDirectoryStructure:
    """Verify every backend file/directory listed in the spec exists."""

    def test_main_py_exists(self):
        assert (BACKEND / "main.py").is_file()

    def test_database_py_exists(self):
        assert (BACKEND / "database.py").is_file()

    def test_models_py_exists(self):
        assert (BACKEND / "models.py").is_file()

    def test_schemas_py_exists(self):
        assert (BACKEND / "schemas.py").is_file()

    def test_requirements_txt_exists(self):
        assert (BACKEND / "requirements.txt").is_file()

    def test_routers_directory_exists(self):
        assert (BACKEND / "routers").is_dir()

    def test_routers_init_exists(self):
        assert (BACKEND / "routers" / "__init__.py").is_file()

    @pytest.mark.parametrize("router_name", [
        "babies", "users", "feeds", "sleeps", "diapers",
        "pumps", "measurements", "milestones", "calendar", "settings",
    ])
    def test_router_file_exists(self, router_name):
        assert (BACKEND / "routers" / f"{router_name}.py").is_file()


class TestFrontendDirectoryStructure:
    """Verify every frontend file/directory listed in the spec exists."""

    def test_package_json_exists(self):
        assert (FRONTEND / "package.json").is_file()

    def test_vite_config_exists(self):
        assert (FRONTEND / "vite.config.js").is_file()

    def test_tailwind_config_exists(self):
        assert (FRONTEND / "tailwind.config.js").is_file()

    def test_postcss_config_exists(self):
        assert (FRONTEND / "postcss.config.js").is_file()

    def test_index_html_exists(self):
        assert (FRONTEND / "index.html").is_file()

    def test_src_main_jsx_exists(self):
        assert (FRONTEND / "src" / "main.jsx").is_file()

    def test_src_app_jsx_exists(self):
        assert (FRONTEND / "src" / "App.jsx").is_file()

    def test_src_index_css_exists(self):
        assert (FRONTEND / "src" / "index.css").is_file()

    @pytest.mark.parametrize("dirname", [
        "context", "pages", "components", "hooks",
    ])
    def test_src_subdirectory_exists(self, dirname):
        assert (FRONTEND / "src" / dirname).is_dir()


# ── requirements.txt contents ─────────────────────────────────────────────────

class TestRequirementsTxt:
    """Verify requirements.txt contains the expected packages."""

    @pytest.fixture(autouse=True)
    def _read_requirements(self):
        self.text = (BACKEND / "requirements.txt").read_text()

    @pytest.mark.parametrize("package", [
        "fastapi", "uvicorn", "sqlalchemy", "aiosqlite", "pydantic", "python-dateutil",
    ])
    def test_required_package_present(self, package):
        assert package in self.text, f"{package} not found in requirements.txt"

    def test_requirements_txt_is_not_empty(self):
        stripped = self.text.strip()
        assert len(stripped) > 0

    def test_no_duplicate_packages(self):
        lines = [l.strip().split(">=")[0].split("==")[0].split("[")[0]
                 for l in self.text.strip().splitlines() if l.strip()]
        assert len(lines) == len(set(lines)), "Duplicate packages in requirements.txt"


# ── package.json contents ─────────────────────────────────────────────────────

class TestPackageJson:
    """Verify package.json has the expected dependencies."""

    @pytest.fixture(autouse=True)
    def _read_package_json(self):
        import json
        self.pkg = json.loads((FRONTEND / "package.json").read_text())

    @pytest.mark.parametrize("dep", [
        "react", "react-dom", "react-router-dom", "date-fns",
    ])
    def test_runtime_dependency_present(self, dep):
        assert dep in self.pkg.get("dependencies", {}), \
            f"{dep} not in package.json dependencies"

    @pytest.mark.parametrize("dep", [
        "@vitejs/plugin-react", "vite", "tailwindcss", "autoprefixer", "postcss",
    ])
    def test_dev_dependency_present(self, dep):
        assert dep in self.pkg.get("devDependencies", {}), \
            f"{dep} not in package.json devDependencies"


# ── Backend modules can be imported ───────────────────────────────────────────

class TestBackendImports:
    """Verify that all backend modules can be imported without errors."""

    def test_import_database(self):
        import database
        assert hasattr(database, "engine")
        assert hasattr(database, "get_db")

    def test_import_models(self):
        import models
        assert hasattr(models, "Base")

    def test_import_schemas(self):
        import schemas  # noqa: F401 — just verifying no import error

    @pytest.mark.parametrize("router_name", [
        "babies", "users", "feeds", "sleeps", "diapers",
        "pumps", "measurements", "milestones", "calendar", "settings",
    ])
    def test_import_router(self, router_name):
        mod = __import__(f"routers.{router_name}", fromlist=[router_name])
        assert hasattr(mod, "router"), \
            f"routers.{router_name} must export a 'router' object"

    def test_import_main_creates_fastapi_app(self):
        import main
        from fastapi import FastAPI
        assert isinstance(main.app, FastAPI)


# ── pip install succeeds ──────────────────────────────────────────────────────

class TestPipInstall:
    """Verify pip install -r requirements.txt succeeds (dry-run check)."""

    def test_all_required_packages_are_installed(self):
        """Every package in requirements.txt should already be installed."""
        import importlib.metadata
        lines = (BACKEND / "requirements.txt").read_text().strip().splitlines()
        for line in lines:
            pkg = line.strip().split(">=")[0].split("==")[0].split("[")[0]
            if not pkg:
                continue
            # python-dateutil installs as python_dateutil
            dist_name = pkg.replace("-", "_")
            try:
                importlib.metadata.version(dist_name)
            except importlib.metadata.PackageNotFoundError:
                # try original name
                try:
                    importlib.metadata.version(pkg)
                except importlib.metadata.PackageNotFoundError:
                    pytest.fail(f"Package {pkg} is not installed")


# ── npm install succeeds ──────────────────────────────────────────────────────

class TestNpmInstall:
    """Verify npm dependencies were installed (node_modules exists)."""

    def test_node_modules_exists(self):
        assert (FRONTEND / "node_modules").is_dir(), \
            "node_modules directory does not exist — npm install may not have been run"

    def test_node_modules_has_react(self):
        assert (FRONTEND / "node_modules" / "react").is_dir(), \
            "react package not found in node_modules"

    def test_node_modules_has_vite(self):
        assert (FRONTEND / "node_modules" / "vite").is_dir(), \
            "vite package not found in node_modules"

    def test_package_lock_exists(self):
        assert (FRONTEND / "package-lock.json").is_file(), \
            "package-lock.json missing — npm install should generate it"
