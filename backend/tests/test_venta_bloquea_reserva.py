"""Una orden activa con seña impide vender la prenda, aunque el evento sea lejano."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pony.orm import db_session

from src.models import EstadoProducto, Producto
from src.schemas import ItemPresupuestoIn, PresupuestoCreate, VentaCreate, VentaDetalleCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices
from src.services.ventas_services import VentasServices
from tests.factories import fake_current_user, seed_base_world


def _presupuesto_y_orden(world, producto_id, retiro: date):
    pres = PresupuestosServices()
    cu = fake_current_user(world.usuario.id)
    out = pres.crear_presupuesto(
        PresupuestoCreate(
            cliente_id=world.cliente.id,
            fecha_evento=retiro + timedelta(days=5),
            fecha_retiro=retiro,
            fecha_devolucion=retiro + timedelta(days=7),
            categoria_evento="Test",
            nombre_agasajado="Y",
            lugar_evento="Z",
            observaciones="",
            items=[
                ItemPresupuestoIn(
                    producto_id=producto_id,
                    cantidad=1,
                    precio_unitario=80.0,
                    subtotal=80.0,
                ),
            ],
        ),
        cu,
    )
    pid = out["data"]["id"]
    OrdenTrabajoServices().crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=80.0,
        payment_method="EFECTIVO",
        usuario_id=world.usuario.id,
        cuenta_destino_id=world.cuenta_destino.id,
    )
    return pid


def _venta_payload(world, producto_id):
    return VentaCreate(
        cliente_id=world.cliente.id,
        sucursal_id=world.sucursal.id,
        tipo_precio="Lista",
        payment_method="EFECTIVO",
        productos=[VentaDetalleCreate(producto_id=producto_id, cantidad=1)],
        cuenta_destino_id=world.cuenta_destino.id,
    )


def test_venta_bloqueada_con_orden_activa_futuro_lejano():
    w = seed_base_world()
    _presupuesto_y_orden(w, w.producto_a.id, date(2040, 1, 15))
    svc = VentasServices()
    with pytest.raises(HTTPException) as ei:
        svc.create_venta(_venta_payload(w, w.producto_a.id), fake_current_user(w.usuario.id))
    assert ei.value.status_code == 400
    assert "reservado" in str(ei.value.detail).lower()
    with db_session:
        assert Producto[w.producto_a.id].estado == EstadoProducto.SALON


def test_venta_ok_sin_orden():
    w = seed_base_world()
    svc = VentasServices()
    out = svc.create_venta(_venta_payload(w, w.producto_a.id), fake_current_user(w.usuario.id))
    assert out["id"]
    with db_session:
        assert Producto[w.producto_a.id].estado == EstadoProducto.VENDIDO


def test_venta_ok_si_solo_presupuesto_pendiente():
    w = seed_base_world()
    PresupuestosServices().crear_presupuesto(
        PresupuestoCreate(
            cliente_id=w.cliente.id,
            fecha_evento=date(2040, 2, 1),
            fecha_retiro=date(2040, 1, 20),
            fecha_devolucion=date(2040, 2, 5),
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
        fake_current_user(w.usuario.id),
    )
    svc = VentasServices()
    out = svc.create_venta(_venta_payload(w, w.producto_a.id), fake_current_user(w.usuario.id))
    assert out["id"]


def test_venta_ok_si_orden_cancelada():
    w = seed_base_world()
    pid = _presupuesto_y_orden(w, w.producto_a.id, date(2040, 3, 10))
    with db_session:
        pr = __import__("src.models", fromlist=["Presupuesto"]).Presupuesto.get(id=pid)
        orden = pr.orden_trabajo
        orden.estado = "Cancelada"
    svc = VentasServices()
    out = svc.create_venta(_venta_payload(w, w.producto_a.id), fake_current_user(w.usuario.id))
    assert out["id"]
    with db_session:
        assert Producto[w.producto_a.id].estado == EstadoProducto.VENDIDO


def test_venta_ok_si_orden_completada_sin_reserva():
    w = seed_base_world()
    pid = _presupuesto_y_orden(w, w.producto_a.id, date(2031, 5, 1))
    with db_session:
        from src.models import Presupuesto

        oid = Presupuesto.get(id=pid).orden_trabajo.id
    OrdenTrabajoServices().completar_devolucion(
        oid, usuario_id=w.usuario.id, destino="SALON"
    )
    svc = VentasServices()
    out = svc.create_venta(_venta_payload(w, w.producto_a.id), fake_current_user(w.usuario.id))
    assert out["id"]
