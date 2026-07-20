"""Admin puede crear ADMIN; no puede crear ni promover a SUPER_ADMIN."""
import os
import uuid

import pytest
from jose import jwt
from pony.orm import db_session

os.environ.setdefault("BOOTSTRAP_ADMIN", "false")
os.environ.setdefault("ENV", "test")

from src.models import Roles, Sucursal, Usuario
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


def _auth(world):
    return {"Authorization": f"Bearer {_token(world.usuario_id)}"}


def _payload_usuario(world, *, role: str, suf: str | None = None):
    suf = suf or uuid.uuid4().hex[:10]
    return {
        "username": f"u_{role.lower()}_{suf}",
        "email": f"{role.lower()}_{suf}@test.local",
        "password": "secreto123",
        "nombre": "Test",
        "apellido": "User",
        "role": role,
        "sucursal": world.sucursal_id,
    }


def test_crear_admin_ok(client, world):
    res = client.post(
        "/usuarios/create",
        json=_payload_usuario(world, role="ADMIN"),
        headers=_auth(world),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["success"] is True
    assert body["data"]["rol"] == "ADMIN"


def test_crear_empleado_ok(client, world):
    res = client.post(
        "/usuarios/create",
        json=_payload_usuario(world, role="EMPLEADO"),
        headers=_auth(world),
    )
    assert res.status_code == 201, res.text
    assert res.json()["data"]["rol"] == "EMPLEADO"


def test_crear_super_admin_rechazado(client, world):
    res = client.post(
        "/usuarios/create",
        json=_payload_usuario(world, role="SUPER_ADMIN"),
        headers=_auth(world),
    )
    assert res.status_code == 403, res.text
    assert "EMPLEADO" in res.json()["detail"] or "SUPER_ADMIN" in res.json()["detail"]


def test_no_promover_a_super_admin(client, world):
    create = client.post(
        "/usuarios/create",
        json=_payload_usuario(world, role="EMPLEADO"),
        headers=_auth(world),
    )
    assert create.status_code == 201, create.text
    user_id = create.json()["data"]["id"]

    res = client.put(
        f"/usuarios/update/{user_id}",
        json={"role": "SUPER_ADMIN"},
        headers=_auth(world),
    )
    assert res.status_code == 403, res.text


def test_listar_excluye_super_admin(client, world):
    suf = uuid.uuid4().hex[:10]
    with db_session:
        sucursal = Sucursal.get(id=world.sucursal_id)
        Usuario(
            username=f"super_{suf}",
            email=f"super_{suf}@test.local",
            password="x",
            nombre="Super",
            apellido="Admin",
            rol=Roles.SUPER_ADMIN,
            sucursal=sucursal,
        )

    res = client.get("/usuarios/all", headers=_auth(world))
    assert res.status_code == 200, res.text
    roles = {u["rol"] for u in res.json()}
    assert "SUPER_ADMIN" not in roles
    assert "ADMIN" in roles or "EMPLEADO" in roles
