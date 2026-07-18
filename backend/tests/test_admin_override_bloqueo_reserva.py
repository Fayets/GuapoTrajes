"""ADMIN puede omitir explícitamente la ventana de seguridad entre reservas."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.models import Presupuesto, Roles, Usuario
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.disponibilidad_services import verificar_disponibilidad
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


R = date(2035, 5, 20)


def _payload(w, *, override: bool) -> PresupuestoCreate:
    return PresupuestoCreate(
        cliente_id=w.cliente_id,
        fecha_evento=R,
        fecha_retiro=R - timedelta(days=4),
        fecha_devolucion=R - timedelta(days=2),
        categoria_evento="Override bloqueo",
        nombre_agasajado="Prueba",
        lugar_evento="Local",
        observaciones="",
        ignorar_conflictos_reserva=override,
        items=[
            ItemPresupuestoIn(
                producto_id=w.producto_a_id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            )
        ],
    )


def _crear_reserva_que_bloquea(w) -> None:
    servicio = PresupuestosServices()
    cu = fake_current_user(w.usuario_id)
    original = PresupuestoCreate(
        cliente_id=w.cliente_id,
        fecha_evento=R + timedelta(days=2),
        fecha_retiro=R,
        fecha_devolucion=R + timedelta(days=5),
        categoria_evento="Reserva original",
        nombre_agasajado="Original",
        lugar_evento="Local",
        observaciones="",
        items=[
            ItemPresupuestoIn(
                producto_id=w.producto_a_id,
                cantidad=1,
                precio_unitario=100.0,
                subtotal=100.0,
            )
        ],
    )
    creado = servicio.crear_presupuesto(original, cu)
    pid = creado["data"]["id"]
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario_id,
        cuenta_destino_id=w.cuenta_destino_id,
    )
    assert verificar_disponibilidad(
        w.producto_a_id,
        R - timedelta(days=4),
        R - timedelta(days=2),
    ) is False


def test_admin_sin_confirmar_sigue_bloqueado():
    w = seed_base_world()
    _crear_reserva_que_bloquea(w)

    with pytest.raises(HTTPException) as exc:
        PresupuestosServices().crear_presupuesto(
            _payload(w, override=False),
            fake_current_user(w.usuario_id),
        )
    assert exc.value.status_code == 400
    assert "conflicto" in exc.value.detail.lower()


def test_admin_puede_omitir_bloqueo_tras_confirmar():
    w = seed_base_world()
    _crear_reserva_que_bloquea(w)

    result = PresupuestosServices().crear_presupuesto(
        _payload(w, override=True),
        fake_current_user(w.usuario_id),
    )
    assert result["success"] is True
    with db_session:
        nuevo = Presupuesto.get(id=result["data"]["id"])
        assert nuevo is not None
        assert any(i.producto.id == w.producto_a_id for i in nuevo.items)


def test_empleado_no_puede_forzar_override_desde_payload():
    w = seed_base_world()
    _crear_reserva_que_bloquea(w)
    with db_session:
        Usuario[w.usuario_id].rol = Roles.EMPLEADO

    with pytest.raises(HTTPException) as exc:
        PresupuestosServices().crear_presupuesto(
            _payload(w, override=True),
            fake_current_user(w.usuario_id),
        )
    assert exc.value.status_code == 403
    assert "administrador" in exc.value.detail.lower()
