"""Contrato → estado CLIENTE en productos; devolución → SALON y liberación de reserva."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from pony.orm import db_session

from src.models import EstadoProducto, Presupuesto, Producto, ProductoReservado
from src.schemas import ItemPresupuestoIn, PresupuestoCreate
from src.services.orden_trabajo_services import OrdenTrabajoServices
from src.services.presupuestos_services import PresupuestosServices

from tests.factories import fake_current_user, seed_base_world


@pytest.fixture
def orden_pagada_total():
    """Una orden con saldo 0 (seña = total) y un solo producto."""
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    R = date(2031, 3, 10)
    payload = PresupuestoCreate(
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
    )
    out = pres.crear_presupuesto(payload, cu)
    pid = out["data"]["id"]
    ord_svc = OrdenTrabajoServices()
    ord_svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=80.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        p = Presupuesto.get(id=pid)
        o = p.orden_trabajo
        assert o is not None
        oid = o.id
    return type("W", (), {"world": w, "orden_id": oid, "producto_id": w.producto_a.id})()


def test_registrar_contrato_pone_producto_en_cliente(orden_pagada_total):
    x = orden_pagada_total
    svc = OrdenTrabajoServices()
    svc.registrar_contrato_generado(x.orden_id)
    with db_session:
        p = Producto.get(id=x.producto_id)
        assert p.estado == EstadoProducto.CLIENTE


def test_completar_devolucion_salon_libera_reserva(orden_pagada_total):
    x = orden_pagada_total
    svc = OrdenTrabajoServices()
    svc.registrar_contrato_generado(x.orden_id)
    svc.completar_devolucion(
        x.orden_id,
        usuario_id=x.world.usuario.id,
        destino="SALON",
    )
    with db_session:
        p = Producto.get(id=x.producto_id)
        assert p.estado == EstadoProducto.SALON
        n = sum(1 for pr in ProductoReservado.select() if pr.producto.id == x.producto_id)
        assert n == 0


@pytest.fixture
def orden_dos_productos():
    w = seed_base_world()
    pres = PresupuestosServices()
    cu = fake_current_user(w.usuario.id)
    R = date(2031, 4, 1)
    payload = PresupuestoCreate(
        cliente_id=w.cliente.id,
        fecha_evento=R + timedelta(days=4),
        fecha_retiro=R,
        fecha_devolucion=R + timedelta(days=10),
        categoria_evento="Test",
        nombre_agasajado="Z",
        lugar_evento="L",
        observaciones="",
        items=[
            ItemPresupuestoIn(
                producto_id=w.producto_a.id,
                cantidad=1,
                precio_unitario=50.0,
                subtotal=50.0,
            ),
            ItemPresupuestoIn(
                producto_id=w.producto_b.id,
                cantidad=1,
                precio_unitario=50.0,
                subtotal=50.0,
            ),
        ],
    )
    out = pres.crear_presupuesto(payload, cu)
    pid = out["data"]["id"]
    ord_svc = OrdenTrabajoServices()
    ord_svc.crear_orden_trabajo(
        presupuesto_id=pid,
        seña_pagada=100.0,
        payment_method="EFECTIVO",
        usuario_id=w.usuario.id,
        cuenta_destino_id=w.cuenta_destino.id,
    )
    with db_session:
        pr = Presupuesto.get(id=pid)
        oid = pr.orden_trabajo.id
    return type(
        "W2",
        (),
        {
            "world": w,
            "orden_id": oid,
            "id_a": w.producto_a.id,
            "id_b": w.producto_b.id,
        },
    )()


def test_devolucion_parcial_solo_un_producto(orden_dos_productos):
    x = orden_dos_productos
    svc = OrdenTrabajoServices()
    svc.registrar_contrato_generado(x.orden_id)
    svc.registrar_devolucion_parcial(
        x.orden_id,
        productos_ids=[x.id_a],
        descripcion="Dev test",
        usuario_id=x.world.usuario.id,
        destino="SALON",
    )
    with db_session:
        pa = Producto.get(id=x.id_a)
        pb = Producto.get(id=x.id_b)
        assert pa.estado == EstadoProducto.SALON
        assert pb.estado == EstadoProducto.CLIENTE
        assert sum(1 for pr in ProductoReservado.select() if pr.producto.id == x.id_a) == 0
        assert sum(1 for pr in ProductoReservado.select() if pr.producto.id == x.id_b) == 1
