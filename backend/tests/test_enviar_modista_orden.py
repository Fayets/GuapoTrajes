"""Enviar a modista desde orden con datos de cliente/retiro/notas."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session, flush

from src.models import EstadoProducto, Modista, Presupuesto, Producto, ProductoModista
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from tests.factories import fake_current_user, seed_base_world


@pytest.fixture
def orden_con_modista_marcada():
    w = seed_base_world()
    R = date(2033, 5, 10)
    cu = fake_current_user(w.usuario.id)
    out = PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=R + timedelta(days=5),
            fecha_retiro=R,
            fecha_devolucion=R + timedelta(days=7),
            categoria_evento="Test",
            nombre_agasajado="Y",
            lugar_evento="Z",
            observaciones="",
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
        m = Modista(nombre="Modista Test Env", direccion="X", telefono="1")
        flush()
        mid = m.id
    svc.actualizar_modista_producto_reservado(
        oid, w.producto_a.id, True, "Achicar mangas"
    )
    return type(
        "X",
        (),
        {
            "orden_id": oid,
            "producto_id": w.producto_a.id,
            "modista_id": mid,
            "usuario_id": w.usuario.id,
            "cliente_nombre": f"{w.cliente.apellido} {w.cliente.nombre}".strip()
            if False
            else None,
            "world": w,
        },
    )()


def test_enviar_modista_requiere_marcado(orden_con_modista_marcada):
    x = orden_con_modista_marcada
    svc = OrdenTrabajoServices()
    svc.actualizar_modista_producto_reservado(x.orden_id, x.producto_id, False, None)
    with pytest.raises(HTTPException) as ei:
        svc.enviar_producto_a_modista_desde_orden(
            x.orden_id, x.producto_id, x.modista_id, x.usuario_id
        )
    assert ei.value.status_code == 400


def test_enviar_modista_ok_crea_ingreso(orden_con_modista_marcada):
    x = orden_con_modista_marcada
    svc = OrdenTrabajoServices()
    out = svc.enviar_producto_a_modista_desde_orden(
        x.orden_id, x.producto_id, x.modista_id, x.usuario_id
    )
    assert out["success"] is True
    assert "Retiro:" in (out["data"].get("notas_enviadas") or "")
    assert "Achicar mangas" in (out["data"].get("notas_enviadas") or "")

    with db_session:
        p = Producto.get(id=x.producto_id)
        assert p.estado == EstadoProducto.MODISTA
        abiertos = [pm for pm in list(ProductoModista.select()) if pm.fecha_salida is None and pm.producto.id == x.producto_id]
        assert len(abiertos) == 1
        assert abiertos[0].modista.id == x.modista_id
        assert (abiertos[0].cliente_nombre or "").strip() != ""
