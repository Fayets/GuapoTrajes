"""El admin cambia la ventana de bloqueo para todo el local."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from jose import jwt
from pony.orm import db_session

from src.models import ConfiguracionSistema, Roles, Usuario
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.disponibilidad_services import (
    explicacion_ventana_seguridad,
    guardar_dias_ventana_seguridad,
    verificar_disponibilidad,
)
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world

R = date(2032, 4, 10)


def _limpiar_config() -> None:
    with db_session:
        for fila in list(ConfiguracionSistema.select()):
            fila.delete()


@pytest.fixture
def mundo():
    _limpiar_config()
    w = seed_base_world()
    yield w
    _limpiar_config()


def _reservar(w) -> int:
    creado = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=5),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=12),
            categoria_evento="Casamiento",
            nombre_agasajado="Ventana",
            lugar_evento="Salón",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
                    cantidad=1,
                    precio_unitario=100.0,
                    subtotal=100.0,
                )
            ],
        ),
        fake_current_user(w.usuario.id),
    )
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=creado["data"]["id"],
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    return w.producto_a.id


def test_sin_ajuste_la_ventana_sigue_en_dos_dias(mundo):
    pid = _reservar(mundo)
    # R-3 queda afuera de una ventana de 2 días.
    assert verificar_disponibilidad(pid, R - timedelta(days=5), R - timedelta(days=3)) is True
    # R-2 ya entra en la ventana.
    assert verificar_disponibilidad(pid, R - timedelta(days=4), R - timedelta(days=2)) is False


def test_cambiar_la_ventana_mueve_el_bloqueo_de_todas_las_reservas(mundo):
    pid = _reservar(mundo)
    guardar_dias_ventana_seguridad(4)
    # Con 4 días, un alquiler que termina en R-3 ahora choca.
    assert verificar_disponibilidad(pid, R - timedelta(days=6), R - timedelta(days=3)) is False
    # R-5 sigue libre: la ventana nueva empieza en R-4.
    assert verificar_disponibilidad(pid, R - timedelta(days=8), R - timedelta(days=5)) is True


def test_la_explicacion_dice_de_donde_sale_cada_fecha():
    texto = explicacion_ventana_seguridad(2)
    assert "fecha de retiro" in texto["inicio"]
    assert "fecha del evento" in texto["inicio"]
    assert "fecha de devolución" in texto["fin"]
    assert "limpieza" in texto["fin"]
    assert "fecha del evento" in texto["fin"]
    assert "seña" in texto["reservado_hoy"]


def test_rechaza_un_margen_fuera_de_rango():
    with pytest.raises(HTTPException) as exc:
        guardar_dias_ventana_seguridad(31)
    assert exc.value.status_code == 400


def _token(user_id: int) -> str:
    from src.security import ALGORITHM, SECRET_KEY

    return jwt.encode({"sub": str(user_id)}, SECRET_KEY, algorithm=ALGORITHM)


def test_solo_admin_puede_guardar_la_ventana_por_api(mundo):
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    token_admin = _token(mundo.usuario.id)
    res = client.put(
        "/config/ventana-seguridad",
        json={"dias": 3},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert res.status_code == 200
    cuerpo = res.json()
    assert cuerpo["dias"] == 3
    assert "fecha de retiro" in cuerpo["inicio"]
    assert "fecha de devolución" in cuerpo["fin"]

    with db_session:
        Usuario[mundo.usuario.id].rol = Roles.EMPLEADO
    res_empleado = client.put(
        "/config/ventana-seguridad",
        json={"dias": 1},
        headers={"Authorization": f"Bearer {_token(mundo.usuario.id)}"},
    )
    assert res_empleado.status_code == 403
    lectura = client.get(
        "/config/ventana-seguridad",
        headers={"Authorization": f"Bearer {_token(mundo.usuario.id)}"},
    )
    assert lectura.status_code == 200
    assert lectura.json()["dias"] == 3
