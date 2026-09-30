"""Imprimir la etiqueta grande marca el conjunto como separado."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.models import OrdenTrabajo, Presupuesto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


def _crear_orden():
    w = seed_base_world()
    R = date(2036, 2, 2)
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R,
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=3),
            categoria_evento="Casamiento",
            nombre_agasajado="Separado",
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
    pid = out["data"]["id"]
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=50.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        orden_id = Presupuesto.get(id=pid).orden_trabajo.id
    return orden_id


def test_marcar_conjunto_separado_queda_en_la_orden():
    orden_id = _crear_orden()
    svc = OrdenTrabajoServices()
    with db_session:
        assert OrdenTrabajo[orden_id].conjunto_separado is False

    out = svc.marcar_conjunto_separado(orden_id)
    assert out["success"] is True
    assert out["data"]["conjunto_separado"] is True

    with db_session:
        assert OrdenTrabajo[orden_id].conjunto_separado is True

    otra = svc.marcar_conjunto_separado(orden_id)
    assert otra["data"]["conjunto_separado"] is True


def test_no_marca_separado_una_orden_cancelada():
    orden_id = _crear_orden()
    with db_session:
        OrdenTrabajo[orden_id].estado = "cancelada"
    with pytest.raises(HTTPException) as exc:
        OrdenTrabajoServices().marcar_conjunto_separado(orden_id)
    assert exc.value.status_code == 400
