"""Permisos: EMPLEADO opera Modista/Lavandería, pero no administra sus opciones."""
from __future__ import annotations

from jose import jwt
from pony.orm import db_session, flush

from src.models import (
    Lavanderia,
    Modista,
    Roles,
    Sucursal,
    Usuario,
)
from src.security import ALGORITHM, SECRET_KEY
from tests.factories import seed_base_world


def _token(user_id: int) -> str:
    return jwt.encode(
        {"sub": str(user_id), "type": "access"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def test_empleado_puede_operar_pero_no_administrar_talleres():
    from fastapi.testclient import TestClient
    from main import app

    w = seed_base_world()
    with db_session:
        sucursal = Sucursal[w.sucursal_id]
        empleado = Usuario(
            username=f"emp_taller_{w.usuario_id}",
            email=f"emp_taller_{w.usuario_id}@test.local",
            password="test",
            nombre="Empleado",
            apellido="Taller",
            rol=Roles.EMPLEADO,
            sucursal=sucursal,
        )
        modista = Modista(
            nombre="Modista test permisos",
            direccion="Dirección test",
            telefono="3804000001",
        )
        lavanderia = Lavanderia(
            nombre="Lavandería test permisos",
            direccion="Dirección test",
            telefono="3804000002",
        )
        flush()
        empleado_id = empleado.id
        modista_id = modista.id
        lavanderia_id = lavanderia.id

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {_token(empleado_id)}"}

    # Puede ver las opciones.
    assert client.get("/modistas/all", headers=headers).status_code == 200
    assert client.get("/lavanderia/all", headers=headers).status_code == 200

    # No puede dar de alta, editar ni eliminar opciones.
    body = {"nombre": "No permitido", "direccion": "X", "telefono": "1"}
    assert client.post("/modistas/register", json=body, headers=headers).status_code == 403
    assert client.put(
        f"/modistas/update/{modista_id}", json=body, headers=headers
    ).status_code == 403
    assert client.delete(
        f"/modistas/delete/{modista_id}", headers=headers
    ).status_code == 403
    assert client.post("/lavanderia/register", json=body, headers=headers).status_code == 403
    assert client.put(
        f"/lavanderia/update/{lavanderia_id}", json=body, headers=headers
    ).status_code == 403
    assert client.delete(
        f"/lavanderia/delete/{lavanderia_id}", headers=headers
    ).status_code == 403

    # Sí puede enviar y recibir prendas de Modista.
    asignar_modista = client.post(
        "/modistas/asignar-producto",
        json={"modista_id": modista_id, "producto_id": w.producto_a_id},
        headers=headers,
    )
    assert asignar_modista.status_code == 200
    assert asignar_modista.json()["success"] is True
    productos_modista = client.get(
        f"/modistas/productos?modista_id={modista_id}", headers=headers
    )
    assert productos_modista.status_code == 200
    assert any(
        p["id"] == w.producto_a_id for p in productos_modista.json()["data"]
    )
    assert client.post(
        f"/modistas/regresar-producto/{w.producto_a_id}", headers=headers
    ).status_code == 200

    # Sí puede enviar y recibir prendas de Lavandería.
    asignar_lavanderia = client.post(
        "/lavanderia/asignar-producto",
        json={"lavanderia_id": lavanderia_id, "producto_id": w.producto_b_id},
        headers=headers,
    )
    assert asignar_lavanderia.status_code == 200
    assert asignar_lavanderia.json()["success"] is True
    productos_lavanderia = client.get(
        f"/lavanderia/productos?lavanderia_id={lavanderia_id}", headers=headers
    )
    assert productos_lavanderia.status_code == 200
    assert any(
        p["id"] == w.producto_b_id for p in productos_lavanderia.json()["data"]
    )
    assert client.post(
        f"/lavanderia/regresar-producto/{w.producto_b_id}", headers=headers
    ).status_code == 200

    # La BD completa de pytest es temporal y conftest la elimina al finalizar.
