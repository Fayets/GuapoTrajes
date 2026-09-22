"""GET /productos/get (404 real) y GET /productos/all?q= (búsqueda paginada)."""
from __future__ import annotations

import os
from datetime import date, timedelta

from jose import jwt

os.environ.setdefault("BOOTSTRAP_ADMIN", "false")
os.environ.setdefault("ENV", "test")

from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _token(user_id: int) -> str:
    from src.security import ALGORITHM, SECRET_KEY

    payload = {"sub": str(user_id), "type": "access"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _client():
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


def test_get_producto_por_codigo_inexistente_es_404():
    world = seed_base_world()
    client = _client()
    token = _token(world.usuario.id)
    res = client.get(
        "/productos/get/CODIGO-INEXISTENTE-XYZ",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
    detail = res.json().get("detail")
    assert detail == "Producto no encontrado"


def test_get_producto_por_codigo_existente_es_200():
    world = seed_base_world()
    client = _client()
    token = _token(world.usuario.id)
    res = client.get(
        f"/productos/get/{world.producto_a.codigo_barra}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == world.producto_a.id
    assert body["codigo_barra"] == world.producto_a.codigo_barra


def test_get_producto_por_codigo_sin_token_es_401():
    world = seed_base_world()
    client = _client()
    res = client.get(f"/productos/get/{world.producto_a.codigo_barra}")
    assert res.status_code == 401


def test_productos_all_q_filtra_coincidencias_y_total():
    world = seed_base_world()
    client = _client()
    token = _token(world.usuario.id)
    fragmento = world.producto_a.codigo_barra
    res = client.get(
        "/productos/all",
        params={"q": fragmento, "size": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert 1 <= len(items) <= 30
    ids = {item["id"] for item in items}
    assert world.producto_a.id in ids
    total = int(res.headers.get("X-Total-Count") or 0)
    assert total >= 1
    assert total >= len(items)
    for item in items:
        blob = " ".join(
            str(item.get(k) or "")
            for k in (
                "codigo_barra",
                "descripcion",
                "descripcion_extra",
                "linea_nombre",
                "talle_nombre",
                "tela_nombre",
                "color_nombre",
            )
        ).lower()
        assert fragmento.lower() in blob


def test_productos_all_sin_q_respeta_size_30():
    world = seed_base_world()
    client = _client()
    token = _token(world.usuario.id)
    res = client.get(
        "/productos/all",
        params={"size": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) <= 30


def test_productos_all_q_marca_disponible_en_fechas_false_si_hay_reserva():
    world = seed_base_world()
    retiro = date(2031, 3, 10)
    devolucion = date(2031, 3, 20)
    pres = PresupuestosServices()
    pres.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=world.cliente.id,
            fecha_evento=retiro + timedelta(days=5),
            fecha_retiro=retiro,
            fecha_devolucion=devolucion,
            categoria_evento="Casamiento",
            nombre_agasajado="Reserva Q",
            lugar_evento="Salón",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=world.producto_a.id,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                )
            ],
        ),
        fake_current_user(world.usuario.id),
    )

    client = _client()
    token = _token(world.usuario.id)
    res = client.get(
        "/productos/all",
        params={
            "q": world.producto_a.codigo_barra,
            "size": 30,
            "fecha_retiro": retiro.isoformat(),
            "fecha_devolucion": devolucion.isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    items = res.json()
    match = next(item for item in items if item["id"] == world.producto_a.id)
    assert match["disponible_en_fechas"] is False
