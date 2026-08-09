"""Notas obligatorias al enviar a modista (stock vía API y servicio)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from jose import jwt
from pony.orm import db_session, flush

from src.models import EstadoProducto, Modista, Producto, ProductoModista
from src.security import ALGORITHM, SECRET_KEY
from src.services.modista_services import ModistaServices
from tests.factories import seed_base_world


def _token(user_id: int) -> str:
    return jwt.encode(
        {"sub": str(user_id), "type": "access"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def test_asignar_stock_sin_notas_rechazado_servicio():
    w = seed_base_world()
    with db_session:
        m = Modista(nombre="Mod Pytest Notas", direccion="X", telefono="1")
        flush()
        mid = m.id

    svc = ModistaServices()
    with pytest.raises(HTTPException) as ei:
        svc.asignar_producto(mid, w.producto_a_id, notas=None)
    assert ei.value.status_code == 400
    assert "trabajo" in (ei.value.detail or "").lower()

    with pytest.raises(HTTPException) as ei2:
        svc.asignar_producto(mid, w.producto_a_id, notas="   ")
    assert ei2.value.status_code == 400


def test_asignar_stock_con_notas_ok_servicio():
    w = seed_base_world()
    with db_session:
        m = Modista(nombre="Mod Pytest OK", direccion="X", telefono="2")
        flush()
        mid = m.id

    svc = ModistaServices()
    out = svc.asignar_producto(
        mid, w.producto_a_id, notas="Achicar manga izquierda", usuario_id=w.usuario_id
    )
    assert out["success"] is True

    with db_session:
        p = Producto.get(id=w.producto_a_id)
        assert p.estado == EstadoProducto.MODISTA
        abiertos = [
            pm
            for pm in list(ProductoModista.select())
            if pm.producto.id == w.producto_a_id and pm.fecha_salida is None
        ]
        assert len(abiertos) == 1
        assert abiertos[0].notas == "Achicar manga izquierda"

    svc.regresar_producto_de_modista(w.producto_a_id, w.usuario_id)


def test_asignar_stock_sin_notas_rechazado_api():
    from fastapi.testclient import TestClient
    from main import app

    w = seed_base_world()
    with db_session:
        m = Modista(nombre="Mod API Notas", direccion="X", telefono="3")
        flush()
        mid = m.id

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {_token(w.usuario_id)}"}

    sin_notas = client.post(
        "/modistas/asignar-producto",
        json={"modista_id": mid, "producto_id": w.producto_a_id},
        headers=headers,
    )
    assert sin_notas.status_code == 200
    body = sin_notas.json()
    assert body["success"] is False
    assert "trabajo" in (body.get("message") or "").lower()

    con_notas = client.post(
        "/modistas/asignar-producto",
        json={
            "modista_id": mid,
            "producto_id": w.producto_a_id,
            "notas": "Subir cintura 2 cm",
        },
        headers=headers,
    )
    assert con_notas.status_code == 200
    assert con_notas.json()["success"] is True

    assert (
        client.post(
            f"/modistas/regresar-producto/{w.producto_a_id}", headers=headers
        ).status_code
        == 200
    )
