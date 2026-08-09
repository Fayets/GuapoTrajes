"""Observaciones del presupuesto visibles en orden y reporte prendas a armar."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from pony.orm import db_session, flush

from src.models import Modista, Presupuesto
from src.presupuesto_observaciones import observaciones_presupuesto_para_mostrar
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from src.services.reportes_services import ReportesServices
from tests.factories import fake_current_user, seed_base_world


def test_observaciones_presupuesto_excluye_aviso_interno():
    interno = "Conjuntos ya armados para esta fecha: algo"
    assert observaciones_presupuesto_para_mostrar(interno) == ""
    assert observaciones_presupuesto_para_mostrar("  Achicar pantalón 2 cm  ") == "Achicar pantalón 2 cm"


@pytest.fixture
def orden_con_observaciones_modista():
    w = seed_base_world()
    R = date(2035, 3, 20)
    cu = fake_current_user(w.usuario.id)
    notas = "Talle pecho 98 · largo pantalón 105 · subir cintura"
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=5),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="Casamiento",
            nombre_agasajado="Test",
            lugar_evento="Salón",
            observaciones=notas,
            items=[
                ItemPresupuestoIn(
                    producto_id=w.producto_a.id,
                    cantidad=1,
                    precio_unitario=80.0,
                    subtotal=80.0,
                ),
            ],
        ),
        cu,
    )
    pid = out["data"]["id"]
    svc = OrdenTrabajoServices()
    svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=80.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        oid = Presupuesto.get(id=pid).orden_trabajo.id
    return type(
        "X",
        (),
        {
            "orden_id": oid,
            "presupuesto_id": pid,
            "notas": notas,
            "fecha_evento": R + timedelta(days=5),
            "world": w,
        },
    )()


def test_orden_api_incluye_observaciones_presupuesto(orden_con_observaciones_modista):
    x = orden_con_observaciones_modista
    svc = OrdenTrabajoServices()
    orden = svc.obtener_orden_por_id(x.orden_id)
    assert orden["observaciones"] == x.notas


def test_prendas_a_armar_incluye_observaciones_y_arreglos(orden_con_observaciones_modista):
    x = orden_con_observaciones_modista
    rep = ReportesServices()
    desde = x.fecha_evento - timedelta(days=1)
    hasta = x.fecha_evento + timedelta(days=1)
    filas = rep.obtener_prendas_a_armar(desde, hasta)
    match = [f for f in filas if f["orden_id"] == x.orden_id]
    assert len(match) == 1
    fila = match[0]
    assert fila["observaciones"] == x.notas
    assert fila["tiene_arreglos"] is True
    assert len(fila["productos"]) >= 1
    assert fila["productos"][0]["arreglos"] == x.notas
