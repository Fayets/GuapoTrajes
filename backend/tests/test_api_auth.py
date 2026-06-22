"""Smoke tests HTTP para auth y endpoints de debug eliminados."""
import os

import pytest
from jose import jwt

os.environ.setdefault("BOOTSTRAP_ADMIN", "false")
os.environ.setdefault("ENV", "test")

from tests.factories import seed_base_world


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


@pytest.fixture(scope="module")
def world():
    return seed_base_world()


def _token(user_id: int) -> str:
    from src.security import SECRET_KEY, ALGORITHM

    payload = {"sub": str(user_id), "type": "access"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def test_verify_token_acepta_sub(client, world):
    token = _token(world.usuario.id)
    res = client.post("/auth/verify-token", params={"token": token})
    assert res.status_code == 200
    assert res.json()["message"] == "Token válido"


def test_register_requiere_auth(client):
    res = client.post(
        "/auth/register",
        json={
            "username": "hacker",
            "email": "hack@test.local",
            "password": "x",
            "nombre": "X",
            "apellido": "Y",
            "role": "ADMIN",
            "sucursal": 1,
        },
    )
    assert res.status_code == 401


def test_debug_endpoints_eliminados(client):
    assert client.get("/auth/_debug/header").status_code == 404
    res = client.post("/ordenes/debug-raw", json={"x": 1})
    assert res.status_code in (404, 405)


def test_disponibilidad_requiere_auth(client, world):
    pid = world.producto_a.id
    res = client.get(
        f"/productos/{pid}/disponibilidad",
        params={
            "fecha_retiro": "2025-06-01",
            "fecha_devolucion": "2025-06-05",
        },
    )
    assert res.status_code == 401

    token = _token(world.usuario.id)
    res2 = client.get(
        f"/productos/{pid}/disponibilidad",
        params={
            "fecha_retiro": "2025-06-01",
            "fecha_devolucion": "2025-06-05",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code == 200
    assert "disponible" in res2.json()
