"""
Configuración de pytest: SQLite en archivo temporal y mapeo Pony antes de los tests.
Debe ejecutarse desde el directorio `backend/` o con pythonpath apuntando a él.
"""
import os
import tempfile

_fd, _GUAPO_TEST_SQLITE = tempfile.mkstemp(suffix=".sqlite")
os.close(_fd)

os.environ["DB_PROVIDER"] = "sqlite"
os.environ["DB_NAME"] = _GUAPO_TEST_SQLITE
os.environ.setdefault("SECRET", "pytest_secret_key")
os.environ.setdefault("DB_USER", "")
os.environ.setdefault("DB_PASS", "")
os.environ.setdefault("DB_HOST", "")

import pytest


@pytest.fixture(scope="session", autouse=True)
def pony_db_mapping():
    from src.db import db
    from src import models  # noqa: F401 — registra entidades
    from src.migrations import apply_schema_migrations

    apply_schema_migrations()
    db.generate_mapping(create_tables=True, check_tables=False)
    yield
    try:
        db.disconnect()
    except Exception:
        pass
    path = os.environ.get("DB_NAME", "")
    if path and path != ":memory:" and os.path.isfile(path):
        try:
            os.unlink(path)
        except OSError:
            pass
